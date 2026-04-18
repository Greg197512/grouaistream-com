
CREATE TABLE public.operational_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name text NOT NULL,
  monthly_amount numeric NOT NULL CHECK (monthly_amount >= 0),
  billing_day smallint NOT NULL DEFAULT 1 CHECK (billing_day BETWEEN 1 AND 28),
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operational_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage operational costs"
ON public.operational_costs FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.operational_costs (service_name, monthly_amount, billing_day, notes) VALUES
  ('Lovable.dev', 50, 1, 'Hosting + AI gateway'),
  ('ElevenLabs', 25, 5, 'Voice TTS + cloning'),
  ('Suno API', 20, 10, 'AI music generation');

CREATE OR REPLACE FUNCTION public.get_admin_cost_overview()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _total_costs numeric;
  _platform_revenue numeric;
  _tips_volume numeric;
  _balance numeric;
  _costs jsonb;
  _next_billing jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  SELECT COALESCE(sum(monthly_amount), 0) INTO _total_costs
  FROM operational_costs WHERE is_active = true;

  SELECT COALESCE(sum(platform_fee), 0), COALESCE(sum(amount), 0)
  INTO _platform_revenue, _tips_volume
  FROM tip_transactions
  WHERE tx_type = 'tip' AND created_at >= date_trunc('month', now());

  _balance := _platform_revenue - _total_costs;

  SELECT jsonb_agg(row_to_json(c) ORDER BY c.billing_day) INTO _costs
  FROM (SELECT * FROM operational_costs ORDER BY billing_day) c;

  SELECT jsonb_agg(row_to_json(n)) INTO _next_billing FROM (
    SELECT service_name, monthly_amount, billing_day,
      CASE
        WHEN billing_day >= EXTRACT(day FROM now())::int
        THEN make_date(EXTRACT(year FROM now())::int, EXTRACT(month FROM now())::int, billing_day)
        ELSE make_date(EXTRACT(year FROM now())::int, EXTRACT(month FROM now())::int, billing_day) + interval '1 month'
      END AS next_due
    FROM operational_costs WHERE is_active = true
    ORDER BY next_due ASC LIMIT 5
  ) n;

  RETURN jsonb_build_object(
    'total_monthly_costs', _total_costs,
    'platform_revenue_mtd', _platform_revenue,
    'tips_volume_mtd', _tips_volume,
    'balance', _balance,
    'shortfall', GREATEST(_total_costs - _platform_revenue, 0),
    'is_alert', _balance < 0,
    'costs', COALESCE(_costs, '[]'::jsonb),
    'upcoming', COALESCE(_next_billing, '[]'::jsonb)
  );
END;
$$;
