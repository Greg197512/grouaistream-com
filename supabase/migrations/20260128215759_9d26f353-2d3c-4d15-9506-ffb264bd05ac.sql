-- Allow authenticated admins to delete tracks
CREATE POLICY "Admins can delete tracks" 
ON public.tracks 
FOR DELETE 
USING (public.has_role(auth.uid(), 'admin'));