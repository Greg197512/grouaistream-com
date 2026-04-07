-- Fix 1: Restrict user_subscriptions INSERT to free plan only
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.user_subscriptions;
CREATE POLICY "Users can insert own free subscription"
  ON public.user_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND plan = 'free'
    AND status = 'active'
  );

-- Fix 2: Remove email_send_log from Realtime publication
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.email_send_log;
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

-- Fix 3: Fix music storage INSERT policy to enforce user path
DROP POLICY IF EXISTS "Authenticated users can upload music" ON storage.objects;
CREATE POLICY "Users can upload to own music folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'music'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );
