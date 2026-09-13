-- VIP zawezony do czystej DYSKOTEKI: disco/dance/house/club/funk/nu-disco/italo/
-- euro, tytuly disco/club/dance/remix, oraz mocna tanecznosc (danceability>=0.7).
-- Bez techno/edm/electro/trance i bez szerokich mix/edit. VIP ~311 parkietowych.
CREATE OR REPLACE FUNCTION public.rebuild_radio_schedules()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.radio_schedule WHERE item_type = 'track';
  INSERT INTO public.radio_schedule (track_id, item_type, position, station)
    SELECT id, 'track', (row_number() OVER (ORDER BY random()))::int, 'public'
    FROM public.tracks WHERE (audio_url IS NOT NULL OR video_url IS NOT NULL) AND locked = false;
  INSERT INTO public.radio_schedule (track_id, item_type, position, station)
    SELECT id, 'track', (row_number() OVER (ORDER BY random()))::int, 'vip'
    FROM public.tracks
    WHERE (audio_url IS NOT NULL OR video_url IS NOT NULL)
      AND ( genre ~* 'disco|dance|house|club|funk|nu.?disco|italo|hi.?nrg|euro'
            OR title ~* 'disco|club|dance|remix'
            OR danceability >= 0.7 );
END $$;
SELECT public.rebuild_radio_schedules();
