-- Tabela raportów miesięcznych kosztów
CREATE TABLE IF NOT EXISTS public.monthly_cost_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_month date NOT NULL,
  category text NOT NULL CHECK (category IN ('fixed', 'variable', 'summary')),
  service_name text NOT NULL,
  amount_eur numeric(12, 2) NOT NULL DEFAULT 0,
  usage_metric jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_month, service_name)
);

CREATE INDEX IF NOT EXISTS idx_cost_reports_month ON public.monthly_cost_reports(report_month DESC);
CREATE INDEX IF NOT EXISTS idx_cost_reports_category ON public.monthly_cost_reports(category);

-- RLS
ALTER TABLE public.monthly_cost_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage cost reports"
  ON public.monthly_cost_reports
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages cost reports"
  ON public.monthly_cost_reports
  FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Trigger updated_at
CREATE TRIGGER trg_cost_reports_updated_at
  BEFORE UPDATE ON public.monthly_cost_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RPC: podsumowanie ostatnich 12 miesięcy
CREATE OR REPLACE FUNCTION public.get_cost_report_summary(_months integer DEFAULT 12)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _result jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  WITH monthly AS (
    SELECT
      report_month,
      SUM(CASE WHEN category = 'fixed' THEN amount_eur ELSE 0 END) AS fixed_total,
      SUM(CASE WHEN category = 'variable' THEN amount_eur ELSE 0 END) AS variable_total,
      SUM(CASE WHEN category IN ('fixed', 'variable') THEN amount_eur ELSE 0 END) AS total
    FROM public.monthly_cost_reports
    WHERE report_month >= (date_trunc('month', now()) - (_months || ' months')::interval)::date
    GROUP BY report_month
    ORDER BY report_month DESC
  ),
  current_breakdown AS (
    SELECT
      service_name,
      category,
      amount_eur,
      usage_metric,
      notes
    FROM public.monthly_cost_reports
    WHERE report_month = date_trunc('month', now())::date
      AND category IN ('fixed', 'variable')
    ORDER BY amount_eur DESC
  )
  SELECT jsonb_build_object(
    'months', COALESCE((SELECT jsonb_agg(row_to_json(monthly)) FROM monthly), '[]'::jsonb),
    'current_breakdown', COALESCE((SELECT jsonb_agg(row_to_json(current_breakdown)) FROM current_breakdown), '[]'::jsonb),
    'current_month', date_trunc('month', now())::date
  ) INTO _result;

  RETURN _result;
END;
$$;

-- RPC: ręczne wyzwolenie raportu (admin only)
CREATE OR REPLACE FUNCTION public.trigger_cost_report(_month date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _target_month date;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  _target_month := COALESCE(_month, date_trunc('month', now())::date);

  -- Wywołanie edge function przez pg_net
  PERFORM net.http_post(
    url := 'https://bvstvawnigyczvofzhps.supabase.co/functions/v1/monthly-cost-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.anon_key', true)
    ),
    body := jsonb_build_object('month', _target_month, 'manual', true)
  );

  RETURN jsonb_build_object('success', true, 'month', _target_month, 'message', 'Raport w trakcie generowania');
END;
$$;