# 03 — API

Trzy warstwy interfejsów: **funkcje brzegowe** (Deno, Supabase Edge),
**API klienta** (TypeScript, `src/lib/longevity`) i **webhooki dostawców**.

---

## 1. `POST /functions/v1/stop-aging-coach`

Warstwa językowa AI Coacha. `verify_jwt = true` — wymaga zalogowania.

### Żądanie

```jsonc
{
  "question": "Czy mogę dziś trenować?",
  "context": {                       // wyliczone lokalnie, model ich nie zmienia
    "locale": "pl",
    "date": "2026-07-28",
    "profile": { "ageBand": "40-49", "sex": "male" },
    "scores": {
      "biologicalAge": 38.4, "biologicalAgeDelta": -3.6, "recoveryAge": 39.1,
      "sleep": 78, "stress": 34, "stressLevel": "moderate", "recovery": 71,
      "energy": 68, "epigenetic": 82, "brain": 74,
      "cardiovascular": 80, "metabolic": 69, "longevityIndex": 76
    },
    "nervousSystem": { "state": "recovery", "balance": 72, "rationale": ["…"] },
    "twin": { "maturity": 0.68, "baselineDays": 41, "optimalBedtime": 1372, "predictions": [ … ] },
    "insights": [ { "priority": 2, "title": "…", "actions": ["…"], "basedOn": ["…"], "category": "sleep" } ]
  },
  "history": [ { "role": "user", "content": "…" }, { "role": "assistant", "content": "…" } ],
  "groundTruth": "Regeneracja: 71/100 …"   // odpowiedź silnika reguł
}
```

**`groundTruth` jest polem obowiązkowym w praktyce.** Bez niego model dostaje
same liczby i musi sam ułożyć zalecenie — czyli dokładnie to, czego architektura
unika. Klient zawsze wylicza odpowiedź regułową (`answerLocally`) **przed**
wysłaniem żądania i przekazuje ją jako źródło prawdy merytorycznej.

### Odpowiedź

```jsonc
{
  "reply": "Body Battery 68/100, regeneracja 71 …",
  "source": "ai",          // "ai" | "rules" | "safety"
  "disclaimer": "To wskazówka oparta na Twoich danych, a nie diagnoza medyczna. …"
}
```

| `source` | Znaczenie |
| --- | --- |
| `ai` | Model językowy przeformułował `groundTruth` |
| `rules` | Model niedostępny (brak klucza / limit / błąd) — zwrócono `groundTruth` |
| `safety` | Wykryto objaw alarmowy — zwrócono stałą, przetestowaną treść |

### Ścieżka bezpieczeństwa

Przed wywołaniem modelu treść pytania jest sprawdzana pod kątem fraz
alarmowych (ból w klatce piersiowej, duszność, omdlenia, myśli samobójcze —
w wersji polskiej i angielskiej, z wariantami bez diakrytyków). Przy trafieniu
funkcja **nie wywołuje modelu** i zwraca stałą treść z numerami 112, 116 123
i 800 70 2222.

Powód: to jedyna sytuacja, w której kreatywność modelu jest wadą, a nie zaletą.
Odpowiedź na sygnał alarmowy musi być identyczna za każdym razem i możliwa do
przetestowania.

### Kody błędów

| Kod | Warunek |
| --- | --- |
| `400` | Brak pytania albo nieprawidłowy JSON |
| `401` | Brak lub nieważny JWT (`verify_jwt = true`) |
| `405` | Metoda inna niż `POST` / `OPTIONS` |
| `200` z `source: "rules"` | Model niedostępny — **nie jest to błąd dla klienta** |

Ostatni wiersz jest istotny: awaria dostawcy AI nie może objawiać się
komunikatem o błędzie. Użytkownik dostaje merytorycznie tę samą poradę,
oznaczoną w interfejsie jako „odpowiedź z silnika reguł".

---

## 2. `POST /functions/v1/stop-aging-sync`

Wejście danych z urządzeń. `verify_jwt = false` — webhooki dostawców nie
potrafią wysłać JWT Supabase, więc funkcja weryfikuje nadawcę sama.

### Dwa tryby uwierzytelnienia

**Tryb A — aplikacja mobilna** (Apple Health, Health Connect):
nagłówek `Authorization: Bearer <supabase_jwt>`, użytkownik ustalany przez
`admin.auth.getUser(token)`.

**Tryb B — webhook dostawcy** (Garmin, Oura, WHOOP, Fitbit, Polar, Strava):
pole `providerUserId` w treści, użytkownik ustalany przez zapytanie do
`longevity_device_links` po parze `(provider, provider_user_id)`.

Gdy żaden tryb nie zadziała → `401`. Brak trybu „zaufaj treści żądania".

### Żądanie

```jsonc
{
  "provider": "garmin",
  "providerUserId": "d3f1c9a2-…",     // tryb B
  "payload": { /* surowy ładunek dostawcy albo znormalizowany */ }
}
```

### Odpowiedź

```jsonc
{ "ok": true, "merged": 3, "days": ["2026-07-26", "2026-07-27", "2026-07-28"] }
```

### Co funkcja robi, a czego nie

**Robi:** rozpoznanie użytkownika → normalizację (mapper dostawcy) →
scalenie z istniejącym rekordem wg zaufania źródła → upsert → aktualizację
`last_sync_at`.

**Nie robi:** nie liczy żadnego wskaźnika. Wiek biologiczny, indeks stresu
i regeneracja powstają w silniku TypeScript pokrytym testami — duplikowanie
tej logiki w Deno oznaczałoby dwie implementacje, które rozejdą się przy
pierwszej zmianie wag.

### Reguła scalania

```
Pole nadpisujemy, gdy:  nowe źródło ma wyższe lub równe zaufanie
                        LUB pole było puste
```

Zaufanie (`SOURCE_TRUST`) — musi być identyczne po obu stronach
(`devices.ts` i `stop-aging-sync/index.ts`):

| Źródło | Zaufanie | | Źródło | Zaufanie |
| --- | --- | --- | --- | --- |
| Garmin | 100 | | Fitbit | 82 |
| Oura | 95 | | Withings | 76 |
| WHOOP | 92 | | Health Connect | 72 |
| Polar | 88 | | Strava | 50 |
| Apple Health | 85 | | Wpis ręczny | 40 |

Uzasadnienie kolejności: urządzenie noszone całą dobę na nadgarstku lub palcu
mierzy więcej i dokładniej niż telefon w kieszeni. Wyjątkiem są pola, których
urządzenie nie mierzy w ogóle (dieta, nastrój, używki) — tam wpis ręczny jest
jedynym źródłem i wygrywa przez brak konkurencji, nie przez regułę.

### Mappery

| Dostawca | Obsługiwane sekcje ładunku |
| --- | --- |
| `garmin` | `dailies`, `sleeps`, `userMetrics`, `hrv`, `trainingReadiness` |
| `oura` | `sleep`, `readiness`, `activity` |
| `whoop` | `recovery`, `sleep`, `cycle` |
| pozostałe | `mapNormalized` — ładunek znormalizowany po stronie klienta |

Mappery przycinają dane do znanych pól. Klient mobilny **nie może** wstrzyknąć
dowolnego JSON-a do `payload` — `mapNormalized` przepisuje wyłącznie osiem
znanych grup, a `compact()` usuwa `undefined`, żeby scalanie nie kasowało
istniejących wartości.

### Rejestracja webhooków u dostawców

| Dostawca | Endpoint konfiguracyjny |
| --- | --- |
| Garmin | Health API → Ping/Push Service, URL: `…/stop-aging-sync` |
| Oura | Webhook Subscription API v2, `event_type: create|update` |
| WHOOP | Webhooks, zdarzenia `recovery.updated`, `sleep.updated`, `workout.updated` |
| Fitbit | Subscriptions API, kolekcje `sleep`, `activities`, `body` |
| Polar | AccessLink → transaction pull (bez push — cykliczne odpytywanie) |
| Strava | Push Subscription, zdarzenie `activity.create` |

---

## 3. API klienta

Jedno wejście do całego silnika:

```ts
import { analyzeDay } from "@/lib/longevity";

const analysis = analyzeDay(today, history, profile, { totalXp });
```

Zwraca `DayAnalysis`:

```ts
interface DayAnalysis {
  panel: LongevityPanel;         // wszystkie wyniki dnia
  twin: DigitalTwin;             // baza osobista, prognozy, optymalna pora snu
  baseline: TwinBaseline;
  missions: Mission[];           // pięć misji dobranych do stanu
  missionProgress: MissionProgress[];
  earnedXpToday: number;
  gamification: GamificationState;
  report: CoachReport;           // wnioski + obowiązkowe zastrzeżenie
  garmin: GarminInsight;         // rekomendacja treningowa + Morning Report
  nutrition: NutritionAnalysis;  // cele, luki, konkretne poprawki
}
```

### Kontrakt każdej funkcji silnika

Wszystkie funkcje wyliczające wynik zwracają `ScoreResult`:

```ts
interface ScoreResult {
  value: number;            // 0–100
  confidence: "low" | "medium" | "high";
  drivers: ScoreDriver[];   // udziały składników — sumują się do `value`
  inputsUsed: number;       // ile pól danych faktycznie użyto
}
```

Suma `drivers[].contribution` równa się `value` (z dokładnością do zaokrągleń —
pilnuje tego test „suma udziałów składników równa się wynikowi"). Dzięki temu
interfejs zawsze potrafi pokazać rozbicie i wykres udziałów się domyka.

### Warstwa trwałości

```ts
import {
  loadRecords, saveRecords, mergeRecord,       // pamięć lokalna
  fetchRemoteRecords, pushRemoteRecords,       // Supabase
  fetchRemoteProfile, pushRemoteProfile,
  buildExportBundle, importBundle,             // RODO art. 20
  wipeLocalData, wipeRemoteData,               // RODO art. 17
} from "@/lib/longevity/storage";
```

`storage.ts` importujemy **bezpośrednio**, nie przez `index.ts` — dzięki temu
testy silnika nie ciągną klienta Supabase i działają bez zmiennych środowiskowych.

Wszystkie operacje zdalne są „miękkie": przy braku tabel, braku sesji lub braku
sieci zwracają `null` / `{ ok: false, reason }` i aplikacja działa dalej na
danych lokalnych. Nie ma ścieżki, w której błąd sieci blokuje zapis dziennika.

---

## 4. Format eksportu

```jsonc
{
  "version": 1,
  "exportedAt": "2026-07-28T09:14:22.000Z",
  "profile":  { /* UserProfile */ },
  "settings": { /* LongevitySettings */ },
  "totalXp": 4820,
  "records": [ /* DailyRecord[] */ ]
}
```

Format jest **wersjonowany i samodokumentujący** — `importBundle()` odrzuca
paczki o nieznanej wersji zamiast wczytywać je częściowo. Import scala dane
po dacie: istniejące wpisy są uzupełniane, nie nadpisywane.

---

## 5. Limity i koszty

| Zasób | Limit | Uzasadnienie |
| --- | --- | --- |
| `stop-aging-coach` | 60 wywołań / użytkownik / dobę | Koszt modelu; przy przekroczeniu klient przechodzi na silnik reguł |
| `stop-aging-sync` | 1000 wywołań / użytkownik / dobę | Garmin przy pełnej synchronizacji wysyła ~20 pushy dziennie |
| Upsert rekordów | 100 wierszy na żądanie | Powyżej tego Supabase odrzuca ze względu na rozmiar |
| Pamięć lokalna | 400 dni | Rok z zapasem; starsze dane pozostają w bazie |
| Powiadomienia | 4 / dobę (twardo) | Wymóg produktowy, pilnowany triggerem w bazie |

Debounce synchronizacji: 2 sekundy. Suwak nawodnienia nie powinien generować
żądania na każdy ruch palca — zmiany zbierają się i lecą jedną paczką.
