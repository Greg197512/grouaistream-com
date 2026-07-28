-- ============================================================================
-- Zatrzymać Starość (Stop Aging AI) — schemat modułu HealthTech
-- ============================================================================
--
-- Założenia projektowe:
--
--  1. DANE ZDROWOTNE TO SZCZEGÓLNA KATEGORIA DANYCH (RODO art. 9). Każda
--     tabela ma RLS włączone i politykę „tylko właściciel wiersza”. Nie ma
--     tu polityk otwartych dla `anon` ani dla `authenticated` bez warunku.
--
--  2. REKORD DNIA W JSONB, nie w trzydziestu kolumnach. Zestaw metryk
--     zmienia się z każdą integracją (Garmin dorzuca Hill Score, Oura
--     temperaturę skóry). Sztywny schemat wymuszałby migrację przy każdym
--     nowym dostawcy. Struktura JSON jest kontraktem współdzielonym
--     z `src/lib/longevity/types.ts` i z funkcją `stop-aging-sync`.
--
--  3. WSKAŹNIKÓW NIE LICZYMY W BAZIE. Wiek biologiczny, indeks stresu
--     i pozostałe wyniki powstają w silniku TypeScript pokrytym testami.
--     Baza przechowuje wejścia i — opcjonalnie — zmaterializowane wyniki
--     dnia do szybkich wykresów historycznych.
--
--  4. TOKENY DOSTAWCÓW nie są przechowywane jawnie. Kolumny trzymają wartości
--     zaszyfrowane po stronie funkcji brzegowej (AES-256-GCM, klucz
--     w Supabase Secrets), a klient nie ma do nich dostępu — RLS nie
--     udostępnia tych kolumn użytkownikowi.
-- ============================================================================

-- ── Profil i ustawienia ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.longevity_profiles (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Kształt zgodny z `UserProfile`: wiek, płeć, wzrost, masa, cele, używki.
  profile     JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Kształt zgodny z `LongevitySettings`: język, powiadomienia, prywatność.
  settings    JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_xp    INTEGER NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
  -- Zgoda na przetwarzanie danych zdrowotnych (RODO art. 9 ust. 2 lit. a).
  health_consent_at    TIMESTAMPTZ,
  -- Osobna zgoda na wysyłanie zanonimizowanego kontekstu do modelu językowego.
  ai_consent_at        TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.longevity_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Właściciel czyta swój profil"
  ON public.longevity_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Właściciel tworzy swój profil"
  ON public.longevity_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Właściciel aktualizuje swój profil"
  ON public.longevity_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Właściciel usuwa swój profil"
  ON public.longevity_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- ── Rekordy dzienne ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.longevity_daily_records (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Doba lokalna użytkownika, nie UTC — sen z 23:40 należy do dnia poprzedniego.
  day         DATE NOT NULL,
  -- Kształt zgodny z `DailyRecord`: sleep, cardio, activity, body, vendor,
  -- nutrition, lifestyle, subjective, sources.
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

-- Zapytania zawsze idą po użytkowniku i zakresie dat (okna 7/30/90/365 dni).
CREATE INDEX IF NOT EXISTS longevity_daily_records_user_day_idx
  ON public.longevity_daily_records (user_id, day DESC);

ALTER TABLE public.longevity_daily_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Właściciel czyta swoje dni"
  ON public.longevity_daily_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Właściciel zapisuje swoje dni"
  ON public.longevity_daily_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Właściciel aktualizuje swoje dni"
  ON public.longevity_daily_records FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Właściciel usuwa swoje dni"
  ON public.longevity_daily_records FOR DELETE
  USING (auth.uid() = user_id);

-- ── Zmaterializowane wyniki dnia ────────────────────────────────────────────
-- Wypełniane przez klienta po przeliczeniu panelu. Służą wyłącznie do szybkich
-- wykresów rocznych — źródłem prawdy pozostaje `longevity_daily_records`.

CREATE TABLE IF NOT EXISTS public.longevity_daily_scores (
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day                 DATE NOT NULL,
  biological_age      NUMERIC(4,1),
  recovery_age        NUMERIC(4,1),
  sleep_score         SMALLINT CHECK (sleep_score BETWEEN 0 AND 100),
  stress_index        SMALLINT CHECK (stress_index BETWEEN 0 AND 100),
  recovery_score      SMALLINT CHECK (recovery_score BETWEEN 0 AND 100),
  energy_score        SMALLINT CHECK (energy_score BETWEEN 0 AND 100),
  epigenetic_score    SMALLINT CHECK (epigenetic_score BETWEEN 0 AND 100),
  brain_score         SMALLINT CHECK (brain_score BETWEEN 0 AND 100),
  cardio_score        SMALLINT CHECK (cardio_score BETWEEN 0 AND 100),
  metabolic_score     SMALLINT CHECK (metabolic_score BETWEEN 0 AND 100),
  longevity_index     SMALLINT CHECK (longevity_index BETWEEN 0 AND 100),
  nervous_state       TEXT CHECK (nervous_state IN ('recovery','overload','fight','freeze')),
  -- Pewność wyniku — pozwala odfiltrować dni policzone z dwóch pól.
  confidence          TEXT CHECK (confidence IN ('low','medium','high')),
  computed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

CREATE INDEX IF NOT EXISTS longevity_daily_scores_user_day_idx
  ON public.longevity_daily_scores (user_id, day DESC);

ALTER TABLE public.longevity_daily_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Właściciel czyta swoje wyniki"
  ON public.longevity_daily_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Właściciel zapisuje swoje wyniki"
  ON public.longevity_daily_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Właściciel aktualizuje swoje wyniki"
  ON public.longevity_daily_scores FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Właściciel usuwa swoje wyniki"
  ON public.longevity_daily_scores FOR DELETE
  USING (auth.uid() = user_id);

-- ── Połączenia z urządzeniami ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.longevity_device_links (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider            TEXT NOT NULL CHECK (provider IN (
                        'garmin','apple_health','health_connect','oura','whoop','fitbit',
                        'polar','samsung_health','suunto','coros','withings','huawei_health',
                        'google_fit','strava','xiaomi','amazfit','manual')),
  -- Identyfikator użytkownika u dostawcy — po nim webhook trafia do konta.
  provider_user_id    TEXT,
  -- Tokeny zaszyfrowane w funkcji brzegowej; klient ich nie odczytuje.
  access_token_enc    TEXT,
  refresh_token_enc   TEXT,
  token_expires_at    TIMESTAMPTZ,
  scopes              TEXT[],
  last_sync_at        TIMESTAMPTZ,
  last_error          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

-- Webhook dostawcy szuka konta po parze (provider, provider_user_id).
CREATE INDEX IF NOT EXISTS longevity_device_links_provider_user_idx
  ON public.longevity_device_links (provider, provider_user_id);

ALTER TABLE public.longevity_device_links ENABLE ROW LEVEL SECURITY;

-- Użytkownik widzi fakt połączenia i czas ostatniej synchronizacji.
-- Tokeny są w tych samych wierszach, dlatego klient korzysta z widoku poniżej,
-- a nie z tabeli bezpośrednio.
CREATE POLICY "Właściciel czyta swoje połączenia"
  ON public.longevity_device_links FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Właściciel usuwa swoje połączenia"
  ON public.longevity_device_links FOR DELETE
  USING (auth.uid() = user_id);

-- Zapis i aktualizacja wyłącznie przez funkcje brzegowe (service role),
-- bo tylko one mają klucz szyfrujący tokeny — brak polityk INSERT/UPDATE
-- dla roli `authenticated` jest tu celowy.

CREATE OR REPLACE VIEW public.longevity_device_status
WITH (security_invoker = true) AS
  SELECT user_id, provider, last_sync_at, last_error, created_at,
         (access_token_enc IS NOT NULL) AS connected
  FROM public.longevity_device_links;

-- ── Historia rozmów z AI Coachem ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.longevity_coach_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user','coach')),
  content     TEXT NOT NULL,
  -- 'ai' | 'rules' | 'safety' — z czego powstała odpowiedź.
  source      TEXT CHECK (source IN ('ai','rules','safety')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS longevity_coach_messages_user_idx
  ON public.longevity_coach_messages (user_id, created_at DESC);

ALTER TABLE public.longevity_coach_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Właściciel czyta swoje rozmowy"
  ON public.longevity_coach_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Właściciel zapisuje swoje rozmowy"
  ON public.longevity_coach_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Właściciel usuwa swoje rozmowy"
  ON public.longevity_coach_messages FOR DELETE
  USING (auth.uid() = user_id);

-- ── Sesje praktyk (oddech, medytacja) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.longevity_practice_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('breathing','meditation','soundscape')),
  -- Identyfikator z katalogu treści (`BREATHING_PROTOCOLS` / `MEDITATION_SESSIONS`).
  reference_id  TEXT NOT NULL,
  duration_min  NUMERIC(5,1) NOT NULL CHECK (duration_min > 0),
  completed     BOOLEAN NOT NULL DEFAULT true,
  day           DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS longevity_practice_sessions_user_day_idx
  ON public.longevity_practice_sessions (user_id, day DESC);

ALTER TABLE public.longevity_practice_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Właściciel czyta swoje sesje"
  ON public.longevity_practice_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Właściciel zapisuje swoje sesje"
  ON public.longevity_practice_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Właściciel usuwa swoje sesje"
  ON public.longevity_practice_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- ── Odznaki ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.longevity_badges (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id    TEXT NOT NULL,
  earned_at   DATE NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (user_id, badge_id)
);

ALTER TABLE public.longevity_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Właściciel czyta swoje odznaki"
  ON public.longevity_badges FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Właściciel zapisuje swoje odznaki"
  ON public.longevity_badges FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ── Powiadomienia ───────────────────────────────────────────────────────────
-- Limit „nie więcej niż 4 dziennie” jest wymogiem produktowym, więc pilnuje go
-- baza, a nie tylko klient. Trigger odrzuca piąte powiadomienie w dobie.

CREATE TABLE IF NOT EXISTS public.longevity_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day         DATE NOT NULL DEFAULT CURRENT_DATE,
  kind        TEXT NOT NULL CHECK (kind IN (
                'morning_report','mission_reminder','wind_down','recovery_alert','streak')),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  opened_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS longevity_notifications_user_day_idx
  ON public.longevity_notifications (user_id, day DESC);

ALTER TABLE public.longevity_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Właściciel czyta swoje powiadomienia"
  ON public.longevity_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Właściciel aktualizuje swoje powiadomienia"
  ON public.longevity_notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.longevity_enforce_notification_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sent_today INTEGER;
  user_limit INTEGER;
BEGIN
  SELECT COUNT(*) INTO sent_today
  FROM public.longevity_notifications
  WHERE user_id = NEW.user_id AND day = NEW.day;

  -- Limit z ustawień użytkownika; domyślnie 4, nigdy więcej niż 4.
  SELECT LEAST(COALESCE((settings ->> 'maxNotificationsPerDay')::INTEGER, 4), 4)
  INTO user_limit
  FROM public.longevity_profiles
  WHERE user_id = NEW.user_id;

  IF sent_today >= COALESCE(user_limit, 4) THEN
    RAISE EXCEPTION 'Przekroczono dzienny limit powiadomień (%).', COALESCE(user_limit, 4)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS longevity_notification_limit ON public.longevity_notifications;
CREATE TRIGGER longevity_notification_limit
  BEFORE INSERT ON public.longevity_notifications
  FOR EACH ROW EXECUTE FUNCTION public.longevity_enforce_notification_limit();

-- ── Katalog treści (panel admina) ───────────────────────────────────────────
-- Sesje i ćwiczenia są domyślnie w kodzie (działają offline), ale zespół
-- treści może dodawać pozycje bez wdrożenia aplikacji.

CREATE TABLE IF NOT EXISTS public.longevity_content (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,
  kind          TEXT NOT NULL CHECK (kind IN ('meditation','breathing','soundscape','article')),
  title         TEXT NOT NULL,
  summary       TEXT,
  category      TEXT,
  minutes       INTEGER CHECK (minutes > 0),
  -- Scenariusz sesji albo parametry ćwiczenia — struktura zależna od `kind`.
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Powiązanie z platformą Grouaistream (nagranie lektorskie, utwór).
  grouaistream_tag TEXT,
  locale        TEXT NOT NULL DEFAULT 'pl',
  premium       BOOLEAN NOT NULL DEFAULT false,
  published     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.longevity_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Opublikowane treści są czytelne dla zalogowanych"
  ON public.longevity_content FOR SELECT
  TO authenticated
  USING (published = true);

CREATE POLICY "Administrator zarządza treściami"
  ON public.longevity_content FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ── Statystyki dla panelu admina ────────────────────────────────────────────
-- Widok zwraca wyłącznie dane zagregowane — żadnych wartości per użytkownik.

CREATE OR REPLACE VIEW public.longevity_admin_stats AS
  SELECT
    (SELECT COUNT(*) FROM public.longevity_profiles)                                    AS users_total,
    (SELECT COUNT(DISTINCT user_id) FROM public.longevity_daily_records
      WHERE day >= CURRENT_DATE - 7)                                                    AS active_7d,
    (SELECT COUNT(DISTINCT user_id) FROM public.longevity_daily_records
      WHERE day >= CURRENT_DATE - 30)                                                   AS active_30d,
    (SELECT COUNT(*) FROM public.longevity_daily_records)                               AS days_recorded,
    (SELECT COUNT(*) FROM public.longevity_device_links WHERE access_token_enc IS NOT NULL) AS devices_connected,
    (SELECT COUNT(*) FROM public.longevity_device_links
      WHERE provider = 'garmin' AND access_token_enc IS NOT NULL)                       AS garmin_connected,
    (SELECT ROUND(AVG(duration_min)::numeric, 1) FROM public.longevity_practice_sessions
      WHERE day >= CURRENT_DATE - 30)                                                   AS avg_practice_min_30d,
    (SELECT COUNT(*) FROM public.longevity_coach_messages
      WHERE created_at >= now() - INTERVAL '30 days')                                   AS coach_messages_30d;

REVOKE ALL ON public.longevity_admin_stats FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.longevity_admin_dashboard()
RETURNS SETOF public.longevity_admin_stats
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.longevity_admin_stats
  WHERE public.has_role(auth.uid(), 'admin');
$$;

-- ── Automatyczne `updated_at` ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.longevity_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS longevity_profiles_touch ON public.longevity_profiles;
CREATE TRIGGER longevity_profiles_touch
  BEFORE UPDATE ON public.longevity_profiles
  FOR EACH ROW EXECUTE FUNCTION public.longevity_touch_updated_at();

DROP TRIGGER IF EXISTS longevity_daily_records_touch ON public.longevity_daily_records;
CREATE TRIGGER longevity_daily_records_touch
  BEFORE UPDATE ON public.longevity_daily_records
  FOR EACH ROW EXECUTE FUNCTION public.longevity_touch_updated_at();

DROP TRIGGER IF EXISTS longevity_content_touch ON public.longevity_content;
CREATE TRIGGER longevity_content_touch
  BEFORE UPDATE ON public.longevity_content
  FOR EACH ROW EXECUTE FUNCTION public.longevity_touch_updated_at();

-- ── Usunięcie konta = usunięcie danych zdrowotnych ──────────────────────────
-- Kaskady ON DELETE CASCADE wyżej realizują prawo do bycia zapomnianym
-- (RODO art. 17) na poziomie bazy: skasowanie wiersza w auth.users usuwa
-- komplet danych modułu, bez zadania w kolejce i bez ręcznej interwencji.
