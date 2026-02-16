
-- Create storage bucket for music files
INSERT INTO storage.buckets (id, name, public) VALUES ('music', 'music', true);

-- Allow authenticated users to upload to music bucket
CREATE POLICY "Authenticated users can upload music"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'music' AND auth.uid() IS NOT NULL);

-- Allow anyone to read music files
CREATE POLICY "Anyone can read music files"
ON storage.objects FOR SELECT
USING (bucket_id = 'music');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own music uploads"
ON storage.objects FOR DELETE
USING (bucket_id = 'music' AND auth.uid()::text = (storage.foldername(name))[1]);
