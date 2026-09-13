-- VIP = DYSKOTEKA/parkiet (doprecyzowanie): disco/dance/house/techno/club/funk,
-- remixy i miksy w tytule, oraz utwory o wysokiej tanecznosci (danceability>=0.6).
-- VIP ~562 realnie dyskotekowych utworow. Public bez zmian.
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
      AND ( genre ~* 'disco|dance|house|techno|edm|electro|club|funk|nu.?disco|italo|hi.?nrg|euro|trance'
            OR title ~* 'mix|megamix|remix|dj.?set|bootleg|club|dance|disco|edit'
            OR danceability >= 0.6 );
END $$;
SELECT public.rebuild_radio_schedules();
