CREATE TABLE public.paddle_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  paddle_transaction_id text NOT NULL,
  paddle_subscription_id text,
  paddle_customer_id text,
  product_id text,
  price_id text,
  plan text,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'completed',
  billed_at timestamptz NOT NULL DEFAULT now(),
  invoice_url text,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (paddle_transaction_id, environment)
);

CREATE INDEX idx_paddle_transactions_user ON public.paddle_transactions(user_id, environment, billed_at DESC);
CREATE INDEX idx_paddle_transactions_sub ON public.paddle_transactions(paddle_subscription_id);

ALTER TABLE public.paddle_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own transactions"
  ON public.paddle_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages transactions"
  ON public.paddle_transactions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');