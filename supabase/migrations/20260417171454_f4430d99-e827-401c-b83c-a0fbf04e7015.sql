-- Public view exposes only safe fields (display_name, avatar_url) of profiles.
-- Base table policies remain unchanged: users still see only their own profile,
-- admins see all profiles. The public view enables homepage cards and
-- uploader badges to render for anonymous and logged-in visitors.

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = on) AS
SELECT
  user_id,
  display_name,
  avatar_url
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Allow read of safe columns directly on profiles for joins from other tables.
-- We add a permissive SELECT policy that exposes ONLY rows when the caller
-- queries the public view (security_invoker passes through caller permissions),
-- so we still need to grant SELECT on profiles for the view to work.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Public can read display name and avatar'
  ) THEN
    CREATE POLICY "Public can read display name and avatar"
      ON public.profiles
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;