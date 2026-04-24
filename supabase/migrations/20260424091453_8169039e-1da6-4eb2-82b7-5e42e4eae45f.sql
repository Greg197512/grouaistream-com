
-- ============================================================
-- GROUA SOUL — Aurora's tables
-- ============================================================

-- 1) soul_world_knowledge — metadane z otwartych źródeł sieci
CREATE TABLE public.soul_world_knowledge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_url TEXT,
  title TEXT NOT NULL,
  content TEXT,
  summary TEXT,
  language TEXT DEFAULT 'en',
  sentiment NUMERIC(3,2),
  importance INTEGER DEFAULT 5,
  embedding vector(768),
  metadata JSONB DEFAULT '{}'::jsonb,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_soul_world_knowledge_fetched ON public.soul_world_knowledge (fetched_at DESC);
CREATE INDEX idx_soul_world_knowledge_source ON public.soul_world_knowledge (source);
CREATE INDEX idx_soul_world_knowledge_embed ON public.soul_world_knowledge USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE public.soul_world_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_world_knowledge" ON public.soul_world_knowledge
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));


-- 2) soul_emotions — emocjonalny puls platformy
CREATE TABLE public.soul_emotions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dominant_emotion TEXT NOT NULL,
  emotions JSONB NOT NULL DEFAULT '{}'::jsonb,
  energy NUMERIC(3,2) DEFAULT 0.5,
  tension NUMERIC(3,2) DEFAULT 0.5,
  valence NUMERIC(3,2) DEFAULT 0.5,
  narrative TEXT,
  context JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_soul_emotions_measured ON public.soul_emotions (measured_at DESC);

ALTER TABLE public.soul_emotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_emotions" ON public.soul_emotions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));


-- 3) soul_journal — codzienny dziennik Aurory
CREATE TABLE public.soul_journal (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entry_type TEXT NOT NULL DEFAULT 'daily',
  mood TEXT,
  content TEXT NOT NULL,
  audio_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entry_date, entry_type)
);
CREATE INDEX idx_soul_journal_date ON public.soul_journal (entry_date DESC);

ALTER TABLE public.soul_journal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_journal" ON public.soul_journal
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));


-- 4) soul_dreams — nocne intuicje
CREATE TABLE public.soul_dreams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dream_text TEXT NOT NULL,
  hypothesis TEXT,
  target_type TEXT,
  target_id UUID,
  proposed_action JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewer_user_id UUID,
  reviewed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  dreamed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_soul_dreams_status ON public.soul_dreams (status, dreamed_at DESC);

ALTER TABLE public.soul_dreams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_dreams" ON public.soul_dreams
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));


-- 5) soul_world_sources — config źródeł
CREATE TABLE public.soul_world_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL,
  url_template TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  fetch_interval_minutes INTEGER DEFAULT 60,
  last_fetched_at TIMESTAMPTZ,
  last_status TEXT,
  last_error TEXT,
  items_ingested_total BIGINT DEFAULT 0,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.soul_world_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_world_sources" ON public.soul_world_sources
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_soul_world_sources_updated
  BEFORE UPDATE ON public.soul_world_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- Seed otwartych źródeł (bez kluczy API)
INSERT INTO public.soul_world_sources (name, source_type, url_template, fetch_interval_minutes, config) VALUES
  ('Wikipedia — On This Day Music', 'wikipedia_otd', 'https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/{month}/{day}', 1440, '{"category":"culture"}'::jsonb),
  ('MusicBrainz — Latest Releases', 'musicbrainz', 'https://musicbrainz.org/ws/2/release/?query=date:[NOW-7DAYS%20TO%20NOW]&fmt=json&limit=25', 360, '{"ua":"GrouAIStream/1.0 (admin@grouaistream.com)"}'::jsonb),
  ('iTunes — Top Music PL', 'itunes_rss', 'https://itunes.apple.com/pl/rss/topsongs/limit=25/json', 720, '{"country":"pl"}'::jsonb),
  ('iTunes — Top Music Global', 'itunes_rss', 'https://itunes.apple.com/us/rss/topsongs/limit=25/json', 720, '{"country":"us"}'::jsonb),
  ('YouTube — Trending Music PL', 'youtube_trending', 'https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&videoCategoryId=10&regionCode=PL&maxResults=20', 240, '{"region":"PL","needs_key":true}'::jsonb),
  ('Reddit — r/WeAreTheMusicMakers', 'reddit_json', 'https://www.reddit.com/r/WeAreTheMusicMakers/top.json?t=day&limit=15', 360, '{}'::jsonb),
  ('Reddit — r/electronicmusic', 'reddit_json', 'https://www.reddit.com/r/electronicmusic/top.json?t=day&limit=15', 360, '{}'::jsonb),
  ('Reddit — r/popheads', 'reddit_json', 'https://www.reddit.com/r/popheads/top.json?t=day&limit=15', 360, '{}'::jsonb)
ON CONFLICT (name) DO NOTHING;


-- RPC: ostatni emocjonalny puls
CREATE OR REPLACE FUNCTION public.get_aurora_pulse()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _latest jsonb;
  _journal jsonb;
  _dreams_pending int;
  _world_count int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  SELECT row_to_json(e) INTO _latest
  FROM (SELECT * FROM public.soul_emotions ORDER BY measured_at DESC LIMIT 1) e;

  SELECT row_to_json(j) INTO _journal
  FROM (SELECT * FROM public.soul_journal ORDER BY entry_date DESC LIMIT 1) j;

  SELECT count(*) INTO _dreams_pending FROM public.soul_dreams WHERE status = 'pending';
  SELECT count(*) INTO _world_count FROM public.soul_world_knowledge WHERE fetched_at > now() - interval '24 hours';

  RETURN jsonb_build_object(
    'latest_emotion', COALESCE(_latest, 'null'::jsonb),
    'latest_journal', COALESCE(_journal, 'null'::jsonb),
    'pending_dreams', _dreams_pending,
    'world_items_24h', _world_count
  );
END;
$$;
