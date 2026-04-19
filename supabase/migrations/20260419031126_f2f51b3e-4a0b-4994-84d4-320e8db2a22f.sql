-- Subscriptions table for Paddle
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  paddle_subscription_id text NOT NULL UNIQUE,
  paddle_customer_id text NOT NULL,
  product_id text NOT NULL,
  price_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, environment)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_paddle_id ON public.subscriptions(paddle_subscription_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscriptions"
  ON public.subscriptions FOR ALL
  USING (auth.role() = 'service_role');

-- One-time purchases (coffee tips)
CREATE TABLE IF NOT EXISTS public.one_time_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  paddle_transaction_id text NOT NULL UNIQUE,
  paddle_customer_id text,
  product_id text NOT NULL,
  price_id text NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  recipient_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_track_id uuid REFERENCES public.tracks(id) ON DELETE SET NULL,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_one_time_purchases_user ON public.one_time_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_one_time_purchases_recipient ON public.one_time_purchases(recipient_user_id);

ALTER TABLE public.one_time_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own purchases"
  ON public.one_time_purchases FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = recipient_user_id);

CREATE POLICY "Service role manages purchases"
  ON public.one_time_purchases FOR ALL
  USING (auth.role() = 'service_role');

-- Sync trigger: when paddle subscription is active, mirror to user_subscriptions
CREATE OR REPLACE FUNCTION public.sync_paddle_to_user_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan text;
BEGIN
  -- Map paddle product to internal plan
  _plan := CASE
    WHEN NEW.product_id = 'grouai_ultimate' THEN 'ultimate'
    WHEN NEW.product_id = 'grouai_pro' THEN 'pro'
    ELSE 'free'
  END;

  IF NEW.status IN ('active', 'trialing') AND _plan IN ('pro', 'ultimate') THEN
    INSERT INTO public.user_subscriptions (user_id, plan, status, current_period_end)
    VALUES (NEW.user_id, _plan::subscription_plan, 'active', NEW.current_period_end)
    ON CONFLICT (user_id) DO UPDATE
      SET plan = EXCLUDED.plan,
          status = 'active',
          current_period_end = EXCLUDED.current_period_end,
          updated_at = now();
  ELSIF NEW.status IN ('canceled', 'paused') THEN
    UPDATE public.user_subscriptions
    SET status = 'inactive', plan = 'free', updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;

  -- Sync profile membership
  PERFORM public.sync_profile_membership(NEW.user_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_paddle_subscription ON public.subscriptions;
CREATE TRIGGER trg_sync_paddle_subscription
  AFTER INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_paddle_to_user_subscription();

-- Updated_at trigger
DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();