-- ============================================================
-- GROUAI HUB — setup (projekt bmwtydwpevzhbdplilbr / raport-nl-pl)
-- Zastępuje n8n: tabele robocze + harmonogram pg_cron.
-- Funkcje edge: aurora-worker, social-distribution, newsfeed-fetcher,
--               radio-autopilot, hub-status (verify_jwt = false).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Konfiguracja (odczyt wyłącznie przez service_role — RLS bez polityk)
CREATE TABLE IF NOT EXISTS public.hub_config (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hub_config ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.hub_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ts timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  data jsonb
);
ALTER TABLE public.hub_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_hub_log_ts ON public.hub_log (ts DESC);

CREATE TABLE IF NOT EXISTS public.hub_news_seen (
  url_hash text PRIMARY KEY,
  source text,
  ts timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hub_news_seen ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.hub_news_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ts timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  url text NOT NULL,
  source text NOT NULL,
  summary text
);
ALTER TABLE public.hub_news_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_hub_news_items_ts ON public.hub_news_items (ts DESC);

CREATE TABLE IF NOT EXISTS public.hub_social_queue (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  marketing_post_id text,
  title text,
  url text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued', -- queued | publishing | published | failed
  result jsonb,
  published_at timestamptz
);
ALTER TABLE public.hub_social_queue ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.hub_radio_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ts timestamptz NOT NULL DEFAULT now(),
  ok boolean NOT NULL,
  details jsonb
);
ALTER TABLE public.hub_radio_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_hub_radio_log_ts ON public.hub_radio_log (ts DESC);

CREATE TABLE IF NOT EXISTS public.hub_deliverables (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  order_id text,
  run_id text,
  service_type text,
  brief text,
  deliverable text,
  model text
);
ALTER TABLE public.hub_deliverables ENABLE ROW LEVEL SECURITY;

-- Seed konfiguracji (wartości sekretne uzupełniane osobno)
INSERT INTO public.hub_config (key, value) VALUES
  ('hub_token', ''),
  ('openrouter_api_key', ''),
  ('openrouter_model', 'google/gemini-2.5-flash'),
  ('bvstv_url', 'https://bvstvawnigyczvofzhps.supabase.co'),
  ('bvstv_ingest_token', ''),
  ('telegram_bot_token', ''),
  ('telegram_chat_id', ''),
  ('discord_webhook_url', ''),
  ('radio_info_url', 'https://hkbraboqdsonekzxbntr.supabase.co/functions/v1/radio-stream?f=info')
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------
-- Harmonogram (URL-e funkcji huba; token doklejany w hub_setup_crons)
-- Crony instalowane osobnym blokiem po deployu funkcji.
-- ------------------------------------------------------------
