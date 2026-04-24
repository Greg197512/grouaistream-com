-- ============= AURORA: Niche pruning, content refresh, n8n business orders =============

-- 1) Niche prune log
CREATE TABLE IF NOT EXISTS public.aurora_niche_prune_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_id uuid REFERENCES public.aurora_niches(id) ON DELETE CASCADE,
  reason text NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  action text NOT NULL DEFAULT 'archived',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.aurora_niche_prune_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read prune log" ON public.aurora_niche_prune_log
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "service insert prune log" ON public.aurora_niche_prune_log
  FOR INSERT WITH CHECK (true);

-- 2) Content refresh log
CREATE TABLE IF NOT EXISTS public.aurora_content_refresh_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL,
  target_id text NOT NULL,
  niche_id uuid,
  changes jsonb DEFAULT '{}'::jsonb,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.aurora_content_refresh_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read refresh log" ON public.aurora_content_refresh_log
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "service insert refresh log" ON public.aurora_content_refresh_log
  FOR INSERT WITH CHECK (true);

-- 3) Business orders (n8n / klienci)
CREATE TABLE IF NOT EXISTS public.aurora_business_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'webhook',
  client_email text,
  client_name text,
  client_company text,
  service_type text NOT NULL,
  brief text NOT NULL,
  budget_eur numeric DEFAULT 0,
  deadline timestamptz,
  payload jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'received',
  priority int NOT NULL DEFAULT 5,
  ai_plan jsonb,
  result jsonb,
  result_url text,
  n8n_workflow_id text,
  n8n_execution_id text,
  assigned_to text DEFAULT 'aurora',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.aurora_business_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all orders" ON public.aurora_business_orders
  FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "service insert orders" ON public.aurora_business_orders
  FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_business_orders_status ON public.aurora_business_orders(status);
CREATE INDEX IF NOT EXISTS idx_business_orders_created ON public.aurora_business_orders(created_at DESC);

-- 4) n8n workflow registry
CREATE TABLE IF NOT EXISTS public.aurora_n8n_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  service_type text,
  webhook_url text,
  enabled boolean NOT NULL DEFAULT true,
  auto_assign boolean NOT NULL DEFAULT true,
  last_execution_at timestamptz,
  last_status text,
  total_runs int NOT NULL DEFAULT 0,
  total_success int NOT NULL DEFAULT 0,
  total_failed int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.aurora_n8n_workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage n8n" ON public.aurora_n8n_workflows
  FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5) Order events (timeline / log)
CREATE TABLE IF NOT EXISTS public.aurora_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.aurora_business_orders(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  message text,
  data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.aurora_order_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read events" ON public.aurora_order_events
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "service insert events" ON public.aurora_order_events
  FOR INSERT WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_order_events_order ON public.aurora_order_events(order_id, created_at DESC);

-- 6) Updated-at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_business_orders_touch ON public.aurora_business_orders;
CREATE TRIGGER trg_business_orders_touch BEFORE UPDATE ON public.aurora_business_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_n8n_workflows_touch ON public.aurora_n8n_workflows;
CREATE TRIGGER trg_n8n_workflows_touch BEFORE UPDATE ON public.aurora_n8n_workflows
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();