
CREATE TABLE public.user_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  -- Computed preference weights (JSON)
  genre_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  mood_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Time-based patterns
  daily_patterns JSONB NOT NULL DEFAULT '{}'::jsonb,
  weekly_patterns JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Frequency/energy preferences
  preferred_energy TEXT NOT NULL DEFAULT 'medium',
  preferred_tempo TEXT NOT NULL DEFAULT 'medium',
  -- Skip patterns (genres/moods to avoid)
  avoid_genres TEXT[] NOT NULL DEFAULT '{}',
  avoid_moods TEXT[] NOT NULL DEFAULT '{}',
  -- Stats
  total_tracks_analyzed INTEGER NOT NULL DEFAULT 0,
  last_analyzed_at TIMESTAMP WITH TIME ZONE,
  -- AI-generated summary
  ai_profile_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences" ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own preferences" ON public.user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON public.user_preferences FOR UPDATE USING (auth.uid() = user_id);
