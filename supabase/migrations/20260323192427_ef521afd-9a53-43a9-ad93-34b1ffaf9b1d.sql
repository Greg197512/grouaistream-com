
CREATE TABLE public.track_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  suno_link text NOT NULL,
  title text NOT NULL,
  genre text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending',
  moderation_result jsonb DEFAULT '{}'::jsonb,
  score_length integer DEFAULT 0,
  score_lyrics integer DEFAULT 0,
  score_vocal integer DEFAULT 0,
  score_production integer DEFAULT 0,
  score_originality integer DEFAULT 0,
  total_score integer DEFAULT 0,
  rejection_reasons text[] DEFAULT '{}'::text[],
  moderator_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  moderated_at timestamptz
);

ALTER TABLE public.track_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit tracks" ON public.track_submissions
  FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Admins can view all submissions" ON public.track_submissions
  FOR SELECT TO public USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update submissions" ON public.track_submissions
  FOR UPDATE TO public USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete submissions" ON public.track_submissions
  FOR DELETE TO public USING (has_role(auth.uid(), 'admin'::app_role));
