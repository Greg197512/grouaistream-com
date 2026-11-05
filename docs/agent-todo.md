# Lista zadań agentów — GrouAI

Źródło: audyt L0 z 4.11.2026 ([`docs/audit/2026-11-audit.md`](audit/2026-11-audit.md)).
Priorytet: P0 pilne/blokuje, P1 ważne, P2 rozwój, P3 porządki. Nakład: S (≤1 dzień), M (2–5 dni), L (>1 tydzień).
Poziom: najwyższy poziom autonomii, jakiego wymaga zadanie (L1 propozycja · L2 staging · L3 produkcja · L4 pieniądze/prawo).
Właściciel: **agent** (wykonuje po bramce) albo **Grzegorz** (tylko Ty możesz to zrobić).

## P0 — pilne

| ID | Zadanie | Moduł | Nakład | Ryzyko | Poziom | Właściciel |
| --- | --- | --- | --- | --- | --- | --- |
| P0-1 | Uzgodnić schemat bazy z repo: brakujące `shop_orders`, `gift_codes`, `radio_stations`, `radio_story_slots`, `locked_tracks`, `blog_promos`, `tracks.catalog_hidden`; uzupełnić historię migracji. Najpierw staging, potem produkcja | wszystkie | M | wysokie | L3 | agent (plan) → Grzegorz (zgoda) |
| P0-2 | Dodać w Vercel brakujące zmienne: darmowy klucz AI (`GEMINI_API_KEY` lub `GROQ_API_KEY`), `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `YOUTUBE_API_KEY`, `TELEGRAM_*` | Stream, Studio | S | niskie | L3 | Grzegorz |
| P0-3 | Wykrywanie nastroju a RODO: wyłączyć wysyłanie zdjęć twarzy do darmowych modeli, dodać osobną zgodę, analiza lokalna albo u dostawcy z umową powierzenia, DPIA | Stream | M | wysokie | L4 | agent (spec) → Grzegorz |
| P0-4 | Usunąć duplikaty projektów Vercel (`grouaistream`, `dist`) i wyłączyć `deploy.yml` (drugie wdrożenie `--prod`) | infra | S | niskie | L3 | Grzegorz (usunięcie) / agent (workflow) |
| P0-5 | CI dla PR: build + testy + lint (tylko nowe błędy); ochrona gałęzi `main` (scalanie po zielonym CI) | infra | S | niskie | L2 | agent |
| P0-6 | Sklep: dodać w Vercel `STRIPE_SECRET_KEY` (najpierw `sk_test_…`, test zamówienia, potem klucz live) i opcjonalnie `SHOP_SHIPPING_EUR_CENTS`; `SHOP_PADDLE_LIVE` nie włączać | GrouaRock | S | wysokie | L4 | Grzegorz |

## P1 — ważne

| ID | Zadanie | Moduł | Nakład | Ryzyko | Poziom | Właściciel |
| --- | --- | --- | --- | --- | --- | --- |
| P1-1 | Środowisko staging: podglądy Vercela + osobna baza (propozycja: projekt `sbmfliylgpqyteezrrtn` do czasu przełączenia) | infra | M | średnie | L2 | agent |
| P1-2 | Dokończyć migrację z Lovable (`docs/MIGRACJA-Z-LOVABLE.md`): sekrety funkcji, Google OAuth, przełączenie | infra | L | wysokie | L3 | Grzegorz + agent |
| P1-3 | Hub `bmwtydwpevzhbdplilbr`: przenieść albo wyłączyć `voice-intent`, `studio-chat`, `acestep-generate`, `hub-pricing`, `paddle-report`, `hub-email-send`, `neuro-profile`, geolokalizację | Stream, Studio | M | średnie | L2 | agent |
| P1-4 | Budżety API per moduł (LLM, ElevenLabs, Suno, Replicate): licznik dzienny/miesięczny, alert 80%, stop 100%; przegląd 45 cronów i wyłączenie zbędnych | wszystkie | M | średnie | L3 | agent (spec) → Grzegorz |
| P1-5 | ✅ częściowo 5.11 (radio: tekst na stronie + identyfikacja głosem). Ujawnienie AI: prezenter i głosy TTS w radiu, utwory z Studia (znaczek + metadane strumienia), zgodnie z AI Act | Radio, Studio | S | średnie | L3 | agent |
| P1-6 | Baner zgód na cookies + aktualizacja polityki prywatności (kamera, mikrofon, analityka) | Stream | M | średnie | L4 | agent (projekt) → Grzegorz |
| P1-7 | Limity zapytań i uwierzytelnienie dla `api/youtube-search`, `api/media`, `api/news-feed` | Stream | S | niskie | L2 | agent |
| P1-8 | Otwarty zapis bez logowania (`blog_newsletter_subscribers`, `reel_requests`, `dj_session_guests`): limit zapytań lub captcha | Stream | S | niskie | L3 | agent |
| P1-9 | GrouaRock: spec dostawcy (porównanie 2–3 firm druku na żądanie: marża, czas dostawy, API, zwroty) i automatycznej realizacji zamówień | GrouaRock | M | średnie | L1 | agent |
| P1-10 | GrouaRock: regulamin (projekt gotowy: `/shop/terms`, PL/EN/NL), VAT OSS i faktury (gotowe w panelu) — do zatwierdzenia treści i uzupełnienia `SHOP_SELLER_*`, `SHOP_VAT_MODE` w Vercel; wybór dostawcy i czasu dostawy | GrouaRock | M | wysokie | L4 | Grzegorz/prawnik |
| P1-11 | ✅ 5.11 autopilot (`radioClock.ts`). Radio: spec silnika ramówki (bloki gatunkowe, weekend Disco/Electronic/Hip-Hop, rotacja bez powtórek w oknie X h, dżingle) | Radio | M | niskie | L1 | agent |
| P1-12 | ✅ częściowo 5.11 (audio, długość, martwe hosty, audycje; LUFS jeszcze nie). Radio: bramka jakości przed anteną (LUFS, cisza, długość, filtr treści) z kodem z `src/lib/releasePrep.ts` | Radio, Studio | M | niskie | L2 | agent |
| P1-13 | Monitor zdrowia: przenieść z GitHub Actions (co 5 min) na cron Vercela albo co 15 min | infra | S | niskie | L2 | agent |

## P2 — rozwój

| ID | Zadanie | Moduł | Nakład | Ryzyko | Poziom | Właściciel |
| --- | --- | --- | --- | --- | --- | --- |
| P2-1 | Wersjonowane API Studio dla Radia: kolejka zadań, ponawianie, koszt na utwór, gatunki priorytetowe Disco/Electronic/Hip-Hop | Studio | L | średnie | L2 | agent |
| P2-2 | ✅ 5.11 wersja 1 (szablony, bez LLM; `radioHost.ts`). Persona prezentera AI (styl, wartości, zakazy) + generowanie wstawek „w locie” z filtrami treści; TTS ElevenLabs z otwartym zapasem i cache'em | Radio | L | średnie | L3 | agent |
| P2-3 | Monitoring strumienia radia (cisza, błędy) z alertami | Radio | M | niskie | L2 | agent |
| P2-4 | GrouaRock B2B: cenniki hurtowe, konta firmowe, wyceny, faktury VAT | GrouaRock | L | średnie | L4 | agent → Grzegorz |
| P2-5 | Katalog sklepu z bazy zamiast z kodu (`src/data/shopCatalog.ts`), zdjęcia produktów | GrouaRock | M | niskie | L2 | agent |
| P2-6 | Verified Human Streams: definicja, mierzenie skuteczności i fałszywych blokad | Stream | M | średnie | L2 | agent |
| P2-7 | Retencja `agent_events` (121 MB) i `brain_memory` | infra | S | niskie | L3 | agent |

## P3 — porządki

| ID | Zadanie | Moduł | Nakład | Ryzyko | Poziom | Właściciel |
| --- | --- | --- | --- | --- | --- | --- |
| P3-1 | Lint: 686 błędów; usunąć `@ts-nocheck` z 7 plików (zacząć od `RadioLive.tsx`) | Stream | L | niskie | L2 | agent |
| P3-2 | Testy e2e krytycznych ścieżek: logowanie, odtwarzanie, generowanie w Studio, zamówienie w sklepie | wszystkie | M | niskie | L2 | agent |
| P3-3 | Publiczne klucze anon wpisane w kod (`api/health.ts`, `api/diag-tracks.ts`, `src/lib/hubBlog.ts`) przenieść do zmiennych | infra | S | niskie | L2 | agent |
