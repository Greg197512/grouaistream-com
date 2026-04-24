
-- 1. Rozszerzenie aurora_niches o pola SEO/affiliate
ALTER TABLE public.aurora_niches
  ADD COLUMN IF NOT EXISTS seo_difficulty integer DEFAULT 50 CHECK (seo_difficulty BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS keyword_volume_monthly integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS affiliate_potential integer DEFAULT 50 CHECK (affiliate_potential BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS cpc_estimate_eur numeric(10,2) DEFAULT 0;

-- opportunity_score jako generated column
ALTER TABLE public.aurora_niches
  ADD COLUMN IF NOT EXISTS opportunity_score numeric GENERATED ALWAYS AS (
    (LEAST(COALESCE(keyword_volume_monthly,0), 50000)::numeric / 50000 * 100 * 0.35)
    + (COALESCE(affiliate_potential,50)::numeric * 0.30)
    + ((100 - COALESCE(seo_difficulty,50))::numeric * 0.25)
    + (LEAST(COALESCE(cpc_estimate_eur,0), 10)::numeric / 10 * 100 * 0.10)
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_aurora_niches_opportunity ON public.aurora_niches(opportunity_score DESC);

-- 2. Refresh schedule na landingach + blog
ALTER TABLE public.aurora_landing_pages
  ADD COLUMN IF NOT EXISTS last_refreshed_at timestamptz,
  ADD COLUMN IF NOT EXISTS refresh_interval_days integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS refresh_count integer DEFAULT 0;

ALTER TABLE public.seo_blog_posts
  ADD COLUMN IF NOT EXISTS last_refreshed_at timestamptz,
  ADD COLUMN IF NOT EXISTS refresh_interval_days integer DEFAULT 45,
  ADD COLUMN IF NOT EXISTS refresh_count integer DEFAULT 0;

-- 3. Warianty A/B
CREATE TABLE IF NOT EXISTS public.aurora_landing_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id uuid NOT NULL REFERENCES public.aurora_landing_pages(id) ON DELETE CASCADE,
  variant_label text NOT NULL CHECK (variant_label IN ('A','B','C','D')),
  hero_headline text NOT NULL,
  hero_subheadline text,
  cta_text text NOT NULL DEFAULT 'Dowiedz się więcej',
  weight integer NOT NULL DEFAULT 50 CHECK (weight BETWEEN 0 AND 100),
  is_winner boolean NOT NULL DEFAULT false,
  views integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  conversions integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(landing_page_id, variant_label)
);
CREATE INDEX IF NOT EXISTS idx_aurora_variants_landing ON public.aurora_landing_variants(landing_page_id);

ALTER TABLE public.aurora_landing_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "variants public read live"
  ON public.aurora_landing_variants FOR SELECT
  USING (true);

CREATE POLICY "variants admin write"
  ON public.aurora_landing_variants FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. Metryki (tracking pixel)
CREATE TABLE IF NOT EXISTS public.aurora_metric_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_id uuid REFERENCES public.aurora_niches(id) ON DELETE SET NULL,
  landing_page_id uuid REFERENCES public.aurora_landing_pages(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.aurora_landing_variants(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('view','click','lead','revenue')),
  amount_eur numeric(10,2),
  session_id text,
  referrer text,
  country text,
  user_agent_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_metric_events_niche_date ON public.aurora_metric_events(niche_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_metric_events_landing ON public.aurora_metric_events(landing_page_id, event_type, created_at DESC);

ALTER TABLE public.aurora_metric_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "metrics anyone insert"
  ON public.aurora_metric_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "metrics admin read"
  ON public.aurora_metric_events FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 5. Reguły zgodności
CREATE TABLE IF NOT EXISTS public.aurora_compliance_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL UNIQUE,
  auto_approve boolean NOT NULL DEFAULT true,
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  min_quality_score integer NOT NULL DEFAULT 70,
  banned_terms text[] NOT NULL DEFAULT ARRAY[]::text[],
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.aurora_compliance_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compliance rules admin all"
  ON public.aurora_compliance_rules FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed reguł
INSERT INTO public.aurora_compliance_rules (action_type, auto_approve, checklist, min_quality_score, banned_terms) VALUES
  ('niche_launch', true, '{"requires_cta":true,"requires_meta_desc":true,"min_words":600,"requires_disclaimer":true,"min_opportunity_score":50}'::jsonb, 70,
    ARRAY['cure cancer','guaranteed income','miracle','crypto pump','adult content','weapons','hate']),
  ('seo_post', true, '{"min_words":800,"requires_h2":true,"requires_internal_link":true,"requires_author":"Aurora (AI)"}'::jsonb, 70,
    ARRAY['cure cancer','guaranteed income','miracle','crypto pump','adult content','weapons','hate']),
  ('ab_variant', true, '{"requires_cta":true,"max_headline_chars":80}'::jsonb, 60,
    ARRAY['cure cancer','guaranteed income','miracle']),
  ('refresh', true, '{"preserves_h1":true,"preserves_url":true}'::jsonb, 65,
    ARRAY['cure cancer','guaranteed income','miracle']),
  ('niche_pause', true, '{"min_age_days":14,"max_roi":0.5}'::jsonb, 0, ARRAY[]::text[])
ON CONFLICT (action_type) DO NOTHING;

-- 6. Compliance log
CREATE TABLE IF NOT EXISTS public.aurora_compliance_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL,
  reference_id uuid,
  reference_table text,
  decision text NOT NULL CHECK (decision IN ('auto_approved','manual_queue','rejected','published','paused','refreshed')),
  quality_score integer,
  failed_checks jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_compliance_log_date ON public.aurora_compliance_log(created_at DESC);
ALTER TABLE public.aurora_compliance_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compliance log admin read"
  ON public.aurora_compliance_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "compliance log service insert"
  ON public.aurora_compliance_log FOR INSERT
  WITH CHECK (true);

-- 7. Widok wydajności nisz (rolling 7d)
CREATE OR REPLACE VIEW public.aurora_niche_performance AS
SELECT 
  n.id AS niche_id,
  n.niche_name,
  n.category,
  n.status,
  n.opportunity_score,
  COALESCE(v.views_7d, 0) AS views_7d,
  COALESCE(c.clicks_7d, 0) AS clicks_7d,
  COALESCE(l.leads_7d, 0) AS leads_7d,
  COALESCE(r.revenue_7d, 0) AS revenue_7d,
  CASE WHEN COALESCE(v.views_7d, 0) > 0
    THEN ROUND((COALESCE(c.clicks_7d, 0)::numeric / v.views_7d) * 100, 2)
    ELSE 0 END AS ctr_7d,
  COALESCE(cost.cost_eur_7d, 0) AS cost_eur_7d,
  CASE WHEN COALESCE(cost.cost_eur_7d, 0) > 0
    THEN ROUND(COALESCE(r.revenue_7d, 0) / cost.cost_eur_7d, 2)
    ELSE NULL END AS roi_7d,
  EXTRACT(DAY FROM (now() - n.discovered_at))::int AS age_days
FROM public.aurora_niches n
LEFT JOIN (
  SELECT niche_id, count(*) AS views_7d FROM public.aurora_metric_events
  WHERE event_type = 'view' AND created_at > now() - interval '7 days'
  GROUP BY niche_id
) v ON v.niche_id = n.id
LEFT JOIN (
  SELECT niche_id, count(*) AS clicks_7d FROM public.aurora_metric_events
  WHERE event_type = 'click' AND created_at > now() - interval '7 days'
  GROUP BY niche_id
) c ON c.niche_id = n.id
LEFT JOIN (
  SELECT niche_id, count(*) AS leads_7d FROM public.aurora_metric_events
  WHERE event_type = 'lead' AND created_at > now() - interval '7 days'
  GROUP BY niche_id
) l ON l.niche_id = n.id
LEFT JOIN (
  SELECT niche_id, COALESCE(sum(amount_eur), 0) AS revenue_7d FROM public.aurora_metric_events
  WHERE event_type = 'revenue' AND created_at > now() - interval '7 days'
  GROUP BY niche_id
) r ON r.niche_id = n.id
LEFT JOIN (
  SELECT (payload->>'niche_id')::uuid AS niche_id,
    COALESCE(sum(estimated_revenue_eur) * 0.05, 0) AS cost_eur_7d
  FROM public.aurora_revenue_actions
  WHERE created_at > now() - interval '7 days'
    AND payload->>'niche_id' IS NOT NULL
  GROUP BY (payload->>'niche_id')::uuid
) cost ON cost.niche_id = n.id;

-- 8. RLS na widoku jest dziedziczona z bazowych tabel; access dla admina
GRANT SELECT ON public.aurora_niche_performance TO authenticated;
