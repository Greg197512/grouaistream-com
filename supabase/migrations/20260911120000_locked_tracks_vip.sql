-- Nagrania „na kłódkę" (konto admina Mr.Gregorius) widoczne TYLKO dla posiadaczy
-- klucza = aktywnej subskrypcji VIP/Pro/Ultimate (oraz właściciela i admina).
-- Reszta użytkowników w ogóle ich nie widzi — egzekwowane na poziomie RLS, więc
-- działa we WSZYSTKICH zapytaniach (gatunki, radio, wyszukiwarka, DJ) automatycznie.

-- 1) Flaga blokady (domyślnie false → cały dotychczasowy katalog pozostaje widoczny).
ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false;

-- 2) Oznacz katalog admina jako zablokowany.
UPDATE public.tracks SET locked = true WHERE btrim(artist) = 'Mr.Gregorius';

-- 3) Polityka SELECT: publicznie tylko odblokowane; zablokowane widzą właściciel,
--    admin i użytkownicy z aktywną subskrypcją ('live').
DROP POLICY IF EXISTS "Anyone can view tracks" ON public.tracks;
DROP POLICY IF EXISTS "Public sees unlocked; subscribers see all" ON public.tracks;
CREATE POLICY "Public sees unlocked; subscribers see all" ON public.tracks
FOR SELECT TO public
USING (
  locked = false
  OR (
    auth.uid() IS NOT NULL AND (
      auth.uid() = user_id
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_active_subscription(auth.uid(), 'live')
    )
  )
);
