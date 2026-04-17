-- Bonus za 5 sesji wykrywania nastroju
CREATE OR REPLACE FUNCTION public.claim_mood_sessions_milestone_bonus()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _sessions_count integer;
  _bonus_amount numeric := 5;
  _target_track_id uuid;
  _already boolean;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.creator_milestone_bonuses
    WHERE user_id = _user_id AND bonus_type = 'mood_sessions_5'
  ) INTO _already;

  IF _already THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_claimed');
  END IF;

  SELECT count(*) INTO _sessions_count
  FROM public.mood_sessions
  WHERE user_id = _user_id;

  IF _sessions_count < 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_eligible', 'current', _sessions_count, 'required', 5);
  END IF;

  INSERT INTO public.creator_milestone_bonuses (user_id, bonus_type, amount)
  VALUES (_user_id, 'mood_sessions_5', _bonus_amount);

  SELECT id INTO _target_track_id
  FROM public.tracks
  WHERE user_id = _user_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF _target_track_id IS NOT NULL THEN
    INSERT INTO public.creator_earnings (user_id, track_id, amount, earning_type, description)
    VALUES (_user_id, _target_track_id, _bonus_amount, 'bonus', 'Bonus za 5 sesji rozpoznawania nastroju 🧠');

    UPDATE public.tracks
    SET total_earnings = total_earnings + _bonus_amount
    WHERE id = _target_track_id AND user_id = _user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'amount', _bonus_amount);
END;
$$;

-- Bonus za 5 utworów w GrouAI Studio (tylko Ultimate)
CREATE OR REPLACE FUNCTION public.claim_studio_milestone_bonus()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _studio_count integer;
  _bonus_amount numeric := 12;
  _target_track_id uuid;
  _already boolean;
  _is_ultimate boolean;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- Sprawdź subskrypcję Ultimate
  SELECT EXISTS(
    SELECT 1 FROM public.user_subscriptions
    WHERE user_id = _user_id
      AND plan = 'ultimate'::subscription_plan
      AND status = 'active'
  ) INTO _is_ultimate;

  IF NOT _is_ultimate THEN
    RETURN jsonb_build_object('success', false, 'error', 'requires_ultimate');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.creator_milestone_bonuses
    WHERE user_id = _user_id AND bonus_type = 'studio_5'
  ) INTO _already;

  IF _already THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_claimed');
  END IF;

  -- Liczy utwory z AI (audio_url zawiera 'suno' lub 'replicate')
  SELECT count(*) INTO _studio_count
  FROM public.tracks
  WHERE user_id = _user_id
    AND (audio_url ILIKE '%suno%' OR audio_url ILIKE '%replicate%');

  IF _studio_count < 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_eligible', 'current', _studio_count, 'required', 5);
  END IF;

  INSERT INTO public.creator_milestone_bonuses (user_id, bonus_type, amount)
  VALUES (_user_id, 'studio_5', _bonus_amount);

  SELECT id INTO _target_track_id
  FROM public.tracks
  WHERE user_id = _user_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF _target_track_id IS NOT NULL THEN
    INSERT INTO public.creator_earnings (user_id, track_id, amount, earning_type, description)
    VALUES (_user_id, _target_track_id, _bonus_amount, 'bonus', 'Bonus za 5 utworów w GrouAI Studio (Ultimate) 🎛️');

    UPDATE public.tracks
    SET total_earnings = total_earnings + _bonus_amount
    WHERE id = _target_track_id AND user_id = _user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'amount', _bonus_amount);
END;
$$;