-- 1. Tabela portfeli tipowych (saldo per user)
CREATE TABLE public.tip_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  balance numeric NOT NULL DEFAULT 5.00,
  total_received numeric NOT NULL DEFAULT 0,
  total_sent numeric NOT NULL DEFAULT 0,
  welcome_seen boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tip_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own wallet" ON public.tip_wallets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins view all wallets" ON public.tip_wallets
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update wallets" ON public.tip_wallets
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_tip_wallets_user ON public.tip_wallets(user_id);

-- 2. Historia transakcji tipów
CREATE TABLE public.tip_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  track_id uuid,
  amount numeric NOT NULL CHECK (amount > 0),
  artist_amount numeric NOT NULL,
  platform_fee numeric NOT NULL,
  tx_type text NOT NULL DEFAULT 'tip',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tip_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own sent tips" ON public.tip_transactions
  FOR SELECT TO authenticated USING (auth.uid() = sender_id);

CREATE POLICY "Users view own received tips" ON public.tip_transactions
  FOR SELECT TO authenticated USING (auth.uid() = recipient_id);

CREATE POLICY "Admins view all tips" ON public.tip_transactions
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_tip_tx_sender ON public.tip_transactions(sender_id, created_at DESC);
CREATE INDEX idx_tip_tx_recipient ON public.tip_transactions(recipient_id, created_at DESC);

-- 3. Funkcja: pobierz/utwórz portfel zalogowanego usera
CREATE OR REPLACE FUNCTION public.get_tip_wallet()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _wallet record;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  -- Auto-create z 5€ jeśli nie istnieje
  INSERT INTO public.tip_wallets (user_id, balance)
  VALUES (_user_id, 5.00)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO _wallet FROM public.tip_wallets WHERE user_id = _user_id;

  RETURN jsonb_build_object(
    'balance', _wallet.balance,
    'total_received', _wallet.total_received,
    'total_sent', _wallet.total_sent,
    'welcome_seen', _wallet.welcome_seen
  );
END;
$$;

-- 4. Funkcja: oznacz modal powitalny jako pokazany
CREATE OR REPLACE FUNCTION public.mark_tip_welcome_seen()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  INSERT INTO public.tip_wallets (user_id, balance, welcome_seen)
  VALUES (_user_id, 5.00, true)
  ON CONFLICT (user_id) DO UPDATE SET welcome_seen = true, updated_at = now();

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 5. Funkcja: wyślij tip (atomowa transakcja)
CREATE OR REPLACE FUNCTION public.send_tip(_track_id uuid, _amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sender_id uuid := auth.uid();
  _recipient_id uuid;
  _track_title text;
  _balance numeric;
  _artist_amount numeric;
  _platform_fee numeric;
BEGIN
  IF _sender_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  IF _amount NOT IN (1, 2, 5, 10) THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount');
  END IF;

  -- Pobierz właściciela utworu
  SELECT user_id, title INTO _recipient_id, _track_title
  FROM public.tracks WHERE id = _track_id;

  IF _recipient_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'track_no_owner');
  END IF;

  IF _recipient_id = _sender_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_self_tip');
  END IF;

  -- Auto-create portfela darczyńcy
  INSERT INTO public.tip_wallets (user_id, balance)
  VALUES (_sender_id, 5.00) ON CONFLICT (user_id) DO NOTHING;

  -- Lock + sprawdź saldo
  SELECT balance INTO _balance FROM public.tip_wallets
  WHERE user_id = _sender_id FOR UPDATE;

  IF _balance < _amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance', 'balance', _balance);
  END IF;

  _artist_amount := _amount * 0.9;
  _platform_fee := _amount * 0.1;

  -- Odlicz darczyńcy
  UPDATE public.tip_wallets
  SET balance = balance - _amount,
      total_sent = total_sent + _amount,
      updated_at = now()
  WHERE user_id = _sender_id;

  -- Auto-create portfela odbiorcy
  INSERT INTO public.tip_wallets (user_id, balance, total_received)
  VALUES (_recipient_id, 5.00, _artist_amount)
  ON CONFLICT (user_id) DO UPDATE
    SET total_received = tip_wallets.total_received + _artist_amount,
        updated_at = now();

  -- Zapis transakcji
  INSERT INTO public.tip_transactions
    (sender_id, recipient_id, track_id, amount, artist_amount, platform_fee, tx_type)
  VALUES (_sender_id, _recipient_id, _track_id, _amount, _artist_amount, _platform_fee, 'tip');

  -- Earnings dla artysty (90%)
  INSERT INTO public.creator_earnings (user_id, track_id, amount, earning_type, description)
  VALUES (_recipient_id, _track_id, _artist_amount, 'tip',
          'Tip ' || _amount || '€ za "' || COALESCE(_track_title, 'utwór') || '" (90% = ' || _artist_amount || '€)');

  UPDATE public.tracks
  SET total_earnings = total_earnings + _artist_amount
  WHERE id = _track_id;

  RETURN jsonb_build_object(
    'success', true,
    'amount_sent', _amount,
    'artist_received', _artist_amount,
    'new_balance', _balance - _amount
  );
END;
$$;

-- 6. Admin: doładuj credity userowi
CREATE OR REPLACE FUNCTION public.admin_topup_tip_credits(_user_id uuid, _amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _new_balance numeric;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  IF _amount <= 0 OR _amount > 1000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount');
  END IF;

  INSERT INTO public.tip_wallets (user_id, balance)
  VALUES (_user_id, 5.00 + _amount)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = tip_wallets.balance + _amount,
        updated_at = now()
  RETURNING balance INTO _new_balance;

  -- Loguj jako transakcję adminową (sender = admin, recipient = user, type='admin_topup')
  INSERT INTO public.tip_transactions
    (sender_id, recipient_id, track_id, amount, artist_amount, platform_fee, tx_type)
  VALUES (auth.uid(), _user_id, NULL, _amount, _amount, 0, 'admin_topup');

  RETURN jsonb_build_object('success', true, 'new_balance', _new_balance);
END;
$$;

-- 7. Admin: pełny przegląd tipów
CREATE OR REPLACE FUNCTION public.get_admin_tip_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _summary jsonb; _wallets jsonb; _transactions jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  SELECT jsonb_build_object(
    'total_balance', COALESCE((SELECT sum(balance) FROM tip_wallets), 0),
    'total_sent', COALESCE((SELECT sum(total_sent) FROM tip_wallets), 0),
    'total_received', COALESCE((SELECT sum(total_received) FROM tip_wallets), 0),
    'total_platform_fees', COALESCE((SELECT sum(platform_fee) FROM tip_transactions WHERE tx_type='tip'), 0),
    'total_users_with_wallet', (SELECT count(*) FROM tip_wallets),
    'total_tips_sent', (SELECT count(*) FROM tip_transactions WHERE tx_type='tip')
  ) INTO _summary;

  SELECT jsonb_agg(row_to_json(w)) INTO _wallets FROM (
    SELECT tw.user_id, tw.balance, tw.total_sent, tw.total_received,
           u.email, p.display_name
    FROM tip_wallets tw
    LEFT JOIN auth.users u ON u.id = tw.user_id
    LEFT JOIN profiles p ON p.user_id = tw.user_id
    ORDER BY tw.total_received DESC, tw.balance DESC
    LIMIT 200
  ) w;

  SELECT jsonb_agg(row_to_json(t)) INTO _transactions FROM (
    SELECT tt.id, tt.amount, tt.artist_amount, tt.platform_fee, tt.tx_type, tt.created_at,
           tt.sender_id, su.email AS sender_email, sp.display_name AS sender_name,
           tt.recipient_id, ru.email AS recipient_email, rp.display_name AS recipient_name,
           tt.track_id, tk.title AS track_title
    FROM tip_transactions tt
    LEFT JOIN auth.users su ON su.id = tt.sender_id
    LEFT JOIN profiles sp ON sp.user_id = tt.sender_id
    LEFT JOIN auth.users ru ON ru.id = tt.recipient_id
    LEFT JOIN profiles rp ON rp.user_id = tt.recipient_id
    LEFT JOIN tracks tk ON tk.id = tt.track_id
    ORDER BY tt.created_at DESC
    LIMIT 300
  ) t;

  RETURN jsonb_build_object(
    'summary', _summary,
    'wallets', COALESCE(_wallets, '[]'::jsonb),
    'transactions', COALESCE(_transactions, '[]'::jsonb)
  );
END;
$$;