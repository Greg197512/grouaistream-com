-- Model „Fair Share": creator_earnings tylko z REALNEGO przychodu.
-- Blokuje fabrykowane zobowiązania (bonus startowy, za polubienia, per-stream,
-- milestone, weekend), które właściciel płaciłby z kieszeni. Dopuszcza tylko
-- 'tip' (realna wpłata) i 'revenue_share'/'referral_revenue' (udział z realnych wpływów).

-- 1) Wyłącz automatyczny bonus €0,30 za każdy wgrany utwór.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_grant_track_starter_bonus') THEN
    EXECUTE 'ALTER TABLE public.tracks DISABLE TRIGGER trg_grant_track_starter_bonus';
  END IF;
END $$;

-- 2) Uniwersalny strażnik: przepuszcza tylko zarobki z realnego przychodu.
CREATE OR REPLACE FUNCTION public.only_real_revenue_earnings()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.earning_type NOT IN ('tip','revenue_share','referral_revenue') THEN
    RETURN NULL; -- po cichu pomiń fabrykowane naliczenia
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_only_real_revenue_earnings ON public.creator_earnings;
CREATE TRIGGER trg_only_real_revenue_earnings
BEFORE INSERT ON public.creator_earnings
FOR EACH ROW EXECUTE FUNCTION public.only_real_revenue_earnings();
