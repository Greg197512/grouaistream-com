-- Track which users have received the one-time mood analysis bonus
CREATE TABLE IF NOT EXISTS public.mood_analysis_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  amount numeric NOT NULL DEFAULT 10,
  granted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mood_analysis_bonuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own mood bonus"
ON public.mood_analysis_bonuses FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all mood bonuses"
ON public.mood_analysis_bonuses FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- RPC: claim one-time 10 PLN bonus when user does first mood analysis
CREATE OR REPLACE FUNCTION public.claim_mood_analysis_bonus()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _already_claimed boolean;
  _bonus_amount numeric := 10;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.mood_analysis_bonuses WHERE user_id = _user_id)
  INTO _already_claimed;

  IF _already_claimed THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_claimed', 'amount', 0);
  END IF;

  -- Mark as claimed
  INSERT INTO public.mood_analysis_bonuses (user_id, amount)
  VALUES (_user_id, _bonus_amount);

  -- Credit the user's earnings — use a synthetic track-less earning
  -- earning_type='bonus' so it's clearly distinguishable in dashboards
  INSERT INTO public.creator_earnings (user_id, track_id, amount, earning_type, description)
  SELECT _user_id, t.id, _bonus_amount, 'bonus', 'Bonus za pierwszą analizę nastroju AI 🎁'
  FROM public.tracks t
  WHERE t.user_id = _user_id
  LIMIT 1;

  -- Fallback: if user has no own track, attach to ANY track (system bonus)
  IF NOT FOUND THEN
    INSERT INTO public.creator_earnings (user_id, track_id, amount, earning_type, description)
    SELECT _user_id, t.id, _bonus_amount, 'bonus', 'Bonus za pierwszą analizę nastroju AI 🎁'
    FROM public.tracks t
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object('success', true, 'amount', _bonus_amount);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_mood_analysis_bonus() TO authenticated;