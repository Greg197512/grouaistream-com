ALTER TABLE public.tracks
  ADD COLUMN IF NOT EXISTS bpm numeric,
  ADD COLUMN IF NOT EXISTS energy numeric,
  ADD COLUMN IF NOT EXISTS valence numeric,
  ADD COLUMN IF NOT EXISTS danceability numeric,
  ADD COLUMN IF NOT EXISTS features_analyzed_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_tracks_bpm ON public.tracks(bpm) WHERE bpm IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracks_features_analyzed ON public.tracks(features_analyzed_at) WHERE features_analyzed_at IS NULL;