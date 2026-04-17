-- Tabela bonusów milestone (uploady, lajki itp.)
CREATE TABLE IF NOT EXISTS public.creator_milestone_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bonus_type text NOT NULL,
  amount numeric NOT NULL DEFAULT 12,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, bonus_type)
);

ALTER TABLE public.creator_milestone_bonuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own milestone bonuses"
ON public.creator_milestone_bonuses
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all milestone bonuses"
ON public.creator_milestone_bonuses
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Bonus za 50 uploadów własnych utworów
CREATE OR REPLACE FUNCTION public.claim_upload_milestone_bonus()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _track_count integer;
  _bonus_amount numeric := 12;
  _target_track_id uuid;
  _already boolean;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.creator_milestone_bonuses
    WHERE user_id = _user_id AND bonus_type = 'uploads_50'
  ) INTO _already;

  IF _already THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_claimed');
  END IF;

  SELECT count(*) INTO _track_count
  FROM public.tracks
  WHERE user_id = _user_id;

  IF _track_count < 50 THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_eligible', 'current', _track_count, 'required', 50);
  END IF;

  INSERT INTO public.creator_milestone_bonuses (user_id, bonus_type, amount)
  VALUES (_user_id, 'uploads_50', _bonus_amount);

  SELECT id INTO _target_track_id
  FROM public.tracks
  WHERE user_id = _user_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF _target_track_id IS NOT NULL THEN
    INSERT INTO public.creator_earnings (user_id, track_id, amount, earning_type, description)
    VALUES (_user_id, _target_track_id, _bonus_amount, 'bonus', 'Bonus za 50 dodanych utworów 🎁');

    UPDATE public.tracks
    SET total_earnings = total_earnings + _bonus_amount
    WHERE id = _target_track_id AND user_id = _user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'amount', _bonus_amount);
END;
$$;

-- Bonus za 50 polubień własnych utworów przez innych
CREATE OR REPLACE FUNCTION public.claim_likes_milestone_bonus()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _likes_count integer;
  _bonus_amount numeric := 12;
  _target_track_id uuid;
  _already boolean;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.creator_milestone_bonuses
    WHERE user_id = _user_id AND bonus_type = 'likes_50'
  ) INTO _already;

  IF _already THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_claimed');
  END IF;

  SELECT count(*) INTO _likes_count
  FROM public.liked_songs ls
  JOIN public.tracks t ON t.id = ls.track_id
  WHERE t.user_id = _user_id
    AND ls.user_id <> _user_id;

  IF _likes_count < 50 THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_eligible', 'current', _likes_count, 'required', 50);
  END IF;

  INSERT INTO public.creator_milestone_bonuses (user_id, bonus_type, amount)
  VALUES (_user_id, 'likes_50', _bonus_amount);

  SELECT id INTO _target_track_id
  FROM public.tracks
  WHERE user_id = _user_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF _target_track_id IS NOT NULL THEN
    INSERT INTO public.creator_earnings (user_id, track_id, amount, earning_type, description)
    VALUES (_user_id, _target_track_id, _bonus_amount, 'bonus', 'Bonus za 50 polubień Twoich utworów 🎁');

    UPDATE public.tracks
    SET total_earnings = total_earnings + _bonus_amount
    WHERE id = _target_track_id AND user_id = _user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'amount', _bonus_amount);
END;
$$;