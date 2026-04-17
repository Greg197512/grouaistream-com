
CREATE TABLE public.admin_marquee_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_marquee_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active marquee messages"
ON public.admin_marquee_messages FOR SELECT
USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert marquee messages"
ON public.admin_marquee_messages FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update marquee messages"
ON public.admin_marquee_messages FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete marquee messages"
ON public.admin_marquee_messages FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_admin_marquee_messages_updated_at
BEFORE UPDATE ON public.admin_marquee_messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_marquee_messages;
