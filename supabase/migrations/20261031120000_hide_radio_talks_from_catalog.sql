-- Nocna Rozmowa i inne odcinki radiowe nie są utworami muzycznymi.
-- Zostają w bazie (plików na R2 NIE usuwamy), ale znikają z katalogu,
-- z Nowych, wyszukiwarki i z rotacji muzycznej radia.
-- Odtwarzanie: wiersz w radio_story_slots (godzina 23:00, czas polski).
-- Najnowszy odcinek jest aktywny; starsze zostają wyłączone (archiwum).
--
-- Ten plik NIE uruchamia się przy deployu Vercela. Trzeba go odpalić raz
-- na produkcyjnej bazie (Supabase SQL Editor albo `supabase db push`).

ALTER TABLE public.tracks
  ADD COLUMN IF NOT EXISTS catalog_hidden boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tracks.catalog_hidden IS
  'true = odcinek radiowy / nie-muzyka. Ukryty w katalogu (RLS) i pomijany przez rozgłośnię muzyczną.';

-- 1) Oznacz istniejące odcinki. Nie ruszamy audio_url.
UPDATE public.tracks
SET catalog_hidden = true
WHERE catalog_hidden = false
  AND (
    coalesce(title, '') ~* 'nocna[[:space:]-]*rozmowa'
    OR coalesce(audio_url, '') ~* 'nocna-rozmowa'
  );

-- 2) Przepisz je do szuflady audycji (osobno od muzyki), jeśli jeszcze ich tam nie ma.
INSERT INTO public.radio_story_slots (slot, title, audio_url, duration_sec, air_times, is_active)
SELECT
  'Nocna Rozmowa',
  t.title,
  t.audio_url,
  GREATEST(COALESCE(t.duration, 600), 1),
  ARRAY['23:00'::time],
  false
FROM public.tracks t
WHERE t.catalog_hidden = true
  AND t.audio_url IS NOT NULL
  AND btrim(t.audio_url) <> ''
  AND (
    coalesce(t.title, '') ~* 'nocna[[:space:]-]*rozmowa'
    OR t.audio_url ~* 'nocna-rozmowa'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.radio_story_slots s WHERE s.audio_url = t.audio_url
  );

-- 3) Zostaw jeden wiersz na URL (gdy ten sam plik był dodany dwa razy).
DELETE FROM public.radio_story_slots a
USING public.radio_story_slots b
WHERE a.audio_url IS NOT NULL
  AND a.audio_url = b.audio_url
  AND a.id <> b.id
  AND (a.created_at, a.id) > (b.created_at, b.id)
  AND (
    a.slot ~* 'nocna[[:space:]-]*rozmowa'
    OR coalesce(a.title, '') ~* 'nocna[[:space:]-]*rozmowa'
    OR a.audio_url ~* 'nocna-rozmowa'
  );

-- 4) Na antenie tylko najnowszy odcinek. Reszta zostaje w tabeli, wyłączona.
WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY created_at DESC, id DESC) AS rn
  FROM public.radio_story_slots
  WHERE slot ~* 'nocna[[:space:]-]*rozmowa'
     OR coalesce(title, '') ~* 'nocna[[:space:]-]*rozmowa'
     OR coalesce(audio_url, '') ~* 'nocna-rozmowa'
)
UPDATE public.radio_story_slots s
SET is_active = (r.rn = 1)
FROM ranked r
WHERE s.id = r.id;

-- 5) Zdejmij duplikaty z programu muzycznego:
--    wiersze item_type=track (trigger auto-dodawał upload) oraz ręczne „Rozmowa".
DELETE FROM public.radio_schedule rs
WHERE rs.track_id IN (
    SELECT id FROM public.tracks
    WHERE catalog_hidden = true
      AND (
        coalesce(title, '') ~* 'nocna[[:space:]-]*rozmowa'
        OR coalesce(audio_url, '') ~* 'nocna-rozmowa'
      )
  )
  OR (
    rs.item_type IS DISTINCT FROM 'track'
    AND (
      coalesce(rs.custom_title, '') ~* 'nocna[[:space:]-]*rozmowa'
      OR coalesce(rs.custom_audio_url, '') ~* 'nocna-rozmowa'
    )
  );

-- 6) Nowe uploady muzyczne nadal wchodzą do radia. Odcinki — nie.
CREATE OR REPLACE FUNCTION public.auto_add_track_to_radio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_pos int;
BEGIN
  IF NEW.audio_url IS NULL OR NEW.duration IS NULL OR NEW.duration < 90 THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.catalog_hidden, false)
     OR COALESCE(NEW.title, '') ~* 'nocna[[:space:]-]*rozmowa'
     OR COALESCE(NEW.audio_url, '') ~* 'nocna-rozmowa'
  THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(MAX(position), 0) + 1 INTO next_pos FROM public.radio_schedule;
  INSERT INTO public.radio_schedule (track_id, position, item_type, custom_title, custom_duration)
  VALUES (NEW.id, next_pos, 'track', '🆕 ' || COALESCE(NEW.title, 'New track'), NEW.duration);
  RETURN NEW;
END;
$$;

-- 7) Cotygodniowy reshuffle nie wrzuca odcinków z powrotem do rotacji.
--    Nie wywołujemy funkcji tutaj — nie tasujemy żywej anteny przy tej migracji.
CREATE OR REPLACE FUNCTION public.rebuild_radio_schedules()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.radio_schedule WHERE item_type = 'track';
  INSERT INTO public.radio_schedule (track_id, item_type, position, station)
    SELECT id, 'track', (row_number() OVER (ORDER BY random()))::int, 'public'
    FROM public.tracks
    WHERE (audio_url IS NOT NULL OR video_url IS NOT NULL)
      AND locked = false
      AND catalog_hidden = false
      AND coalesce(title, '') !~* 'nocna[[:space:]-]*rozmowa'
      AND coalesce(audio_url, '') !~* 'nocna-rozmowa';
  INSERT INTO public.radio_schedule (track_id, item_type, position, station)
    SELECT id, 'track', (row_number() OVER (ORDER BY random()))::int, 'vip'
    FROM public.tracks
    WHERE (audio_url IS NOT NULL OR video_url IS NOT NULL)
      AND catalog_hidden = false
      AND coalesce(title, '') !~* 'nocna[[:space:]-]*rozmowa'
      AND coalesce(audio_url, '') !~* 'nocna-rozmowa'
      AND ( genre ~* 'disco|dance|house|club|funk|nu.?disco|italo|hi.?nrg|euro'
            OR title ~* 'disco|club|dance|remix'
            OR danceability >= 0.7 );
END $$;

-- 8) Katalog: nikt (także właściciel i admin w aplikacji) nie widzi odcinków
--    jako utworów. Service role nadal je widzi.
DROP POLICY IF EXISTS "Anyone can view tracks" ON public.tracks;
DROP POLICY IF EXISTS "Public sees unlocked; subscribers see all" ON public.tracks;
CREATE POLICY "Public sees unlocked; subscribers see all" ON public.tracks
FOR SELECT TO public
USING (
  catalog_hidden = false
  AND (
    locked = false
    OR (
      auth.uid() IS NOT NULL AND (
        auth.uid() = user_id
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_active_subscription(auth.uid(), 'live')
      )
    )
  )
);
