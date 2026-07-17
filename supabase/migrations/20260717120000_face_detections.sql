-- ============================================================
-- FACE DETECTIONS — surowe odczyty detekcji twarzy/oczu/mimiki.
-- Każdy skan zapisuje pełny wektor emocji + sygnały oczu i mikroekspresji.
-- To zbiór danych, na którym silnik/algorytmy uczą się w czasie
-- (agregacja per użytkownik, dostrajanie progów, personalizacja rekomendacji).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.face_detections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Wynik główny
  dominant_emotion text NOT NULL,
  confidence numeric,                       -- 0-100
  emotions jsonb NOT NULL DEFAULT '{}'::jsonb, -- {happy:0-1, sad:0-1, ...}

  -- Sygnały oczu / wzroku / mimiki
  eye_state text,                           -- open | half | closed
  gaze text,                                -- center | left | right | up | down | away
  micro_expressions jsonb DEFAULT '[]'::jsonb, -- np. ["brow_raise","lip_press"]

  -- Wymiary afektu (model kołowy Russella)
  valence numeric,                          -- -1..1 (negatywny..pozytywny)
  arousal numeric,                          -- 0..1 (spokój..pobudzenie)
  engagement numeric,                       -- 0..1 (uwaga/zaangażowanie)

  -- Kontekst techniczny
  frames_count int NOT NULL DEFAULT 1,      -- ile klatek uśredniono
  source text NOT NULL DEFAULT 'webcam',
  model text,                               -- który silnik AI zwrócił wynik
  playing_track_id uuid,                    -- co grało w tle (jeśli wiadomo)
  language text
);

CREATE INDEX IF NOT EXISTS idx_face_detections_user
  ON public.face_detections (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_face_detections_emotion
  ON public.face_detections (dominant_emotion, created_at DESC);

ALTER TABLE public.face_detections ENABLE ROW LEVEL SECURITY;

-- Użytkownik zapisuje i czyta WYŁĄCZNIE swoje detekcje.
DROP POLICY IF EXISTS "Users insert own face_detections" ON public.face_detections;
CREATE POLICY "Users insert own face_detections"
  ON public.face_detections FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own face_detections" ON public.face_detections;
CREATE POLICY "Users read own face_detections"
  ON public.face_detections FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admin czyta wszystko (globalne uczenie / analityka silnika).
DROP POLICY IF EXISTS "Admins read all face_detections" ON public.face_detections;
CREATE POLICY "Admins read all face_detections"
  ON public.face_detections FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
