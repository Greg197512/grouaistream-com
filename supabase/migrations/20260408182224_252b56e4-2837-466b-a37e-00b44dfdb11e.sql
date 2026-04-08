
-- 1. Fix privilege escalation: remove user self-update on subscriptions
DROP POLICY IF EXISTS "Users can update own subscription" ON public.user_subscriptions;

-- 2. Fix track_submissions: add user_id, tighten INSERT, add user SELECT
ALTER TABLE public.track_submissions ADD COLUMN IF NOT EXISTS user_id uuid;

-- Backfill existing submissions where possible (match by email)
UPDATE public.track_submissions ts
SET user_id = u.id
FROM auth.users u
WHERE ts.user_email = u.email AND ts.user_id IS NULL;

-- Drop old permissive INSERT policy
DROP POLICY IF EXISTS "Authenticated users can submit tracks" ON public.track_submissions;

-- New INSERT: must be authenticated and user_id = auth.uid()
CREATE POLICY "Users can submit own tracks"
  ON public.track_submissions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Let users view their own submissions
CREATE POLICY "Users can view own submissions"
  ON public.track_submissions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
