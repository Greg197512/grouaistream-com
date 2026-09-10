-- Automat promocji bloga: co tydzień generuje GOTOWE posty do social (X/LinkedIn/
-- Facebook) o najnowszych wpisach, z CTA grouaistream.com. Posty lądują jako
-- „draft" do akceptacji i publikacji przez człowieka (nie autopostujemy nigdzie
-- bez zgody konta). Promocję w Google/Bing/Yandex załatwia osobno funkcja
-- edge `indexnow-ping` (zgłasza nowe URL-e + pinguje sitemap).
--
-- Świadomie NIE ma tu żadnego scrapowania maili ani masowej wysyłki na pozyskane
-- adresy — to łamałoby ePrivacy/RODO i wpakowałoby domenę na blacklisty
-- (co zabiłoby maile transakcyjne: potwierdzenia, wypłaty, faktury).

-- 1) Kolejka gotowych postów promocyjnych.
CREATE TABLE IF NOT EXISTS public.blog_promo_posts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_slug   text NOT NULL,
  blog_title  text NOT NULL,
  platform    text NOT NULL CHECK (platform IN ('x','linkedin','facebook')),
  body        text NOT NULL,
  url         text NOT NULL,
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted','skipped')),
  week_of     date NOT NULL DEFAULT (date_trunc('week', now())::date),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blog_slug, platform, week_of)
);

CREATE INDEX IF NOT EXISTS idx_blog_promo_status_week
  ON public.blog_promo_posts (status, week_of DESC);

-- 2) RLS: czytają/edytują tylko adminzy; generator (SECURITY DEFINER) wstawia sam.
ALTER TABLE public.blog_promo_posts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='blog_promo_posts' AND policyname='blog_promo_admin_all') THEN
    CREATE POLICY blog_promo_admin_all ON public.blog_promo_posts
      FOR ALL USING (public.has_role(auth.uid(),'admin'))
      WITH CHECK (public.has_role(auth.uid(),'admin'));
  END IF;
END $$;

-- 3) Generator: dla N najnowszych opublikowanych wpisów tworzy 3 gotowe posty.
--    Idempotentny (ON CONFLICT) — bezpieczny przy wielokrotnym uruchomieniu w tygodniu.
CREATE OR REPLACE FUNCTION public.generate_weekly_blog_promo(_limit int DEFAULT 5)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p        record;
  u        text;
  short    text;
  n        integer := 0;
  wk       date := date_trunc('week', now())::date;
BEGIN
  FOR p IN
    SELECT slug, title, description
    FROM public.seo_blog_posts
    WHERE is_published = true
    ORDER BY created_at DESC
    LIMIT _limit
  LOOP
    u := 'https://grouaistream.com/blog/' || p.slug;
    short := left(coalesce(p.description,''), 160);

    -- X / Twitter (zwięźle, < 280 znaków)
    INSERT INTO public.blog_promo_posts (blog_slug, blog_title, platform, body, url, week_of)
    VALUES (p.slug, p.title, 'x',
      '🎧 ' || p.title || E'\n\n' || left(coalesce(p.description,''), 90) ||
      E'\n\nCzytaj 👉 ' || u || E'\n#muzyka #AI #streaming #dźwięk',
      u, wk)
    ON CONFLICT (blog_slug, platform, week_of) DO NOTHING;

    -- LinkedIn (profesjonalnie, dłużej)
    INSERT INTO public.blog_promo_posts (blog_slug, blog_title, platform, body, url, week_of)
    VALUES (p.slug, p.title, 'linkedin',
      p.title || E'\n\n' || short ||
      E'\n\nNowy wpis na blogu GrouAI Stream — o tym, jak technologia zmienia dźwięk i streaming.' ||
      E'\n\n👉 Czytaj: ' || u ||
      E'\n🎵 Odkrywaj muzykę bez botów: https://grouaistream.com' ||
      E'\n\n#muzyka #AI #streaming #audio #muzykacyfrowa',
      u, wk)
    ON CONFLICT (blog_slug, platform, week_of) DO NOTHING;

    -- Facebook (swobodnie)
    INSERT INTO public.blog_promo_posts (blog_slug, blog_title, platform, body, url, week_of)
    VALUES (p.slug, p.title, 'facebook',
      p.title || ' 🎶' || E'\n\n' || short ||
      E'\n\nPrzeczytaj na naszym blogu 👉 ' || u ||
      E'\n\nSłuchaj i odkrywaj na grouaistream.com — uczciwy streaming, zero botów.',
      u, wk)
    ON CONFLICT (blog_slug, platform, week_of) DO NOTHING;

    n := n + 1;
  END LOOP;

  RETURN n;
END $$;

-- 4) Cotygodniowy cron (pn 09:00 UTC): generuje paczkę postów na nowy tydzień.
--    Wymaga rozszerzenia pg_cron (dostępne w Supabase). Jeśli już istnieje job
--    o tej nazwie, najpierw go usuwamy, by uniknąć duplikatów.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('weekly-blog-promo')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-blog-promo');
    PERFORM cron.schedule(
      'weekly-blog-promo',
      '0 9 * * 1',
      $cron$ SELECT public.generate_weekly_blog_promo(5); $cron$
    );
  END IF;
END $$;

-- 5) Wygeneruj od razu paczkę na bieżący tydzień (żeby nie czekać do poniedziałku).
SELECT public.generate_weekly_blog_promo(6);
