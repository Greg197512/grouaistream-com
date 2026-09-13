-- VIP: więcej utworów (prośba użytkownika). Rozszerzenie kuratorowanej stacji VIP
-- w duchu miksy + hip-hop o muzykę taneczną/elektroniczną (house/techno/dance/
-- disco/edm/club/dnb/funk), więcej słów-kluczy w tytule (remix/edit/bootleg/
-- session/live set) i niższy próg długości miksu (>= 6 min). VIP ~974 utworów.

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
        genre ~* 'hip.?hop|rap|trap|mix|house|techno|dance|disco|edm|electro|club|drum|dnb|garage|funk'
        OR title ~* 'mix|megamix|mixtape|dj.?set|remix|edit|bootleg|session|live.?set|skladank|składank|nonstop|non.?stop'
        OR duration >= 360
      );
END $$;

SELECT public.rebuild_radio_schedules();
