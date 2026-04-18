CREATE OR REPLACE FUNCTION public.purchase_boost(_track_id uuid, _package text DEFAULT 'basic')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _price numeric;
  _impressions int;
  _days int;
  _balance numeric;
  _track_owner uuid;
  _expires timestamptz;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- Tylko Basic na start
  IF _package = 'basic' THEN
    _price := 5;
    _impressions := 5000;
    _days := 7;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'invalid_package');
  END IF;

  -- Sprawdź czy track istnieje
  SELECT user_id INTO _track_owner FROM public.tracks WHERE id = _track_id;
  IF _track_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'track_not_found');
  END IF;

  -- Auto-create wallet
  INSERT INTO public.tip_wallets (user_id, balance)
  VALUES (_user_id, 5.00) ON CONFLICT (user_id) DO NOTHING;

  -- Lock + sprawdź saldo
  SELECT balance INTO _balance FROM public.tip_wallets
  WHERE user_id = _user_id FOR UPDATE;

  IF _balance < _price THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance', 'balance', _balance, 'required', _price);
  END IF;

  -- Pobierz kasę
  UPDATE public.tip_wallets
  SET balance = balance - _price,
      total_sent = total_sent + _price,
      updated_at = now()
  WHERE user_id = _user_id;

  _expires := now() + (_days || ' days')::interval;

  -- Zapis transakcji: 100% dla platformy (artist_amount = 0, platform_fee = full price)
  INSERT INTO public.tip_transactions
    (sender_id, recipient_id, track_id, amount, artist_amount, platform_fee, tx_type)
  VALUES (_user_id, _user_id, _track_id, _price, 0, _price, 'boost');

  -- Insert boost record
  INSERT INTO public.track_boosts (track_id, user_id, package_type, impressions_total, amount_paid, expires_at)
  VALUES (_track_id, _user_id, _package, _impressions, _price, _expires);

  -- Aktywuj na utworze
  UPDATE public.tracks
  SET is_boosted = true,
      boost_expires_at = _expires
  WHERE id = _track_id;

  RETURN jsonb_build_object(
    'success', true,
    'package', _package,
    'impressions', _impressions,
    'days', _days,
    'expires_at', _expires,
    'new_balance', _balance - _price
  );
END;
$$;