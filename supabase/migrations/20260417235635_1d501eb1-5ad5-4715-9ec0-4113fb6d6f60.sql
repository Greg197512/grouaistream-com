
-- Tabela danych wypłat
CREATE TABLE IF NOT EXISTS public.payout_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  payout_request_id UUID REFERENCES public.payout_requests(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  city TEXT NOT NULL,
  bank_account TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payout_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own payout details"
  ON public.payout_details FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own payout details"
  ON public.payout_details FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all payout details"
  ON public.payout_details FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Funkcja: postępy bonusów wszystkich userów (admin only)
CREATE OR REPLACE FUNCTION public.get_all_users_bonus_progress()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  SELECT jsonb_agg(row_to_json(t)) INTO _result FROM (
    SELECT 
      u.id AS user_id,
      u.email,
      p.display_name,
      -- liczniki
      (SELECT count(*) FROM public.tracks WHERE user_id = u.id) AS uploads_count,
      (SELECT count(*) FROM public.liked_songs ls 
        JOIN public.tracks t ON t.id = ls.track_id 
        WHERE t.user_id = u.id AND ls.user_id <> u.id) AS likes_count,
      (SELECT count(*) FROM public.mood_sessions WHERE user_id = u.id) AS mood_sessions_count,
      (SELECT count(*) FROM public.tracks 
        WHERE user_id = u.id AND (audio_url ILIKE '%suno%' OR audio_url ILIKE '%replicate%')) AS studio_count,
      -- juz odebrane
      (SELECT EXISTS(SELECT 1 FROM public.creator_milestone_bonuses WHERE user_id = u.id AND bonus_type = 'uploads_50')) AS uploads_claimed,
      (SELECT EXISTS(SELECT 1 FROM public.creator_milestone_bonuses WHERE user_id = u.id AND bonus_type = 'likes_50')) AS likes_claimed,
      (SELECT EXISTS(SELECT 1 FROM public.creator_milestone_bonuses WHERE user_id = u.id AND bonus_type = 'mood_sessions_5')) AS mood_claimed,
      (SELECT EXISTS(SELECT 1 FROM public.creator_milestone_bonuses WHERE user_id = u.id AND bonus_type = 'studio_5')) AS studio_claimed,
      (SELECT EXISTS(SELECT 1 FROM public.mood_analysis_bonuses WHERE user_id = u.id)) AS mood_first_claimed,
      -- saldo
      COALESCE((SELECT sum(amount) FROM public.creator_earnings WHERE user_id = u.id), 0) AS total_earned,
      COALESCE((SELECT sum(amount) FROM public.payout_requests WHERE user_id = u.id AND status IN ('pending','processed','paid')), 0) AS total_requested
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.user_id = u.id
    ORDER BY u.created_at DESC
  ) t;

  RETURN COALESCE(_result, '[]'::jsonb);
END;
$$;

-- Funkcja: lista pendingowych wypłat dla admina
CREATE OR REPLACE FUNCTION public.get_pending_payouts()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  SELECT jsonb_agg(row_to_json(t)) INTO _result FROM (
    SELECT 
      pd.id AS detail_id,
      pd.user_id,
      pd.full_name,
      pd.city,
      pd.bank_account,
      pd.amount,
      pd.acknowledged,
      pd.created_at,
      pr.id AS payout_request_id,
      pr.status AS request_status,
      u.email,
      p.display_name
    FROM public.payout_details pd
    LEFT JOIN public.payout_requests pr ON pr.id = pd.payout_request_id
    LEFT JOIN auth.users u ON u.id = pd.user_id
    LEFT JOIN public.profiles p ON p.user_id = pd.user_id
    WHERE pd.acknowledged = false
    ORDER BY pd.created_at ASC
  ) t;

  RETURN COALESCE(_result, '[]'::jsonb);
END;
$$;

-- Funkcja: utwórz wniosek o wypłatę z danymi
CREATE OR REPLACE FUNCTION public.submit_payout_request(
  _full_name TEXT,
  _city TEXT,
  _bank_account TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _balance NUMERIC;
  _already_requested NUMERIC;
  _available NUMERIC;
  _request_id UUID;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  IF length(trim(_full_name)) < 3 OR length(trim(_city)) < 2 OR length(trim(_bank_account)) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_data');
  END IF;

  SELECT COALESCE(sum(amount), 0) INTO _balance
  FROM public.creator_earnings WHERE user_id = _user_id;

  SELECT COALESCE(sum(amount), 0) INTO _already_requested
  FROM public.payout_requests 
  WHERE user_id = _user_id AND status IN ('pending', 'processed', 'paid');

  _available := _balance - _already_requested;

  IF _available < 12 THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance', 'available', _available);
  END IF;

  INSERT INTO public.payout_requests (user_id, amount, status)
  VALUES (_user_id, _available, 'pending')
  RETURNING id INTO _request_id;

  INSERT INTO public.payout_details (user_id, payout_request_id, full_name, city, bank_account, amount)
  VALUES (_user_id, _request_id, trim(_full_name), trim(_city), trim(_bank_account), _available);

  RETURN jsonb_build_object('success', true, 'amount', _available, 'request_id', _request_id);
END;
$$;

-- Funkcja: admin potwierdza wypłatę
CREATE OR REPLACE FUNCTION public.acknowledge_payout(_detail_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin_id UUID := auth.uid();
  _request_id UUID;
BEGIN
  IF NOT has_role(_admin_id, 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  UPDATE public.payout_details
  SET acknowledged = true,
      acknowledged_at = now(),
      acknowledged_by = _admin_id
  WHERE id = _detail_id
  RETURNING payout_request_id INTO _request_id;

  IF _request_id IS NOT NULL THEN
    UPDATE public.payout_requests
    SET status = 'paid',
        processed_at = now()
    WHERE id = _request_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;
