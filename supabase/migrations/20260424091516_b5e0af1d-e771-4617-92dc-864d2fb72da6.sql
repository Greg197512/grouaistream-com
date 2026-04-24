
INSERT INTO storage.buckets (id, name, public) VALUES
  ('aurora-voice', 'aurora-voice', true),
  ('aurora-exports', 'aurora-exports', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "aurora_voice_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'aurora-voice');

CREATE POLICY "aurora_voice_admin_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'aurora-voice' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "aurora_voice_service_write" ON storage.objects
  FOR INSERT TO service_role
  WITH CHECK (bucket_id = 'aurora-voice');

CREATE POLICY "aurora_exports_admin_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'aurora-exports' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "aurora_exports_admin_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'aurora-exports' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "aurora_exports_service_write" ON storage.objects
  FOR INSERT TO service_role
  WITH CHECK (bucket_id = 'aurora-exports');
