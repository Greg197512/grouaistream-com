
-- Radio messages / wishes table
CREATE TABLE public.radio_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  display_name text NOT NULL DEFAULT 'Anonim',
  message text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.radio_messages ENABLE ROW LEVEL SECURITY;

-- Anyone can read messages
CREATE POLICY "Anyone can view radio messages"
  ON public.radio_messages FOR SELECT
  USING (true);

-- Authenticated users can insert
CREATE POLICY "Authenticated users can post messages"
  ON public.radio_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins can delete
CREATE POLICY "Admins can delete radio messages"
  ON public.radio_messages FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Radio likes counter table (per track aggregated)
CREATE TABLE public.radio_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid REFERENCES public.tracks(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(track_id, user_id)
);

ALTER TABLE public.radio_likes ENABLE ROW LEVEL SECURITY;

-- Anyone can view likes
CREATE POLICY "Anyone can view radio likes"
  ON public.radio_likes FOR SELECT
  USING (true);

-- Authenticated can insert own likes
CREATE POLICY "Authenticated users can like"
  ON public.radio_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can unlike (delete own)
CREATE POLICY "Users can unlike"
  ON public.radio_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.radio_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.radio_likes;
