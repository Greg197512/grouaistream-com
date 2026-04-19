-- Włącz pgvector dla embeddingów melodii
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- 1. song_catalog — katalog wszystkich utworów
-- ============================================
CREATE TABLE public.song_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  lyrics TEXT,
  genre TEXT,
  subgenre TEXT,
  mood TEXT,
  language TEXT DEFAULT 'unknown',
  duration_seconds INTEGER,
  audio_url TEXT,
  cover_url TEXT,
  external_id TEXT,
  source TEXT NOT NULL DEFAULT 'platform',
  source_url TEXT,
  license TEXT DEFAULT 'unknown',
  is_training_eligible BOOLEAN DEFAULT false,
  moderation_status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}'::jsonb,
  ingested_by TEXT DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_song_catalog_source ON public.song_catalog(source);
CREATE INDEX idx_song_catalog_genre ON public.song_catalog(genre);
CREATE INDEX idx_song_catalog_mood ON public.song_catalog(mood);
CREATE INDEX idx_song_catalog_training ON public.song_catalog(is_training_eligible, moderation_status);
CREATE UNIQUE INDEX idx_song_catalog_dedup ON public.song_catalog(source, COALESCE(external_id, audio_url));

ALTER TABLE public.song_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Catalog publicly readable for approved tracks"
  ON public.song_catalog FOR SELECT
  USING (moderation_status = 'approved' OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can write to catalog"
  ON public.song_catalog FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- 2. audio_features — cechy audio
-- ============================================
CREATE TABLE public.audio_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  catalog_id UUID NOT NULL REFERENCES public.song_catalog(id) ON DELETE CASCADE UNIQUE,
  bpm NUMERIC,
  music_key TEXT,
  music_mode TEXT,
  time_signature TEXT DEFAULT '4/4',
  energy NUMERIC CHECK (energy >= 0 AND energy <= 1),
  danceability NUMERIC CHECK (danceability >= 0 AND danceability <= 1),
  valence NUMERIC CHECK (valence >= 0 AND valence <= 1),
  acousticness NUMERIC CHECK (acousticness >= 0 AND acousticness <= 1),
  instrumentalness NUMERIC CHECK (instrumentalness >= 0 AND instrumentalness <= 1),
  loudness_db NUMERIC,
  speechiness NUMERIC CHECK (speechiness >= 0 AND speechiness <= 1),
  liveness NUMERIC CHECK (liveness >= 0 AND liveness <= 1),
  tempo_confidence NUMERIC,
  analyzed_by TEXT DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_audio_features_bpm ON public.audio_features(bpm);
CREATE INDEX idx_audio_features_key ON public.audio_features(music_key);
CREATE INDEX idx_audio_features_energy ON public.audio_features(energy);

ALTER TABLE public.audio_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Audio features publicly readable"
  ON public.audio_features FOR SELECT USING (true);

CREATE POLICY "Only admins can write audio features"
  ON public.audio_features FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- 3. melody_embeddings — wektory melodii (pgvector)
-- ============================================
CREATE TABLE public.melody_embeddings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  catalog_id UUID NOT NULL REFERENCES public.song_catalog(id) ON DELETE CASCADE UNIQUE,
  embedding vector(1536),
  embedding_model TEXT DEFAULT 'openai-text-embedding-3-small',
  embedding_source TEXT DEFAULT 'lyrics_genre_mood',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_melody_embeddings_vector ON public.melody_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE public.melody_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Embeddings publicly readable"
  ON public.melody_embeddings FOR SELECT USING (true);

CREATE POLICY "Only admins can write embeddings"
  ON public.melody_embeddings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- 4. training_dataset — gotowe do fine-tune
-- ============================================
CREATE TABLE public.training_dataset (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  catalog_id UUID NOT NULL REFERENCES public.song_catalog(id) ON DELETE CASCADE UNIQUE,
  prompt_text TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  duration_seconds INTEGER,
  quality_score NUMERIC DEFAULT 0.5 CHECK (quality_score >= 0 AND quality_score <= 1),
  opt_in BOOLEAN DEFAULT false,
  exported_at TIMESTAMP WITH TIME ZONE,
  export_batch TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_training_dataset_quality ON public.training_dataset(quality_score DESC);
CREATE INDEX idx_training_dataset_unexported ON public.training_dataset(opt_in, exported_at);

ALTER TABLE public.training_dataset ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can access training dataset"
  ON public.training_dataset FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- 5. n8n_ingest_tokens — bezpieczne tokeny dla botów
-- ============================================
CREATE TABLE public.n8n_ingest_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  label TEXT NOT NULL,
  source_type TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  rate_limit_per_hour INTEGER DEFAULT 1000,
  total_ingests INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.n8n_ingest_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage ingest tokens"
  ON public.n8n_ingest_tokens FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- 6. studio_chat_messages — historia chatu Studio
-- ============================================
CREATE TABLE public.studio_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  ai_model TEXT,
  generation_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_studio_chat_user_time ON public.studio_chat_messages(user_id, created_at DESC);

ALTER TABLE public.studio_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own chat messages"
  ON public.studio_chat_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert their own chat messages"
  ON public.studio_chat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete their own chat messages"
  ON public.studio_chat_messages FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 7. studio_generations — wygenerowane utwory
-- ============================================
CREATE TABLE public.studio_generations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  prompt TEXT NOT NULL,
  ai_model TEXT NOT NULL,
  title TEXT,
  lyrics TEXT,
  genre TEXT,
  subgenre TEXT,
  mood TEXT,
  bpm NUMERIC,
  music_key TEXT,
  time_signature TEXT,
  duration_seconds INTEGER,
  structure JSONB,
  audio_url TEXT,
  vocal_url TEXT,
  stem_vocals_url TEXT,
  stem_drums_url TEXT,
  stem_bass_url TEXT,
  stem_other_url TEXT,
  reference_audio_url TEXT,
  voice_clone_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  uploaded_to_platform BOOLEAN DEFAULT false,
  platform_track_id UUID REFERENCES public.tracks(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_studio_generations_user ON public.studio_generations(user_id, created_at DESC);
CREATE INDEX idx_studio_generations_status ON public.studio_generations(status);

ALTER TABLE public.studio_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own generations"
  ON public.studio_generations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users create their own generations"
  ON public.studio_generations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their own generations"
  ON public.studio_generations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete their own generations"
  ON public.studio_generations FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins see all generations"
  ON public.studio_generations FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Dodaje utwór do katalogu z deduplikacją
CREATE OR REPLACE FUNCTION public.add_to_song_catalog(
  _title TEXT,
  _artist TEXT,
  _source TEXT,
  _audio_url TEXT DEFAULT NULL,
  _external_id TEXT DEFAULT NULL,
  _lyrics TEXT DEFAULT NULL,
  _genre TEXT DEFAULT NULL,
  _mood TEXT DEFAULT NULL,
  _duration INTEGER DEFAULT NULL,
  _license TEXT DEFAULT 'unknown',
  _metadata JSONB DEFAULT '{}'::jsonb,
  _ingested_by TEXT DEFAULT 'manual'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_id UUID;
  _is_eligible BOOLEAN := false;
  _moderation TEXT := 'pending';
BEGIN
  -- Auto-approve dla naszej platformy i CC sources
  IF _source IN ('platform', 'cc_mixter', 'fma', 'jamendo', 'ia') THEN
    _is_eligible := true;
    _moderation := 'approved';
  END IF;

  INSERT INTO public.song_catalog (
    title, artist, source, audio_url, external_id, lyrics, genre, mood,
    duration_seconds, license, metadata, ingested_by,
    is_training_eligible, moderation_status
  )
  VALUES (
    _title, _artist, _source, _audio_url, _external_id, _lyrics, _genre, _mood,
    _duration, _license, _metadata, _ingested_by,
    _is_eligible, _moderation
  )
  ON CONFLICT (source, COALESCE(external_id, audio_url)) DO UPDATE
    SET updated_at = now(),
        metadata = song_catalog.metadata || EXCLUDED.metadata
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

-- Pobiera top 10 utworów usera do "Make it sound like my last 10"
CREATE OR REPLACE FUNCTION public.get_user_top_tracks_for_ai(_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
BEGIN
  IF _user_id IS NULL OR (auth.uid() IS NOT NULL AND auth.uid() <> _user_id AND NOT has_role(auth.uid(), 'admin'::app_role)) THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO _result FROM (
    SELECT 
      t.id, t.title, t.artist, t.genre,
      af.bpm, af.music_key, af.energy, af.valence, af.danceability,
      sc.mood, sc.lyrics
    FROM listening_history lh
    JOIN tracks t ON t.id = lh.track_id
    LEFT JOIN song_catalog sc ON sc.audio_url = t.audio_url
    LEFT JOIN audio_features af ON af.catalog_id = sc.id
    WHERE lh.user_id = _user_id
      AND lh.duration_played > 30
    GROUP BY t.id, t.title, t.artist, t.genre, af.bpm, af.music_key, af.energy, af.valence, af.danceability, sc.mood, sc.lyrics
    ORDER BY count(*) DESC, max(lh.played_at) DESC
    LIMIT 10
  ) t;

  RETURN _result;
END;
$$;

-- Wyszukuje podobne utwory wektorowo (cosine similarity)
CREATE OR REPLACE FUNCTION public.get_similar_tracks_by_embedding(
  _query_embedding vector(1536),
  _limit INTEGER DEFAULT 10
) RETURNS TABLE (
  catalog_id UUID,
  title TEXT,
  artist TEXT,
  genre TEXT,
  similarity NUMERIC
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sc.id,
    sc.title,
    sc.artist,
    sc.genre,
    (1 - (me.embedding <=> _query_embedding))::NUMERIC AS similarity
  FROM melody_embeddings me
  JOIN song_catalog sc ON sc.id = me.catalog_id
  WHERE sc.moderation_status = 'approved'
  ORDER BY me.embedding <=> _query_embedding
  LIMIT _limit;
END;
$$;

-- Trigger: automatycznie kataloguj wygenerowane utwory ze Studio
CREATE OR REPLACE FUNCTION public.auto_catalog_studio_generation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.audio_url IS NOT NULL AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    PERFORM public.add_to_song_catalog(
      COALESCE(NEW.title, 'Untitled Studio Track'),
      'GrouAI Studio User',
      'generated',
      NEW.audio_url,
      NEW.id::text,
      NEW.lyrics,
      NEW.genre,
      NEW.mood,
      NEW.duration_seconds,
      'platform_owned',
      jsonb_build_object(
        'ai_model', NEW.ai_model,
        'bpm', NEW.bpm,
        'key', NEW.music_key,
        'user_id', NEW.user_id
      ),
      'studio_auto'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_catalog_studio
  AFTER INSERT OR UPDATE ON public.studio_generations
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_catalog_studio_generation();

-- Trigger: updated_at na song_catalog
CREATE TRIGGER trg_song_catalog_updated
  BEFORE UPDATE ON public.song_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Storage bucket dla studio generations
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('studio-generations', 'studio-generations', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Studio generations publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'studio-generations');

CREATE POLICY "Users upload to their own studio folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'studio-generations'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users update their own studio files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'studio-generations'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users delete their own studio files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'studio-generations'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );