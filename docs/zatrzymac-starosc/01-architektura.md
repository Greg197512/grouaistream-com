# 01 — Architektura

## Zasada nadrzędna: silnik osobno, interfejs osobno

Cała logika zdrowotna żyje w `src/lib/longevity/` jako **czyste funkcje
TypeScript**. Nie ma tam Reacta, nie ma zapytań sieciowych, nie ma odczytu
czasu systemowego wewnątrz obliczeń. Konsekwencje tej decyzji:

- **Testowalność** — 51 testów jednostkowych pokrywa cały silnik bez
  renderowania czegokolwiek. Test „dobra noc daje wyższy wynik niż zła" wykonuje
  się w milisekundach.
- **Przenośność** — ten sam kod można uruchomić w React Native, w funkcji
  brzegowej albo w skrypcie migracyjnym. Aplikacja mobilna (Q2) użyje tego
  samego pliku, nie kopii.
- **Determinizm** — te same dane wejściowe zawsze dają ten sam wynik. To warunek
  konieczny, żeby wykres historyczny nie zmieniał kształtu po przeliczeniu.

Interfejs nie liczy niczego. Komponent dostaje gotowy obiekt `DayAnalysis`
i go renderuje.

---

## Struktura katalogów

```
src/
├─ lib/longevity/                 # SILNIK — czyste funkcje, zero zależności od UI
│  ├─ types.ts                    # Model danych: DailyRecord, UserProfile, wyniki
│  ├─ math.ts                     # Funkcje numeryczne: plateau, z-score, statystyka kołowa
│  ├─ norms.ts                    # Wartości referencyjne (VO₂max, sen, WHO, BMI)
│  ├─ scores.ts                   # Sen, stres, regeneracja, energia, mózg, krążenie, metabolizm
│  ├─ epigenetic.ts               # Epigenetic Lifestyle Score — 100 punktów dziennie
│  ├─ nervousSystem.ts            # Cztery stany na dwóch osiach (pobudzenie × rezerwa)
│  ├─ garmin.ts                   # Body Battery, Training Readiness, HRV Status, Morning Report
│  ├─ biologicalAge.ts            # Wiek biologiczny i wiek regeneracyjny
│  ├─ digitalTwin.ts              # Baza osobista, trendy, prognozy
│  ├─ missions.ts                 # Generator misji dnia
│  ├─ gamification.ts             # XP, poziomy, serie, odznaki
│  ├─ nutrition.ts                # Cele żywieniowe i konkretne poprawki
│  ├─ breathing.ts                # Protokoły oddechowe z parametrami animacji
│  ├─ meditations.ts              # Katalog sesji ze scenariuszami
│  ├─ soundscape.ts               # Synteza dźwięku w Web Audio API
│  ├─ devices.ts                  # Katalog integracji i zaufanie źródeł
│  ├─ coach.ts                    # Generator wniosków + prompt systemowy
│  ├─ panel.ts                    # Kompozycja: analyzeDay() — jedno wejście dla UI
│  ├─ demoData.ts                 # Deterministyczny generator danych poglądowych
│  ├─ storage.ts                  # Trwałość: localStorage + Supabase (jedyny plik z I/O)
│  └─ index.ts                    # Publiczne API modułu
│
├─ contexts/
│  └─ LongevityContext.tsx        # Stan, synchronizacja, zmemoizowany analysis
│
├─ components/longevity/
│  ├─ primitives.tsx              # GlassCard, SectionTitle, Pill, ProgressBar, Disclaimer
│  ├─ ScoreRing.tsx               # Pierścień wyniku, MetricTile, DriverBars
│  ├─ TrendChart.tsx              # Wykresy (recharts) + Sparkline (SVG)
│  └─ LongevityShell.tsx          # Powłoka: nawigacja desktop/mobile, nagłówek
│
├─ pages/longevity/               # 15 ekranów, każdy = jeden moduł produktowy
│  ├─ Dashboard.tsx  Sleep.tsx  Stress.tsx  NervousSystem.tsx
│  ├─ Breathing.tsx  Meditations.tsx  Coach.tsx  BiologicalAge.tsx
│  ├─ Diet.tsx  Activity.tsx  Trends.tsx  Missions.tsx
│  └─ Journal.tsx  Devices.tsx  Settings.tsx
│
└─ test/
   └─ longevity.test.ts           # 51 testów silnika

supabase/
├─ migrations/
│  └─ 20260728050000_zatrzymac_starosc.sql
└─ functions/
   ├─ stop-aging-coach/index.ts   # Warstwa językowa AI Coacha
   └─ stop-aging-sync/index.ts    # Normalizacja danych z urządzeń

docs/zatrzymac-starosc/           # Ta dokumentacja
```

---

## Warstwy i kierunek zależności

```
┌─────────────────────────────────────────────────────────────┐
│  EKRANY (pages/longevity)                                   │
│  Renderują DayAnalysis. Nie liczą wskaźników.               │
└───────────────────────────┬─────────────────────────────────┘
                            │ useLongevity()
┌───────────────────────────▼─────────────────────────────────┐
│  KONTEKST (LongevityContext)                                │
│  Stan + synchronizacja + useMemo(analyzeDay)                │
└──────────┬──────────────────────────────┬───────────────────┘
           │                              │
┌──────────▼────────────┐    ┌────────────▼───────────────────┐
│  SILNIK (lib/longevity)│    │  TRWAŁOŚĆ (storage.ts)         │
│  Czyste funkcje        │    │  localStorage ↔ Supabase       │
│  Zero I/O              │    │  Jedyny plik z zapytaniami     │
└────────────────────────┘    └────────────┬───────────────────┘
                                           │
                              ┌────────────▼───────────────────┐
                              │  SUPABASE                      │
                              │  PostgreSQL + RLS + Realtime   │
                              │  Edge Functions (Deno)         │
                              └────────────────────────────────┘
```

Zależności idą wyłącznie w dół. Silnik nie wie o istnieniu Reacta ani Supabase —
`import` w drugą stronę nie istnieje i nie powinien się pojawić.

---

## Przepływ danych

### Ścieżka 1 — dane z urządzenia

```
Garmin Connect
   │ webhook (push, ~5 min opóźnienia)
   ▼
stop-aging-sync (Edge Function)
   │ 1. rozpoznanie użytkownika po (provider, provider_user_id)
   │ 2. normalizacja: mapGarmin() → DailyRecord
   │ 3. scalenie wg zaufania źródła (SOURCE_TRUST)
   ▼
longevity_daily_records (JSONB, RLS)
   │ realtime / fetch przy starcie sesji
   ▼
LongevityContext → analyzeDay() → DayAnalysis → ekrany
```

### Ścieżka 2 — wpis ręczny

```
Dziennik dnia (suwak)
   │ updateRecord() — natychmiastowa aktualizacja stanu
   ▼
localStorage (zapis synchroniczny)          ← źródło prawdy dla UI
   │ debounce 2 s
   ▼
pushRemoteRecord() → longevity_daily_records
```

Kolejność jest celowa: **najpierw pamięć lokalna, potem sieć**. Użytkownik widzi
efekt ruchu suwakiem natychmiast, a brak internetu nie blokuje zapisu.

### Ścieżka 3 — rozmowa z AI Coachem

```
Pytanie użytkownika
   ├─→ answerLocally()      → odpowiedź regułowa (zawsze dostępna)
   └─→ stop-aging-coach     → model językowy dostaje:
         • kontekst (liczby wyliczone lokalnie)
         • groundTruth (odpowiedź regułowa)
         • zadanie: przeformułuj, nie wymyślaj
   ▼
Odpowiedź. Przy błędzie sieci / braku klucza / limicie dostawcy
klient pokazuje wersję regułową i oznacza ją w interfejsie.
```

---

## Kluczowe decyzje projektowe

### Dlaczego JSONB, a nie kolumny

Zestaw metryk zmienia się z każdą integracją. Garmin dokłada Hill Score i
Endurance Score, Oura temperaturę skóry, WHOOP Day Strain. Schemat kolumnowy
oznaczałby migrację przy każdym nowym dostawcy i kilkadziesiąt kolumn `NULL`
dla użytkownika z samym telefonem.

Struktura JSON jest kontraktem współdzielonym przez trzy miejsca: `types.ts`,
mappery w `stop-aging-sync` i kolumnę `payload`. Zapytania idą po
`(user_id, day)` — indeks pokrywa 100% ruchu odczytowego.

### Dlaczego local-first

Aplikacja zdrowotna używana jest rano po przebudzeniu (słabe łącze), na siłowni
(brak zasięgu) i w samolocie. Model „najpierw sieć" oznaczałby spinner w
najważniejszych momentach użycia. Pamięć lokalna jest źródłem prawdy dla
interfejsu, chmura służy synchronizacji między urządzeniami i kopii zapasowej.

### Dlaczego dwuwarstwowy AI Coach

Model językowy, który sam wymyśla zalecenia zdrowotne, prędzej czy później
poda liczbę, której nie ma w danych, albo zaleci coś sprzecznego z pomiarem.
Rozdzielenie odpowiedzialności — reguły tworzą treść, model tworzy formę —
usuwa tę klasę błędów i pozwala przetestować merytorykę jednostkowo.

### Dlaczego dźwięk jest syntezowany, a nie odtwarzany z plików

Godzina dźwięku deszczu w dobrej jakości to 50–80 MB. Synteza w Web Audio
zajmuje kilkanaście kilobajtów kodu, startuje natychmiast, działa offline
i nigdy nie słychać zapętlenia. Nagrania lektorskie z Grouaistream dochodzą
jako warstwa premium — nie zastępując tej podstawowej.

### Dlaczego moduł żyje w repozytorium Grouaistream

Wspólne konto, wspólny backend i wspólna biblioteka audio. Użytkownik loguje
się raz, a moduł longevity korzysta z tego samego `AuthContext` i tej samej
instancji Supabase. Warstwa wizualna jest w pełni odseparowana (własna paleta
`longevity-*` w Tailwindzie, własna powłoka), więc obie części nie mieszają się
wizualnie.

---

## Wydajność

| Element | Rozwiązanie |
| --- | --- |
| Przeliczenie panelu | `useMemo` w kontekście; `analyzeDay` jest liniowe względem liczby dni |
| Historia misji | Odtwarzana z bieżącego zestawu zadań (liniowo), nie przez pełny panel na każdy dzień (kwadratowo) |
| Wykresy 365 dni | Średnia krocząca 7-dniowa + próbkowanie do ~60 punktów |
| Animacje | Wyłącznie `transform` i `opacity` — kompozytor GPU, 60 FPS |
| Oddech | `requestAnimationFrame` ze stanem liczonym z czasu, nie z licznika klatek |
| Bundle | Każdy ekran ładowany leniwie przez `React.lazy` |
| Pamięć lokalna | Maksymalnie 400 dni; starsze dane pozostają w bazie |

---

## Rozszerzanie

**Nowy wskaźnik**: dodaj funkcję w `scores.ts` zwracającą `ScoreResult`
(przez `buildScore`), podłącz w `panel.ts`, pokaż w UI jako `MetricTile`.
Automatycznie dostaje listę `drivers` i poziom pewności.

**Nowy dostawca danych**: dopisz mapper w `stop-aging-sync/index.ts`, pozycję
w `DEVICE_INTEGRATIONS` i wartość w `SOURCE_TRUST`. Reszta systemu nie wymaga
zmian — scalanie i wyliczenia działają na znormalizowanym `DailyRecord`.

**Nowa sesja audio**: wpis w `MEDITATION_SESSIONS` ze scenariuszem. Sesja
pojawia się w bibliotece, w rekomendacjach i w wyszukiwaniu bez zmian w UI.

**Nowy język**: kod w `LongevityLocale`, pozycja w `LOCALES` w ustawieniach.
Model językowy odpowiada w języku z pola `locale` kontekstu.
