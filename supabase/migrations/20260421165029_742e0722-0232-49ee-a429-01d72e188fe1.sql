CREATE TABLE IF NOT EXISTS public.radio_announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.seo_blog_posts(id) ON DELETE SET NULL,
  post_title TEXT,
  post_slug TEXT,
  script TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  voice_id TEXT,
  kind TEXT NOT NULL DEFAULT 'blog_daily',
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  played_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS radio_announcements_kind_created_idx
  ON public.radio_announcements(kind, created_at DESC);

ALTER TABLE public.radio_announcements ENABLE ROW LEVEL SECURITY;

-- Public can read (it's a radio audio feed)
CREATE POLICY "Anyone can view announcements"
  ON public.radio_announcements
  FOR SELECT
  USING (true);

-- Only admins can insert/modify (server-side via service role bypasses RLS anyway)
CREATE POLICY "Admins manage announcements"
  ON public.radio_announcements
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));