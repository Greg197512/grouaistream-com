-- Tracker outreachu (legalny, ręczny). To NIE jest scraper ani automat do wysyłki.
-- Człowiek wpisuje kontakty znalezione na OFICJALNYCH stronach (zakładka „Kontakt")
-- szkół, sklepów muzycznych, mediów, klubów. Panel w adminie podsuwa kilka dziennie,
-- trzyma spersonalizowany szablon i prowadzi listę opt-out. Wysyłka odbywa się przez
-- klienta pocztowego użytkownika (mailto), świadomym kliknięciem — zgodnie z ePrivacy/RODO.

CREATE TABLE IF NOT EXISTS public.outreach_contacts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_name         text NOT NULL,
  contact_email    text NOT NULL,
  category         text NOT NULL DEFAULT 'other'
                     CHECK (category IN ('school','music_shop','media','venue','other')),
  source_url       text,                       -- oficjalne źródło kontaktu (dowód legalności)
  status           text NOT NULL DEFAULT 'new'
                     CHECK (status IN ('new','contacted','replied','opt_out')),
  notes            text,
  last_contacted_at timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contact_email)
);

CREATE INDEX IF NOT EXISTS idx_outreach_status ON public.outreach_contacts (status, last_contacted_at NULLS FIRST);

ALTER TABLE public.outreach_contacts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='outreach_contacts' AND policyname='outreach_admin_all') THEN
    CREATE POLICY outreach_admin_all ON public.outreach_contacts
      FOR ALL USING (public.has_role(auth.uid(),'admin'))
      WITH CHECK (public.has_role(auth.uid(),'admin'));
  END IF;
END $$;
