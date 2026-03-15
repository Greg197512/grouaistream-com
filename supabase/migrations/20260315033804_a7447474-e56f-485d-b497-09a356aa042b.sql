
CREATE TABLE public.mix_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  track_a_id uuid REFERENCES public.tracks(id) ON DELETE CASCADE,
  track_b_id uuid REFERENCES public.tracks(id) ON DELETE CASCADE,
  track_a_title text NOT NULL,
  track_b_title text NOT NULL,
  track_a_genre text,
  track_b_genre text,
  mix_style text NOT NULL DEFAULT 'mashup',
  rating integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mix_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mix preferences" ON public.mix_preferences
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mix preferences" ON public.mix_preferences
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mix preferences" ON public.mix_preferences
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own mix preferences" ON public.mix_preferences
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
