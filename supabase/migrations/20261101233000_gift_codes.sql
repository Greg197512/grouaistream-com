-- Bilet podarunkowy za zakup w sklepie Grouarock: kod GROUA-XXXX-XXXX = VIP na 30 dni.
-- Kod powstaje automatycznie, gdy zamówienie dostaje status 'paid' (webhook albo admin).
CREATE TABLE IF NOT EXISTS public.gift_codes (
  code text PRIMARY KEY,
  order_id uuid UNIQUE NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  days integer NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  redeemed_by uuid REFERENCES auth.users(id),
  redeemed_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.vip_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text REFERENCES public.gift_codes(code),
  had_role_before boolean NOT NULL DEFAULT false,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS vip_grants_exp_idx ON public.vip_grants(expires_at);
ALTER TABLE public.gift_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vip_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads own gift codes" ON public.gift_codes FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
CREATE POLICY "admins read gift codes" ON public.gift_codes FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "user reads own vip grants" ON public.vip_grants FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admins read vip grants" ON public.vip_grants FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.gen_gift_code() RETURNS text LANGUAGE plpgsql AS $$
DECLARE chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; s text := ''; i int;
BEGIN
  FOR i IN 1..8 LOOP s := s || substr(chars, 1 + floor(random() * length(chars))::int, 1); END LOOP;
  RETURN 'GROUA-' || substr(s, 1, 4) || '-' || substr(s, 5, 4);
END $$;

CREATE OR REPLACE FUNCTION public.shop_order_gift_code() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c text; tries int := 0;
BEGIN
  IF NEW.status IN ('paid', 'shipped') AND NOT EXISTS (SELECT 1 FROM public.gift_codes WHERE order_id = NEW.id) THEN
    LOOP
      c := public.gen_gift_code();
      BEGIN
        INSERT INTO public.gift_codes(code, order_id, owner_user_id) VALUES (c, NEW.id, NEW.user_id);
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        tries := tries + 1; IF tries > 8 THEN RAISE; END IF;
      END;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS shop_order_gift_code_trg ON public.shop_orders;
CREATE TRIGGER shop_order_gift_code_trg AFTER INSERT OR UPDATE OF status ON public.shop_orders FOR EACH ROW EXECUTE FUNCTION public.shop_order_gift_code();

-- Odbiór kodu. Wołane tylko z edge function (service_role), która zna user id z tokenu.
CREATE OR REPLACE FUNCTION public.redeem_gift_code(p_user uuid, p_code text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.gift_codes%ROWTYPE; had boolean; base timestamptz; exp timestamptz;
BEGIN
  SELECT * INTO g FROM public.gift_codes WHERE code = upper(trim(p_code)) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code'); END IF;
  IF g.redeemed_by IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'already_used'); END IF;
  had := EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user AND role = 'vip');
  SELECT coalesce(max(expires_at), now()) INTO base FROM public.vip_grants WHERE user_id = p_user AND expires_at > now();
  exp := greatest(base, now()) + make_interval(days => g.days);
  UPDATE public.gift_codes SET redeemed_by = p_user, redeemed_at = now() WHERE code = g.code;
  INSERT INTO public.vip_grants(user_id, code, had_role_before, expires_at) VALUES (p_user, g.code, had, exp);
  IF NOT had THEN INSERT INTO public.user_roles(user_id, role) VALUES (p_user, 'vip') ON CONFLICT DO NOTHING; END IF;
  RETURN jsonb_build_object('ok', true, 'gift', true, 'label', 'VIP na ' || g.days || ' dni', 'expires_at', exp);
END $$;
REVOKE ALL ON FUNCTION public.redeem_gift_code(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_gift_code(uuid, text) TO service_role;

-- Wygaszanie VIP-a z biletu (nie rusza VIP-ów nadanych ręcznie przez admina).
CREATE OR REPLACE FUNCTION public.expire_vip_grants() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int := 0; r record;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM public.vip_grants g WHERE expires_at <= now() AND had_role_before = false
           AND NOT EXISTS (SELECT 1 FROM public.vip_grants x WHERE x.user_id = g.user_id AND (x.expires_at > now() OR x.had_role_before = true)) LOOP
    DELETE FROM public.user_roles WHERE user_id = r.user_id AND role = 'vip';
    DELETE FROM public.vip_grants WHERE user_id = r.user_id AND expires_at <= now();
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.expire_vip_grants() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_vip_grants() TO service_role;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('expire-vip-grants', '*/30 * * * *', 'select public.expire_vip_grants()');
  END IF;
END $$;
