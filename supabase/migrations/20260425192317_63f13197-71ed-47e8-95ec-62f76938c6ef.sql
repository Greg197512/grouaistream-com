-- 1) Rozszerzenie orders o cache mapy działań
ALTER TABLE public.aurora_business_orders
  ADD COLUMN IF NOT EXISTS workflow_map JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS progress_pct INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100);

-- 2) Plan / mapa działań per zlecenie
CREATE TABLE IF NOT EXISTS public.aurora_order_plan_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.aurora_business_orders(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  scope TEXT,
  assigned_worker_id UUID REFERENCES public.aurora_workers(id) ON DELETE SET NULL,
  workflow_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','failed','skipped','blocked')),
  progress_pct INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  eta_minutes INTEGER,
  depends_on UUID[] DEFAULT '{}'::uuid[],
  result JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, step_index)
);
CREATE INDEX IF NOT EXISTS idx_plan_steps_order ON public.aurora_order_plan_steps(order_id);
CREATE INDEX IF NOT EXISTS idx_plan_steps_status ON public.aurora_order_plan_steps(status);

ALTER TABLE public.aurora_order_plan_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client reads own plan steps"
  ON public.aurora_order_plan_steps FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.aurora_business_orders o WHERE o.id = order_id AND o.user_id = auth.uid()));

CREATE POLICY "Admin manages all plan steps"
  ON public.aurora_order_plan_steps FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_plan_steps_updated_at
  BEFORE UPDATE ON public.aurora_order_plan_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Change requests — negocjacje z Aurorą
CREATE TABLE IF NOT EXISTS public.aurora_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.aurora_business_orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  client_message TEXT NOT NULL,
  aurora_analysis JSONB DEFAULT '{}'::jsonb,
  web_research JSONB DEFAULT '{}'::jsonb,
  aurora_proposal TEXT,
  proposal_pros TEXT[],
  proposal_cons TEXT[],
  proposal_eta_minutes INTEGER,
  proposal_extra_cost_eur NUMERIC(10,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','analyzing','proposed','accepted','rejected','compromise','applied','failed')),
  client_response TEXT,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_change_requests_order ON public.aurora_change_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_user ON public.aurora_change_requests(user_id);

ALTER TABLE public.aurora_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client manages own change requests"
  ON public.aurora_change_requests FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin manages all change requests"
  ON public.aurora_change_requests FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_change_requests_updated_at
  BEFORE UPDATE ON public.aurora_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Faktury / rachunki PDF
CREATE TABLE IF NOT EXISTS public.aurora_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.aurora_business_orders(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  invoice_type TEXT NOT NULL DEFAULT 'invoice' CHECK (invoice_type IN ('invoice','receipt','proforma','credit_note')),
  buyer_name TEXT NOT NULL,
  buyer_company TEXT,
  buyer_tax_id TEXT,
  buyer_address TEXT,
  buyer_email TEXT,
  seller_name TEXT NOT NULL DEFAULT 'GrouAI Stream',
  seller_tax_id TEXT,
  seller_address TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal_eur NUMERIC(10,2) NOT NULL DEFAULT 0,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 23,
  vat_amount_eur NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_eur NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  pdf_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','paid','cancelled')),
  issued_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON public.aurora_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_order ON public.aurora_invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.aurora_invoices(status);

ALTER TABLE public.aurora_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client reads own invoices"
  ON public.aurora_invoices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admin manages all invoices"
  ON public.aurora_invoices FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.aurora_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Kalendarz / przypomnienia
CREATE TABLE IF NOT EXISTS public.aurora_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  order_id UUID REFERENCES public.aurora_business_orders(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'reminder' CHECK (event_type IN ('reminder','deadline','meeting','milestone','task')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  all_day BOOLEAN NOT NULL DEFAULT false,
  remind_before_minutes INTEGER DEFAULT 60,
  reminded_at TIMESTAMPTZ,
  color TEXT DEFAULT '#FF6A1F',
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','done','cancelled','snoozed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_calendar_user ON public.aurora_calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_starts_at ON public.aurora_calendar_events(starts_at);

ALTER TABLE public.aurora_calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client manages own calendar"
  ON public.aurora_calendar_events FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin manages all calendar events"
  ON public.aurora_calendar_events FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_calendar_updated_at
  BEFORE UPDATE ON public.aurora_calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Notatki klienta (Word-lite)
CREATE TABLE IF NOT EXISTS public.aurora_client_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  order_id UUID REFERENCES public.aurora_business_orders(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Untitled',
  content_md TEXT NOT NULL DEFAULT '',
  tags TEXT[] DEFAULT '{}'::text[],
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notes_user ON public.aurora_client_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_pinned ON public.aurora_client_notes(user_id, pinned) WHERE pinned = true;

ALTER TABLE public.aurora_client_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client manages own notes"
  ON public.aurora_client_notes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin reads all notes"
  ON public.aurora_client_notes FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON public.aurora_client_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7) CRM firm partnerskich B2B
CREATE TABLE IF NOT EXISTS public.aurora_partner_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  legal_name TEXT,
  tax_id TEXT,
  registry_number TEXT,
  industry TEXT,
  country TEXT DEFAULT 'PL',
  city TEXT,
  address TEXT,
  website TEXT,
  primary_email TEXT,
  primary_phone TEXT,
  contacts JSONB DEFAULT '[]'::jsonb,
  partnership_status TEXT NOT NULL DEFAULT 'prospect' CHECK (partnership_status IN ('prospect','negotiating','active','paused','ended','blacklist')),
  partnership_value_eur NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  tags TEXT[] DEFAULT '{}'::text[],
  last_contact_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partner_companies_status ON public.aurora_partner_companies(partnership_status);
CREATE INDEX IF NOT EXISTS idx_partner_companies_industry ON public.aurora_partner_companies(industry);

ALTER TABLE public.aurora_partner_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read partner companies"
  ON public.aurora_partner_companies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin manages partner companies"
  ON public.aurora_partner_companies FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_partner_companies_updated_at
  BEFORE UPDATE ON public.aurora_partner_companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8) Sekwencja numerów faktur
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 1000;