-- Tabela wyzwań weekendowych (AI generuje co weekend)
CREATE TABLE IF NOT EXISTS public.weekend_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  activity_type text NOT NULL CHECK (activity_type IN ('uploads','ratings','mood_sessions','studio_tracks','listens')),
  target_count integer NOT NULL CHECK (target_count > 0),
  reward_amount numeric NOT NULL CHECK (reward_amount > 0 AND reward_amount <= 5),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  generated_by_ai boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weekend_challenges_active ON public.weekend_challenges(is_active, ends_at);

ALTER TABLE public.weekend_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active challenges"
  ON public.weekend_challenges FOR SELECT
  USING (is_active = true AND now() BETWEEN starts_at AND ends_at);

CREATE POLICY "Admins manage all challenges"
  ON public.weekend_challenges FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Tabela odebranych wyzwań
CREATE TABLE IF NOT EXISTS public.weekend_challenge_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  challenge_id uuid NOT NULL REFERENCES public.weekend_challenges(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, challenge_id)
);

ALTER TABLE public.weekend_challenge_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own claims"
  ON public.weekend_challenge_claims FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all claims"
  ON public.weekend_challenge_claims FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Pobierz aktywne wyzwanie
CREATE OR REPLACE FUNCTION public.get_active_weekend_challenge()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _challenge record;
  _progress integer := 0;
  _claimed boolean := false;
  _window_start timestamptz;
BEGIN
  SELECT * INTO _challenge
  FROM public.weekend_challenges
  WHERE is_active = true
    AND now() BETWEEN starts_at AND ends_at
  ORDER BY created_at DESC
  LIMIT 1;

  IF _challenge.id IS NULL THEN
    RETURN jsonb_build_object('active', false);
  END IF;

  IF _user_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.weekend_challenge_claims
                  WHERE user_id = _user_id AND challenge_id = _challenge.id)
    INTO _claimed;

    _window_start := _challenge.starts_at;

    IF _challenge.activity_type = 'uploads' THEN
      SELECT count(*) INTO _progress FROM public.tracks
      WHERE user_id = _user_id AND created_at >= _window_start;
    ELSIF _challenge.activity_type = 'ratings' THEN
      SELECT count(*) INTO _progress FROM public.track_ratings
      WHERE user_id = _user_id AND created_at >= _window_start;
    ELSIF _challenge.activity_type = 'mood_sessions' THEN
      SELECT count(*) INTO _progress FROM public.mood_sessions
      WHERE user_id = _user_id AND detected_at >= _window_start;
    ELSIF _challenge.activity_type = 'studio_tracks' THEN
      SELECT count(*) INTO _progress FROM public.tracks
      WHERE user_id = _user_id AND created_at >= _window_start
        AND (audio_url ILIKE '%suno%' OR audio_url ILIKE '%replicate%');
    ELSIF _challenge.activity_type = 'listens' THEN
      SELECT count(*) INTO _progress FROM public.stream_events
      WHERE user_id = _user_id AND counted = true AND streamed_at >= _window_start;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'active', true,
    'id', _challenge.id,
    'title', _challenge.title,
    'description', _challenge.description,
    'activity_type', _challenge.activity_type,
    'target_count', _challenge.target_count,
    'reward_amount', _challenge.reward_amount,
    'ends_at', _challenge.ends_at,
    'progress', _progress,
    'claimed', _claimed,
    'eligible', (_progress >= _challenge.target_count AND NOT _claimed)
  );
END;
$$;

-- Odbierz nagrodę za wyzwanie
CREATE OR REPLACE FUNCTION public.claim_weekend_challenge(_challenge_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _challenge record;
  _progress integer := 0;
  _target_track_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT * INTO _challenge FROM public.weekend_challenges
  WHERE id = _challenge_id AND is_active = true AND now() BETWEEN starts_at AND ends_at;

  IF _challenge.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'challenge_not_active');
  END IF;

  IF EXISTS(SELECT 1 FROM public.weekend_challenge_claims
            WHERE user_id = _user_id AND challenge_id = _challenge_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_claimed');
  END IF;

  IF _challenge.activity_type = 'uploads' THEN
    SELECT count(*) INTO _progress FROM public.tracks
    WHERE user_id = _user_id AND created_at >= _challenge.starts_at;
  ELSIF _challenge.activity_type = 'ratings' THEN
    SELECT count(*) INTO _progress FROM public.track_ratings
    WHERE user_id = _user_id AND created_at >= _challenge.starts_at;
  ELSIF _challenge.activity_type = 'mood_sessions' THEN
    SELECT count(*) INTO _progress FROM public.mood_sessions
    WHERE user_id = _user_id AND detected_at >= _challenge.starts_at;
  ELSIF _challenge.activity_type = 'studio_tracks' THEN
    SELECT count(*) INTO _progress FROM public.tracks
    WHERE user_id = _user_id AND created_at >= _challenge.starts_at
      AND (audio_url ILIKE '%suno%' OR audio_url ILIKE '%replicate%');
  ELSIF _challenge.activity_type = 'listens' THEN
    SELECT count(*) INTO _progress FROM public.stream_events
    WHERE user_id = _user_id AND counted = true AND streamed_at >= _challenge.starts_at;
  END IF;

  IF _progress < _challenge.target_count THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_eligible',
                              'current', _progress, 'required', _challenge.target_count);
  END IF;

  INSERT INTO public.weekend_challenge_claims (user_id, challenge_id, amount)
  VALUES (_user_id, _challenge_id, _challenge.reward_amount);

  -- Wpada do portfela usera
  SELECT id INTO _target_track_id FROM public.tracks
  WHERE user_id = _user_id ORDER BY created_at ASC LIMIT 1;

  IF _target_track_id IS NOT NULL THEN
    INSERT INTO public.creator_earnings (user_id, track_id, amount, earning_type, description)
    VALUES (_user_id, _target_track_id, _challenge.reward_amount, 'weekend_bonus',
            'Wyzwanie weekendowe: ' || _challenge.title || ' 🎉');
    UPDATE public.tracks SET total_earnings = total_earnings + _challenge.reward_amount
    WHERE id = _target_track_id AND user_id = _user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'amount', _challenge.reward_amount);
END;
$$;

-- Admin tworzy wyzwanie (używane przez edge function AI)
CREATE OR REPLACE FUNCTION public.admin_create_weekend_challenge(
  _title text, _description text, _activity_type text,
  _target_count integer, _reward_amount numeric, _duration_hours integer DEFAULT 72
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _new_id uuid;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- Wyłącz poprzednie aktywne wyzwania
  UPDATE public.weekend_challenges SET is_active = false WHERE is_active = true;

  INSERT INTO public.weekend_challenges
    (title, description, activity_type, target_count, reward_amount, ends_at, created_by)
  VALUES (_title, _description, _activity_type, _target_count, _reward_amount,
          now() + (_duration_hours || ' hours')::interval, auth.uid())
  RETURNING id INTO _new_id;

  RETURN jsonb_build_object('success', true, 'id', _new_id);
END;
$$;

-- Raport finansowy admina
CREATE OR REPLACE FUNCTION public.get_admin_financial_overview()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE _result jsonb; _summary jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  SELECT jsonb_build_object(
    'total_streams_paid', COALESCE((SELECT sum(amount) FROM creator_earnings WHERE earning_type = 'stream'), 0),
    'total_bonuses_paid', COALESCE((SELECT sum(amount) FROM creator_earnings WHERE earning_type = 'bonus'), 0),
    'total_weekend_paid', COALESCE((SELECT sum(amount) FROM creator_earnings WHERE earning_type = 'weekend_bonus'), 0),
    'total_earnings_all', COALESCE((SELECT sum(amount) FROM creator_earnings), 0),
    'total_payouts_paid', COALESCE((SELECT sum(amount) FROM payout_requests WHERE status = 'paid'), 0),
    'total_payouts_pending', COALESCE((SELECT sum(amount) FROM payout_requests WHERE status = 'pending'), 0),
    'users_with_balance', (SELECT count(DISTINCT user_id) FROM creator_earnings)
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
$$;