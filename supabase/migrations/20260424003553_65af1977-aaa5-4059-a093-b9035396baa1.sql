-- Recreate the view with security_invoker = true (caller's permissions/RLS apply)
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles
WITH (security_invoker = true, security_barrier = true)
AS
SELECT user_id, display_name, avatar_url
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Replace the broad authenticated-read policy with a narrower one and re-allow public read
-- but rely on COLUMN-LEVEL GRANTS to restrict what anon can actually SELECT.
DROP POLICY IF EXISTS "Authenticated can read basic profile info" ON public.profiles;

-- Allow anon and authenticated to SELECT rows from profiles (RLS gate),
-- but column-level grants below restrict what they can actually read.
CREATE POLICY "Public can read profile basics"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (true);

-- Revoke broad column access from anon/authenticated, then grant ONLY safe columns
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (user_id, display_name, avatar_url) ON public.profiles TO anon, authenticated;

-- Authenticated users still need full access to their OWN row (existing "Users can view own profile" policy).
-- For that to work with column grants, we grant full SELECT back to authenticated but rely on RLS
-- to filter rows. However, column grants are AND-ed with RLS — so anon/auth can ONLY see safe cols
-- regardless of RLS. To let users see their full own profile, we need a SECURITY DEFINER function.
-- Recreate ensure_profile_for_user already returns role/sub. AuthContext uses direct SELECT for
-- display_name, role, subscription_status, first_login_completed — so we must allow auth users
-- to read all columns of their OWN row.
GRANT SELECT ON public.profiles TO authenticated;

-- And tighten the row-level filter for authenticated direct reads: only own row OR admin
DROP POLICY IF EXISTS "Public can read profile basics" ON public.profiles;

-- Anon: can only SELECT the three safe columns (enforced by column grants), any row
CREATE POLICY "Anon read public profile fields"
ON public.profiles
FOR SELECT
TO anon
USING (true);

-- Re-revoke from anon to keep column grants in effect
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (user_id, display_name, avatar_url) ON public.profiles TO anon;

-- Authenticated: can SELECT any row but column grants below restrict to safe cols by default.
-- Existing policies "Users can view own profile" and "Admins can view all profiles" still apply
-- in addition. Since multiple SELECT policies are OR-ed, we need this permissive one to allow
-- reading other users' safe columns:
CREATE POLICY "Authenticated read public profile fields"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Important: To let authenticated users read their OWN role/subscription_status,
-- they need the column grants for those too. We grant full SELECT to authenticated,
-- which means RLS is the only filter. But then they could read ANY user's role too
-- (via the permissive policy above). To prevent that, drop the permissive policy and
-- instead create a tight one that only allows reading safe columns of others.
-- Postgres doesn't allow column-conditional RLS, so we MUST use column grants.
-- Solution: Revoke full SELECT from authenticated and grant only safe columns,
-- then create a SECURITY DEFINER function for users to fetch their own full profile.

REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (user_id, display_name, avatar_url) ON public.profiles TO authenticated;

-- Function for a user to fetch their own full profile (replaces direct SELECT in AuthContext)
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS TABLE(display_name text, role text, subscription_status text, first_login_completed boolean, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT display_name, role, subscription_status, first_login_completed, avatar_url
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;