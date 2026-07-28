# 10 — Backlog

Zadania w kolejności wykonania. Oszacowania w dniach roboczych jednego
programisty. `[x]` — zrobione, `[ ]` — do zrobienia.

Priorytety: **P0** blokuje premierę · **P1** ważne · **P2** wartościowe ·
**P3** gdy będzie czas.

---

## Zrobione

### Silnik (`src/lib/longevity/`)

- [x] `types.ts` — model danych (DailyRecord, UserProfile, wyniki)
- [x] `math.ts` — plateau, z-score, statystyka kołowa, regresja liniowa
- [x] `norms.ts` — VO₂max wg wieku i płci, normy snu, WHO, BMI
- [x] `scores.ts` — sen, stres, regeneracja, energia, mózg, krążenie, metabolizm, Longevity Index
- [x] `epigenetic.ts` — 100 punktów, 9 kategorii, punktacja częściowa
- [x] `nervousSystem.ts` — cztery stany na dwóch osiach + oś napędu
- [x] `garmin.ts` — Body Battery, Training Readiness, HRV Status, drabinka treningowa, Morning Report
- [x] `biologicalAge.ts` — wiek biologiczny (12 czynników) i regeneracyjny
- [x] `digitalTwin.ts` — baza osobista, trendy, 6 prognoz, optymalna pora snu i okno treningowe
- [x] `missions.ts` — generator misji z uzasadnieniem
- [x] `gamification.ts` — XP, poziomy, seria z dniem ochronnym, 12 odznak
- [x] `nutrition.ts` — Mifflin–St Jeor, cele, konkretne poprawki, mikroskładniki
- [x] `breathing.ts` — 7 protokołów z parametrami animacji
- [x] `meditations.ts` — 14 sesji ze scenariuszami
- [x] `soundscape.ts` — synteza Web Audio (szum różowy, drony, fale binauralne)
- [x] `devices.ts` — 16 kanałów, 20 marek, tablica zaufania
- [x] `coach.ts` — generator wniosków, sygnały bezpieczeństwa, prompt systemowy
- [x] `panel.ts` — `analyzeDay()`
- [x] `demoData.ts` — deterministyczny generator 180 dni
- [x] `storage.ts` — local-first + Supabase, eksport/import RODO
- [x] 51 testów jednostkowych

### Interfejs

- [x] Paleta `longevity-*` i animacje w `tailwind.config.ts`
- [x] Prymitywy: GlassCard, SectionTitle, Pill, ConfidenceBadge, ProgressBar, Disclaimer, EmptyState
- [x] ScoreRing, MetricTile, DriverBars
- [x] TrendChart + Sparkline
- [x] LongevityShell (szyna desktop + dolny pasek mobilny)
- [x] 15 ekranów
- [x] Trasy w `App.tsx` + alias `/stop-aging`
- [x] `LongevityContext` z synchronizacją i debounce

### Backend

- [x] Migracja: 9 tabel, RLS, trigger limitu powiadomień, widok admina
- [x] `stop-aging-coach` — warstwa językowa z wykrywaniem objawów alarmowych
- [x] `stop-aging-sync` — mappery Garmin / Oura / WHOOP + scalanie
- [x] Wpisy w `config.toml`

### Dokumentacja

- [x] 11 dokumentów

---

## P0 — przed premierą

### Garmin

- [ ] Wniosek do Garmin Health API — **złożyć w pierwszym tygodniu** · 1 d
- [ ] OAuth 1.0a: przepływ połączenia + callback · 3 d
- [ ] Szyfrowanie tokenów AES-256-GCM (`_shared/crypto.ts`) · 2 d
- [ ] Rejestracja Ping/Push, weryfikacja podpisu webhooka · 2 d
- [ ] Testy mappera na rzeczywistych ładunkach · 2 d
- [ ] Ekran połączenia: stan, ostatnia synchronizacja, rozłączenie · 2 d

### Wdrożenie

- [ ] `supabase db push` na produkcję + weryfikacja RLS · 1 d
- [ ] Wdrożenie funkcji brzegowych + sekrety · 1 d
- [ ] Regeneracja `src/integrations/supabase/types.ts` (usunie rzutowania w `storage.ts`) · 0,5 d
- [ ] Monitoring błędów (Sentry) dla modułu · 1 d

### Onboarding

- [ ] Kreator 6 kroków: cel → profil → urządzenie → cele dzienne → zgody → pierwszy raport · 4 d
- [ ] Ekran zgód: osobno zdrowie, osobno AI · 1 d
- [ ] Stan pustego konta z jasnym pierwszym krokiem · 1 d

### Prawne

- [ ] Polityka prywatności — weryfikacja przez prawnika · 3 d
- [ ] Regulamin z klauzulą braku statusu wyrobu medycznego · 2 d
- [ ] DPIA (RODO art. 35) · 3 d
- [ ] Rejestr czynności przetwarzania (art. 30) · 1 d
- [ ] Umowa powierzenia z dostawcą modelu (art. 28) · 2 d

### Powiadomienia

- [ ] Web push z zapisem do `longevity_notifications` · 3 d
- [ ] Harmonogram: raport poranny, przypomnienie o misji, wieczorne wyciszenie · 2 d
- [ ] Godziny ciszy + limit 4/dobę po stronie wysyłki · 1 d

**Razem P0: ~38 dni roboczych.**

---

## P1 — pierwszy kwartał po premierze

### Jakość

- [ ] Testy E2E (Playwright): onboarding, dziennik, oddech, coach · 4 d
- [ ] Testy komponentów dla kluczowych ekranów · 3 d
- [ ] Budżet wydajności + pomiar Core Web Vitals · 2 d
- [ ] Audyt dostępności (WCAG 2.1 AA) · 3 d

### Funkcje

- [ ] Zapis sesji do `longevity_practice_sessions` (dziś tylko minuty w dzienniku) · 1 d
- [ ] Zapis wyników do `longevity_daily_scores` (cache wykresów rocznych) · 2 d
- [ ] Historia rozmów AI Coacha w bazie · 2 d
- [ ] Odznaki: zapis `earned_at` przy zdobyciu + animacja · 2 d
- [ ] Raport tygodniowy PDF (jspdf jest już w zależnościach) · 3 d
- [ ] Import plików FIT (ścieżka zapasowa dla Garmina) · 3 d
- [ ] Widżet „szybki wpis" na pulpicie · 2 d

### Tłumaczenia

- [ ] Wydzielenie tekstów modułu do `src/i18n/longevity.*.ts` · 3 d
- [ ] EN, DE, NL · 4 d
- [ ] Przekazanie języka do promptu trenera (pole `locale` już jest) · 0,5 d

**Razem P1: ~34 dni.**

---

## P2 — wartościowe

- [ ] Panel admina: statystyki, zarządzanie treścią, moderacja · 5 d
- [ ] Symulator „co jeśli" — więcej scenariuszy + zapis własnych · 2 d
- [ ] Porównanie okresów (ten miesiąc vs poprzedni) · 2 d
- [ ] Cele długoterminowe („−3 lata wieku biologicznego w 6 miesięcy") · 3 d
- [ ] Sesje audio: kolejka i tło odtwarzania · 3 d
- [ ] Tryb offline: Service Worker + pełne PWA · 4 d
- [ ] Eksport CSV obok JSON · 1 d
- [ ] Rozpoznawanie posiłku ze zdjęcia (model wizyjny) · 5 d
- [ ] Integracja z kalendarzem (obciążenie dnia jako kontekst stresu) · 3 d
- [ ] Ciemny/jasny motyw (dziś tylko ciemny) · 3 d

**Razem P2: ~31 dni.**

---

## P3 — kiedy będzie czas

- [ ] Aplikacja na zegarek (Garmin Connect IQ, watchOS, Wear OS) · 10 d
- [ ] Sterowanie głosowe sesjami · 4 d
- [ ] Wizualizacja 3D cyfrowego bliźniaka (`@react-three/fiber` jest w zależnościach) · 6 d
- [ ] Panel trenera / dietetyka · 8 d
- [ ] API partnerskie z dokumentacją · 6 d
- [ ] Współdzielenie osiągnięć w mediach społecznościowych · 2 d

---

## Dług techniczny

| Pozycja | Wpływ | Koszt |
| --- | --- | --- |
| Rzutowanie `supabase as unknown as SupabaseClient` w `storage.ts` | Brak typów dla nowych tabel | 0,5 d — regeneracja typów po migracji |
| `SOURCE_TRUST` istnieje w dwóch miejscach (klient + Deno) | Ryzyko rozjazdu | 1 d — wspólny plik importowany po obu stronach |
| Kontrakt `DailyRecord` powielony w mapperach Deno | j.w. | 1 d — jw. |
| Historia misji odtwarzana z bieżącego zestawu | Seria dni liczona przybliżeniem | 2 d — zapis zestawu misji per dzień |
| Brak zapisu `longevity_daily_scores` | Wykres roczny liczony w kliencie | 2 d — patrz P1 |
| Teksty modułu wpisane w komponentach | Blokuje tłumaczenia | 3 d — patrz P1 |
| Sesje audio nie trafiają do `longevity_practice_sessions` | Brak historii praktyk | 1 d — patrz P1 |

Żadna z tych pozycji nie blokuje działania. Wszystkie są świadomymi decyzjami
na rzecz szybszego dojścia do działającej całości — i wszystkie są tu spisane,
żeby nie stały się niespodzianką.

---

## Definicja ukończenia

Zadanie jest zrobione, gdy:

1. Kod przechodzi `npx tsc --noEmit` i `npx eslint` bez błędów.
2. Logika w silniku ma test jednostkowy.
3. Interfejs działa od 360 px do 1920 px.
4. Ekran z wynikiem ma `<Disclaimer />`.
5. Wynik ma `confidence` i listę `drivers`.
6. Pusty stan mówi, co zrobić dalej.
7. Animacje używają wyłącznie `transform` i `opacity`.
8. Nowe pole danych jest spójne w trzech miejscach: `types.ts`, mapper, baza.
