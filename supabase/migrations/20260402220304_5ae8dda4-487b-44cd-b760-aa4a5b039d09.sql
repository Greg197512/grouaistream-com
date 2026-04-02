
-- Add boost columns to tracks
ALTER TABLE public.tracks 
  ADD COLUMN IF NOT EXISTS is_boosted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS boost_expires_at timestamptz;

-- Create track_boosts table
CREATE TABLE public.track_boosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  package_type text NOT NULL DEFAULT 'basic',
  impressions_total integer NOT NULL DEFAULT 5000,
  impressions_used integer NOT NULL DEFAULT 0,
  amount_paid decimal(12,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

ALTER TABLE public.track_boosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own boosts"
  ON public.track_boosts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own boosts"
  ON public.track_boosts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all boosts"
  ON public.track_boosts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
