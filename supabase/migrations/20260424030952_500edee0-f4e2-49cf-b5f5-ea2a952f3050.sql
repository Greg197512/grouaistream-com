-- Poprawka: net.http_post jest w schemacie net, nie extensions
CREATE OR REPLACE FUNCTION public.auto_generate_cover_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  request_id bigint;
  func_url text := 'https://bvstvawnigyczvofzhps.supabase.co/functions/v1/ai-cover';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2c3R2YXduaWd5Y3p2b2Z6aHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NDEwMzEsImV4cCI6MjA4NDMxNzAzMX0.Mp6lpKIcFGsduODIwm1V7FcRQmaN5DtPM5aaqj9i_Xw';
BEGIN
  IF NEW.cover_url IS NOT NULL
     AND NEW.cover_url <> ''
     AND NEW.cover_url NOT ILIKE '%picsum.photos%'
     AND NEW.cover_url NOT ILIKE '%placeholder%' THEN
    RETURN NEW;
  END IF;

  SELECT net.http_post(
    url := func_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key
    ),
    body := jsonb_build_object(
      'trackId', NEW.id::text,
      'allow_ai_fallback', true,
      'source', 'auto_trigger'
    ),
    timeout_milliseconds := 120000
  ) INTO request_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'auto_generate_cover_on_insert failed for track %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;