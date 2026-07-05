
-- 1) Payments feed (purchases + tips)
CREATE OR REPLACE FUNCTION public.admin_payments_feed(_limit int DEFAULT 100)
RETURNS TABLE (
  kind text,
  created_at timestamptz,
  amount numeric,
  currency text,
  payer_id uuid,
  payer_name text,
  recipient_id uuid,
  recipient_name text,
  product text,
  ref_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  RETURN QUERY
  (
    SELECT 'purchase'::text,
           o.created_at,
           o.amount,
           o.currency,
           o.user_id,
           pb.display_name,
           o.recipient_user_id,
           pr.display_name,
           o.product_id,
           o.paddle_transaction_id
    FROM one_time_purchases o
    LEFT JOIN profiles pb ON pb.user_id = o.user_id
    LEFT JOIN profiles pr ON pr.user_id = o.recipient_user_id
    WHERE o.refunded_at IS NULL
    ORDER BY o.created_at DESC
    LIMIT _limit
  )
  UNION ALL
  (
    SELECT 'tip'::text,
           t.created_at,
           t.amount,
           'EUR'::text,
           t.sender_id,
           ps.display_name,
           t.recipient_id,
           pr.display_name,
           COALESCE(t.tx_type,'tip'),
           t.id::text
    FROM tip_transactions t
    LEFT JOIN profiles ps ON ps.user_id = t.sender_id
    LEFT JOIN profiles pr ON pr.user_id = t.recipient_id
    ORDER BY t.created_at DESC
    LIMIT _limit
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_payments_feed(int) TO authenticated;

-- 2) Payouts due
CREATE OR REPLACE FUNCTION public.admin_payouts_due(_min_amount numeric DEFAULT 5)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  total_earned numeric,
  total_paid numeric,
  balance numeric,
  full_name text,
  city text,
  bank_account text,
  last_request_at timestamptz,
  last_request_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  RETURN QUERY
  WITH earn AS (
    SELECT ce.user_id, COALESCE(SUM(ce.amount),0) AS total_earned
    FROM creator_earnings ce GROUP BY ce.user_id
  ),
  paid AS (
    SELECT pr.user_id,
           COALESCE(SUM(pr.amount) FILTER (WHERE pr.status IN ('paid','completed')),0) AS total_paid,
           MAX(pr.requested_at) AS last_request_at,
           (ARRAY_AGG(pr.status ORDER BY pr.requested_at DESC))[1] AS last_request_status
    FROM payout_requests pr GROUP BY pr.user_id
  ),
  bank AS (
    SELECT DISTINCT ON (pd.user_id)
      pd.user_id, pd.full_name, pd.city, pd.bank_account
    FROM payout_details pd
    ORDER BY pd.user_id, pd.created_at DESC
  )
  SELECT
    e.user_id,
    p.display_name,
    e.total_earned,
    COALESCE(pa.total_paid,0) AS total_paid,
    (e.total_earned - COALESCE(pa.total_paid,0)) AS balance,
    b.full_name, b.city, b.bank_account,
    pa.last_request_at, pa.last_request_status
  FROM earn e
  LEFT JOIN profiles p ON p.user_id = e.user_id
  LEFT JOIN paid pa ON pa.user_id = e.user_id
  LEFT JOIN bank b ON b.user_id = e.user_id
  WHERE (e.total_earned - COALESCE(pa.total_paid,0)) >= _min_amount
  ORDER BY (e.total_earned - COALESCE(pa.total_paid,0)) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_payouts_due(numeric) TO authenticated;

-- 3) IP fraud detection — accounts sharing the same signup/login IP
CREATE OR REPLACE FUNCTION public.admin_ip_fraud(_min_accounts int DEFAULT 2)
RETURNS TABLE (
  ip_address text,
  account_count bigint,
  user_ids uuid[],
  display_names text[],
  emails text[],
  earnings_total numeric,
  last_seen timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  RETURN QUERY
  WITH ips AS (
    SELECT
      (a.payload->>'actor_id')::uuid AS uid,
      COALESCE(NULLIF(a.ip_address::text,''), a.payload->>'ip_address') AS ip,
      a.created_at
    FROM auth.audit_log_entries a
    WHERE a.payload->>'actor_id' IS NOT NULL
      AND COALESCE(NULLIF(a.ip_address::text,''), a.payload->>'ip_address') IS NOT NULL
  ),
  grouped AS (
    SELECT ip,
           ARRAY_AGG(DISTINCT uid) AS uids,
           MAX(created_at) AS last_seen
    FROM ips
    GROUP BY ip
    HAVING COUNT(DISTINCT uid) >= _min_accounts
  )
  SELECT
    g.ip,
    array_length(g.uids,1)::bigint AS account_count,
    g.uids,
    ARRAY(SELECT COALESCE(p.display_name,'—') FROM unnest(g.uids) u LEFT JOIN profiles p ON p.user_id=u),
    ARRAY(SELECT u2.email FROM unnest(g.uids) u LEFT JOIN auth.users u2 ON u2.id=u),
    (SELECT COALESCE(SUM(ce.amount),0) FROM creator_earnings ce WHERE ce.user_id = ANY(g.uids)),
    g.last_seen
  FROM grouped g
  ORDER BY account_count DESC, last_seen DESC
  LIMIT 200;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_ip_fraud(int) TO authenticated;
