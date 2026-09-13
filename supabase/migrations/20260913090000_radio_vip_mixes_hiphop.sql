-- Radio VIP = TYLKO miksy i hip-hop (prośba użytkownika).
-- Stacja 'vip' przestaje być "cały katalog Mr.Gregoriusa", a staje się kuratorowaną
-- stacją premium: gatunek hip-hop/rap/trap, albo tytuł typu mix/megamix/mixtape/dj set/
-- składanka/nonstop, albo utwór >= 8 min (ciągły miks). Public bez zmian.
-- Cotygodniowy reshuffle (cron 'weekly-radio-reshuffle') używa tej samej funkcji.

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
    WHERE (audio_url IS NOT NULL OR video_url IS NOT NULL)
      AND (
        genre ~* 'hip.?hop|rap|trap'
        OR title ~* 'mix|megamix|mixtape|dj.?set|skladank|składank|nonstop|non.?stop'
        OR duration >= 480
      );
END $$;

SELECT public.rebuild_radio_schedules();
