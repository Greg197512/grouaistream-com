CREATE OR REPLACE FUNCTION public.get_admin_financial_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _result jsonb; _summary jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  SELECT jsonb_build_object(
    'total_streams_paid', COALESCE((SELECT sum(amount) FROM creator_earnings WHERE earning_type = 'stream'), 0),
    'total_bonuses_paid', COALESCE((SELECT sum(amount) FROM creator_earnings WHERE earning_type = 'bonus'), 0),
    'total_weekend_paid', COALESCE((SELECT sum(amount) FROM creator_earnings WHERE earning_type = 'weekend_bonus'), 0),
    'total_like_bonuses_paid', COALESCE((SELECT sum(amount) FROM creator_earnings WHERE earning_type = 'like_bonus'), 0),
    'total_tips_paid', COALESCE((SELECT sum(amount) FROM creator_earnings WHERE earning_type = 'tip'), 0),
    'total_earnings_all', COALESCE((SELECT sum(amount) FROM creator_earnings), 0),
    'total_payouts_paid', COALESCE((SELECT sum(amount) FROM payout_requests WHERE status = 'paid'), 0),
    'total_payouts_pending', COALESCE((SELECT sum(amount) FROM payout_requests WHERE status = 'pending'), 0),
    'users_with_balance', (SELECT count(DISTINCT user_id) FROM creator_earnings),
    'total_likes_count', (SELECT count(*) FROM liked_songs),
    'total_unique_likers', (SELECT count(DISTINCT user_id) FROM liked_songs)
  ) INTO _summary;

  SELECT jsonb_agg(row_to_json(t)) INTO _result FROM (
    SELECT
      ce.id, ce.user_id, ce.amount, ce.earning_type, ce.description, ce.created_at,
      u.email, p.display_name,
      'earning' AS row_kind
    FROM creator_earnings ce
    LEFT JOIN auth.users u ON u.id = ce.user_id
    LEFT JOIN profiles p ON p.user_id = ce.user_id
    UNION ALL
    SELECT
      pr.id, pr.user_id, -pr.amount AS amount, 'payout' AS earning_type,
      ('Wypłata: ' || pr.status) AS description,
      COALESCE(pr.processed_at, pr.requested_at) AS created_at,
      u.email, p.display_name, 'payout' AS row_kind
    FROM payout_requests pr
    LEFT JOIN auth.users u ON u.id = pr.user_id
    LEFT JOIN profiles p ON p.user_id = pr.user_id
    ORDER BY created_at DESC
    LIMIT 500
  ) t;

  RETURN jsonb_build_object('summary', _summary, 'transactions', COALESCE(_result, '[]'::jsonb));
END;
$function$;