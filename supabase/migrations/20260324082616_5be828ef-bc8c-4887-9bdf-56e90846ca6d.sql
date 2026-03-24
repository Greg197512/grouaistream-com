
-- Add user_id column to tracks table for ownership tracking
ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for fast user track lookups
CREATE INDEX IF NOT EXISTS idx_tracks_user_id ON public.tracks(user_id);

-- Add RLS policy: users can view their own tracks (existing SELECT policy covers public view)
-- Add policy for users to update their own tracks
CREATE POLICY "Users can update own tracks" ON public.tracks
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add policy for users to delete their own tracks
DROP POLICY IF EXISTS "Admins can delete tracks" ON public.tracks;
CREATE POLICY "Owner or admin can delete tracks" ON public.tracks
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
