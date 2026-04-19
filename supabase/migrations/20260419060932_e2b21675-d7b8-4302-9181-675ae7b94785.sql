-- Add refunded_at to one_time_purchases so the webhook can mark refunds.
ALTER TABLE public.one_time_purchases
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_one_time_purchases_refunded
  ON public.one_time_purchases(refunded_at) WHERE refunded_at IS NOT NULL;

-- Schedule daily reminder at 09:00 UTC
SELECT cron.schedule(
  'cancel-reminder-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bvstvawnigyczvofzhps.supabase.co/functions/v1/cancel-reminder-cron',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2c3R2YXduaWd5Y3p2b2Z6aHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NDEwMzEsImV4cCI6MjA4NDMxNzAzMX0.Mp6lpKIcFGsduODIwm1V7FcRQmaN5DtPM5aaqj9i_Xw"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);