-- Aktualizacja submit_rating_with_like:
-- 1. Wymóg minimum 30 sekund odsłuchania
-- 2. Bonus 0.10€ dla właściciela utworu za polubienie (jednorazowo na parę user-track)

CREATE OR REPLACE FUNCTION public.submit_rating_with_like(_track_id uuid, _stars smallint, _listened_seconds integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _track_owner uuid;
  _track_title text;
  _is_monetized boolean;
  _like_bonus numeric := 0.10;
  _already_liked boolean;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  IF _stars < 1 OR _stars > 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_stars');
  END IF;

  -- Twardy wymóg: minimum 30 sekund odsłuchania
  IF _listened_seconds < 30 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'listen_too_short',
      'listened', _listened_seconds,
      'required', 30
    );
  END IF;

  SELECT user_id, title, is_monetized INTO _track_owner, _track_title, _is_monetized
  FROM public.tracks WHERE id = _track_id;

  IF _track_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'track_not_found');
  END IF;

  IF _track_owner = _user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_rate_own_track');
  END IF;

  -- Sprawdź czy już polubiono (żeby nie dawać bonusu wielokrotnie)
  SELECT EXISTS(
    SELECT 1 FROM public.liked_songs
    WHERE user_id = _user_id AND track_id = _track_id
  ) INTO _already_liked;

  -- Insert rating
  INSERT INTO public.track_ratings (user_id, track_id, stars, listened_seconds)
  VALUES (_user_id, _track_id, _stars, _listened_seconds);

  -- Insert like (idempotent)
  INSERT INTO public.liked_songs (user_id, track_id)
  VALUES (_user_id, _track_id)
  ON CONFLICT (user_id, track_id) DO NOTHING;

  -- Bonus dla właściciela utworu za nowe polubienie (jednorazowo)
  IF NOT _already_liked AND _track_owner IS NOT NULL THEN
    INSERT INTO public.creator_earnings (user_id, track_id, amount, earning_type, description)
    VALUES (_track_owner, _track_id, _like_bonus, 'like_bonus',
            'Bonus 0,10 € za polubienie utworu "' || COALESCE(_track_title, 'utwór') || '" ❤️');

    UPDATE public.tracks
    SET total_earnings = total_earnings + _like_bonus
    WHERE id = _track_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'stars', _stars,
    'bonus_granted', NOT _already_liked,
    'bonus_amount', CASE WHEN NOT _already_liked THEN _like_bonus ELSE 0 END
  );
END;
$$;