-- Aurora Workforce: pracownicy (workflow=pracownik), rangi, scope, kolejka zadań
-- Domains: aurora.*, stream.moderation.*, stream.marketing.*, stream.support.*

-- 1) Rangi definiowane przez Aurorę (custom)
CREATE TABLE IF NOT EXISTS public.aurora_worker_ranks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,                -- np. 'trainee', 'lead-seo'
  name text NOT NULL,
  level int NOT NULL DEFAULT 1,             -- 1..100, wyższy = większe uprawnienia
  description text,
  max_concurrent_jobs int NOT NULL DEFAULT 1,
  can_delegate boolean NOT NULL DEFAULT false,
  color_hex text DEFAULT '#f59e0b',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.aurora_worker_ranks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin manage ranks" ON public.aurora_worker_ranks;
CREATE POLICY "admin manage ranks" ON public.aurora_worker_ranks
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) Pracownicy = mapowanie do workflow n8n
CREATE TABLE IF NOT EXISTS public.aurora_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_db_id uuid REFERENCES public.aurora_n8n_workflows(id) ON DELETE CASCADE,
  workflow_id text NOT NULL,                -- n8n workflow id
  display_name text NOT NULL,
  rank_id uuid REFERENCES public.aurora_worker_ranks(id) ON DELETE SET NULL,
  domain text NOT NULL,                     -- 'aurora' | 'stream.moderation' | 'stream.marketing' | 'stream.support'
  scopes text[] NOT NULL DEFAULT '{}',      -- np. ['stream.moderation.upload','stream.moderation.cover']
  status text NOT NULL DEFAULT 'active',    -- active|paused|training|fired
  is_busy boolean NOT NULL DEFAULT false,
  current_jobs int NOT NULL DEFAULT 0,
  total_completed int NOT NULL DEFAULT 0,
  total_failed int NOT NULL DEFAULT 0,
  last_assigned_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workflow_id)
);
ALTER TABLE public.aurora_workers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin manage workers" ON public.aurora_workers;
CREATE POLICY "admin manage workers" ON public.aurora_workers
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_workers_domain ON public.aurora_workers(domain) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_workers_scopes ON public.aurora_workers USING gin(scopes);

-- 3) Kolejka zadań (anty-kolizja: routing po scope + lock per zadanie)
CREATE TABLE IF NOT EXISTS public.aurora_workforce_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL,                      -- np. 'stream.moderation.upload'
  domain text NOT NULL,                     -- ekstrahowane z scope (pierwszy segment lub 2 segmenty)
  payload jsonb NOT NULL DEFAULT '{}',
  priority int NOT NULL DEFAULT 100,        -- niższy = ważniejszy
  status text NOT NULL DEFAULT 'pending',   -- pending|locked|running|done|failed|cancelled
  locked_by uuid REFERENCES public.aurora_workers(id) ON DELETE SET NULL,
  locked_at timestamptz,
  lock_expires_at timestamptz,
  run_id uuid REFERENCES public.aurora_n8n_runs(id) ON DELETE SET NULL,
  result jsonb,
  error_message text,
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 3,
  requested_by uuid,                        -- user_id (admin/system)
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);
ALTER TABLE public.aurora_workforce_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin manage jobs" ON public.aurora_workforce_jobs;
CREATE POLICY "admin manage jobs" ON public.aurora_workforce_jobs
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_jobs_pending ON public.aurora_workforce_jobs(status, priority, created_at)
  WHERE status IN ('pending','locked');
CREATE INDEX IF NOT EXISTS idx_jobs_scope ON public.aurora_workforce_jobs(scope);

-- 4) Trigger updated_at na workers
DROP TRIGGER IF EXISTS trg_workers_touch ON public.aurora_workers;
CREATE TRIGGER trg_workers_touch BEFORE UPDATE ON public.aurora_workers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5) Seed domyślnych rang (custom — Aurora może je później zmieniać/dodawać)
INSERT INTO public.aurora_worker_ranks (code, name, level, max_concurrent_jobs, can_delegate, color_hex, description) VALUES
  ('trainee',   'Stażysta',         10, 1, false, '#94a3b8', 'Uczy się — bierze proste zadania'),
  ('specialist','Specjalista',      30, 2, false, '#0ea5e9', 'Standardowe zadania w swojej domenie'),
  ('senior',    'Senior',           60, 3, false, '#f59e0b', 'Złożone zadania, wysoka jakość'),
  ('manager',   'Manager',          80, 4, true,  '#ef4444', 'Może delegować zadania innym pracownikom'),
  ('director',  'Dyrektor domeny',  95, 6, true,  '#a855f7', 'Pełna kontrola nad domeną')
ON CONFLICT (code) DO NOTHING;

-- 6) RPC: zgłoszenie zadania do kolejki
CREATE OR REPLACE FUNCTION public.aurora_workforce_enqueue(
  _scope text, _payload jsonb DEFAULT '{}', _priority int DEFAULT 100, _max_attempts int DEFAULT 3
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _id uuid; _domain text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  -- domena = pierwsze 2 segmenty jeśli zaczyna się od 'stream.', inaczej pierwszy
  _domain := CASE
    WHEN _scope LIKE 'stream.%' THEN split_part(_scope,'.',1)||'.'||split_part(_scope,'.',2)
    ELSE split_part(_scope,'.',1)
  END;
  INSERT INTO public.aurora_workforce_jobs(scope, domain, payload, priority, max_attempts, requested_by)
  VALUES (_scope, _domain, COALESCE(_payload,'{}'::jsonb), _priority, _max_attempts, auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END $$;

-- 7) RPC: claim — wybiera najlepszego wolnego pracownika dla najstarszego pasującego zadania
-- Routing: domain match + scope w workers.scopes (lub workers ma '*'); Lock: SKIP LOCKED + lock_expires_at
CREATE OR REPLACE FUNCTION public.aurora_workforce_claim_job(_lock_seconds int DEFAULT 300)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _job record; _worker record; _rank record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Najpierw zwolnij zadania z wygasłym lockiem
  UPDATE public.aurora_workforce_jobs
  SET status='pending', locked_by=NULL, locked_at=NULL, lock_expires_at=NULL
  WHERE status='locked' AND lock_expires_at < now();

  FOR _job IN
    SELECT * FROM public.aurora_workforce_jobs
    WHERE status='pending' AND attempts < max_attempts
    ORDER BY priority ASC, created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 20
  LOOP
    -- Znajdź najlepszego pracownika: tej domeny, scope match, niezajętego ponad limit, najwyższy rank
    SELECT w.*, r.max_concurrent_jobs AS rank_max, r.level AS rank_level
    INTO _worker
    FROM public.aurora_workers w
    LEFT JOIN public.aurora_worker_ranks r ON r.id = w.rank_id
    WHERE w.status='active'
      AND w.domain = _job.domain
      AND (_job.scope = ANY(w.scopes) OR '*' = ANY(w.scopes) OR (w.domain||'.*') = ANY(w.scopes))
      AND w.current_jobs < COALESCE(r.max_concurrent_jobs, 1)
    ORDER BY COALESCE(r.level,0) DESC, w.current_jobs ASC, w.last_assigned_at ASC NULLS FIRST
    LIMIT 1;

    IF _worker.id IS NOT NULL THEN
      UPDATE public.aurora_workforce_jobs
      SET status='locked', locked_by=_worker.id, locked_at=now(),
          lock_expires_at=now() + (_lock_seconds || ' seconds')::interval,
          attempts = attempts + 1
      WHERE id = _job.id;

      UPDATE public.aurora_workers
      SET current_jobs = current_jobs + 1, is_busy = true, last_assigned_at = now()
      WHERE id = _worker.id;

      RETURN jsonb_build_object(
        'job_id', _job.id, 'scope', _job.scope, 'payload', _job.payload,
        'worker_id', _worker.id, 'workflow_id', _worker.workflow_id,
        'worker_name', _worker.display_name
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object('job_id', null, 'message', 'no_match');
END $$;

-- 8) RPC: oznaczenie wykonania (success/fail) — zwalnia worka i zamyka job
CREATE OR REPLACE FUNCTION public.aurora_workforce_complete_job(
  _job_id uuid, _success boolean, _result jsonb DEFAULT '{}', _error text DEFAULT NULL, _run_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _job record; _worker_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  SELECT * INTO _job FROM public.aurora_workforce_jobs WHERE id=_job_id;
  IF _job.id IS NULL THEN RETURN jsonb_build_object('error','not_found'); END IF;
  _worker_id := _job.locked_by;

  UPDATE public.aurora_workforce_jobs
  SET status = CASE WHEN _success THEN 'done'
                    WHEN _job.attempts >= _job.max_attempts THEN 'failed'
                    ELSE 'pending' END,
      result = COALESCE(_result,'{}'::jsonb),
      error_message = _error,
      run_id = COALESCE(_run_id, run_id),
      finished_at = CASE WHEN _success OR _job.attempts >= _job.max_attempts THEN now() ELSE finished_at END,
      locked_by = CASE WHEN _success THEN locked_by ELSE NULL END,
      lock_expires_at = NULL
  WHERE id = _job_id;

  IF _worker_id IS NOT NULL THEN
    UPDATE public.aurora_workers
    SET current_jobs = GREATEST(0, current_jobs - 1),
        is_busy = (current_jobs - 1) > 0,
        total_completed = total_completed + CASE WHEN _success THEN 1 ELSE 0 END,
        total_failed    = total_failed    + CASE WHEN _success THEN 0 ELSE 1 END
    WHERE id = _worker_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END $$;

-- 9) Widok: szybki przegląd workforce
CREATE OR REPLACE VIEW public.aurora_workforce_overview AS
SELECT
  w.id, w.display_name, w.domain, w.scopes, w.status, w.is_busy, w.current_jobs,
  w.total_completed, w.total_failed, w.workflow_id,
  r.code AS rank_code, r.name AS rank_name, r.level AS rank_level,
  r.max_concurrent_jobs, r.color_hex,
  (SELECT count(*) FROM public.aurora_workforce_jobs j
    WHERE j.locked_by = w.id AND j.status IN ('locked','running')) AS active_jobs
FROM public.aurora_workers w
LEFT JOIN public.aurora_worker_ranks r ON r.id = w.rank_id;
