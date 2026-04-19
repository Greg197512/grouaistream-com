-- SEO Activity Log
CREATE TABLE public.seo_activity_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_type text NOT NULL,
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  triggered_by text NOT NULL DEFAULT 'cron',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_seo_log_created ON public.seo_activity_log(created_at DESC);
CREATE INDEX idx_seo_log_type ON public.seo_activity_log(action_type, created_at DESC);

ALTER TABLE public.seo_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read seo logs"
ON public.seo_activity_log FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role inserts seo logs"
ON public.seo_activity_log FOR INSERT TO public
WITH CHECK (auth.role() = 'service_role');

-- SEO Blog Posts (AI-generated)
CREATE TABLE public.seo_blog_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL,
  content text NOT NULL,
  cover_url text,
  tags text[] DEFAULT '{}'::text[],
  category text NOT NULL DEFAULT 'general',
  is_published boolean NOT NULL DEFAULT true,
  view_count integer NOT NULL DEFAULT 0,
  generated_by_ai boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_blog_published ON public.seo_blog_posts(is_published, created_at DESC);
CREATE INDEX idx_blog_slug ON public.seo_blog_posts(slug);

ALTER TABLE public.seo_blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads published posts"
ON public.seo_blog_posts FOR SELECT TO public
USING (is_published = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage blog posts"
ON public.seo_blog_posts FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role inserts blog posts"
ON public.seo_blog_posts FOR INSERT TO public
WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER update_blog_posts_updated_at
BEFORE UPDATE ON public.seo_blog_posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SEO Keywords tracking
CREATE TABLE public.seo_keywords (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword text NOT NULL UNIQUE,
  category text NOT NULL DEFAULT 'general',
  priority integer NOT NULL DEFAULT 5,
  last_position integer,
  last_checked_at timestamp with time zone,
  total_clicks integer NOT NULL DEFAULT 0,
  total_impressions integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.seo_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage keywords"
ON public.seo_keywords FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- SEO Settings (singleton)
CREATE TABLE public.seo_settings (
  id integer NOT NULL DEFAULT 1 PRIMARY KEY CHECK (id = 1),
  auto_sitemap_enabled boolean NOT NULL DEFAULT true,
  auto_indexnow_enabled boolean NOT NULL DEFAULT true,
  auto_blog_enabled boolean NOT NULL DEFAULT true,
  auto_meta_enabled boolean NOT NULL DEFAULT true,
  blog_frequency_days integer NOT NULL DEFAULT 7,
  ping_frequency_hours integer NOT NULL DEFAULT 12,
  last_sitemap_at timestamp with time zone,
  last_indexnow_at timestamp with time zone,
  last_blog_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

INSERT INTO public.seo_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.seo_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage seo settings"
ON public.seo_settings FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Helper: log activity (callable from edge functions)
CREATE OR REPLACE FUNCTION public.log_seo_activity(
  _action_type text,
  _level text,
  _message text,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _triggered_by text DEFAULT 'cron'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id uuid;
BEGIN
  INSERT INTO public.seo_activity_log (action_type, level, message, metadata, triggered_by)
  VALUES (_action_type, _level, _message, _metadata, _triggered_by)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- Dashboard stats aggregator
CREATE OR REPLACE FUNCTION public.get_seo_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _result jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  SELECT jsonb_build_object(
    'total_actions_24h', (SELECT count(*) FROM seo_activity_log WHERE created_at >= now() - interval '24 hours'),
    'total_actions_7d', (SELECT count(*) FROM seo_activity_log WHERE created_at >= now() - interval '7 days'),
    'errors_24h', (SELECT count(*) FROM seo_activity_log WHERE created_at >= now() - interval '24 hours' AND level = 'error'),
    'success_24h', (SELECT count(*) FROM seo_activity_log WHERE created_at >= now() - interval '24 hours' AND level = 'success'),
    'total_blog_posts', (SELECT count(*) FROM seo_blog_posts WHERE is_published = true),
    'total_blog_views', (SELECT COALESCE(sum(view_count), 0) FROM seo_blog_posts),
    'total_keywords', (SELECT count(*) FROM seo_keywords WHERE is_active = true),
    'total_indexable_urls', (
      (SELECT count(*) FROM tracks WHERE audio_url IS NOT NULL) +
      (SELECT count(*) FROM playlists WHERE is_public = true) +
      (SELECT count(*) FROM seo_blog_posts WHERE is_published = true) +
      20
    ),
    'settings', (SELECT row_to_json(s) FROM seo_settings s WHERE id = 1),
    'recent_logs', (
      SELECT jsonb_agg(row_to_json(l)) FROM (
        SELECT id, action_type, level, message, metadata, triggered_by, created_at
        FROM seo_activity_log
        ORDER BY created_at DESC
        LIMIT 50
      ) l
    ),
    'daily_activity', (
      SELECT jsonb_agg(row_to_json(d)) FROM (
        SELECT date_trunc('day', created_at)::date AS day,
               count(*) AS total,
               count(*) FILTER (WHERE level = 'success') AS success,
               count(*) FILTER (WHERE level = 'error') AS errors
        FROM seo_activity_log
        WHERE created_at >= now() - interval '14 days'
        GROUP BY date_trunc('day', created_at)::date
        ORDER BY day ASC
      ) d
    ),
    'recent_blog_posts', (
      SELECT jsonb_agg(row_to_json(b)) FROM (
        SELECT id, title, slug, description, view_count, created_at, generated_by_ai
        FROM seo_blog_posts
        ORDER BY created_at DESC
        LIMIT 10
      ) b
    )
  ) INTO _result;

  RETURN _result;
END;
$$;

-- Seed initial keywords
INSERT INTO public.seo_keywords (keyword, category, priority) VALUES
  ('AI music streaming', 'core', 10),
  ('mood-based music player', 'core', 10),
  ('voice controlled music app', 'core', 9),
  ('GrouAI Stream', 'brand', 10),
  ('GrouaRock radio', 'brand', 9),
  ('AI DJ music mixing', 'feature', 8),
  ('emotional music recommendations', 'feature', 8),
  ('music for mood detection', 'feature', 8),
  ('upload music earn money', 'monetization', 9),
  ('AI music generator free', 'feature', 8)
ON CONFLICT (keyword) DO NOTHING;