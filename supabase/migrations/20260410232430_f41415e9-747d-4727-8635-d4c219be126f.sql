
-- Add country and source columns to stream_events
ALTER TABLE public.stream_events 
ADD COLUMN IF NOT EXISTS country text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS source text DEFAULT 'direct';

-- Add index for breakdown queries
CREATE INDEX IF NOT EXISTS idx_stream_events_country ON public.stream_events (country);
CREATE INDEX IF NOT EXISTS idx_stream_events_source ON public.stream_events (source);
CREATE INDEX IF NOT EXISTS idx_stream_events_track_streamed ON public.stream_events (track_id, streamed_at);

-- Update record_stream function with source param and 1-hour rate limiting
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
  -- Minimum 30s playback
  IF _duration_played < 30 THEN
    RETURN;
  END IF;

  -- Validate source
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

  -- Insert stream event
  INSERT INTO stream_events (track_id, user_id, duration_played, counted, source)
  VALUES (_track_id, _user_id, _duration_played, true, _valid_source);

  -- Increment total streams
  UPDATE tracks SET total_streams = total_streams + 1 WHERE id = _track_id;

  -- Handle monetization
  SELECT user_id, is_monetized INTO _track_owner, _is_monetized FROM tracks WHERE id = _track_id;

  IF _is_monetized AND _track_owner IS NOT NULL THEN
    INSERT INTO creator_earnings (user_id, track_id, amount, earning_type, description)
    VALUES (_track_owner, _track_id, _rate * 0.65, 'stream', 'Stream royalty (' || _valid_source || ')');
    
    UPDATE tracks SET total_earnings = total_earnings + (_rate * 0.65) WHERE id = _track_id;
  END IF;
END;
$$;
