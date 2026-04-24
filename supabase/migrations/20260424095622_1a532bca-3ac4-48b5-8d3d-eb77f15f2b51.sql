-- Aurora autopilot settings (single-row config)
CREATE TABLE IF NOT EXISTS public.aurora_autopilot_settings (
  id int PRIMARY KEY DEFAULT 1,
  enabled boolean NOT NULL DEFAULT true,
  max_niches_per_day int NOT NULL DEFAULT 2,
  min_confidence numeric(3,2) NOT NULL DEFAULT 0.65,
  max_legal_risk text NOT NULL DEFAULT 'low',
  max_effort_score int NOT NULL DEFAULT 6,
  min_revenue_eur numeric(10,2) NOT NULL DEFAULT 80,
  auto_publish_seo_posts boolean NOT NULL DEFAULT true,
  max_seo_posts_per_day int NOT NULL DEFAULT 5,
  last_run_at timestamptz,
  last_run_summary jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);

-- seed
INSERT INTO public.aurora_autopilot_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.aurora_autopilot_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read autopilot" ON public.aurora_autopilot_settings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update autopilot" ON public.aurora_autopilot_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role autopilot" ON public.aurora_autopilot_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Add body_markdown column on landing pages already exists; ensure aurora_revenue_actions has 'published_url' (it does per prior schema).
-- Add helpful index for "find unpublished SEO posts"
CREATE INDEX IF NOT EXISTS idx_revenue_actions_status_type
  ON public.aurora_revenue_actions(status, action_type, created_at DESC);