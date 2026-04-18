CREATE OR REPLACE FUNCTION public.get_admin_likes_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _summary jsonb;
  _top_fans jsonb;
  _top_tracks jsonb;
  _top_artists jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  SELECT jsonb_build_object(
    'total_likes', (SELECT count(*) FROM liked_songs),
    'unique_fans', (SELECT count(DISTINCT user_id) FROM liked_songs),
    'unique_tracks_liked', (SELECT count(DISTINCT track_id) FROM liked_songs),
    'likes_today', (SELECT count(*) FROM liked_songs WHERE liked_at >= date_trunc('day', now())),
    'likes_week', (SELECT count(*) FROM liked_songs WHERE liked_at >= now() - interval '7 days')
  ) INTO _summary;

  SELECT jsonb_agg(row_to_json(f)) INTO _top_fans FROM (
    SELECT ls.user_id, count(*) AS likes_given,
           u.email, p.display_name
    FROM liked_songs ls
    LEFT JOIN auth.users u ON u.id = ls.user_id
    LEFT JOIN profiles p ON p.user_id = ls.user_id
    GROUP BY ls.user_id, u.email, p.display_name
    ORDER BY likes_given DESC
    LIMIT 50
  ) f;

  SELECT jsonb_agg(row_to_json(t)) INTO _top_tracks FROM (
    SELECT t.id, t.title, t.artist, t.user_id AS owner_id,
           p.display_name AS owner_name,
           count(ls.id) AS likes_count
    FROM tracks t
    JOIN liked_songs ls ON ls.track_id = t.id
    LEFT JOIN profiles p ON p.user_id = t.user_id
    GROUP BY t.id, t.title, t.artist, t.user_id, p.display_name
    ORDER BY likes_count DESC
    LIMIT 50
  ) t;

  SELECT jsonb_agg(row_to_json(a)) INTO _top_artists FROM (
    SELECT t.user_id, p.display_name, u.email,
           count(ls.id) AS total_likes_received,
           count(DISTINCT t.id) AS tracks_with_likes
    FROM tracks t
    JOIN liked_songs ls ON ls.track_id = t.id AND ls.user_id <> t.user_id
    LEFT JOIN profiles p ON p.user_id = t.user_id
    LEFT JOIN auth.users u ON u.id = t.user_id
    WHERE t.user_id IS NOT NULL
    GROUP BY t.user_id, p.display_name, u.email
    ORDER BY total_likes_received DESC
    LIMIT 50
  ) a;

  RETURN jsonb_build_object(
    'summary', _summary,
    'top_fans', COALESCE(_top_fans, '[]'::jsonb),
    'top_tracks', COALESCE(_top_tracks, '[]'::jsonb),
    'top_artists', COALESCE(_top_artists, '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_likes_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _given int;
  _received int;
  _top_tracks jsonb;
  _recent_fans jsonb;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  SELECT count(*) INTO _given FROM liked_songs WHERE user_id = _user_id;

  SELECT count(*) INTO _received
  FROM liked_songs ls JOIN tracks t ON t.id = ls.track_id
  WHERE t.user_id = _user_id AND ls.user_id <> _user_id;

  SELECT jsonb_agg(row_to_json(x)) INTO _top_tracks FROM (
    SELECT t.id, t.title, t.cover_url, count(ls.id) AS likes
    FROM tracks t
    LEFT JOIN liked_songs ls ON ls.track_id = t.id AND ls.user_id <> t.user_id
    WHERE t.user_id = _user_id
    GROUP BY t.id, t.title, t.cover_url
    HAVING count(ls.id) > 0
    ORDER BY likes DESC
    LIMIT 10
  ) x;

  SELECT jsonb_agg(row_to_json(r)) INTO _recent_fans FROM (
    SELECT ls.liked_at, ls.track_id, t.title AS track_title,
           p.display_name AS fan_name, p.avatar_url AS fan_avatar
    FROM liked_songs ls
    JOIN tracks t ON t.id = ls.track_id
    LEFT JOIN profiles p ON p.user_id = ls.user_id
    WHERE t.user_id = _user_id AND ls.user_id <> _user_id
    ORDER BY ls.liked_at DESC
    LIMIT 10
  ) r;

  RETURN jsonb_build_object(
    'likes_given', _given,
    'likes_received', _received,
    'top_tracks', COALESCE(_top_tracks, '[]'::jsonb),
    'recent_fans', COALESCE(_recent_fans, '[]'::jsonb)
  );
END;
$$;