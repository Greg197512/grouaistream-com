
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
  today_start timestamptz;
BEGIN
  -- Only allow admins
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  today_start := date_trunc('day', now());

  SELECT json_build_object(
    'total_mood_sessions', (SELECT count(*) FROM public.mood_sessions),
    'active_today', (SELECT count(DISTINCT user_id) FROM public.listening_history WHERE played_at >= today_start),
    'total_tracks', (SELECT count(*) FROM public.tracks),
    'total_users', (SELECT count(*) FROM public.profiles)
  ) INTO result;

  RETURN result;
END;
$$;
