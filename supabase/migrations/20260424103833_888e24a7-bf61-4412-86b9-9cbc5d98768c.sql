
-- Aurora ↔ n8n: logi wykonań, kroki, błędy, podsumowanie per nisza

-- 1) Tabela uruchomień n8n
CREATE TABLE IF NOT EXISTS public.aurora_n8n_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_db_id uuid REFERENCES public.aurora_n8n_workflows(id) ON DELETE SET NULL,
  workflow_id text NOT NULL,
  execution_id text,
  order_id uuid REFERENCES public.aurora_business_orders(id) ON DELETE SET NULL,
  niche_id uuid REFERENCES public.aurora_niches(id) ON DELETE SET NULL,
  trigger_source text NOT NULL DEFAULT 'aurora',  -- aurora | manual | webhook | cron
  status text NOT NULL DEFAULT 'running',          -- running | success | failed | partial
  input_payload jsonb DEFAULT '{}'::jsonb,
  output_payload jsonb DEFAULT '{}'::jsonb,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms int
);
ALTER TABLE public.aurora_n8n_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read runs" ON public.aurora_n8n_runs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "service write runs" ON public.aurora_n8n_runs
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_n8n_runs_workflow ON public.aurora_n8n_runs(workflow_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_n8n_runs_niche ON public.aurora_n8n_runs(niche_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_n8n_runs_status ON public.aurora_n8n_runs(status, started_at DESC);

-- 2) Kroki w ramach uruchomienia (per node n8n)
CREATE TABLE IF NOT EXISTS public.aurora_n8n_run_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.aurora_n8n_runs(id) ON DELETE CASCADE,
  step_index int NOT NULL DEFAULT 0,
  node_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',  -- pending | success | failed | skipped
  message text,
  data jsonb DEFAULT '{}'::jsonb,
  duration_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.aurora_n8n_run_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read steps" ON public.aurora_n8n_run_steps
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "service write steps" ON public.aurora_n8n_run_steps
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_n8n_steps_run ON public.aurora_n8n_run_steps(run_id, step_index);

-- 3) View: podsumowanie SEO/efektów n8n per nisza (ostatnie 30 dni)
CREATE OR REPLACE VIEW public.aurora_niche_n8n_summary AS
SELECT
  n.id AS niche_id,
  n.niche_name,
  n.status AS niche_status,
  COUNT(r.id) FILTER (WHERE r.started_at > now() - interval '30 days') AS runs_30d,
  COUNT(r.id) FILTER (WHERE r.status = 'success' AND r.started_at > now() - interval '30 days') AS success_30d,
  COUNT(r.id) FILTER (WHERE r.status = 'failed' AND r.started_at > now() - interval '30 days') AS failed_30d,
  AVG(r.duration_ms) FILTER (WHERE r.status = 'success' AND r.started_at > now() - interval '30 days') AS avg_duration_ms,
  MAX(r.started_at) AS last_run_at,
  COALESCE(SUM((r.output_payload->>'seo_pages_generated')::int), 0) AS seo_pages_generated,
  COALESCE(SUM((r.output_payload->>'backlinks_created')::int), 0) AS backlinks_created,
  COALESCE(SUM((r.output_payload->>'leads_captured')::int), 0) AS leads_captured
FROM public.aurora_niches n
LEFT JOIN public.aurora_n8n_runs r ON r.niche_id = n.id
GROUP BY n.id, n.niche_name, n.status;

-- 4) RPC: bump statystyk workflow po zakończeniu runu (idempotentne)
CREATE OR REPLACE FUNCTION public.aurora_n8n_run_finalize(_run_id uuid, _status text, _output jsonb DEFAULT '{}'::jsonb, _error text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _run record;
  _ms int;
BEGIN
  SELECT * INTO _run FROM public.aurora_n8n_runs WHERE id = _run_id;
  IF _run.id IS NULL THEN RETURN jsonb_build_object('error','run_not_found'); END IF;
  _ms := GREATEST(0, EXTRACT(EPOCH FROM (now() - _run.started_at))::int * 1000);

  UPDATE public.aurora_n8n_runs
  SET status = _status,
      output_payload = COALESCE(_output, '{}'::jsonb),
      error_message = _error,
      finished_at = now(),
      duration_ms = _ms
  WHERE id = _run_id;

  UPDATE public.aurora_n8n_workflows
  SET total_runs = total_runs + 1,
      total_success = total_success + CASE WHEN _status = 'success' THEN 1 ELSE 0 END,
      total_failed  = total_failed + CASE WHEN _status = 'failed' THEN 1 ELSE 0 END,
      last_execution_at = now(),
      last_status = _status
  WHERE workflow_id = _run.workflow_id;

  RETURN jsonb_build_object('ok', true, 'duration_ms', _ms);
END $$;
