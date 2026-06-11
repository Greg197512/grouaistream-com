-- ============================================================
-- SILNIK AUTONOMII GROUAI STREAM
-- Spina wszystkie istniejące pętle zarobkowe w jeden
-- samowystarczalny system działający na harmonogramie pg_cron:
--   • aurora-autopilot      — odkrywa i odpala nisze, publikuje SEO posty
--   • aurora-revenue-loop   — codzienne propozycje przychodowe
--   • revenue-optimizer     — analiza przychodów i anomalii
--   • seo-orchestrator      — pełny cykl SEO (sitemap, blog, bot)
--   • marketing-autopilot   — promocja treści w social media przez n8n
--   • health-monitor        — pilnuje, czy wszystko żyje
--   • aurora-ab-evaluator   — wybiera zwycięskie warianty A/B
--   • aurora-content-refresher / niche-pruner — higiena treści i nisz
--   • break-even-alert      — alert rentowności
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ------------------------------------------------------------
-- 1) Tabela logów dystrybucji marketingowej
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  content_type text NOT NULL,
  content_ref text NOT NULL,
  title text,
  url text,
  social_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued', -- queued | dispatched | error
  dispatched_at timestamptz,
  error text
);

CREATE INDEX IF NOT EXISTS idx_marketing_dispatches_ref
  ON public.marketing_dispatches (content_ref, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_dispatches_status
  ON public.marketing_dispatches (status, created_at DESC);

ALTER TABLE public.marketing_dispatches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read marketing_dispatches" ON public.marketing_dispatches;
CREATE POLICY "Admins read marketing_dispatches"
  ON public.marketing_dispatches FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ------------------------------------------------------------
-- 2) Rejestracja workflow n8n do dystrybucji social media
--    (webhook_url uzupełnia admin w panelu Aurora → n8n)
-- ------------------------------------------------------------
INSERT INTO public.aurora_n8n_workflows (workflow_id, name, description, service_type, enabled)
VALUES (
  'social-distribution',
  'Social Media Distribution',
  'Odbiera pakiet promocyjny (posty, brief Canva, skrypt audio) i publikuje w social mediach. Pola payload: social.twitter_post, social.facebook_post, social.instagram_caption, social.tiktok_script, social.linkedin_post, social.canva_brief, social.audio_promo_script.',
  'marketing',
  true
)
ON CONFLICT (workflow_id) DO NOTHING;

-- ------------------------------------------------------------
-- 3) Upewnij się, że autopilot jest WŁĄCZONY
-- ------------------------------------------------------------
INSERT INTO public.aurora_autopilot_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
UPDATE public.aurora_autopilot_settings
SET enabled = true,
    auto_publish_seo_posts = true,
    updated_at = now()
WHERE id = 1;

-- ------------------------------------------------------------
-- 4) Rejestr agentów (widoczny w panelu admina)
-- ------------------------------------------------------------
INSERT INTO public.agent_registry (name, description, enabled, cron_schedule)
VALUES
  ('aurora-autopilot',        'Autonomiczna pętla biznesowa: nisze + auto-publikacja SEO postów', true, '0 */6 * * *'),
  ('aurora-revenue-loop',     'Codzienne propozycje przychodowe (SEO post, landing, pitch, reel, newsletter)', true, '0 5 * * *'),
  ('revenue-optimizer',       'Codzienna analiza przychodów, anomalie, raport ROI', true, '0 7 * * *'),
  ('seo-orchestrator',        'Pełny autonomiczny cykl SEO: sitemap, blog, bot', true, '0 4 * * *'),
  ('marketing-autopilot',     'Promocja treści w social media przez n8n (copy AI + brief Canva + audio ElevenLabs)', true, '0 10,16 * * *'),
  ('health-monitor',          'Pinguje krytyczne funkcje, alertuje o awariach', true, '*/15 * * * *'),
  ('aurora-ab-evaluator',     'Wybiera zwycięskie warianty A/B (z-test)', true, '30 6 * * *'),
  ('aurora-content-refresher','Odświeża najlepsze landingi i posty', true, '0 3 * * 2'),
  ('aurora-niche-pruner',     'Archiwizuje słabo działające nisze', true, '0 2 * * 1'),
  ('break-even-alert',        'Alert rentowności (koszty vs przychody)', true, '0 8 * * *')
ON CONFLICT (name) DO UPDATE
  SET cron_schedule = EXCLUDED.cron_schedule,
      description   = EXCLUDED.description,
      enabled       = true,
      updated_at    = now();

-- ------------------------------------------------------------
-- 5) Harmonogram pg_cron — wywołuje edge functions przez pg_net
-- ------------------------------------------------------------
DO $$
DECLARE
  v_url  text := 'https://bvstvawnigyczvofzhps.supabase.co/functions/v1';
  v_anon text := 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2c3R2YXduaWd5Y3p2b2Z6aHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NDEwMzEsImV4cCI6MjA4NDMxNzAzMX0.Mp6lpKIcFGsduODIwm1V7FcRQmaN5DtPM5aaqj9i_Xw';
BEGIN
  -- usuń stare wersje zadań, jeśli istnieją
  PERFORM cron.unschedule(jobname) FROM cron.job
  WHERE jobname IN (
    'aurora-autopilot-6h', 'aurora-revenue-loop-daily', 'revenue-optimizer-daily',
    'seo-orchestrator-daily', 'marketing-autopilot-10', 'marketing-autopilot-16',
    'health-monitor-15m', 'aurora-ab-evaluator-daily', 'aurora-content-refresher-weekly',
    'aurora-niche-pruner-weekly', 'break-even-alert-daily'
  );

  -- Autopilot biznesowy co 6h
  PERFORM cron.schedule('aurora-autopilot-6h', '0 */6 * * *', format($cron$
    SELECT net.http_post(url := %L,
      headers := jsonb_build_object('Content-Type','application/json','Authorization', %L, 'x-trigger','cron'),
      body := '{}'::jsonb);
  $cron$, v_url || '/aurora-autopilot', v_anon));

  -- Pętla przychodowa codziennie o 05:00
  PERFORM cron.schedule('aurora-revenue-loop-daily', '0 5 * * *', format($cron$
    SELECT net.http_post(url := %L,
      headers := jsonb_build_object('Content-Type','application/json','Authorization', %L, 'x-trigger','cron'),
      body := '{}'::jsonb);
  $cron$, v_url || '/aurora-revenue-loop', v_anon));

  -- Optymalizator przychodów codziennie o 07:00
  PERFORM cron.schedule('revenue-optimizer-daily', '0 7 * * *', format($cron$
    SELECT net.http_post(url := %L,
      headers := jsonb_build_object('Content-Type','application/json','Authorization', %L, 'x-trigger','cron'),
      body := '{}'::jsonb);
  $cron$, v_url || '/revenue-optimizer', v_anon));

  -- Pełny cykl SEO codziennie o 04:00
  PERFORM cron.schedule('seo-orchestrator-daily', '0 4 * * *', format($cron$
    SELECT net.http_post(url := %L,
      headers := jsonb_build_object('Content-Type','application/json','Authorization', %L, 'x-trigger','cron'),
      body := '{"action":"all","triggered_by":"cron"}'::jsonb);
  $cron$, v_url || '/seo-orchestrator', v_anon));

  -- Marketing autopilot 2x dziennie (10:00 i 16:00)
  PERFORM cron.schedule('marketing-autopilot-10', '0 10 * * *', format($cron$
    SELECT net.http_post(url := %L,
      headers := jsonb_build_object('Content-Type','application/json','Authorization', %L, 'x-trigger','cron'),
      body := '{}'::jsonb);
  $cron$, v_url || '/marketing-autopilot', v_anon));

  PERFORM cron.schedule('marketing-autopilot-16', '0 16 * * *', format($cron$
    SELECT net.http_post(url := %L,
      headers := jsonb_build_object('Content-Type','application/json','Authorization', %L, 'x-trigger','cron'),
      body := '{}'::jsonb);
  $cron$, v_url || '/marketing-autopilot', v_anon));

  -- Health monitor co 15 minut
  PERFORM cron.schedule('health-monitor-15m', '*/15 * * * *', format($cron$
    SELECT net.http_post(url := %L,
      headers := jsonb_build_object('Content-Type','application/json','Authorization', %L, 'x-trigger','cron'),
      body := '{}'::jsonb);
  $cron$, v_url || '/health-monitor', v_anon));

  -- Ewaluator A/B codziennie o 06:30
  PERFORM cron.schedule('aurora-ab-evaluator-daily', '30 6 * * *', format($cron$
    SELECT net.http_post(url := %L,
      headers := jsonb_build_object('Content-Type','application/json','Authorization', %L, 'x-trigger','cron'),
      body := '{}'::jsonb);
  $cron$, v_url || '/aurora-ab-evaluator', v_anon));

  -- Odświeżanie treści w każdy wtorek o 03:00
  PERFORM cron.schedule('aurora-content-refresher-weekly', '0 3 * * 2', format($cron$
    SELECT net.http_post(url := %L,
      headers := jsonb_build_object('Content-Type','application/json','Authorization', %L, 'x-trigger','cron'),
      body := '{}'::jsonb);
  $cron$, v_url || '/aurora-content-refresher', v_anon));

  -- Czyszczenie nisz w każdy poniedziałek o 02:00
  PERFORM cron.schedule('aurora-niche-pruner-weekly', '0 2 * * 1', format($cron$
    SELECT net.http_post(url := %L,
      headers := jsonb_build_object('Content-Type','application/json','Authorization', %L, 'x-trigger','cron'),
      body := '{}'::jsonb);
  $cron$, v_url || '/aurora-niche-pruner', v_anon));

  -- Alert rentowności codziennie o 08:00
  PERFORM cron.schedule('break-even-alert-daily', '0 8 * * *', format($cron$
    SELECT net.http_post(url := %L,
      headers := jsonb_build_object('Content-Type','application/json','Authorization', %L, 'x-trigger','cron'),
      body := '{}'::jsonb);
  $cron$, v_url || '/break-even-alert', v_anon));
END $$;
