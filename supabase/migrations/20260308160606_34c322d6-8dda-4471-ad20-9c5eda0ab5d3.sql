-- Allow users to delete their own messages
CREATE POLICY "Users can delete own messages"
ON public.radio_messages
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);