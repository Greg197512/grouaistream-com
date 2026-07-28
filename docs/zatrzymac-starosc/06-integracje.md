# 06 — Integracje z urządzeniami

**Priorytet nr 1: Garmin.** Jako jedyny dostawca udostępnia metryki, których
nie da się odtworzyć z surowego tętna — Body Battery, Training Readiness,
HRV Status, Recovery Time, Endurance Score i Hill Score.

---

## Strategia: kanały, nie marki

Użytkownik z Amazfitem szuka w aplikacji kafelka „Amazfit". Nie znajdzie go —
bo Zepp nie ma publicznego API dla partnerów spoza umowy. Jego dane docierają
przez **Health Connect**.

Dlatego ekran „Urządzenia" pokazuje **kanały** (jak dane faktycznie płyną)
plus mapę **marka → kanał**, żeby użytkownik nie musiał tego wiedzieć.

Jedno połączenie z Health Connect obejmuje kilkanaście marek: Samsung, Xiaomi,
Amazfit, Honor, Oppo, OnePlus, Realme, Mobvoi, Nothing — o ile producent
zapisuje dane do systemu (a od Androida 14 to standard).

---

## Kanały

| # | Kanał | Transport | Push | Opóźnienie | Metryki |
| --- | --- | --- | --- | --- | --- |
| 1 | **Garmin Connect** | OAuth cloud | tak | ~5 min | 22 |
| 2 | Apple Health | SDK natywny | nie | ~15 min | 17 |
| 3 | Health Connect | SDK natywny | nie | ~15 min | 16 |
| 4 | Oura Ring | OAuth cloud | tak | ~10 min | 12 |
| 5 | WHOOP | OAuth cloud | tak | ~10 min | 10 |
| 6 | Fitbit | OAuth cloud | tak | ~15 min | 12 |
| 7 | Polar Flow | OAuth cloud | tak | ~20 min | 9 |
| 8 | Samsung Health | SDK natywny | nie | ~20 min | 11 |
| 9 | Suunto | OAuth cloud | nie | ~30 min | 6 |
| 10 | COROS | OAuth cloud | nie | ~30 min | 7 |
| 11 | Withings | OAuth cloud | tak | ~10 min | 7 |
| 12 | Huawei Health | OAuth cloud | nie | ~30 min | 7 |
| 13 | Google Fit | OAuth cloud | nie | ~30 min | 6 |
| 14 | Strava | OAuth cloud | tak | ~5 min | 5 |
| 15 | Xiaomi / Amazfit / Zepp | przez Health Connect | nie | ~60 min | 6 |
| 16 | Wpis ręczny | zawsze dostępny | — | 0 | 8 |

---

## Marka → kanał

| Marka | Kanał | Uwaga |
| --- | --- | --- |
| Garmin | `garmin` | Bezpośrednio, pełny zakres |
| Apple Watch | `apple_health` | Przez iPhone'a |
| Samsung Galaxy Watch | `health_connect` | |
| Google Pixel Watch | `health_connect` | Fitbit OS |
| Fitbit | `fitbit` | Bezpośrednio lub Health Connect |
| Oura Ring | `oura` | Najlepsze dane nocne |
| WHOOP | `whoop` | |
| Polar | `polar` | |
| Suunto | `suunto` | Treningi kompletne, dane dobowe ograniczone |
| COROS | `coros` | Wymaga umowy partnerskiej |
| Huawei Watch | `huawei_health` | Osobny wniosek o zakres zdrowotny |
| Xiaomi Watch | `health_connect` | |
| Amazfit / Zepp | `health_connect` | |
| Withings | `withings` | Waga, ciśnieniomierz, mata Sleep |
| OnePlus / TicWatch / Nothing / Honor / Oppo / Realme | `health_connect` | |

---

## Garmin — integracja priorytetowa

### Metryki unikalne

| Metryka | Wykorzystanie w silniku |
| --- | --- |
| **Body Battery** | Regeneracja (15%), energia (22%), oś rezerwy w układzie nerwowym |
| **Training Readiness** | Regeneracja (25%), rekomendacja treningowa |
| **HRV Status** | Rekomendacja treningowa (`low`/`poor` → −2 stopnie) |
| **Recovery Time** | Regeneracja (5%), rekomendacja |
| **All-Day Stress** | Indeks stresu (20%), oś pobudzenia |
| **VO₂max** | Wiek biologiczny (±4 lata), wynik krążeniowy (30%) |
| **Endurance / Hill Score** | Kontekst treningowy |
| **Pulse Ox, Respiration** | Sygnały bezpieczeństwa, brain recovery |

### Drabinka rekomendacji treningowej

```
hard → moderate → easy → recovery → rest
```

Start od pozycji wynikającej z Training Readiness (≥80 → 0 kroków, <25 → 4).
Modyfikatory: Body Battery ≤25 (+2), ≤40 (+1), ≥75 (−1); Recovery Time ≥24 h
(+1); Stress ≥70 (+1); HRV Status `low`/`poor` (+2), `unbalanced` (+1),
`balanced` (−1); HRV ≤ −15% względem bazy (+1).

**Konstrukcja jest celowo zachowawcza.** Pojedynczy zły sygnał obniża zalecenie
o stopień, dwa krytyczne prowadzą do dnia bez treningu. Przy braku Training
Readiness startujemy od `moderate`, nie od `hard` — brak danych nigdy nie
oznacza zgody na maksymalne obciążenie.

### Morning Report

Format: fakty → wniosek → priorytety.

```
Body Battery wynosi 32/100.
HRV spadło o 18% względem Twojej bazy (54 ms).
Stres utrzymuje się wysoko od 4 dni.

Dzisiaj nie zalecamy intensywnego treningu.

Priorytet:
✔ sen — połóż się wcześniej niż zwykle
✔ spacer w tempie rozmowy, 30–45 minut
✔ nawodnienie — 2 litry rozłożone na cały dzień
✔ 10 minut oddechu z wydłużonym wydechem
```

Każde zdanie jest oparte na konkretnej liczbie z rekordu. Bez danych Garmin
funkcja zwraca instrukcję połączenia, nie pusty raport.

### Wdrożenie techniczne

1. Rejestracja w Garmin Developer Program → Health API.
2. OAuth 1.0a (Garmin nie migrował na 2.0 dla Health API).
3. Rejestracja Ping/Push Service → URL `…/functions/v1/stop-aging-sync`.
4. Subskrypcja typów: `dailies`, `sleeps`, `stressDetails`, `userMetrics`,
   `hrv`, `trainingReadiness`, `bodyComps`, `activities`.
5. Mapper `mapGarmin()` normalizuje wszystkie sekcje w jednym przebiegu.

Uwagi z dokumentacji Garmina:
- `calendarDate` to doba lokalna użytkownika — używamy jej wprost.
- Czasy w sekundach; `startTimeOffsetInSeconds` daje przesunięcie strefy.
- Body Battery przychodzi jako zakres dobowy (`Lowest`, `Highest`,
  `MostRecent`) — wszystkie trzy trafiają do `vendor`.
- Recovery Time w minutach → dzielimy przez 60.

---

## Pozostałe API — uwagi wdrożeniowe

**Oura v2** — `daily_sleep`, `daily_readiness`, `daily_activity`. Webhooki
z `event_type: create|update`. Najlepsza jakość danych nocnych (temperatura
skóry, HRV w trakcie snu), brak danych treningowych. `readiness.score` →
`readinessScore`, `temperature_deviation` → `body.skinTempDeltaC`.

**WHOOP v2** — czasy w **milisekundach** (nie sekundach). `recovery_score` →
`readinessScore`, `strain` → `strain`. Sen liczymy jako
`total_in_bed − total_awake`. Kilodżule → kcal: `/4,184`.

**Fitbit** — Subscriptions API, nie odpytywanie cykliczne (limit 150 żądań/h
na użytkownika). Kolekcje `sleep`, `activities`, `body`.

**Polar AccessLink** — model transakcyjny: otwórz transakcję, pobierz, zatwierdź.
Brak push. `nightlyRecharge` → `readinessScore`.

**Strava** — wyłącznie treningi. Uzupełnia obraz obciążenia, nie dostarcza
danych dobowych ani snu. Push subscription `activity.create`.

**Apple Health / Health Connect** — działają **wyłącznie na urządzeniu**.
Wymagają aplikacji natywnej (React Native, Q2 roadmapy). Aplikacja normalizuje
dane lokalnie i wysyła gotowy `DailyRecord[]` przez `mapNormalized`. Background
delivery na iOS, WorkManager na Androidzie.

---

## Scalanie wielu źródeł

Użytkownik z Garminem, iPhone'em i wagą Withings ma trzy źródła kroków
i dwa źródła masy ciała. Reguła:

```
Nadpisz pole, gdy nowe źródło ma zaufanie ≥ obecnemu LUB pole jest puste.
```

| Źródło | Zaufanie | Źródło | Zaufanie |
| --- | --- | --- | --- |
| Garmin | 100 | Fitbit | 82 |
| Oura | 95 | Suunto / COROS | 78 |
| WHOOP | 92 | Withings | 76 |
| Polar | 88 | Samsung Health | 74 |
| Apple Health | 85 | Health Connect | 72 |
| Huawei | 66 | Google Fit | 55 |
| Xiaomi / Amazfit | 60–62 | Strava | 50 |
| | | Wpis ręczny | 40 |

**Uzasadnienie hierarchii**: urządzenie noszone całą dobę na nadgarstku lub
palcu mierzy więcej i dokładniej niż telefon w kieszeni, który nie rejestruje
kroków przy pchaniu wózka ani nocy w ogóle.

**Wyjątek**: dieta, nastrój i używki. Tam wpis ręczny jest jedynym źródłem —
wygrywa przez brak konkurencji, nie przez regułę.

Tablica `SOURCE_TRUST` istnieje w dwóch miejscach (`devices.ts` i
`stop-aging-sync/index.ts`) i **musi pozostać identyczna**. Rozjazd oznaczałby,
że dane scalone na serwerze różnią się od scalonych lokalnie.

---

## Praca bez urządzenia

Aplikacja jest w pełni użyteczna z samym dziennikiem. Dostępne wtedy:

- Sleep Score (długość, regularność, pobudki, odczuwana jakość),
- indeks stresu (subiektywny, sen, powiadomienia),
- Epigenetic Score (komplet 100 punktów),
- wiek biologiczny (7 z 12 czynników),
- misje, gamifikacja, AI Coach, oddech, medytacje.

Niedostępne: metryki producenta (Body Battery, Training Readiness),
fazy snu, HRV, VO₂max, SpO₂.

`confidence` spada do `medium` lub `low` i jest to widoczne przy każdej liczbie.
To uczciwsze niż udawanie precyzji, której nie ma.

---

## Bezpieczeństwo integracji

- Tokeny szyfrowane **AES-256-GCM** w funkcji brzegowej; klucz w Supabase
  Secrets, nigdy w kodzie i nigdy w kliencie.
- Kolumny `access_token_enc` / `refresh_token_enc` nie mają polityk
  `INSERT`/`UPDATE` dla roli `authenticated` — zapis wyłącznie przez
  `service_role`.
- Klient odczytuje stan połączenia przez widok `longevity_device_status`,
  który nie eksponuje tokenów.
- Rozłączenie urządzenia: unieważnienie tokenu u dostawcy **i** usunięcie
  wiersza. Dane historyczne pozostają — należą do użytkownika.
- Webhook bez rozpoznanego `providerUserId` → `401`. Brak ścieżki „zaufaj
  treści żądania".

---

## Kolejność wdrożenia

| Faza | Kanały | Uzasadnienie |
| --- | --- | --- |
| **1** (MVP) | Garmin, wpis ręczny | Priorytet produktu + działanie bez urządzenia |
| **2** | Apple Health, Health Connect | Aplikacja mobilna → kilkanaście marek naraz |
| **3** | Oura, WHOOP, Fitbit | Najczęściej używane obok Garmina |
| **4** | Polar, Withings, Strava | Uzupełnienie: dane treningowe i masa ciała |
| **5** | Suunto, COROS, Huawei | Wymagają umów partnerskich |
