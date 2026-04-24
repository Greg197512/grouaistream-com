
-- Aurora R2 Storage: deliverables, pakiety pojemności, subskrypcje klientów

-- 1) Pakiety pojemności R2 sprzedawane jako add-on przez Aurorę
CREATE TABLE IF NOT EXISTS public.aurora_storage_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,            -- np. r2_starter_10gb, r2_pro_50gb
  name text NOT NULL,
  storage_gb int NOT NULL,
  bandwidth_gb_month int NOT NULL DEFAULT 100,
  price_eur numeric(10,2) NOT NULL,
  paddle_price_id text,                 -- human-readable Paddle price external_id
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.aurora_storage_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read active plans" ON public.aurora_storage_plans
  FOR SELECT USING (active = true);
CREATE POLICY "admin manage plans" ON public.aurora_storage_plans
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed kilku domyślnych pakietów
INSERT INTO public.aurora_storage_plans (code, name, storage_gb, bandwidth_gb_month, price_eur, features, sort_order)
VALUES
  ('r2_starter_10gb', 'R2 Starter', 10, 100, 4.90, '["10 GB","100 GB transferu/mies","Podpisane linki 7 dni","CDN dla landingów"]'::jsonb, 1),
  ('r2_pro_50gb',     'R2 Pro',     50, 500, 14.90, '["50 GB","500 GB transferu/mies","Podpisane linki 30 dni","CDN + custom domena"]'::jsonb, 2),
  ('r2_business_200gb','R2 Business',200, 2000, 39.00, '["200 GB","2 TB transferu/mies","Podpisane linki 90 dni","Backup automat. n8n"]'::jsonb, 3)
ON CONFLICT (code) DO NOTHING;

-- 2) Subskrypcje klientów na pakiety R2 (klient = email lub user_id)
CREATE TABLE IF NOT EXISTS public.aurora_storage_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code text NOT NULL REFERENCES public.aurora_storage_plans(code),
  client_email text,
  client_user_id uuid,
  client_company text,
  status text NOT NULL DEFAULT 'active', -- active | paused | canceled
  started_at timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz,
  storage_used_bytes bigint NOT NULL DEFAULT 0,
  bandwidth_used_bytes_month bigint NOT NULL DEFAULT 0,
  paddle_subscription_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.aurora_storage_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage storage subs" ON public.aurora_storage_subscriptions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "client read own storage sub" ON public.aurora_storage_subscriptions
  FOR SELECT USING (client_user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_storage_subs_client_user ON public.aurora_storage_subscriptions(client_user_id);
CREATE INDEX IF NOT EXISTS idx_storage_subs_email ON public.aurora_storage_subscriptions(client_email);

-- 3) Pliki w R2 zarządzane przez Aurorę
CREATE TABLE IF NOT EXISTS public.aurora_storage_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  r2_key text NOT NULL UNIQUE,
  public_url text,
  file_name text NOT NULL,
  content_type text,
  size_bytes bigint NOT NULL DEFAULT 0,
  visibility text NOT NULL DEFAULT 'private', -- private | public_cdn
  category text NOT NULL DEFAULT 'deliverable', -- deliverable | niche_asset | backup | landing | other
  niche_id uuid REFERENCES public.aurora_niches(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.aurora_business_orders(id) ON DELETE SET NULL,
  run_id uuid REFERENCES public.aurora_n8n_runs(id) ON DELETE SET NULL,
  storage_subscription_id uuid REFERENCES public.aurora_storage_subscriptions(id) ON DELETE SET NULL,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);
ALTER TABLE public.aurora_storage_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage files" ON public.aurora_storage_files
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "client read own files" ON public.aurora_storage_files
  FOR SELECT USING (
    storage_subscription_id IN (
      SELECT id FROM public.aurora_storage_subscriptions WHERE client_user_id = auth.uid()
    )
  );
CREATE POLICY "public read CDN files" ON public.aurora_storage_files
  FOR SELECT USING (visibility = 'public_cdn');
CREATE INDEX IF NOT EXISTS idx_aurora_files_niche ON public.aurora_storage_files(niche_id);
CREATE INDEX IF NOT EXISTS idx_aurora_files_order ON public.aurora_storage_files(order_id);
CREATE INDEX IF NOT EXISTS idx_aurora_files_sub ON public.aurora_storage_files(storage_subscription_id);

-- 4) Trigger: aktualizuj zużycie subskrypcji przy insert/delete pliku
CREATE OR REPLACE FUNCTION public.aurora_storage_recalc_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.storage_subscription_id IS NOT NULL THEN
    UPDATE public.aurora_storage_subscriptions
    SET storage_used_bytes = storage_used_bytes + COALESCE(NEW.size_bytes, 0),
        updated_at = now()
    WHERE id = NEW.storage_subscription_id;
  ELSIF TG_OP = 'DELETE' AND OLD.storage_subscription_id IS NOT NULL THEN
    UPDATE public.aurora_storage_subscriptions
    SET storage_used_bytes = GREATEST(0, storage_used_bytes - COALESCE(OLD.size_bytes, 0)),
        updated_at = now()
    WHERE id = OLD.storage_subscription_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_aurora_files_usage_ins ON public.aurora_storage_files;
CREATE TRIGGER trg_aurora_files_usage_ins
AFTER INSERT ON public.aurora_storage_files
FOR EACH ROW EXECUTE FUNCTION public.aurora_storage_recalc_usage();

DROP TRIGGER IF EXISTS trg_aurora_files_usage_del ON public.aurora_storage_files;
CREATE TRIGGER trg_aurora_files_usage_del
AFTER DELETE ON public.aurora_storage_files
FOR EACH ROW EXECUTE FUNCTION public.aurora_storage_recalc_usage();

-- 5) Touch updated_at
DROP TRIGGER IF EXISTS trg_storage_plans_touch ON public.aurora_storage_plans;
CREATE TRIGGER trg_storage_plans_touch BEFORE UPDATE ON public.aurora_storage_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_storage_subs_touch ON public.aurora_storage_subscriptions;
CREATE TRIGGER trg_storage_subs_touch BEFORE UPDATE ON public.aurora_storage_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6) View: zbiorcze statystyki R2 dla pulpitu Aurory
CREATE OR REPLACE VIEW public.aurora_storage_overview AS
SELECT
  (SELECT COUNT(*) FROM public.aurora_storage_files) AS total_files,
  (SELECT COALESCE(SUM(size_bytes), 0) FROM public.aurora_storage_files) AS total_bytes,
  (SELECT COUNT(*) FROM public.aurora_storage_subscriptions WHERE status = 'active') AS active_subscriptions,
  (SELECT COALESCE(SUM(p.price_eur), 0)
     FROM public.aurora_storage_subscriptions s
     JOIN public.aurora_storage_plans p ON p.code = s.plan_code
     WHERE s.status = 'active') AS mrr_eur;
ALTER VIEW public.aurora_storage_overview SET (security_invoker = on);
