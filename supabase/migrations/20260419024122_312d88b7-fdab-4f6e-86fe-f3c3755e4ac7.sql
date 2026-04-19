CREATE OR REPLACE FUNCTION public.log_seo_activity(
  _action_type text,
  _level text,
  _message text,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _triggered_by text DEFAULT 'cron'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE _id uuid;
BEGIN
  INSERT INTO public.seo_activity_log (action_type, level, message, metadata, triggered_by)
  VALUES (_action_type, _level, _message, _metadata, _triggered_by)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_seo_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
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