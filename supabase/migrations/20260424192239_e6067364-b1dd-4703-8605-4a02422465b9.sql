-- Update record_stream: minimum playback 45s
CREATE OR REPLACE FUNCTION public.record_stream(
  _track_id uuid, 
  _user_id uuid, 
  _duration_played integer,
  _source text DEFAULT 'direct'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _track_owner uuid;
  _is_monetized boolean;
  _rate decimal := 0.0007;
  _valid_source text;
BEGIN
  -- Minimum 45s playback (was 30s)
  IF _duration_played < 45 THEN
    RETURN;
  END IF;

  _valid_source := CASE 
    WHEN _source IN ('direct', 'playlist', 'radio', 'dj', 'search', 'ai_dj') THEN _source
    ELSE 'direct'
  END;

  -- Rate limit: 1 stream per user per track per hour
  IF EXISTS (
    SELECT 1 FROM stream_events 
    WHERE track_id = _track_id 
      AND user_id = _user_id 
      AND counted = true
      AND streamed_at > now() - interval '1 hour'
  ) THEN
    RETURN;
  END IF;

  -- Block self-stream payouts: don't pay creators for streaming their own tracks
  SELECT user_id, is_monetized INTO _track_owner, _is_monetized FROM tracks WHERE id = _track_id;

  INSERT INTO stream_events (track_id, user_id, duration_played, counted, source)
  VALUES (_track_id, _user_id, _duration_played, true, _valid_source);

  UPDATE tracks SET total_streams = total_streams + 1 WHERE id = _track_id;

  IF _is_monetized AND _track_owner IS NOT NULL AND _track_owner <> _user_id THEN
    INSERT INTO creator_earnings (user_id, track_id, amount, earning_type, description)
    VALUES (_track_owner, _track_id, _rate * 0.65, 'stream', 'Stream royalty (' || _valid_source || ')');
    
    UPDATE tracks SET total_earnings = total_earnings + (_rate * 0.65) WHERE id = _track_id;
  END IF;
END;
$$;

-- Update submit_rating_with_like: require 45s listened
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

  -- Hard requirement: minimum 45 seconds listened (was 30)
  IF _listened_seconds < 45 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'listen_too_short',
      'listened', _listened_seconds,
      'required', 45
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

  -- Already liked? (each logged-in user can like another's track only once)
  SELECT EXISTS(
    SELECT 1 FROM public.liked_songs
    WHERE user_id = _user_id AND track_id = _track_id
  ) INTO _already_liked;

  -- Insert rating
  INSERT INTO public.track_ratings (user_id, track_id, stars, listened_seconds)
  VALUES (_user_id, _track_id, _stars, _listened_seconds);

  -- Insert like (idempotent - unique constraint enforces one like per user per track)
  INSERT INTO public.liked_songs (user_id, track_id)
  VALUES (_user_id, _track_id)
  ON CONFLICT (user_id, track_id) DO NOTHING;

  -- One-time bonus per user-track pair
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