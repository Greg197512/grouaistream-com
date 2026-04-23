CREATE TABLE IF NOT EXISTS public.cost_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL CHECK (level IN ('warning', 'critical', 'emergency')),
  message text NOT NULL,
  cost_amount numeric NOT NULL DEFAULT 0,
  revenue_amount numeric NOT NULL DEFAULT 0,
  ratio_pct numeric NOT NULL DEFAULT 0,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  dismissed_at timestamptz,
  dismissed_by uuid
);

ALTER TABLE public.cost_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage cost alerts"
  ON public.cost_alerts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_cost_alerts_active
  ON public.cost_alerts (triggered_at DESC)
  WHERE dismissed_at IS NULL;

CREATE OR REPLACE FUNCTION public.get_revenue_mtd()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _month_start timestamptz := date_trunc('month', now());
  _sub_revenue numeric := 0;
  _tip_revenue numeric := 0;
  _active_pro integer := 0;
  _active_ultimate integer := 0;
  _days_in_month integer := EXTRACT(DAY FROM (date_trunc('month', now()) + interval '1 month - 1 day'));
  _day_of_month integer := EXTRACT(DAY FROM now());
  _prorate numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  _prorate := _day_of_month::numeric / _days_in_month::numeric;

  SELECT
    count(*) FILTER (WHERE product_id ILIKE '%pro%' AND product_id NOT ILIKE '%ultimate%'),
    count(*) FILTER (WHERE product_id ILIKE '%ultimate%')
  INTO _active_pro, _active_ultimate
  FROM public.subscriptions
  WHERE status IN ('active', 'trialing')
    AND environment = 'live';

  _sub_revenue := (_active_pro * 4.99 + _active_ultimate * 9.99) * _prorate;

  SELECT COALESCE(SUM(platform_fee), 0) INTO _tip_revenue
  FROM public.tip_transactions
  WHERE created_at >= _month_start;

  RETURN jsonb_build_object(
    'month_start', _month_start,
    'day_of_month', _day_of_month,
    'days_in_month', _days_in_month,
    'active_pro', _active_pro,
    'active_ultimate', _active_ultimate,
    'subscription_revenue_mtd', ROUND(_sub_revenue::numeric, 2),
    'tip_revenue_mtd', ROUND(_tip_revenue::numeric, 2),
    'total_revenue_mtd', ROUND((_sub_revenue + _tip_revenue)::numeric, 2)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_break_even_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _month text := to_char(date_trunc('month', now()), 'YYYY-MM-DD');
  _cost numeric := 0;
  _revenue jsonb;
  _revenue_total numeric := 0;
  _gap numeric;
  _days_left integer;
  _days_in_month integer := EXTRACT(DAY FROM (date_trunc('month', now()) + interval '1 month - 1 day'));
  _day_of_month integer := EXTRACT(DAY FROM now());
  _ratio numeric := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  SELECT COALESCE(SUM(amount_eur), 0) INTO _cost
  FROM public.monthly_cost_reports
  WHERE report_month = _month::date;

  _revenue := public.get_revenue_mtd();
  _revenue_total := COALESCE((_revenue->>'total_revenue_mtd')::numeric, 0);
  _gap := _cost - _revenue_total;
  _days_left := _days_in_month - _day_of_month;

  IF _revenue_total > 0 THEN
    _ratio := ROUND((_cost / _revenue_total * 100)::numeric, 1);
  END IF;

  RETURN jsonb_build_object(
    'month', _month,
    'cost_mtd', ROUND(_cost, 2),
    'revenue_mtd', _revenue_total,
    'revenue_breakdown', _revenue,
    'gap', ROUND(_gap, 2),
    'cost_to_revenue_ratio_pct', _ratio,
    'is_profitable', (_gap < 0),
    'day_of_month', _day_of_month,
    'days_in_month', _days_in_month,
    'days_left', _days_left,
    'required_daily_revenue', CASE WHEN _days_left > 0 THEN ROUND((_gap / _days_left)::numeric, 2) ELSE 0 END,
    'pro_subs_to_break_even', CASE WHEN _gap > 0 THEN CEIL(_gap / 4.99) ELSE 0 END,
    'ultimate_subs_to_break_even', CASE WHEN _gap > 0 THEN CEIL(_gap / 9.99) ELSE 0 END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.dismiss_cost_alert(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  UPDATE public.cost_alerts
  SET dismissed_at = now(), dismissed_by = auth.uid()
  WHERE id = _id;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_active_cost_alerts()
RETURNS SETOF public.cost_alerts
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.cost_alerts
  WHERE dismissed_at IS NULL
    AND public.has_role(auth.uid(), 'admin'::app_role)
  ORDER BY triggered_at DESC
  LIMIT 5;
$$;