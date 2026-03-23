CREATE POLICY "Anyone can insert tracks" ON public.tracks FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can insert tracks" ON public.tracks;