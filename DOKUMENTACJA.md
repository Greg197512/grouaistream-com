# GrouAI Stream — dokumentacja zmian i konfiguracji

Plik pomocniczy: masz tu w jednym miejscu **co trzeba ustawić** i **co gdzie działa**.
Aktualizowany na bieżąco. (Historia szczegółowa: `git log`.)

---

## ✅ 1. Co musisz ustawić (żeby wszystko ożyło)

### A) Zmienne środowiskowe w Vercel
`Vercel → projekt → Settings → Environment Variables` → dodaj i zrób **Redeploy**:

| Zmienna | Do czego | Wymagane |
|---|---|---|
| `OPENROUTER_API_KEY` | Asystent tekstowy (AI) + „✨ Opowiedz o wykonawcy" w rolkach | tak, żeby asystent gadał |
| `ASSISTANT_MODEL` | (opcjonalnie) model asystenta, domyślnie `anthropic/claude-3.5-sonnet` | nie |
| `YOUTUBE_API_KEY` | Wyszukiwanie w całym YouTube (okienko na pauzie w rolkach) | tak, dla szukania po YouTube |

> Bez `OPENROUTER_API_KEY` asystent kulturalnie odpowie „nie jestem skonfigurowany".
> Bez `YOUTUBE_API_KEY` szukanie w rolkach działa tylko po naszych piosenkach + propozycje.

### B) Migracja bazy w Supabase (projekt aplikacji `bvstvawnigyczvofzhps`)
Żeby **historia oglądania** była na koncie (między urządzeniami), uruchom raz:
```
supabase/migrations/20260826120000_reel_history.sql
```
(np. `supabase db push`, albo wklej SQL w Supabase → SQL Editor). Bez tego historia trzyma się lokalnie w przeglądarce.

---

## 🎬 2. Rolki (TikTok-style) — gdzie i jak

- **Na stronie głównej → „🔥 Na czasie"**: okno teledysków. Na komputerze oglądasz w oknie
  (widać tytuł „co jest co"), strzałki lewo/prawo. Na telefonie / przyciskiem **„Rolki"** →
  pełny ekran.
- **W epokach (Groua Era → wejdź w epokę → „Oglądaj jak rolki")**: pełnoekranowe rolki
  teledysków danej dekady. U góry: **wykonawca · tytuł · rok**; chipy epok przełączają dekadę.
- **Sterowanie**: swipe góra/dół = następny/poprzedni, tap = pauza/play, ➕ = dodaj do playlisty.
- **➕ Dodaj do playlisty**: nasze utwory → Supabase `liked_songs` (Polubione); teledyski YouTube → zapis lokalny.
- **Na pauzie** (po ~3,5 s) wyskakuje okienko: wpisz utwór/wykonawcę/rok → szukamy u nas i w YouTube;
  jest też „✨ Opowiedz o wykonawcy" (AI).
- **Źródła teledysków**:
  - „Teledyski AI" = kuratorska pula (`src/lib/aiTeledyski.ts`) — hip-hop, rasta/reggae, techno/disco.
  - „Nasze utwory" = cały katalog (utwory z wideo na przód, np. **reset404**).
  - Epoki = playlisty YouTube dekad (`ERA_YOUTUBE` w `src/lib/eraEngine.ts`).
- **Pamięć**: rolki wznawiają się tam, gdzie skończyłeś (per użytkownik + epoka); martwe filmy są pomijane.

---

## 🎧 3. Groua Era — muzyka po dekadach
- Strona epoki (`/era/:key`) ma odtwarzacz **playlisty YouTube dekady** (całe utwory) — przycisk „Oglądaj jak rolki".
- Playlisty: `ERA_YOUTUBE` (YouTube) i `ERA_SPOTIFY` (Spotify) w `src/lib/eraEngine.ts`.
- W hubie `/era` blok **„Twoje zainteresowania (rolki)"** — top wykonawcy z historii oglądania.

---

## 🤖 4. Asystent tekstowy (AI)
- Backend: **Vercel** `api/assistant.ts` (streaming, OpenRouter/OpenAI). Klient: `src/components/assistant/AIAssistant.tsx` woła `/api/assistant`.
- Zna stronę (`SITE_KNOWLEDGE`) i pamięta zalogowanego użytkownika (imię, statystyki, co gra).
- Reset rozmowy: ikonka kosza w oknie asystenta.

---

## 🎚️ 5. DJ
- `src/hooks/useDJMode.ts` — set „świeżo + najlepsze": mniej ostatnio granych na koniec + ważenie
  popularnością (`plays`/`streams`/`view_count`/`likes`). Tylko nasz katalog.

---

## ✨ 6. Grafika hero
- **Equalizer** nad tytułem: bardzo żywy, 24 słupki (róż→fiolet→cyjan) — `src/components/sections/HeroSection.tsx`.
- **Przebłysk po literach** tytułu: klasa `.title-glint` w `src/index.css`.
- **Tagi hero** (Verified / Anti-Fraud / Mood-Based): jeden rząd na telefonie, cykl 2 min / 30 min,
  przelatująca kula ognia — `src/components/sections/HeroTags.tsx`.
- **Intro** przy starcie (logo z kawałków → rozpływa się) — `src/components/effects/IntroSplash.tsx`.

---

## 📁 7. Najważniejsze pliki
| Obszar | Plik |
|---|---|
| Rolki (uniwersalne) | `src/components/sections/FeedReels.tsx` |
| Rolki epok | `src/components/sections/EraReels.tsx` |
| Okno „Na czasie" | `src/components/sections/NaCzasieHits.tsx` |
| Popup szukania na pauzie | `src/components/reels/ReelSearchPopup.tsx` |
| Pula teledysków AI | `src/lib/aiTeledyski.ts` |
| Szukanie (nasze + YouTube) | `src/lib/reelSearch.ts` |
| Historia oglądania | `src/lib/reelHistory.ts` + migracja `reel_history` |
| Asystent (klient / AI) | `src/components/assistant/AIAssistant.tsx` + `src/lib/assistantClient.ts` |
| Backend AI (Vercel) | `api/assistant.ts` |
| Szukanie YouTube (Vercel) | `api/youtube-search.ts` |
| Epoki (playlisty) | `src/lib/eraEngine.ts`, `src/pages/EraPage.tsx` |
| DJ | `src/hooks/useDJMode.ts` |
| Hero (equalizer/przebłysk) | `src/components/sections/HeroSection.tsx`, `src/index.css` |

---

## ⏭️ 8. Do zrobienia / opcje na przyszłość
- DJ dokładający utwory **z YouTube** do setu (do przetestowania na żywo po ustawieniu kluczy).
- **Zainteresowania z rolek → dobór** kolejnych teledysków (po wdrożeniu tabeli `reel_history`).
- Jeśli któryś teledysk z puli nie gra (autor wyłączył osadzanie) — podmiana na inny.

---

## 🔧 9. Jak wdrażamy
- Zmiany idą na branch `claude/grouaistream-analysis-optimization-ivi8w5`, merge do `main`, Vercel deployuje z `main`.
- Przed każdym wdrożeniem: `npx vite build` (weryfikacja) + podgląd.
