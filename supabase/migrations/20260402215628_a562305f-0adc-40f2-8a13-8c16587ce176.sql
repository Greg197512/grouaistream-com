
-- Add monetization columns to tracks table
ALTER TABLE public.tracks 
  ADD COLUMN IF NOT EXISTS is_monetized boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS monetization_enabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS total_streams bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_earnings decimal(12,4) NOT NULL DEFAULT 0;

-- Create stream_events table for tracking individual streams
CREATE TABLE public.stream_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  streamed_at timestamptz NOT NULL DEFAULT now(),
  duration_played integer NOT NULL DEFAULT 0,
  counted boolean NOT NULL DEFAULT false
);

ALTER TABLE public.stream_events ENABLE ROW LEVEL SECURITY;

-- Anyone can insert stream events (authenticated)
CREATE POLICY "Authenticated users can insert stream events"
  ON public.stream_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can view own stream events
CREATE POLICY "Users can view own stream events"
  ON public.stream_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all stream events
CREATE POLICY "Admins can view all stream events"
  ON public.stream_events FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create creator_earnings table
CREATE TABLE public.creator_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  amount decimal(12,4) NOT NULL DEFAULT 0,
  earning_type text NOT NULL DEFAULT 'stream',
  created_at timestamptz NOT NULL DEFAULT now(),
  description text
);

ALTER TABLE public.creator_earnings ENABLE ROW LEVEL SECURITY;

-- Users can view own earnings
CREATE POLICY "Users can view own earnings"
  ON public.creator_earnings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all earnings
CREATE POLICY "Admins can view all earnings"
  ON public.creator_earnings FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can insert earnings (from edge function)
CREATE POLICY "Service role can insert earnings"
  ON public.creator_earnings FOR INSERT TO public
  WITH CHECK (auth.role() = 'service_role'::text);

-- Create payout_requests table
CREATE TABLE public.payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount decimal(12,4) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  stripe_payout_id text
);

ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payouts"
  ON public.payout_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can request payouts"
  ON public.payout_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage payouts"
  ON public.payout_requests FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Function to increment stream count and create earning
CREATE OR REPLACE FUNCTION public.record_stream(
  _track_id uuid,
  _user_id uuid,
  _duration_played integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _track_owner uuid;
  _is_monetized boolean;
  _rate decimal := 0.003;
BEGIN
  -- Only count if duration >= 30 seconds
  IF _duration_played < 30 THEN
    RETURN;
  END IF;

  -- Check if already counted in last 5 minutes for same user+track
  IF EXISTS (
    SELECT 1 FROM stream_events 
    WHERE track_id = _track_id 
      AND user_id = _user_id 
      AND counted = true
      AND streamed_at > now() - interval '5 minutes'
  ) THEN
    RETURN;
  END IF;

  -- Insert stream event
  INSERT INTO stream_events (track_id, user_id, duration_played, counted)
  VALUES (_track_id, _user_id, _duration_played, true);

  -- Increment total_streams on track
  UPDATE tracks SET total_streams = total_streams + 1 WHERE id = _track_id;

  -- Get track owner and monetization status
  SELECT user_id, is_monetized INTO _track_owner, _is_monetized FROM tracks WHERE id = _track_id;

  -- If monetized, create earning for creator (65% of rate)
  IF _is_monetized AND _track_owner IS NOT NULL THEN
    INSERT INTO creator_earnings (user_id, track_id, amount, earning_type, description)
    VALUES (_track_owner, _track_id, _rate * 0.65, 'stream', 'Stream royalty');
    
    UPDATE tracks SET total_earnings = total_earnings + (_rate * 0.65) WHERE id = _track_id;
  END IF;
END;
$$;

-- Enable realtime for stream_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.stream_events;
