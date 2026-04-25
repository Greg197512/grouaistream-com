-- 1. Rozszerz aurora_business_orders o pola płatności
ALTER TABLE public.aurora_business_orders
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS price_eur numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS paddle_transaction_id text,
  ADD COLUMN IF NOT EXISTS paddle_price_id text,
  ADD COLUMN IF NOT EXISTS checkout_url text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_business_orders_user ON public.aurora_business_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_business_orders_paddle_tx ON public.aurora_business_orders(paddle_transaction_id);
CREATE INDEX IF NOT EXISTS idx_business_orders_payment_status ON public.aurora_business_orders(payment_status);

-- Polityka: właściciel zamówienia widzi swoje
DROP POLICY IF EXISTS "owner read own orders" ON public.aurora_business_orders;
CREATE POLICY "owner read own orders" ON public.aurora_business_orders
  FOR SELECT USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 2. Tabela: zgłoszenia braku pracownika n8n
CREATE TABLE IF NOT EXISTS public.aurora_workforce_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.aurora_business_orders(id) ON DELETE SET NULL,
  service_type text NOT NULL,
  required_capability text NOT NULL,
  brief text,
  status text NOT NULL DEFAULT 'pending', -- pending | building | built | failed | manual
  built_workflow_id text,
  built_workflow_db_id uuid REFERENCES public.aurora_n8n_workflows(id) ON DELETE SET NULL,
  architect_log_id uuid,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.aurora_workforce_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manage workforce req" ON public.aurora_workforce_requests
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "service insert workforce req" ON public.aurora_workforce_requests
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER trg_workforce_req_touch
  BEFORE UPDATE ON public.aurora_workforce_requests
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- 3. Tabela: log Architect-AI (audyt auto-buildów)
CREATE TABLE IF NOT EXISTS public.aurora_n8n_architect_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.aurora_workforce_requests(id) ON DELETE SET NULL,
  service_type text NOT NULL,
  prompt text NOT NULL,
  ai_response jsonb,
  generated_workflow jsonb,
  n8n_response jsonb,
  status text NOT NULL DEFAULT 'pending', -- pending | success | failed
  error text,
  ai_model text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.aurora_n8n_architect_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin read architect log" ON public.aurora_n8n_architect_log
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "service write architect log" ON public.aurora_n8n_architect_log
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_architect_log_created ON public.aurora_n8n_architect_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_architect_log_status ON public.aurora_n8n_architect_log(status);
CREATE INDEX IF NOT EXISTS idx_workforce_req_status ON public.aurora_workforce_requests(status);