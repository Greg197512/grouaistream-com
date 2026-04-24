-- Per-client egress configuration
ALTER TABLE public.aurora_storage_subscriptions
  ADD COLUMN IF NOT EXISTS egress_billing_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS egress_cost_per_gb_eur_override numeric(8,4);

-- Recreate view with egress accounting
DROP VIEW IF EXISTS public.aurora_storage_client_usage;

CREATE VIEW public.aurora_storage_client_usage
WITH (security_invoker = true) AS
SELECT
  s.id AS subscription_id,
  s.client_email,
  s.client_company,
  s.client_user_id,
  s.plan_code,
  p.name AS plan_name,
  p.storage_gb AS plan_storage_gb,
  p.price_eur AS plan_price_eur,
  s.status,
  s.storage_used_bytes,
  ROUND(s.storage_used_bytes / 1073741824.0, 3) AS storage_used_gb,
  ROUND((s.storage_used_bytes / 1073741824.0) / NULLIF(p.storage_gb, 0) * 100, 1) AS usage_percent,
  ROUND((s.storage_used_bytes / 1073741824.0) * (
    SELECT cost_per_gb_eur FROM public.aurora_r2_settings LIMIT 1
  ), 4) AS estimated_cost_eur,
  -- Egress
  s.egress_billing_enabled,
  ROUND(s.bandwidth_used_bytes_month / 1073741824.0, 3) AS egress_used_gb,
  COALESCE(
    s.egress_cost_per_gb_eur_override,
    (SELECT cost_per_gb_egress_eur FROM public.aurora_r2_settings LIMIT 1)
  ) AS effective_egress_cost_per_gb_eur,
  ROUND(
    CASE WHEN s.egress_billing_enabled THEN
      (s.bandwidth_used_bytes_month / 1073741824.0) * COALESCE(
        s.egress_cost_per_gb_eur_override,
        (SELECT cost_per_gb_egress_eur FROM public.aurora_r2_settings LIMIT 1)
      )
    ELSE 0 END, 4
  ) AS egress_cost_eur,
  s.current_period_end,
  s.paddle_subscription_id
FROM public.aurora_storage_subscriptions s
LEFT JOIN public.aurora_storage_plans p ON p.code = s.plan_code;