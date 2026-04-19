INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('blog-assets', 'blog-assets', true, 5242880, ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880;

CREATE POLICY "Public read blog assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'blog-assets');

CREATE POLICY "Service role write blog assets" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'blog-assets' AND auth.role() = 'service_role');

CREATE POLICY "Service role update blog assets" ON storage.objects
  FOR UPDATE USING (bucket_id = 'blog-assets' AND auth.role() = 'service_role');