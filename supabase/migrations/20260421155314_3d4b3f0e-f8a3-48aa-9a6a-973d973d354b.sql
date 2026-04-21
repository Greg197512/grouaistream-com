-- ============================================================
-- ETAP 2: Zewnętrzne zmysły Mózgu — newsfeed infrastructure
-- ============================================================

-- 1) Tabela źródeł zewnętrznych (admin może dodawać/wyłączać)
CREATE TABLE IF NOT EXISTS public.brain_external_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source_type text NOT NULL, -- 'rss' | 'reddit_json' | 'hackernews' | 'producthunt'
  url text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  filter_keywords text[] DEFAULT NULL, -- opcjonalny whitelist
  last_fetched_at timestamptz,
  last_status text,
  last_error text,
  items_ingested_total integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brain_external_sources_enabled
  ON public.brain_external_sources(enabled, source_type);

ALTER TABLE public.brain_external_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage external sources"
ON public.brain_external_sources
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_brain_external_sources_updated_at
BEFORE UPDATE ON public.brain_external_sources
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Deduplikacja (URL hash → unikamy zapisywania tego samego newsa wielokrotnie)
CREATE TABLE IF NOT EXISTS public.brain_ingest_dedup (
  url_hash text PRIMARY KEY,
  source_name text,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX IF NOT EXISTS idx_brain_ingest_dedup_expires
  ON public.brain_ingest_dedup(expires_at);

ALTER TABLE public.brain_ingest_dedup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view ingest dedup"
ON public.brain_ingest_dedup
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3) Funkcja czyszcząca stare wpisy dedup
CREATE OR REPLACE FUNCTION public.cleanup_brain_ingest_dedup()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _deleted integer;
BEGIN
  DELETE FROM public.brain_ingest_dedup WHERE expires_at < now();
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RETURN _deleted;
END;
$$;

-- 4) Seed domyślnych źródeł (idempotentnie)
INSERT INTO public.brain_external_sources (name, source_type, url, filter_keywords) VALUES
  ('Pitchfork — News',           'rss',          'https://pitchfork.com/rss/news/',                                NULL),
  ('Pitchfork — Best New Music', 'rss',          'https://pitchfork.com/rss/reviews/best/albums/',                 NULL),
  ('Resident Advisor — News',    'rss',          'https://ra.co/xml/rss-news.xml',                                 NULL),
  ('Mixmag',                     'rss',          'https://mixmag.net/rss.xml',                                     NULL),
  ('Reddit — r/Music (top day)', 'reddit_json',  'https://www.reddit.com/r/Music/top.json?t=day&limit=15',         NULL),
  ('Reddit — r/edmproduction',   'reddit_json',  'https://www.reddit.com/r/edmproduction/top.json?t=day&limit=10', NULL),
  ('Reddit — r/listentothis',    'reddit_json',  'https://www.reddit.com/r/listentothis/top.json?t=day&limit=15',  NULL),
  ('HackerNews — Top',           'hackernews',   'https://hacker-news.firebaseio.com/v0/topstories.json',          ARRAY['music','audio','sound','dj','spotify','suno','elevenlabs','generative','ai music'])
ON CONFLICT DO NOTHING;

-- 5) Rejestr agenta newsfeed
INSERT INTO public.agent_registry (name, description, enabled, cron_schedule) VALUES
  ('newsfeed-listener', 'Pobiera świeże dane z RSS/Reddit/HN co 1h, embedduje i zapisuje do brain_memory.', true, '0 * * * *')
ON CONFLICT (name) DO NOTHING;