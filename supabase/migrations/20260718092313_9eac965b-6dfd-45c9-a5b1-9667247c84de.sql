ALTER TABLE public.aurora_business_orders
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.aurora_business_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients insert own orders" ON public.aurora_business_orders;
CREATE POLICY "clients insert own orders" ON public.aurora_business_orders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "clients read own orders" ON public.aurora_business_orders;
CREATE POLICY "clients read own orders" ON public.aurora_business_orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "clients update own orders" ON public.aurora_business_orders;
CREATE POLICY "clients update own orders" ON public.aurora_business_orders
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);