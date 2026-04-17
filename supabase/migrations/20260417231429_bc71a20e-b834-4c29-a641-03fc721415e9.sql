CREATE OR REPLACE FUNCTION public.claim_mood_analysis_bonus()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _already_claimed boolean;
  _bonus_amount numeric := 10;
  _target_track_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.mood_analysis_bonuses WHERE user_id = _user_id)
  INTO _already_claimed;

  IF _already_claimed THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_claimed', 'amount', 0);
  END IF;

  INSERT INTO public.mood_analysis_bonuses (user_id, amount)
  VALUES (_user_id, _bonus_amount);

  SELECT id INTO _target_track_id
  FROM public.tracks
  WHERE user_id = _user_id
  LIMIT 1;

  IF _target_track_id IS NULL THEN
    SELECT id INTO _target_track_id
    FROM public.tracks
    LIMIT 1;
  END IF;

  IF _target_track_id IS NOT NULL THEN
    INSERT INTO public.creator_earnings (user_id, track_id, amount, earning_type, description)
    VALUES (_user_id, _target_track_id, _bonus_amount, 'bonus', 'Bonus za pierwszą analizę nastroju AI 🎁');

    UPDATE public.tracks
    SET total_earnings = total_earnings + _bonus_amount
    WHERE id = _target_track_id
      AND user_id = _user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'amount', _bonus_amount);
END;
$function$;