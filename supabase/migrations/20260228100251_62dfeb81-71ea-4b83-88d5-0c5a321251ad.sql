CREATE POLICY "Service role can update tracks" ON public.tracks FOR UPDATE USING (true) WITH CHECK (true);

ALTER POLICY "Service role can update tracks" ON public.tracks TO service_role;