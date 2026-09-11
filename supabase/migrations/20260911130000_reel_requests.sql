-- „Społeczność słuchania": każdy wybór z popupu w rolce (wpisane zapytanie +
-- co zostało włączone) trafia tutaj. Na tej podstawie strona uczy się popytu
-- (co ludzie chcą słuchać) i może lepiej dobierać/rozbudowywać katalog.
CREATE TABLE IF NOT EXISTS public.reel_requests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid,
  query      text NOT NULL,
  match_type text NOT NULL DEFAULT 'none' CHECK (match_type IN ('track','youtube','suggestion','none')),
  track_id   uuid,
  video_id   text,
  title      text,
  artist     text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reel_requests_created ON public.reel_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reel_requests_query ON public.reel_requests (lower(query));

ALTER TABLE public.reel_requests ENABLE ROW LEVEL SECURITY;

-- Każdy (także niezalogowany) może zapisać swój wybór — to jego decyzja słuchania,
-- brak danych wrażliwych. Odczyt tylko dla admina (analiza popytu).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reel_requests' AND policyname='reel_requests_insert_any') THEN
    CREATE POLICY reel_requests_insert_any ON public.reel_requests FOR INSERT TO public WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reel_requests' AND policyname='reel_requests_admin_read') THEN
    CREATE POLICY reel_requests_admin_read ON public.reel_requests FOR SELECT TO public USING (public.has_role(auth.uid(),'admin'));
  END IF;
END $$;
