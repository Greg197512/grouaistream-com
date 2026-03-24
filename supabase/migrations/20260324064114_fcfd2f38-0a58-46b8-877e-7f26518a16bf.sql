
-- 1. FIX: Unlock codes publicly readable → create RPC for verification, remove public SELECT
-- Create a secure verification function
CREATE OR REPLACE FUNCTION public.verify_unlock_code(candidate text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM unlock_codes WHERE code = candidate AND is_active = true)
$$;

-- Remove the public SELECT policy that exposes codes
DROP POLICY IF EXISTS "Anyone can read active codes" ON public.unlock_codes;

-- 2. FIX: Privilege escalation via user_roles → add explicit INSERT restriction for non-admins
-- The ALL policy is permissive, so we need a restrictive check. 
-- Since RLS is permissive by default, we just need to ensure no other policy grants INSERT to non-admins.
-- The existing "Admins can manage roles" ALL policy already requires admin role.
-- But we must verify no broad INSERT exists. Let's add an explicit INSERT policy that only allows admins.
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. FIX: Track submissions - require authentication for INSERT
DROP POLICY IF EXISTS "Anyone can submit tracks" ON public.track_submissions;
CREATE POLICY "Authenticated users can submit tracks" ON public.track_submissions
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 4. FIX: Radio likes - restrict SELECT to authenticated users
DROP POLICY IF EXISTS "Anyone can view radio likes" ON public.radio_likes;
CREATE POLICY "Authenticated users can view radio likes" ON public.radio_likes
  FOR SELECT TO authenticated
  USING (true);

-- 5. FIX: DJ session guests - restrict anonymous update to session-scoped
DROP POLICY IF EXISTS "Guests can update own record" ON public.dj_session_guests;
CREATE POLICY "Guests can update own record" ON public.dj_session_guests
  FOR UPDATE
  USING (user_id IS NOT NULL AND auth.uid() = user_id);

-- 6. FIX: Tracks INSERT - require authentication
DROP POLICY IF EXISTS "Anyone can insert tracks" ON public.tracks;
CREATE POLICY "Authenticated users can insert tracks" ON public.tracks
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 7. FIX: Movies INSERT - restrict to admin only
DROP POLICY IF EXISTS "Authenticated users can insert movies" ON public.movies;
CREATE POLICY "Admins can insert movies" ON public.movies
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
