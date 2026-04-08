
-- 1. Fix: tracks INSERT - only own tracks
DROP POLICY IF EXISTS "Authenticated users can insert tracks" ON public.tracks;
CREATE POLICY "Authenticated users can insert own tracks"
ON public.tracks
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 2. Fix: user_roles - block INSERT for non-admins (already has admin-only ALL policy, but add explicit denial)
-- The existing "Admins can manage roles" ALL policy already restricts via has_role check.
-- But we need to ensure no other INSERT policy exists. Let's verify by dropping any permissive insert and relying on the ALL policy.
-- The ALL policy with has_role check already covers INSERT, so no additional policy needed.
-- Just ensure no open INSERT policy exists (there isn't one based on current policies).

-- 3. Fix: track_submissions - restrict email visibility
-- Drop existing SELECT policies and recreate with proper restrictions
DROP POLICY IF EXISTS "Users can view own submissions" ON public.track_submissions;
CREATE POLICY "Users can view own submissions"
ON public.track_submissions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all submissions" ON public.track_submissions;
CREATE POLICY "Admins can view all submissions"
ON public.track_submissions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
