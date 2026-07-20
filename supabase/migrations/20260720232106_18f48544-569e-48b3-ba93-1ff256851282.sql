
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  is_broadcast boolean NOT NULL DEFAULT false,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX IF NOT EXISTS chat_messages_recipient_created_idx ON public.chat_messages(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_sender_created_idx ON public.chat_messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_broadcast_idx ON public.chat_messages(is_broadcast, created_at DESC) WHERE is_broadcast = true;

GRANT SELECT, INSERT, UPDATE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_select_own_or_broadcast" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (is_broadcast = true OR sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "chat_insert_as_self" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "chat_update_read_by_recipient" ON public.chat_messages
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
