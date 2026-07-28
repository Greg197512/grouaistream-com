# 02 — Baza danych

Migracja: `supabase/migrations/20260728050000_zatrzymac_starosc.sql`
Silnik: PostgreSQL 15 (Supabase), RLS włączone na **każdej** tabeli.

---

## Model w skrócie

```
auth.users
   │ ON DELETE CASCADE (wszędzie)
   ├── longevity_profiles          1:1   profil, ustawienia, XP, zgody
   ├── longevity_daily_records     1:N   rekord doby (JSONB) — źródło prawdy
   ├── longevity_daily_scores      1:N   zmaterializowane wyniki (cache wykresów)
   ├── longevity_device_links      1:N   połączenia OAuth, tokeny zaszyfrowane
   ├── longevity_coach_messages    1:N   historia rozmów z AI Coachem
   ├── longevity_practice_sessions 1:N   sesje oddechowe i medytacyjne
   ├── longevity_badges            1:N   zdobyte odznaki
   └── longevity_notifications     1:N   wysłane powiadomienia (limit 4/dobę)

longevity_content                        katalog treści (admin), bez właściciela
```

---

## `longevity_profiles`

Jeden wiersz na użytkownika.

| Kolumna | Typ | Opis |
| --- | --- | --- |
| `user_id` | `UUID` PK | FK do `auth.users` |
| `profile` | `JSONB` | Kształt `UserProfile`: wiek, płeć, wzrost, masa, cele, używki |
| `settings` | `JSONB` | Kształt `LongevitySettings`: język, powiadomienia, prywatność |
| `total_xp` | `INTEGER` | Suma XP, `CHECK >= 0` |
| `health_consent_at` | `TIMESTAMPTZ` | Zgoda na przetwarzanie danych zdrowotnych (RODO art. 9 ust. 2 lit. a) |
| `ai_consent_at` | `TIMESTAMPTZ` | Osobna zgoda na wysyłanie kontekstu do modelu językowego |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | `updated_at` aktualizowane triggerem |

**Dwie osobne zgody, nie jedna.** Użytkownik może korzystać z aplikacji bez
zgody na AI — trener działa wtedy wyłącznie na silniku reguł, w całości
na urządzeniu. Zgoda zgrupowana byłaby wymuszeniem, a nie zgodą swobodną.

---

## `longevity_daily_records` — serce systemu

| Kolumna | Typ | Opis |
| --- | --- | --- |
| `user_id` | `UUID` | Część klucza głównego |
| `day` | `DATE` | Doba **lokalna użytkownika**, nie UTC |
| `payload` | `JSONB` | Kształt `DailyRecord` |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | |

PK: `(user_id, day)` · Indeks: `(user_id, day DESC)`

### Dlaczego doba lokalna, a nie UTC

Sen rozpoczęty o 23:40 należy do nocy z dnia poprzedniego. Przy dobie UTC
użytkownik w strefie UTC+2 miałby połowę nocy przypisaną do złego dnia, a
regularność snu — kluczowy składnik wyniku — liczyłaby się na przesuniętych
danych. Dostawcy (Garmin `calendarDate`, Oura `day`) też raportują dobę lokalną.

### Struktura `payload`

```jsonc
{
  "date": "2026-07-28",
  "sleep": {
    "durationMin": 462, "timeInBedMin": 495, "bedtimeMinOfDay": 1387,
    "wakeMinOfDay": 402, "awakenings": 2, "vendorScore": 84,
    "stages": { "deepMin": 78, "remMin": 96, "lightMin": 276, "awakeMin": 12 },
    "avgHeartRate": 52, "avgHrvMs": 58, "avgSpo2": 96,
    "respirationRate": 13.4, "skinTempDeltaC": -0.2, "source": "garmin"
  },
  "cardio":    { "restingHeartRate": 54, "hrvMs": 58, "spo2": 96, "vo2Max": 47.2, "source": "garmin" },
  "activity":  { "steps": 9840, "activeKcal": 612, "moderateVigorousMin": 34,
                 "sedentaryMin": 540, "walkMin": 42, "workouts": [ /* … */ ], "source": "garmin" },
  "body":      { "weightKg": 80.4, "heightCm": 180, "bodyFatPct": 19.8, "source": "withings" },
  "vendor":    { "bodyBattery": 68, "bodyBatteryLow": 24, "trainingReadiness": 74,
                 "stressScore": 32, "hrvStatus": "balanced", "recoveryTimeH": 6, "source": "garmin" },
  "nutrition": { "kcal": 2340, "proteinG": 118, "fiberG": 29, "addedSugarG": 18,
                 "waterMl": 2250, "vegetableServings": 4, "alcoholUnits": 0 },
  "lifestyle": { "meditationMin": 12, "breathworkMin": 5, "outdoorMin": 45,
                 "morningLightMin": 18, "screenBeforeBedMin": 10, "notifications": 87 },
  "subjective":{ "mood": 4, "energy": 4, "focus": 4, "stress": 2, "sleepQuality": 4 },
  "sources":   ["garmin", "withings", "manual"]
}
```

Kontrakt jest współdzielony przez trzy miejsca i **musi** pozostać spójny:

1. `src/lib/longevity/types.ts` — definicja TypeScript,
2. `supabase/functions/stop-aging-sync/index.ts` — mappery dostawców,
3. kolumna `payload` — zapis.

Zmiana pola w jednym miejscu bez pozostałych dwóch to błąd, który ujawni się
dopiero na produkcji. Testy w `src/test/longevity.test.ts` chronią stronę
klienta; mappery pokrywa checklista wdrożeniowa w [03 — API](./03-api.md).

### Dlaczego bez walidacji JSON Schema w bazie

Rozważane i odrzucone. `CHECK (jsonb_matches_schema(...))` wymaga rozszerzenia
`pg_jsonschema` i przy każdej zmianie modelu wymusza migrację — czyli dokładnie
to, czego JSONB miał uniknąć. Walidacja odbywa się w funkcji brzegowej
(`compact()` przycina do znanych pól) i w TypeScript. Baza pilnuje tego, co
tanie i krytyczne: typów kolumn, kluczy obcych i RLS.

---

## `longevity_daily_scores` — cache wykresów

Zmaterializowane wyniki dnia. **Nie są źródłem prawdy** — służą wyłącznie
szybkim wykresom rocznym, gdzie przeliczanie 365 paneli w przeglądarce byłoby
zbyt kosztowne.

Kolumny: `biological_age`, `recovery_age`, `sleep_score`, `stress_index`,
`recovery_score`, `energy_score`, `epigenetic_score`, `brain_score`,
`cardio_score`, `metabolic_score`, `longevity_index`, `nervous_state`,
`confidence`, `computed_at`.

Wszystkie wyniki 0–100 mają `CHECK (… BETWEEN 0 AND 100)`. To nie jest ozdobnik:
gdyby zmiana wag w silniku wypuściła wartość 103, baza odrzuci zapis zamiast
przyjąć niepoprawną liczbę na wykres.

Kolumna `confidence` pozwala odfiltrować dni policzone z dwóch pól — wykres
roczny nie powinien mieszać dnia z pełną synchronizacją z dniem, w którym
użytkownik wpisał tylko nastrój.

---

## `longevity_device_links`

| Kolumna | Opis |
| --- | --- |
| `provider` | `CHECK` z listą 17 dozwolonych wartości |
| `provider_user_id` | Identyfikator u dostawcy — po nim webhook trafia do konta |
| `access_token_enc`, `refresh_token_enc` | **Zaszyfrowane AES-256-GCM** w funkcji brzegowej |
| `token_expires_at`, `scopes`, `last_sync_at`, `last_error` | |

Indeks `(provider, provider_user_id)` obsługuje ścieżkę webhooka — to jedyne
zapytanie, które nie zaczyna się od `user_id`.

### Polityki celowo niepełne

Tabela ma polityki `SELECT` i `DELETE` dla właściciela, ale **nie ma
`INSERT` ani `UPDATE`** dla roli `authenticated`. To nie przeoczenie: zapis
tokenów odbywa się wyłącznie przez funkcje brzegowe działające na `service_role`,
bo tylko one mają klucz szyfrujący. Klient nie ma jak wstawić własnego tokenu.

Do odczytu stanu połączenia służy widok `longevity_device_status`
(`security_invoker = true`), który nie eksponuje kolumn z tokenami:

```sql
SELECT user_id, provider, last_sync_at, last_error, created_at,
       (access_token_enc IS NOT NULL) AS connected
FROM public.longevity_device_links;
```

---

## `longevity_notifications` — limit wymuszony w bazie

Wymóg produktowy „nie więcej niż 4 powiadomienia dziennie" jest pilnowany przez
trigger `longevity_enforce_notification_limit`, a nie tylko przez klienta:

```sql
SELECT LEAST(COALESCE((settings ->> 'maxNotificationsPerDay')::INTEGER, 4), 4)
```

`LEAST(..., 4)` jest twardym sufitem — nawet jeśli ustawienie użytkownika
zostanie uszkodzone albo jakiś proces spróbuje ustawić 20, baza przepuści
maksymalnie cztery. Piąte wstawienie kończy się `check_violation`.

Powód: powiadomienia mogą wysyłać różne procesy (raport poranny, przypomnienie
o misji, wieczorne wyciszenie, alert regeneracyjny). Każdy z nich zna tylko
swój kontekst. Jedyne miejsce, które widzi całą dobę, to baza.

---

## `longevity_content` i panel admina

Katalog sesji i ćwiczeń jest **domyślnie w kodzie** (`meditations.ts`,
`breathing.ts`) — dzięki temu aplikacja działa offline. Tabela `longevity_content`
pozwala zespołowi treści dodawać pozycje bez wdrożenia aplikacji.

RLS:
- `authenticated` widzi wyłącznie `published = true`,
- `has_role(auth.uid(), 'admin')` ma pełne `ALL`.

### Statystyki

Widok `longevity_admin_stats` zwraca **wyłącznie agregaty** — liczbę
użytkowników, aktywnych w 7/30 dniach, podłączone urządzenia, średni czas
praktyki. Żadnej wartości per użytkownik. Dodatkowo:

```sql
REVOKE ALL ON public.longevity_admin_stats FROM anon, authenticated;
```

Dostęp idzie przez funkcję `longevity_admin_dashboard()` (`SECURITY DEFINER`
z warunkiem `has_role`). Widok bez `REVOKE` byłby czytelny dla każdego
zalogowanego — nawet zagregowane dane zdrowotne to informacja biznesowa.

---

## Wzorzec RLS

Każda tabela z danymi użytkownika ma cztery polityki zbudowane tak samo:

```sql
CREATE POLICY "Właściciel czyta swoje dni"
  ON public.longevity_daily_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Właściciel zapisuje swoje dni"
  ON public.longevity_daily_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);
-- analogicznie UPDATE (USING + WITH CHECK) i DELETE (USING)
```

`UPDATE` ma **oba** warunki: `USING` sprawdza wiersz przed zmianą, `WITH CHECK`
po zmianie. Bez `WITH CHECK` użytkownik mógłby przepisać `user_id` na cudze
konto i podrzucić komuś swoje dane.

Nigdzie nie ma polityki dla roli `anon`.

---

## Retencja i usuwanie danych

**Prawo do bycia zapomnianym (RODO art. 17)** realizuje `ON DELETE CASCADE`
na kluczach obcych do `auth.users`. Usunięcie konta kasuje komplet danych
modułu w jednej transakcji — bez zadania w kolejce, bez ręcznej interwencji
i bez ryzyka, że jakaś tabela zostanie pominięta.

Klient dodatkowo udostępnia przycisk „Usuń wszystkie dane" (Ustawienia →
Twoje dane), który czyści pamięć lokalną i wywołuje `wipeRemoteData()`.

**Prawo do przenoszenia (RODO art. 20)**: eksport do JSON w formacie
`ExportBundle` (wersjonowany, wczytywalny z powrotem przez `importBundle`).

Polityka retencji:

| Dane | Okres |
| --- | --- |
| Rekordy dzienne | Bezterminowo, dopóki konto istnieje |
| Pamięć lokalna | 400 ostatnich dni (rok z zapasem) |
| Historia AI Coacha | 90 dni, potem automatyczne czyszczenie |
| Powiadomienia | 180 dni |
| `last_error` w połączeniach | Kasowany przy udanej synchronizacji |

---

## Wydajność

Cały ruch odczytowy zaczyna się od `user_id`, więc indeksy złożone
`(user_id, day DESC)` pokrywają go w całości. Typowe zapytanie:

```sql
SELECT day, payload
FROM public.longevity_daily_records
WHERE user_id = $1
ORDER BY day ASC
LIMIT 400;
```

Przy 400 dniach i rekordzie ~2 kB payload to poniżej 1 MB na użytkownika —
mieści się w jednym żądaniu przy starcie sesji, potem wszystko idzie z pamięci
lokalnej. Zapisy odbywają się porcjami po 100 wierszy (`pushRemoteRecords`),
bo upsert całego roku w jednym żądaniu bywa odrzucany przez limit rozmiaru.
