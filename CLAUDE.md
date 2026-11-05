# GrouAI Stream — fakty projektu (czytaj to zamiast eksplorować od zera)

Ten plik istnieje, by NIE tracić tokenów na ponowne odkrywanie. Trzymaj go krótki
i aktualny. Jeśli fakt tu jest — nie weryfikuj go od nowa dziesiątkami wywołań.

## Stack
- **Vite + React + TS SPA** (NIE Next.js). Tailwind, framer-motion.
- Build: `vite build && node scripts/prerender.mjs` (bez `tsc` — szybki, ~50 s).
- Hosting: **Vercel** (Pro). Serverless w `api/` (edge): `assistant`, `youtube-search`, `media`, `diag-tracks`.

## Backend
- Supabase (Lovable-managed) ref: `bvstvawnigyczvofzhps` (klient: `src/integrations/supabase/client.ts`).
  **Lovable omijać całkowicie** (żadnych narzędzi Lovable, także `query_database`). Odczyt danych: `api/diag-tracks`
  przez `mcp__Vercel__web_fetch_vercel_url`. Pełny SQL dopiero na własnym Supabase `sbmfliylgpqyteezrrtn` (MCP Supabase).
- **R2 media (publiczne):** `https://pub-46ecdc3a5ae341fcb16454d732eb9bcd.r2.dev`.
  R2 zwraca `206 audio/mpeg` z zakresami, ale **BEZ nagłówka CORS** → nie używać Web Audio
  z `crossOrigin="anonymous"` na tych plikach. Zwykłe `<audio>` (crossOrigin=null) gra wprost.
- Uploady userów → **Vercel `api/r2-upload`** (token Supabase → podpisany PUT SigV4 → przeglądarka wysyła prosto na R2;
  `{"action":"setup-cors"}` ustawia CORS zasobnika). Wymaga w Vercel: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.
  Zapas: edge `r2-signed-url`/`r2-upload-proxy`.
- Asystent `api/assistant`: klucze AI w Vercel (brak) → Pollinations (bywa 402) → edge `ai-assistant` (ma klucze). Test: `GET /api/assistant?ping=1[&skip=pollinations]`.
- Zapis na R2 z edge: `_shared/r2.ts` = fetch + SigV4 (NIE @aws-sdk — zawieszał się). Test: `suno-generate` `{"action":"r2test"}`.
- Studio → Spotify: po każdej generacji `certifyWithToasts` (`src/lib/releasePipeline.ts`, `releasePrep.ts`):
  mastering −14 LUFS/−1 dBTP, WAV 44,1k/16, okładka 3000, czysty tekst → `generations.release`,
  `tracks.release` + `tracks.studio_certified` (znaczek „✓ GrouAI Studio”). Migracja z Lovable: `docs/MIGRACJA-Z-LOVABLE.md`.

- **Sklep GrouaRock** (`/shop`): Vercel `api/shop-checkout` → zamówienia w istniejącej tabeli `aurora_business_orders`
  (`service_type="shop"`, pozycje i adres w `payload`, token usera + RLS). Ceny z `src/data/shopCatalog.ts`.
  Płatność: **sam kod QR Revolut** (`SHOP_REVOLUT_LINK`; klient płaci w aplikacji albo kartą, IBAN tylko zapasowo) + opcjonalnie Stripe. Paddle nie (zakaz towarów fizycznych).
  Sklep i regulamin (`/shop/terms`) w PL/EN/NL (`src/i18n/shop.ts`, `src/data/shopCatalogI18n.ts`). Faktury → `aurora_invoices`
  (admin, `src/lib/shopInvoice.ts`), VAT OSS → `src/lib/vatOss.ts` + raport kwartalny w panelu. Dane sprzedawcy: `SHOP_SELLER_*`, `SHOP_VAT_MODE`.
  Realizacja (pośrednik): po opłaceniu Printful (`PRINTFUL_API_KEY`, External ID wariantu `produkt-ROZMIAR`) + gadżety e-mailem
  (`SHOP_SUPPLIER_EMAIL`, `src/data/shopSuppliers.ts`); e-maile Resend/Brevo (`SHOP_MAIL_FROM`), powiadomienia `SHOP_NOTIFY_EMAIL`=grouarock@gmail.com.
  W Vercel ustawione: `SHOP_BANK_IBAN/HOLDER/BIC`, `SHOP_REVOLUT_LINK` (revolut.me/grouaaistream), `SHOP_NOTIFY_EMAIL`. Menu: „GrouaDrop”.
  Stara funkcja `shop-checkout` i tabele `shop_orders`/`gift_codes` nie są używane (brak w bazie prod).

## Vercel
- Team `team_dcuxbMKuCaW05SplN8IdrSIq`. Produkcja `grouaistream.com` = projekt **`grouaistream-com`**
  (`prj_nDY7frLwg4nyMZpywRDLSzclamTZ`). Projekty `grouaistream` i `dist` to duplikaty na tym samym
  repo (do usunięcia — mnożą Build Minutes). Ignored Build Step: `bash scripts/vercel-ignore-build.sh`.
- Z piaskownicy agenta EGRESS blokuje `*.supabase.co`, `*.r2.dev`, `grouaistream.com` (curl/WebFetch/Playwright).
  Do sprawdzenia żywej strony/R2 używaj `mcp__Vercel__web_fetch_vercel_url` (idzie siecią Vercela).

## Odtwarzanie (ustalone — nie regresuj)
- Crossfade `LiveDJEngine` **WYŁĄCZONY** (`isCrossfadeEligible` = false) — wymagał CORS, psuł R2.
- `proxiedMediaUrl` = **no-op** (gramy wprost z R2; `/api/media` zostaje tylko do diagnostyki/hostów bez CORS).
- Player: `src/contexts/PlayerContext.tsx`. Nie wymuszać crossOrigin. Format .wav bywa u twórców.
- Granie przy zgaszonym ekranie: radio (`RadioLive.tsx`) i player mają **jeden stały `<audio>`** (podmiana `src` + `play()` od razu w `ended`).
  NIE tworzyć `new Audio()` na kolejny utwór — telefon w tle blokuje start nowego elementu. `main.tsx` nie przeładowuje, gdy `mediaSession.playbackState === "playing"`.

## Radio — autopilot (od 5.11.2026)
- Stacja publiczna gra **autopilota** (`src/lib/radioClock.ts` → `radioDaily.ts`): plan na całą dobę od polskiej północy,
  bloki: noc chill / poranek pop / dzień mix / popołudnie electronic / wieczór hip-hop; pt 18:00–nd 6:00 Disco/Electronic/Hip-Hop
  (rotacja co godzinę); niedziela spokój. Bez powtórek w oknie 2–8 h, artyści rozdzieleni, bramka jakości (audio, 45 s–15 min,
  bez `cdn1.suno.ai` i audycji). Admin: tryb `24h` = autopilot (podgląd ramówki), `manual` = grafik `radio_schedule`, `scheduled` = godziny. VIP gra grafik.
  Brak utworów w bloku klubowym (weekend, popołudnie, wieczór) → **DJ-miks electronic/hip-hop/disco** (`dj: true`, znaczek „DJ mix”).
  Przejścia DJ-skie: fade-in 2,5 s / fade-out 4 s samą głośnością jednego `<audio>` (bez Web Audio, bez drugiego elementu).
- **Prezenterka AI „Nova”** (`src/lib/radioHost.ts`): persona, szablony PL/EN/NL/UA, filtr treści; mówi przy starcie utworu
  (powitanie, zmiana bloku, pełna godzina z ujawnieniem AI, co 4 utwory zapowiedź; min. 6 min odstępu), muzyka ściszona do 25% (`duckRef`).
  Humor: `FUN` (ogólne/poranek/noc/weekend/DJ) w 4 językach, ~co trzecia kwestia (`wantsJoke`), żarty o muzyce i o sobie jako AI, nigdy z ludzi.
  Głos: `speak(…, {mode:"dj"})`. Słuchacz wyłącza przyciskiem (localStorage `grouai-radio-host`). Ujawnienie AI widoczne na stronie radia.
- **Język = wybór użytkownika:** `LanguageContext` zapisuje wybór zalogowanego w `user_metadata.language` i przywraca go po zalogowaniu
  (każde urządzenie). Radio (Nova, Talk, newsy, opowiadania) bierze język z kontekstu, nie z domyślnego „pl”.

## Baza `tracks` (stan po sprzątaniu)
- ~406 realnych utworów. Usunięto 66 600 pustych „widm" (5 CC-artystów: Bensound, Kevin MacLeod,
  Scott Buckley, Audionautix, Purple Planet) dosypywanych przez cron. Trigger
  `block_sourceless_demo_tracks` (BEFORE INSERT) blokuje ich powrót. Cron joby 1/8/9 (cc-fetch) = disabled.
- Martwe: ~46 na `cdn1.suno.ai` (403 — skasowane po stronie Suno, nieodzyskiwalne bez oryginałów).

## Deploy (obowiązkowy flow)
**Od 4.11.2026 (ADLC, `docs/decisions.md`):** zmiany przez PR do `main`; scalenie = produkcja (L3) tylko po zgodzie Grzegorza.
Zadania i audyt: `docs/agent-todo.md`, `docs/audit/2026-11-audit.md`.
Gałąź robocza: `claude/grouaistream-analysis-optimization-ivi8w5`.
`push -u origin <branch>` → `checkout main` → `pull --no-rebase` → `merge --no-ff <branch>` → `push origin main` → wróć na branch.
Stopka commita: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` + `Claude-Session: <url>`.

## PWA / cache
Service Worker usunięty; `public/sw.js` to self-destruct (czyści cache, wyrejestrowuje). Zainstalowane
apki na Androidzie trzymały stary kod — reinstalacja apki leczy.

## Perf / low-power
`src/lib/perf.ts` → `<html data-lowpower>` na słabym sprzęcie: lite Aurora, brak MatrixNotes,
zerowy backdrop-blur. Nie dokładać wiecznych animacji na home.

## Reguły oszczędzania tokenów (dla agenta)
- Odpowiadaj zwięźle i po polsku; bez powtarzania kontekstu z tego pliku.
- Nie pobieraj całych bundli/HTML (`web_fetch` dużych plików). Do GitHub/Vercel MCP używaj
  `minimal_output`/wąskich filtrów; do `diag-tracks` małych `limit`. Grep z `head_limit`.
- Nie czytaj ponownie plików już wczytanych w sesji; nie re-weryfikuj faktów z tego pliku.
