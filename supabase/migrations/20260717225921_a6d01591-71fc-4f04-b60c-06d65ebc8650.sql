CREATE TABLE IF NOT EXISTS public.face_detections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  dominant_emotion text NOT NULL,
  confidence numeric,
  emotions jsonb NOT NULL DEFAULT '{}'::jsonb,
  eye_state text,
  gaze text,
  micro_expressions jsonb DEFAULT '[]'::jsonb,
  valence numeric,
  arousal numeric,
  engagement numeric,
  frames_count int NOT NULL DEFAULT 1,
  source text NOT NULL DEFAULT 'webcam',
  model text,
  playing_track_id uuid,
  language text
);

CREATE INDEX IF NOT EXISTS idx_face_detections_user ON public.face_detections (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_face_detections_emotion ON public.face_detections (dominant_emotion, created_at DESC);

GRANT SELECT, INSERT ON public.face_detections TO authenticated;
GRANT ALL ON public.face_detections TO service_role;

ALTER TABLE public.face_detections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own face_detections" ON public.face_detections
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own face_detections" ON public.face_detections
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all face_detections" ON public.face_detections
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));