-- Enable pg_net for async HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Helper: czy user jest "verified" (uprawniony do auto-AI okładek)
CREATE OR REPLACE FUNCTION public.is_verified_creator(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND role IN ('artist', 'pro')
  )
  OR EXISTS (
    SELECT 1 FROM public.user_subscriptions
    WHERE user_id = _user_id
      AND status = 'active'
      AND plan IN ('pro'::subscription_plan, 'ultimate'::subscription_plan)
  );
$$;

-- Trigger function: po dodaniu utworu bez okładki → wywołaj ai-cover async
CREATE OR REPLACE FUNCTION public.auto_fill_cover_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _has_cover boolean;
  _verified boolean;
  _function_url text := 'https://bvstvawnigyczvofzhps.supabase.co/functions/v1/ai-cover';
  _anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2c3R2YXduaWd5Y3p2b2Z6aHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NDEwMzEsImV4cCI6MjA4NDMxNzAzMX0.Mp6lpKIcFGsduODIwm1V7FcRQmaN5DtPM5aaqj9i_Xw';
BEGIN
  -- Skip jeśli już ma prawdziwą okładkę
  _has_cover := NEW.cover_url IS NOT NULL
    AND NEW.cover_url <> ''
    AND NEW.cover_url NOT ILIKE '%picsum.photos%'
    AND NEW.cover_url NOT ILIKE '%placeholder%';

  IF _has_cover THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  _verified := public.is_verified_creator(NEW.user_id);

  -- cover-search (iTunes/Deezer) jest darmowe — wołamy zawsze
  -- AI fallback (kosztuje) — tylko verified. ai-cover wewnętrznie najpierw szuka oryginału,
  -- a do AI fallback przekazujemy flagę allow_ai.
  PERFORM net.http_post(
    url := _function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    ),
    body := jsonb_build_object(
      'trackId', NEW.id,
      'allow_ai_fallback', _verified,
      'source', 'auto_trigger'
    ),
    timeout_milliseconds := 5000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nigdy nie blokuj insertu utworu z powodu błędu w trigger
  RAISE WARNING 'auto_fill_cover_on_insert failed for track %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_fill_cover ON public.tracks;
CREATE TRIGGER trg_auto_fill_cover
AFTER INSERT ON public.tracks
FOR EACH ROW
EXECUTE FUNCTION public.auto_fill_cover_on_insert();