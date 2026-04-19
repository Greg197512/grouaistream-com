-- ===== TABELA SZABLONÓW =====
CREATE TABLE public.tiktok_reel_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  feature_name text NOT NULL,
  hook text NOT NULL,
  voiceover_script text NOT NULL,
  outro text NOT NULL DEFAULT 'Try it free at grouaistream.com',
  screenshot_paths text[] NOT NULL DEFAULT '{}',
  app_route text,
  duration_seconds int NOT NULL DEFAULT 10,
  queue_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  used_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tiktok_reel_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage templates" ON public.tiktok_reel_templates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read templates" ON public.tiktok_reel_templates
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER trg_tiktok_templates_updated
  BEFORE UPDATE ON public.tiktok_reel_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== TABELA WYGENEROWANYCH ROLEK =====
CREATE TABLE public.tiktok_reels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.tiktok_reel_templates(id) ON DELETE SET NULL,
  title text NOT NULL,
  feature_name text NOT NULL,
  voiceover_script text NOT NULL,
  captions jsonb NOT NULL DEFAULT '[]'::jsonb,
  audio_url text,
  screenshot_urls text[] NOT NULL DEFAULT '{}',
  video_url text,
  duration_seconds int NOT NULL DEFAULT 10,
  status text NOT NULL DEFAULT 'draft',
  language text NOT NULL DEFAULT 'en',
  generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tiktok_reels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage reels" ON public.tiktok_reels
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_tiktok_reels_updated
  BEFORE UPDATE ON public.tiktok_reels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_tiktok_reels_created ON public.tiktok_reels(created_at DESC);
CREATE INDEX idx_tiktok_reels_template ON public.tiktok_reels(template_id);
CREATE INDEX idx_tiktok_templates_queue ON public.tiktok_reel_templates(queue_order, is_active);

-- ===== BUCKET STORAGE =====
INSERT INTO storage.buckets (id, name, public)
VALUES ('tiktok-reels', 'tiktok-reels', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read tiktok-reels" ON storage.objects
  FOR SELECT USING (bucket_id = 'tiktok-reels');

CREATE POLICY "Admins write tiktok-reels" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tiktok-reels' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update tiktok-reels" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'tiktok-reels' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete tiktok-reels" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'tiktok-reels' AND has_role(auth.uid(), 'admin'::app_role));

-- ===== SEED 10 SZABLONÓW (EN, professional Apple-ad tone) =====
INSERT INTO public.tiktok_reel_templates (slug, title, feature_name, hook, voiceover_script, app_route, queue_order, screenshot_paths) VALUES
('intro-brand', 'Brand Intro — Music That Sees You', 'Brand', 'Music that looks you in the eyes.', 'You don''t play songs anymore. You talk to music. GrouAI Stream — your empathic AI DJ. Welcome home.', '/', 1, ARRAY['hero','aurora']),
('ai-dj-voice', 'AI DJ — Just Speak', 'AI Voice DJ', 'Just say what you feel.', 'Whisper at 4 AM that your heart hurts. GrouAI finds the one song that never promised to save you, but does. Your voice. Your DJ.', '/radio-live', 2, ARRAY['radio-live','dj-voice']),
('mood-detector', 'Mood Detector — Music Reads You', 'Mood Detection', 'Your face. Your soundtrack.', 'Smile at the camera. GrouAI sees euphoria in your eyes and drops the track that makes you dance in the kitchen at dawn.', '/', 3, ARRAY['mood-detector','hero']),
('live-radio', 'Live Radio — Thousands. One Heartbeat.', 'Live Radio', 'Thousands hearing the same beat. Right now.', 'GrouAI Live Radio. Real-time chat. Real-time votes. One song, one moment, thousands of hearts. This is shared listening — reborn.', '/radio-live', 4, ARRAY['radio-live','radio-chat']),
('music-studio', 'AI Studio — Make a Track in 30s', 'Music Studio', 'Type a vibe. Get a song.', 'GrouAI Studio. Fifteen genres. Your lyrics. A finished track in thirty seconds. Powered by Suno. No instrument required.', '/suno', 5, ARRAY['suno','studio']),
('party-mode', 'Party Mode — QR. Vote. Vibe.', 'Party Mode', 'Your party. Their playlist.', 'Scan the QR. Guests vote tracks live. AI reads the crowd''s energy through your camera. Every party — perfectly mixed.', '/party-pulpit', 6, ARRAY['party-pulpit','party-qr']),
('cover-designer', 'Cover Designer — Album Art in Seconds', 'Cover Designer', 'Album art that means something.', 'Describe a feeling. GrouAI paints your cover. CD jewel case preview included. Your sound. Your visual signature.', '/album-creator', 7, ARRAY['cover','album-creator']),
('crowd-camera', 'DJ Crowd Cam — Read the Room', 'DJ Crowd Camera', 'Read the room. Drop the beat.', 'Point the camera at the dancefloor. GrouAI detects the crowd''s mood — joy, hype, mellow — and adjusts the next track. Live. In real time.', '/party-pulpit', 8, ARRAY['party-pulpit','crowd-cam']),
('earnings-tips', 'Get Paid — Streams. Tips. Royalties.', 'Creator Earnings', 'Your music. Your money.', 'Upload a track. GrouAI pays per verified stream. Fans tip in one tap. Sixty-five percent royalty. Twelve euros minimum payout. Real income. Real fast.', '/creator-earnings', 9, ARRAY['earnings','tips']),
('multi-language', 'Built For Everyone — 4 Languages, Live', 'Multi-Language', 'Your language. Your music. One app.', 'Polish. English. Dutch. Ukrainian. GrouAI speaks your language — every blog post, every voice command, every interface — translated by AI in real time.', '/blog', 10, ARRAY['blog','language-switcher']);