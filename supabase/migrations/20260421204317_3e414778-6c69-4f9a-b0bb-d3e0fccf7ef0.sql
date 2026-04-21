
-- Register agents for music stories blog + radio
INSERT INTO public.agent_registry (name, cron_schedule, enabled, description)
VALUES
  ('music-stories-generate', '0 9 * * *', true, 'Codzienna historia muzyczna o pionierze elektroniki (Firecrawl + Gemini Pro + cover)'),
  ('music-story-radio-17', '0 17 * * *', true, 'Audio historia muzyczna w radiu o 17:00 (głos George, ElevenLabs)'),
  ('music-story-radio-23', '0 23 * * *', true, 'Audio historia muzyczna w radiu o 23:00 (głos George, ElevenLabs)')
ON CONFLICT (name) DO UPDATE
  SET cron_schedule = EXCLUDED.cron_schedule,
      description = EXCLUDED.description,
      enabled = EXCLUDED.enabled,
      updated_at = now();

-- Schedule pg_cron jobs to invoke the edge functions
DO $$
DECLARE
  v_url text := 'https://bvstvawnigyczvofzhps.supabase.co/functions/v1';
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2c3R2YXduaWd5Y3p2b2Z6aHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NDEwMzEsImV4cCI6MjA4NDMxNzAzMX0.Mp6lpKIcFGsduODIwm1V7FcRQmaN5DtPM5aaqj9i_Xw';
BEGIN
  PERFORM cron.unschedule(jobname) FROM cron.job
  WHERE jobname IN ('music-stories-daily-09','music-story-radio-17','music-story-radio-23');

  PERFORM cron.schedule(
    'music-stories-daily-09',
    '0 9 * * *',
    format($cron$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization', %L, 'x-trigger','cron'),
        body := '{}'::jsonb
      );
    $cron$, v_url || '/music-stories-generate', 'Bearer ' || v_anon)
  );

  PERFORM cron.schedule(
    'music-story-radio-17',
    '0 17 * * *',
    format($cron$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization', %L, 'x-trigger','cron-17'),
        body := '{}'::jsonb
      );
    $cron$, v_url || '/music-story-radio-announce', 'Bearer ' || v_anon)
  );

  PERFORM cron.schedule(
    'music-story-radio-23',
    '0 23 * * *',
    format($cron$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization', %L, 'x-trigger','cron-23'),
        body := '{}'::jsonb
      );
    $cron$, v_url || '/music-story-radio-announce', 'Bearer ' || v_anon)
  );
END $$;
