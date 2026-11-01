-- Sklep Grouarock: zamówienia. Zapis tylko przez edge function shop-checkout (service role).
CREATE TABLE IF NOT EXISTS public.shop_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  items jsonb NOT NULL,
  total_cents integer NOT NULL CHECK (total_cents >= 0),
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','paid','shipped','cancelled','refunded')),
  shipping jsonb,
  paddle_transaction_id text UNIQUE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_orders_user_idx ON public.shop_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shop_orders_status_idx ON public.shop_orders(status, created_at DESC);
ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own shop orders" ON public.shop_orders FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admins read shop orders" ON public.shop_orders FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update shop orders" ON public.shop_orders FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
