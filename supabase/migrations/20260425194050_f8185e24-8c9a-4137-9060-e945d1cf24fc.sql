
-- Aurora Singularity Engine
CREATE TABLE IF NOT EXISTS public.aurora_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  category TEXT,
  source_url TEXT,
  source_type TEXT DEFAULT 'web',
  title TEXT,
  content TEXT NOT NULL,
  summary TEXT,
  quality_score NUMERIC DEFAULT 0.5,
  iq_value NUMERIC DEFAULT 1,
  r2_key TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_akb_topic ON public.aurora_knowledge_base(topic);
CREATE INDEX IF NOT EXISTS idx_akb_category ON public.aurora_knowledge_base(category);
ALTER TABLE public.aurora_knowledge_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read knowledge" ON public.aurora_knowledge_base FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.aurora_ai_dialogues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  partner_model TEXT NOT NULL,
  aurora_messages JSONB DEFAULT '[]'::jsonb,
  partner_messages JSONB DEFAULT '[]'::jsonb,
  conclusion TEXT,
  iq_gain NUMERIC DEFAULT 0,
  r2_key TEXT,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.aurora_ai_dialogues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read dialogues" ON public.aurora_ai_dialogues FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.aurora_iq_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iq_score NUMERIC NOT NULL DEFAULT 100,
  facts_known INT DEFAULT 0,
  dialogues_completed INT DEFAULT 0,
  successful_decisions INT DEFAULT 0,
  failed_decisions INT DEFAULT 0,
  avg_quality NUMERIC DEFAULT 0.5,
  notes TEXT,
  recorded_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.aurora_iq_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read iq" ON public.aurora_iq_metrics FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.aurora_learning_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  goal TEXT,
  priority INT DEFAULT 5,
  status TEXT DEFAULT 'pending',
  result_summary TEXT,
  r2_key TEXT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_alj_status ON public.aurora_learning_jobs(status, priority DESC);
ALTER TABLE public.aurora_learning_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage learning jobs" ON public.aurora_learning_jobs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
