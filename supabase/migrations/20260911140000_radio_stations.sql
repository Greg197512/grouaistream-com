-- Dwie stacje radia + cotygodniowe przetasowanie (bez częstych powtórek).
-- public = wszystkie odblokowane, grające utwory; vip = zablokowane (dla subskrybentów).
-- Każda stacja: każdy utwór raz, losowa kolejność. Rebuild co tydzień automatem —
-- łapie też nowe wgrania i rotuje kolejność. Radio jest zsynchronizowane (pozycja
-- liczona z started_at), więc tasujemy po stronie bazy (wspólny sygnał).

ALTER TABLE public.radio_schedule ADD COLUMN IF NOT EXISTS station text NOT NULL DEFAULT 'public';
CREATE INDEX IF NOT EXISTS idx_radio_schedule_station_pos ON public.radio_schedule (station, position);

CREATE OR REPLACE FUNCTION public.rebuild_radio_schedules()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.radio_schedule WHERE item_type = 'track';
  INSERT INTO public.radio_schedule (track_id, item_type, position, station)
    SELECT id, 'track', (row_number() OVER (ORDER BY random()))::int, 'public'
    FROM public.tracks
    WHERE (audio_url IS NOT NULL OR video_url IS NOT NULL) AND locked = false;
  INSERT INTO public.radio_schedule (track_id, item_type, position, station)
    SELECT id, 'track', (row_number() OVER (ORDER BY random()))::int, 'vip'
    FROM public.tracks
    WHERE (audio_url IS NOT NULL OR video_url IS NOT NULL) AND locked = true;
END $$;

-- Zbuduj od razu obie stacje.
SELECT public.rebuild_radio_schedules();

-- Cotygodniowe przetasowanie (pon. 04:00 UTC).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.unschedule('weekly-radio-reshuffle') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='weekly-radio-reshuffle');
    PERFORM cron.schedule('weekly-radio-reshuffle', '0 4 * * 1', $cron$ SELECT public.rebuild_radio_schedules(); $cron$);
  END IF;
END $$;
