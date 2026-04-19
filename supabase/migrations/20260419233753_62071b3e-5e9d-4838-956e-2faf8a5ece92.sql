-- Cron co 6h: bulk-populate
SELECT cron.schedule(
  'grouai-cc-mixter-bulk-fetch',
  '7 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bvstvawnigyczvofzhps.supabase.co/functions/v1/bulk-populate',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2c3R2YXduaWd5Y3p2b2Z6aHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NDEwMzEsImV4cCI6MjA4NDMxNzAzMX0.Mp6lpKIcFGsduODIwm1V7FcRQmaN5DtPM5aaqj9i_Xw'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Cron co 6h offset +30min: daily-cc-fetch (4 gatunki)
SELECT cron.schedule(
  'grouai-daily-cc-fetch',
  '37 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bvstvawnigyczvofzhps.supabase.co/functions/v1/daily-cc-fetch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2c3R2YXduaWd5Y3p2b2Z6aHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NDEwMzEsImV4cCI6MjA4NDMxNzAzMX0.Mp6lpKIcFGsduODIwm1V7FcRQmaN5DtPM5aaqj9i_Xw'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);