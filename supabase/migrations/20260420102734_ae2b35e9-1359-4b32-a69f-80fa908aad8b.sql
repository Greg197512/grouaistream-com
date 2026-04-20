-- 1) Trial trigger: auto-grant 7-day Pro trial via legacy user_subscriptions on new profile
CREATE OR REPLACE FUNCTION public.grant_signup_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only insert if no row exists yet (idempotent)
  INSERT INTO public.user_subscriptions (user_id, plan, status, trial_ends_at)
  VALUES (NEW.user_id, 'pro'::subscription_plan, 'active', now() + interval '7 days')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_grant_trial ON public.profiles;
CREATE TRIGGER profiles_grant_trial
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.grant_signup_trial();

-- 2) Helper: get a tippable random track (referenced by webhook; create if missing)
CREATE OR REPLACE FUNCTION public.get_random_tippable_track()
RETURNS TABLE(track_id uuid, owner_user_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id AS track_id, t.user_id AS owner_user_id
  FROM public.tracks t
  WHERE t.user_id IS NOT NULL
    AND t.audio_url IS NOT NULL
  ORDER BY random()
  LIMIT 1;
$$;