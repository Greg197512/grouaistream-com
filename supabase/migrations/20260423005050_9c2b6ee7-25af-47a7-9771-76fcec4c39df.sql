CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('payment_failed','subscription_canceled','transaction_canceled')),
  paddle_transaction_id text,
  paddle_subscription_id text,
  plan text,
  amount numeric,
  currency text,
  reason text,
  period_end timestamptz,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_events_txn ON public.payment_events(event_type, paddle_transaction_id, environment) WHERE paddle_transaction_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_events_sub ON public.payment_events(event_type, paddle_subscription_id, environment) WHERE paddle_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_events_user ON public.payment_events(user_id, created_at DESC);

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own payment events" ON public.payment_events;
CREATE POLICY "Users view own payment events"
  ON public.payment_events FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages payment events" ON public.payment_events;
CREATE POLICY "Service role manages payment events"
  ON public.payment_events FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');