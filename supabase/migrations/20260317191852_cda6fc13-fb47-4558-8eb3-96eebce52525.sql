-- Allow users to delete their own listening history
CREATE POLICY "Users can delete own listening history"
ON public.listening_history
FOR DELETE
USING (auth.uid() = user_id);

-- Allow users to delete their own playlist_tracks (already covered by existing policy but let's be safe)
-- The existing "Users can manage own playlist tracks" policy uses ALL which covers DELETE
