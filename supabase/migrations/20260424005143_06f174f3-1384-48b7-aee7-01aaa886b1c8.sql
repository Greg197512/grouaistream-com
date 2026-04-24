-- Funkcja aktywująca boost po opłaceniu przez Paddle (bez debetu portfela).
-- Wywoływana przez webhook payments-webhook (service_role).

ALTER TABLE public.track_boosts
  ADD COLUMN IF NOT EXISTS paddle_transaction_id text;

CREATE UNIQUE INDEX IF NOT EXISTS track_boosts_paddle_tx_uniq
  ON public.track_boosts (paddle_transaction_id)
  WHERE paddle_transaction_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.activate_boost_paid(
  _user_id uuid,
  _track_id uuid,
  _package text DEFAULT 'basic',
  _amount numeric DEFAULT 5,
  _paddle_transaction_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _impressions int;
  _days int;
  _track_owner uuid;
  _expires timestamptz;
BEGIN
  IF _package = 'basic' THEN
    _impressions := 5000;
    _days := 7;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'invalid_package');
  END IF;

  SELECT user_id INTO _track_owner FROM public.tracks WHERE id = _track_id;
  IF _track_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'track_not_found');
  END IF;

  IF _paddle_transaction_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.track_boosts
      WHERE paddle_transaction_id = _paddle_transaction_id
    ) THEN
      RETURN jsonb_build_object('success', true, 'already_processed', true);
    END IF;
  END IF;

  _expires := now() + (_days || ' days')::interval;

  INSERT INTO public.track_boosts (
    track_id, user_id, package_type, impressions_total, amount_paid, expires_at, paddle_transaction_id
  )
  VALUES (_track_id, _user_id, _package, _impressions, _amount, _expires, _paddle_transaction_id);

  UPDATE public.tracks
  SET is_boosted = true,
      boost_expires_at = _expires
  WHERE id = _track_id;

  RETURN jsonb_build_object(
    'success', true,
    'package', _package,
    'impressions', _impressions,
    'days', _days,
    'expires_at', _expires
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.activate_boost_paid(uuid, uuid, text, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_boost_paid(uuid, uuid, text, numeric, text) FROM anon;
REVOKE ALL ON FUNCTION public.activate_boost_paid(uuid, uuid, text, numeric, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.activate_boost_paid(uuid, uuid, text, numeric, text) TO service_role;