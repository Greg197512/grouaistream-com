INSERT INTO storage.buckets (id, name, public)
VALUES ('email-assets', 'email-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Email assets are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'email-assets');

CREATE POLICY "Only admins can upload email assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'email-assets'
  AND (auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'))
);