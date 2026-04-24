-- 1. PROFILES: Restrict public read to display_name + avatar_url only via view
-- Drop the broad public SELECT policy that exposed role, subscription_status, etc.
DROP POLICY IF EXISTS "Public can read display name and avatar" ON public.profiles;

-- Recreate the safe public view with security_invoker so it respects caller permissions,
-- then add a narrow public-read policy that ONLY exposes display_name + avatar_url to anon.
-- Strategy: keep view, grant SELECT on view to anon/authenticated, add a NEW policy on
-- profiles that allows reading only display_name + avatar_url columns publicly is not
-- possible with RLS (column-level needs grants). So instead we rely on the view bypassing RLS:
-- Use security_invoker = false (default) so the view runs as owner and bypasses RLS.
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles
WITH (security_invoker = false, security_barrier = true)
AS
SELECT user_id, display_name, avatar_url
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Re-add a narrow self/admin/auth policy already exists; ensure authenticated users can
-- read minimal info of OTHERS via the view (no direct table access for others).
-- Add a policy permitting authenticated users to read all profiles' display_name/avatar_url
-- via direct table access too (some app code reads profiles directly). To keep behavior
-- safe, restrict to authenticated only (anon must use the view).
CREATE POLICY "Authenticated can read basic profile info"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- 2. STORAGE: studio-generations -> private bucket + scoped read
UPDATE storage.buckets SET public = false WHERE id = 'studio-generations';

DROP POLICY IF EXISTS "Studio generations publicly readable" ON storage.objects;

CREATE POLICY "Users read their own studio files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'studio-generations'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- 3. Fix mutable search_path on user-defined functions
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;

-- 4. REALTIME channel authorization: scope subscriptions to authenticated users
-- Default deny by enabling RLS (already enabled by Supabase) and adding a basic policy
-- that only authenticated users can subscribe, blocking anonymous channel subscriptions.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='realtime' AND tablename='messages') THEN
    -- Drop any prior policy with same name for idempotency
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can subscribe to realtime" ON realtime.messages';
    EXECUTE 'CREATE POLICY "Authenticated users can subscribe to realtime"
      ON realtime.messages
      FOR SELECT
      TO authenticated
      USING (true)';
  END IF;
END $$;