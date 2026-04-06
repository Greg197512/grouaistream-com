CREATE OR REPLACE FUNCTION public.record_stream(_track_id uuid, _user_id uuid, _duration_played integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _track_owner uuid;
  _is_monetized boolean;
  _rate decimal := 0.0007;
BEGIN
  IF _duration_played < 30 THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM stream_events 
    WHERE track_id = _track_id 
      AND user_id = _user_id 
      AND counted = true
      AND streamed_at > now() - interval '5 minutes'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO stream_events (track_id, user_id, duration_played, counted)
  VALUES (_track_id, _user_id, _duration_played, true);

  UPDATE tracks SET total_streams = total_streams + 1 WHERE id = _track_id;

  SELECT user_id, is_monetized INTO _track_owner, _is_monetized FROM tracks WHERE id = _track_id;

  IF _is_monetized AND _track_owner IS NOT NULL THEN
    INSERT INTO creator_earnings (user_id, track_id, amount, earning_type, description)
    VALUES (_track_owner, _track_id, _rate * 0.65, 'stream', 'Stream royalty');
    
    UPDATE tracks SET total_earnings = total_earnings + (_rate * 0.65) WHERE id = _track_id;
  END IF;
END;
$$;