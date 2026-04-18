-- 1. Tabela ocen
CREATE TABLE public.track_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  track_id UUID NOT NULL,
  stars SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  listened_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, track_id)
);

CREATE INDEX idx_track_ratings_user ON public.track_ratings(user_id);
CREATE INDEX idx_track_ratings_track ON public.track_ratings(track_id);

ALTER TABLE public.track_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own ratings"
  ON public.track_ratings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own ratings"
  ON public.track_ratings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Track owners view ratings on their tracks"
  ON public.track_ratings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tracks t WHERE t.id = track_id AND t.user_id = auth.uid()));

CREATE POLICY "Admins view all ratings"
  ON public.track_ratings FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Atomowy submit ratingu + lajka
CREATE OR REPLACE FUNCTION public.submit_rating_with_like(
  _track_id UUID,
  _stars SMALLINT,
  _listened_seconds INTEGER
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  IF _stars < 1 OR _stars > 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_stars');
  END IF;

  INSERT INTO public.track_ratings (user_id, track_id, stars, listened_seconds)
  VALUES (_user_id, _track_id, _stars, GREATEST(_listened_seconds, 0))
  ON CONFLICT (user_id, track_id) DO UPDATE
    SET stars = EXCLUDED.stars,
        listened_seconds = GREATEST(track_ratings.listened_seconds, EXCLUDED.listened_seconds);

  INSERT INTO public.liked_songs (user_id, track_id)
  VALUES (_user_id, _track_id)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 3. Bonus za 50 ocen
CREATE OR REPLACE FUNCTION public.claim_ratings_50_milestone_bonus()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _count integer;
  _bonus_amount numeric := 12;
  _target_track_id uuid;
  _already boolean;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.creator_milestone_bonuses
    WHERE user_id = _user_id AND bonus_type = 'ratings_50'
  ) INTO _already;

  IF _already THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_claimed');
  END IF;

  SELECT count(*) INTO _count
  FROM public.track_ratings
  WHERE user_id = _user_id;

  IF _count < 50 THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_eligible', 'current', _count, 'required', 50);
  END IF;

  INSERT INTO public.creator_milestone_bonuses (user_id, bonus_type, amount)
  VALUES (_user_id, 'ratings_50', _bonus_amount);

  SELECT id INTO _target_track_id
  FROM public.tracks WHERE user_id = _user_id ORDER BY created_at ASC LIMIT 1;

  IF _target_track_id IS NOT NULL THEN
    INSERT INTO public.creator_earnings (user_id, track_id, amount, earning_type, description)
    VALUES (_user_id, _target_track_id, _bonus_amount, 'bonus', 'Bonus za 50 ocen utworów ⭐');

    UPDATE public.tracks SET total_earnings = total_earnings + _bonus_amount
    WHERE id = _target_track_id AND user_id = _user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'amount', _bonus_amount);
END;
$$;

-- 4. Admin: wszystkie oceny z flagą podejrzane
CREATE OR REPLACE FUNCTION public.get_all_ratings_for_admin(_only_suspicious boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
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
      tr.id,
      tr.user_id,
      u.email AS user_email,
      p.display_name AS user_name,
      tr.track_id,
      tk.title AS track_title,
      tk.artist AS track_artist,
      tr.stars,
      tr.listened_seconds,
      tr.created_at,
      (tr.listened_seconds < 30) AS is_suspicious_short,
      (tr.stars = 5) AS is_max_stars
    FROM public.track_ratings tr
    LEFT JOIN auth.users u ON u.id = tr.user_id
    LEFT JOIN public.profiles p ON p.user_id = tr.user_id
    LEFT JOIN public.tracks tk ON tk.id = tr.track_id
    WHERE (_only_suspicious = false OR tr.listened_seconds < 30)
    ORDER BY tr.created_at DESC
    LIMIT 1000
  ) t;

  RETURN COALESCE(_result, '[]'::jsonb);
END;
$$;

-- 5. Aktualizacja postępu bonusów: dodaj ratings_count i ratings_claimed
CREATE OR REPLACE FUNCTION public.get_all_users_bonus_progress()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
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
      (SELECT count(*) FROM public.tracks WHERE user_id = u.id) AS uploads_count,
      (SELECT count(*) FROM public.liked_songs ls 
        JOIN public.tracks t ON t.id = ls.track_id 
        WHERE t.user_id = u.id AND ls.user_id <> u.id) AS likes_count,
      (SELECT count(*) FROM public.mood_sessions WHERE user_id = u.id) AS mood_sessions_count,
      (SELECT count(*) FROM public.tracks 
        WHERE user_id = u.id AND (audio_url ILIKE '%suno%' OR audio_url ILIKE '%replicate%')) AS studio_count,
      (SELECT count(*) FROM public.track_ratings WHERE user_id = u.id) AS ratings_count,
      (SELECT EXISTS(SELECT 1 FROM public.creator_milestone_bonuses WHERE user_id = u.id AND bonus_type = 'uploads_50')) AS uploads_claimed,
      (SELECT EXISTS(SELECT 1 FROM public.creator_milestone_bonuses WHERE user_id = u.id AND bonus_type = 'likes_50')) AS likes_claimed,
      (SELECT EXISTS(SELECT 1 FROM public.creator_milestone_bonuses WHERE user_id = u.id AND bonus_type = 'mood_sessions_5')) AS mood_claimed,
      (SELECT EXISTS(SELECT 1 FROM public.creator_milestone_bonuses WHERE user_id = u.id AND bonus_type = 'studio_5')) AS studio_claimed,
      (SELECT EXISTS(SELECT 1 FROM public.creator_milestone_bonuses WHERE user_id = u.id AND bonus_type = 'ratings_50')) AS ratings_claimed,
      (SELECT EXISTS(SELECT 1 FROM public.mood_analysis_bonuses WHERE user_id = u.id)) AS mood_first_claimed,
      COALESCE((SELECT sum(amount) FROM public.creator_earnings WHERE user_id = u.id), 0) AS total_earned,
      COALESCE((SELECT sum(amount) FROM public.payout_requests WHERE user_id = u.id AND status IN ('pending','processed','paid')), 0) AS total_requested
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.user_id = u.id
    ORDER BY u.created_at DESC
  ) t;

  RETURN COALESCE(_result, '[]'::jsonb);
END;
$$;