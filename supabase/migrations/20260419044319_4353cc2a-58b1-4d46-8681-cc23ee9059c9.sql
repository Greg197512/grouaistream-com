-- 1. COMMENTS
CREATE TABLE public.blog_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.seo_blog_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  parent_id UUID REFERENCES public.blog_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_blog_comments_post ON public.blog_comments(post_id, created_at DESC);
ALTER TABLE public.blog_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads visible comments" ON public.blog_comments
  FOR SELECT USING (is_hidden = false OR has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = user_id);
CREATE POLICY "Authenticated insert own comments" ON public.blog_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own comments" ON public.blog_comments
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own comments" ON public.blog_comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage all comments" ON public.blog_comments
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. LIKES
CREATE TABLE public.blog_post_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.seo_blog_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);
CREATE INDEX idx_blog_likes_post ON public.blog_post_likes(post_id);
ALTER TABLE public.blog_post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads likes" ON public.blog_post_likes FOR SELECT USING (true);
CREATE POLICY "Authenticated like" ON public.blog_post_likes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated unlike" ON public.blog_post_likes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3. SAVES
CREATE TABLE public.blog_post_saves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.seo_blog_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);
CREATE INDEX idx_blog_saves_user ON public.blog_post_saves(user_id, saved_at DESC);
ALTER TABLE public.blog_post_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own saves" ON public.blog_post_saves
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users save" ON public.blog_post_saves
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users unsave" ON public.blog_post_saves
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4. AFFILIATE LINKS
CREATE TABLE public.blog_affiliate_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand TEXT NOT NULL,
  display_text TEXT NOT NULL,
  url TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  click_count INTEGER NOT NULL DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_affiliate_active ON public.blog_affiliate_links(is_active, priority DESC);
CREATE INDEX idx_affiliate_keywords ON public.blog_affiliate_links USING GIN(keywords);
ALTER TABLE public.blog_affiliate_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads active affiliate" ON public.blog_affiliate_links
  FOR SELECT USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage affiliate" ON public.blog_affiliate_links
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 5. SAFE VIEW INCREMENT
CREATE OR REPLACE FUNCTION public.increment_blog_view(_post_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.seo_blog_posts SET view_count = view_count + 1 WHERE id = _post_id;
$$;

-- 6. UPDATED_AT TRIGGERS
CREATE TRIGGER update_blog_comments_updated_at BEFORE UPDATE ON public.blog_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_blog_affiliate_updated_at BEFORE UPDATE ON public.blog_affiliate_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Track blog_frequency_days obniżamy do 1 (codziennie) w seo_settings
UPDATE public.seo_settings SET blog_frequency_days = 1 WHERE id = 1;

-- 8. Seed kilku linków affiliate
INSERT INTO public.blog_affiliate_links (brand, display_text, url, keywords, category, description, priority) VALUES
  ('Suno', 'Suno AI', 'https://suno.com/?ref=grouaistream', ARRAY['suno','ai music','generowanie muzyki','generate music','ai song','ai utwór'], 'ai-music', 'AI music generation platform', 9),
  ('ElevenLabs', 'ElevenLabs', 'https://elevenlabs.io/?from=grouaistream', ARRAY['elevenlabs','voice clone','tts','text to speech','klonowanie głosu','syntezator mowy'], 'ai-voice', 'AI voice synthesis & cloning', 9),
  ('Spotify', 'Spotify', 'https://www.spotify.com', ARRAY['spotify','playlist','playlisty','streaming'], 'streaming', 'Music streaming platform', 5),
  ('YouTube Music', 'YouTube Music', 'https://music.youtube.com', ARRAY['youtube music','youtube','music video','teledysk'], 'streaming', 'YouTube music platform', 5),
  ('Bandcamp', 'Bandcamp', 'https://bandcamp.com', ARRAY['bandcamp','indie','independent','niezależny','niezależni twórcy'], 'streaming', 'Independent music marketplace', 6),
  ('GrouAI Stream', 'GrouAI Stream', 'https://grouaistream.com/auth', ARRAY['grouaistream','grouai','ai dj','mood detection','monetyzacja','zarobki'], 'self', 'Our own platform', 10);