
-- Add columns for jingles, ads, and talks
ALTER TABLE public.radio_schedule 
  ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'track',
  ADD COLUMN IF NOT EXISTS custom_title text,
  ADD COLUMN IF NOT EXISTS custom_duration integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custom_audio_url text;

-- Make track_id nullable for non-track items
ALTER TABLE public.radio_schedule ALTER COLUMN track_id DROP NOT NULL;
