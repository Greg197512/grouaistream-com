-- ============================================================
-- PROGRAM POLECEŃ (legalny, jednopoziomowy program afiliacyjny)
-- Użytkownik dostaje unikalny kod. Gdy polecona osoba wykupi
-- abonament, polecający dostaje 20% prowizji od każdej płatności
-- przez 12 miesięcy od rejestracji poleconego.
-- Jednopoziomowy = prowizja TYLKO od własnych poleconych
-- (zgodne z prawem PL/UE — brak wynagradzania za samą rekrutację).
-- ============================================================

-- 1. Kolumny w profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referred_at timestamptz;

-- 2. Generator unikalnego kodu polecającego
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  _code text;
  _tries int := 0;
BEGIN
  LOOP
    _code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = _code);
    _tries := _tries + 1;
    IF _tries > 10 THEN
      _code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
      EXIT;
    END IF;
  END LOOP;
  RETURN _code;
END;
$$;

-- 3. Backfill kodów dla istniejących użytkowników
UPDATE public.profiles
SET referral_code = public.generate_referral_code()
WHERE referral_code IS NULL;

-- 4. Trigger: każdy nowy profil dostaje kod automatycznie
CREATE OR REPLACE FUNCTION public.set_referral_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := public.generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_referral_code ON public.profiles;
CREATE TRIGGER trg_set_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_referral_code();

-- 5. Tabela prowizji z poleceń
CREATE TABLE IF NOT EXISTS public.referral_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paddle_transaction_id text NOT NULL,
  environment text NOT NULL DEFAULT 'live',
  plan text,
  gross_amount decimal(12,4) NOT NULL DEFAULT 0,
  commission_amount decimal(12,4) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'eur',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (paddle_transaction_id, environment)
);

ALTER TABLE public.referral_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Referrer reads own commissions" ON public.referral_commissions;
CREATE POLICY "Referrer reads own commissions"
  ON public.referral_commissions FOR SELECT TO authenticated
  USING (auth.uid() = referrer_user_id);

-- service_role omija RLS — webhook wstawia prowizje bez dodatkowej polityki

-- 6. Prowizje z poleceń wpadają do creator_earnings (istniejący system
--    wypłat od 50 PLN). Earning z polecenia nie ma utworu → track_id NULL.
ALTER TABLE public.creator_earnings ALTER COLUMN track_id DROP NOT NULL;

-- 7. RPC: zastosuj kod polecający (wywoływane po pierwszym logowaniu)
CREATE OR REPLACE FUNCTION public.apply_referral_code(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _referrer uuid;
  _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT user_id INTO _referrer
  FROM public.profiles
  WHERE referral_code = upper(trim(_code));

  IF _referrer IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;

  IF _referrer = _me THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'self_referral');
  END IF;

  -- tylko raz i tylko dla świeżych kont (do 7 dni od utworzenia profilu)
  UPDATE public.profiles
  SET referred_by = _referrer, referred_at = now()
  WHERE user_id = _me
    AND referred_by IS NULL
    AND created_at > now() - interval '7 days';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_referred_or_too_old');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_referral_code(text) TO authenticated;

-- 8. RPC: statystyki mojego programu poleceń
CREATE OR REPLACE FUNCTION public.get_my_referral_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _code text;
  _referred_count int;
  _total_commission decimal(12,4);
  _this_month decimal(12,4);
BEGIN
  IF _me IS NULL THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  SELECT referral_code INTO _code FROM public.profiles WHERE user_id = _me;

  SELECT count(*) INTO _referred_count
  FROM public.profiles WHERE referred_by = _me;

  SELECT coalesce(sum(commission_amount), 0) INTO _total_commission
  FROM public.referral_commissions WHERE referrer_user_id = _me;

  SELECT coalesce(sum(commission_amount), 0) INTO _this_month
  FROM public.referral_commissions
  WHERE referrer_user_id = _me
    AND created_at >= date_trunc('month', now());

  RETURN jsonb_build_object(
    'ok', true,
    'referral_code', _code,
    'referred_count', _referred_count,
    'total_commission', _total_commission,
    'this_month_commission', _this_month
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_referral_stats() TO authenticated;
