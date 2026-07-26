
-- 1. Drop the legacy (user_id, environment) unique so re-subscribes / cancels+resubs can coexist.
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_environment_key;

-- 2. 30-day payout hold for coffee tips.
ALTER TABLE public.creator_earnings
  ADD COLUMN IF NOT EXISTS available_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_creator_earnings_user_available
  ON public.creator_earnings(user_id, available_at);

-- 3. Server-side entitlement helper. Defaults to live so any forgotten env
--    argument fails safe (never grants access based on sandbox rows).
CREATE OR REPLACE FUNCTION public.has_active_subscription(
  user_uuid uuid,
  check_env text DEFAULT 'live'
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = user_uuid
      AND environment = check_env
      AND (
        (status IN ('active','trialing','past_due')
          AND (current_period_end IS NULL OR current_period_end > now()))
        OR (status = 'canceled' AND current_period_end > now())
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO authenticated, service_role;
