ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'free';

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'free';

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_user_id_unique
ON public.profiles (user_id);

CREATE INDEX IF NOT EXISTS idx_profiles_role
ON public.profiles (role);

CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status
ON public.profiles (subscription_status);

UPDATE public.profiles p
SET subscription_status = COALESCE((
  SELECT us.plan::text
  FROM public.user_subscriptions us
  WHERE us.user_id = p.user_id
    AND us.status = 'active'
  ORDER BY COALESCE(us.current_period_end, us.updated_at, us.created_at) DESC NULLS LAST
  LIMIT 1
), 'free');

UPDATE public.profiles p
SET role = CASE
  WHEN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p.user_id
      AND ur.role = 'admin'
  ) THEN 'pro'
  WHEN p.role IN ('artist', 'pro') THEN p.role
  WHEN EXISTS (
    SELECT 1
    FROM public.user_subscriptions us
    WHERE us.user_id = p.user_id
      AND us.status = 'active'
      AND us.plan IN ('pro', 'ultimate')
  ) THEN 'pro'
  ELSE 'free'
END;

DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.sync_profile_membership(_user_id uuid)
RETURNS TABLE(role text, subscription_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan text := 'free';
  _current_role text := 'free';
  _resolved_role text := 'free';
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() <> _user_id AND NOT public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO public.profiles (user_id, role, subscription_status)
  VALUES (_user_id, 'free', 'free')
  ON CONFLICT (user_id) DO NOTHING;

  SELECT p.role INTO _current_role
  FROM public.profiles p
  WHERE p.user_id = _user_id;

  SELECT COALESCE((
    SELECT us.plan::text
    FROM public.user_subscriptions us
    WHERE us.user_id = _user_id
      AND us.status = 'active'
    ORDER BY COALESCE(us.current_period_end, us.updated_at, us.created_at) DESC NULLS LAST
    LIMIT 1
  ), 'free')
  INTO _plan;

  IF _current_role IN ('artist', 'pro') THEN
    _resolved_role := _current_role;
  ELSIF EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = 'admin'
  ) OR _plan IN ('pro', 'ultimate') THEN
    _resolved_role := 'pro';
  ELSE
    _resolved_role := 'free';
  END IF;

  UPDATE public.profiles
  SET role = _resolved_role,
      subscription_status = _plan,
      updated_at = now()
  WHERE user_id = _user_id;

  RETURN QUERY
  SELECT p.role, p.subscription_status
  FROM public.profiles p
  WHERE p.user_id = _user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_profile_for_user(_user_id uuid, _display_name text DEFAULT NULL)
RETURNS TABLE(role text, subscription_status text, display_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() <> _user_id AND NOT public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO public.profiles (user_id, display_name, role, subscription_status)
  VALUES (_user_id, NULLIF(BTRIM(_display_name), ''), 'free', 'free')
  ON CONFLICT (user_id) DO UPDATE
  SET display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name);

  PERFORM public.sync_profile_membership(_user_id);

  RETURN QUERY
  SELECT p.role, p.subscription_status, p.display_name
  FROM public.profiles p
  WHERE p.user_id = _user_id;
END;
$$;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();