-- ============================================================
-- ETAP 1: FUNDAMENT EKOSYSTEMU MÓZGU GROUAI
-- ============================================================

-- Upewnij się że pgvector jest dostępny (powinien już być)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ------------------------------------------------------------
-- 1) AGENT_EVENTS — centralny event bus
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_type TEXT NOT NULL,
  source TEXT NOT NULL,
  actor_user_id UUID,
  target_type TEXT,
  target_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_by_brain BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  priority INTEGER NOT NULL DEFAULT 5
);

CREATE INDEX IF NOT EXISTS idx_agent_events_unprocessed
  ON public.agent_events (processed_by_brain, priority, created_at)
  WHERE processed_by_brain = false;
CREATE INDEX IF NOT EXISTS idx_agent_events_type_time
  ON public.agent_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_events_actor
  ON public.agent_events (actor_user_id, created_at DESC);

ALTER TABLE public.agent_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read agent_events"
  ON public.agent_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- INSERT odbywa się przez funkcję SECURITY DEFINER (emit_agent_event) — brak polityki INSERT z RLS

-- ------------------------------------------------------------
-- 2) BRAIN_MEMORY — pamięć długoterminowa Mózgu
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.brain_memory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  memory_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  embedding vector(768),
  importance INTEGER NOT NULL DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
  source_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_brain_memory_type_importance
  ON public.brain_memory (memory_type, importance DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_brain_memory_expires
  ON public.brain_memory (expires_at)
  WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_brain_memory_embedding
  ON public.brain_memory
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

ALTER TABLE public.brain_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read brain_memory"
  ON public.brain_memory FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert brain_memory"
  ON public.brain_memory FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update brain_memory"
  ON public.brain_memory FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete brain_memory"
  ON public.brain_memory FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ------------------------------------------------------------
-- 3) AGENT_DECISIONS — log decyzji Mózgu i agentów
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_decisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  agent_name TEXT NOT NULL,
  decision_type TEXT NOT NULL,
  reasoning TEXT,
  action_taken JSONB NOT NULL DEFAULT '{}'::jsonb,
  event_ids UUID[] DEFAULT '{}',
  executed BOOLEAN NOT NULL DEFAULT false,
  executed_at TIMESTAMPTZ,
  rejected BOOLEAN NOT NULL DEFAULT false,
  rejected_at TIMESTAMPTZ,
  rejected_by UUID
);

CREATE INDEX IF NOT EXISTS idx_agent_decisions_pending
  ON public.agent_decisions (created_at DESC)
  WHERE executed = false AND rejected = false;
CREATE INDEX IF NOT EXISTS idx_agent_decisions_agent
  ON public.agent_decisions (agent_name, created_at DESC);

ALTER TABLE public.agent_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read agent_decisions"
  ON public.agent_decisions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update agent_decisions"
  ON public.agent_decisions FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ------------------------------------------------------------
-- 4) AGENT_REGISTRY — manifest agentów
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_registry (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  cron_schedule TEXT,
  last_run_at TIMESTAMPTZ,
  last_status TEXT,
  last_error TEXT,
  success_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read agent_registry"
  ON public.agent_registry FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update agent_registry"
  ON public.agent_registry FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert agent_registry"
  ON public.agent_registry FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger updated_at
CREATE TRIGGER trg_agent_registry_updated_at
  BEFORE UPDATE ON public.agent_registry
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed: zarejestruj Mózg
INSERT INTO public.agent_registry (name, description, enabled, cron_schedule)
VALUES
  ('grouai-brain', 'Centralny mózg platformy — analizuje eventy, zapisuje wspomnienia, deleguje agentów', true, '*/5 * * * *'),
  ('newsfeed-listener', 'Pobiera RSS/Reddit/HN i karmi pamięć Mózgu (etap 2)', false, '0 * * * *'),
  ('a-r-scout', 'Skanuje świeżą muzykę pasującą do gustu platformy (etap 2)', false, '0 6 * * *'),
  ('health-monitor', 'Pinguje edge functions, alertuje o awariach (etap 3)', false, '*/5 * * * *'),
  ('revenue-optimizer', 'Analizuje przychody, wykrywa anomalie, sugeruje wyzwania (etap 3)', false, '0 8 * * *')
ON CONFLICT (name) DO NOTHING;

-- ------------------------------------------------------------
-- 5) HELPER FUNCTION: emit_agent_event
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.emit_agent_event(
  _event_type TEXT,
  _source TEXT,
  _actor_user_id UUID DEFAULT NULL,
  _target_type TEXT DEFAULT NULL,
  _target_id UUID DEFAULT NULL,
  _payload JSONB DEFAULT '{}'::jsonb,
  _priority INTEGER DEFAULT 5
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _event_id UUID;
BEGIN
  INSERT INTO public.agent_events (
    event_type, source, actor_user_id, target_type, target_id, payload, priority
  ) VALUES (
    _event_type, _source, _actor_user_id, _target_type, _target_id, _payload, _priority
  )
  RETURNING id INTO _event_id;

  RETURN _event_id;
END;
$$;

-- ------------------------------------------------------------
-- 6) SEMANTIC SEARCH: search_brain_memory
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_brain_memory(
  _query_embedding vector(768),
  _match_count INTEGER DEFAULT 10,
  _memory_types TEXT[] DEFAULT NULL,
  _min_importance INTEGER DEFAULT 1
)
RETURNS TABLE (
  id UUID,
  memory_type TEXT,
  title TEXT,
  content TEXT,
  summary TEXT,
  importance INTEGER,
  source_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bm.id,
    bm.memory_type,
    bm.title,
    bm.content,
    bm.summary,
    bm.importance,
    bm.source_url,
    bm.metadata,
    bm.created_at,
    1 - (bm.embedding <=> _query_embedding) AS similarity
  FROM public.brain_memory bm
  WHERE bm.embedding IS NOT NULL
    AND bm.importance >= _min_importance
    AND (bm.expires_at IS NULL OR bm.expires_at > now())
    AND (_memory_types IS NULL OR bm.memory_type = ANY(_memory_types))
  ORDER BY bm.embedding <=> _query_embedding ASC
  LIMIT _match_count;
END;
$$;

-- ------------------------------------------------------------
-- 7) CLEANUP: usuwa wygasłe wspomnienia (uruchamiane przez cron)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_expired_brain_memory()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deleted INTEGER;
BEGIN
  DELETE FROM public.brain_memory
  WHERE expires_at IS NOT NULL AND expires_at < now();
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RETURN _deleted;
END;
$$;

-- ------------------------------------------------------------
-- 8) CRON: Mózg myśli co 5 minut
-- ------------------------------------------------------------
SELECT cron.unschedule('grouai-brain-tick') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'grouai-brain-tick'
);

SELECT cron.schedule(
  'grouai-brain-tick',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://bvstvawnigyczvofzhps.supabase.co/functions/v1/grouai-brain',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2c3R2YXduaWd5Y3p2b2Z6aHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NDEwMzEsImV4cCI6MjA4NDMxNzAzMX0.Mp6lpKIcFGsduODIwm1V7FcRQmaN5DtPM5aaqj9i_Xw'
    ),
    body := jsonb_build_object('source', 'cron', 'tick', extract(epoch from now()))
  ) AS request_id;
  $cron$
);

-- Cleanup expired memory raz dziennie
SELECT cron.unschedule('brain-memory-cleanup') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'brain-memory-cleanup'
);

SELECT cron.schedule(
  'brain-memory-cleanup',
  '0 3 * * *',
  $cron$ SELECT public.cleanup_expired_brain_memory(); $cron$
);