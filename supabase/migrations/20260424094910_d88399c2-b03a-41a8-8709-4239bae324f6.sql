-- Aurora discovered niches (beyond music)
CREATE TABLE IF NOT EXISTS public.aurora_niches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discovered_at timestamptz NOT NULL DEFAULT now(),
  niche_name text NOT NULL,
  category text NOT NULL,
  description text,
  market_signals jsonb DEFAULT '{}'::jsonb,
  search_volume_estimate int DEFAULT 0,
  competition_level text DEFAULT 'unknown',
  monetization_methods jsonb DEFAULT '[]'::jsonb,
  estimated_monthly_revenue_eur numeric(10,2) DEFAULT 0,
  confidence_score numeric(3,2) DEFAULT 0,
  effort_score int DEFAULT 5,
  legal_risk text DEFAULT 'low',
  target_audience text,
  domain_suggestions jsonb DEFAULT '[]'::jsonb,
  content_pillars jsonb DEFAULT '[]'::jsonb,
  first_actions jsonb DEFAULT '[]'::jsonb,
  source_urls jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'discovered',
  launched_at timestamptz,
  launched_url text,
  reviewer_user_id uuid,
  reviewed_at timestamptz,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_aurora_niches_status ON public.aurora_niches(status, discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_aurora_niches_revenue ON public.aurora_niches(estimated_monthly_revenue_eur DESC);

ALTER TABLE public.aurora_niches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read niches" ON public.aurora_niches
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update niches" ON public.aurora_niches
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access niches" ON public.aurora_niches
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);