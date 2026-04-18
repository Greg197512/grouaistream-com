-- 1. Trigger blokujący self-likes na liked_songs
CREATE OR REPLACE FUNCTION public.prevent_self_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _track_owner uuid;
BEGIN
  SELECT user_id INTO _track_owner FROM public.tracks WHERE id = NEW.track_id;
  IF _track_owner IS NOT NULL AND _track_owner = NEW.user_id THEN
    RAISE EXCEPTION 'cannot_like_own_track' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_like ON public.liked_songs;
CREATE TRIGGER trg_prevent_self_like
BEFORE INSERT ON public.liked_songs
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_like();

-- 2. Wyczyszczenie istniejących self-lików
DELETE FROM public.liked_songs ls
USING public.tracks t
WHERE ls.track_id = t.id AND ls.user_id = t.user_id;

-- 3. Aktualizacja submit_rating_with_like - blokuj self-like graceful
CREATE OR REPLACE FUNCTION public.submit_rating_with_like(_track_id uuid, _stars smallint, _listened_seconds integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _track_owner uuid;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  IF _stars < 1 OR _stars > 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_stars');
  END IF;

  SELECT user_id INTO _track_owner FROM public.tracks WHERE id = _track_id;
  IF _track_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'track_not_found');
  END IF;

  IF _track_owner = _user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_rate_own_track');
  END IF;

  -- Insert rating
  INSERT INTO public.track_ratings (user_id, track_id, stars, listened_seconds)
  VALUES (_user_id, _track_id, _stars, GREATEST(_listened_seconds, 0));

  -- Insert like (idempotent)
  INSERT INTO public.liked_songs (user_id, track_id)
  VALUES (_user_id, _track_id)
  ON CONFLICT (user_id, track_id) DO NOTHING;

  RETURN jsonb_build_object('success', true, 'stars', _stars);
END;
$$;