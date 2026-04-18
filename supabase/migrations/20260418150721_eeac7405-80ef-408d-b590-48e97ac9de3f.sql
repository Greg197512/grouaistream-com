
CREATE OR REPLACE FUNCTION public.grant_track_starter_bonus()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Auto-create tip wallet z 5€ dla nowych twórców
  INSERT INTO public.tip_wallets (user_id, balance, welcome_seen)
  VALUES (NEW.user_id, 5.00, false)
  ON CONFLICT (user_id) DO NOTHING;

  -- Bonus startowy 0,30 € za każdy uploadowany utwór
  INSERT INTO public.creator_earnings (user_id, track_id, amount, earning_type, description)
  VALUES (NEW.user_id, NEW.id, 0.30, 'bonus', 'Bonus startowy 0,30 € za utwór 🎁');

  -- Aktualizuj total_earnings na utworze
  UPDATE public.tracks
  SET total_earnings = COALESCE(total_earnings, 0) + 0.30
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_track_starter_bonus ON public.tracks;
CREATE TRIGGER trg_grant_track_starter_bonus
AFTER INSERT ON public.tracks
FOR EACH ROW
EXECUTE FUNCTION public.grant_track_starter_bonus();
