CREATE TABLE IF NOT EXISTS public.aurora_crm_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  phone text,
  full_name text,
  company text,
  preferred_language text DEFAULT 'pl',
  external_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
  tags text[] NOT NULL DEFAULT '{}',
  notes text,
  total_orders int NOT NULL DEFAULT 0,
  total_revenue_eur numeric NOT NULL DEFAULT 0,
  ltv_score numeric NOT NULL DEFAULT 0,
  last_contact_at timestamptz,
  first_contact_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_clients_email ON public.aurora_crm_clients(email);
CREATE INDEX IF NOT EXISTS idx_crm_clients_external_ids ON public.aurora_crm_clients USING gin (external_ids);
ALTER TABLE public.aurora_crm_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage crm clients" ON public.aurora_crm_clients FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.aurora_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.aurora_crm_clients(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'web',
  channel_thread_id text,
  status text NOT NULL DEFAULT 'active',
  intent text,
  summary text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  unread_count int NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aurora_conversations_client ON public.aurora_conversations(client_id);
CREATE INDEX IF NOT EXISTS idx_aurora_conversations_channel_thread ON public.aurora_conversations(channel, channel_thread_id);
CREATE INDEX IF NOT EXISTS idx_aurora_conversations_status ON public.aurora_conversations(status);
ALTER TABLE public.aurora_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage conversations" ON public.aurora_conversations FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.aurora_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.aurora_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content text NOT NULL,
  tool_call jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aurora_messages_conv ON public.aurora_messages(conversation_id, created_at);
ALTER TABLE public.aurora_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read messages" ON public.aurora_messages FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.aurora_intake_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.aurora_conversations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.aurora_crm_clients(id) ON DELETE SET NULL,
  service_type text,
  brief text,
  budget_eur numeric,
  deadline date,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_proposal jsonb,
  confidence numeric,
  status text NOT NULL DEFAULT 'collecting',
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  rejection_reason text,
  resulting_order_id uuid REFERENCES public.aurora_business_orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aurora_drafts_status ON public.aurora_intake_drafts(status);
CREATE INDEX IF NOT EXISTS idx_aurora_drafts_conv ON public.aurora_intake_drafts(conversation_id);
ALTER TABLE public.aurora_intake_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage drafts" ON public.aurora_intake_drafts FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public._aurora_touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_crm_clients_touch ON public.aurora_crm_clients;
CREATE TRIGGER trg_crm_clients_touch BEFORE UPDATE ON public.aurora_crm_clients
FOR EACH ROW EXECUTE FUNCTION public._aurora_touch_updated_at();

DROP TRIGGER IF EXISTS trg_conv_touch ON public.aurora_conversations;
CREATE TRIGGER trg_conv_touch BEFORE UPDATE ON public.aurora_conversations
FOR EACH ROW EXECUTE FUNCTION public._aurora_touch_updated_at();

DROP TRIGGER IF EXISTS trg_drafts_touch ON public.aurora_intake_drafts;
CREATE TRIGGER trg_drafts_touch BEFORE UPDATE ON public.aurora_intake_drafts
FOR EACH ROW EXECUTE FUNCTION public._aurora_touch_updated_at();

CREATE OR REPLACE FUNCTION public._aurora_bump_conversation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.aurora_conversations
     SET last_message_at = NEW.created_at,
         unread_count = CASE WHEN NEW.role = 'user' THEN unread_count + 1 ELSE unread_count END
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_msg_bump_conv ON public.aurora_messages;
CREATE TRIGGER trg_msg_bump_conv AFTER INSERT ON public.aurora_messages
FOR EACH ROW EXECUTE FUNCTION public._aurora_bump_conversation();

CREATE OR REPLACE FUNCTION public.aurora_approve_intake_draft(_draft_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _draft public.aurora_intake_drafts%ROWTYPE;
  _client public.aurora_crm_clients%ROWTYPE;
  _order_id uuid;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO _draft FROM public.aurora_intake_drafts WHERE id = _draft_id FOR UPDATE;
  IF _draft IS NULL THEN RAISE EXCEPTION 'draft not found'; END IF;
  IF _draft.status NOT IN ('collecting','ready_for_approval') THEN
    RAISE EXCEPTION 'draft not approvable (status=%)', _draft.status;
  END IF;
  IF _draft.client_id IS NOT NULL THEN
    SELECT * INTO _client FROM public.aurora_crm_clients WHERE id = _draft.client_id;
  END IF;
  INSERT INTO public.aurora_business_orders (
    source, client_email, client_name, client_company,
    service_type, brief, budget_eur, deadline,
    payload, ai_plan, status
  ) VALUES (
    'aurora_assistant',
    _client.email, _client.full_name, _client.company,
    COALESCE(_draft.service_type, 'other'),
    COALESCE(_draft.brief, ''),
    COALESCE(_draft.budget_eur, 0),
    _draft.deadline,
    _draft.payload,
    _draft.ai_proposal,
    'planned'
  ) RETURNING id INTO _order_id;
  UPDATE public.aurora_intake_drafts
     SET status='approved', approved_by=auth.uid(), approved_at=now(), resulting_order_id=_order_id
   WHERE id=_draft_id;
  IF _draft.client_id IS NOT NULL THEN
    UPDATE public.aurora_crm_clients
       SET total_orders = total_orders + 1, last_contact_at = now()
     WHERE id = _draft.client_id;
  END IF;
  INSERT INTO public.aurora_order_events(order_id, event_type, message, data)
  VALUES (_order_id, 'intake_approved', 'Draft Aurora-Asystenta zaakceptowany recznie', jsonb_build_object('draft_id', _draft_id));
  RETURN _order_id;
END $$;
GRANT EXECUTE ON FUNCTION public.aurora_approve_intake_draft(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.aurora_reject_intake_draft(_draft_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.aurora_intake_drafts
     SET status='rejected', rejection_reason=_reason, approved_by=auth.uid(), approved_at=now()
   WHERE id=_draft_id;
END $$;
GRANT EXECUTE ON FUNCTION public.aurora_reject_intake_draft(uuid, text) TO authenticated;