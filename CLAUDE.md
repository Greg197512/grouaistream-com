# GrouAI Stream — fakty projektu (czytaj to zamiast eksplorować od zera)

Ten plik istnieje, by NIE tracić tokenów na ponowne odkrywanie. Trzymaj go krótki
i aktualny. Jeśli fakt tu jest — nie weryfikuj go od nowa dziesiątkami wywołań.

## Stack
- **Vite + React + TS SPA** (NIE Next.js). Tailwind, framer-motion.
- Build: `vite build && node scripts/prerender.mjs` (bez `tsc` — szybki, ~50 s).
- Hosting: **Vercel** (Pro). Serverless w `api/` (edge): `assistant`, `youtube-search`, `media`, `diag-tracks`.

## Backend
- Supabase (Lovable-managed) ref: `bvstvawnigyczvofzhps` (klient: `src/integrations/supabase/client.ts`).
  Do zapytań SQL: Lovable MCP `query_database`, project_id `462bddcb-d545-4f42-bc51-5f437cb12bbe`
  (workspace `YE3AfpUp6rhkrR1T4L8Y`). MCP bywa niestabilny (timeout 60 s) — batchuj, licz na retry.
- **R2 media (publiczne):** `https://pub-46ecdc3a5ae341fcb16454d732eb9bcd.r2.dev`.
  R2 zwraca `206 audio/mpeg` z zakresami, ale **BEZ nagłówka CORS** → nie używać Web Audio
  z `crossOrigin="anonymous"` na tych plikach. Zwykłe `<audio>` (crossOrigin=null) gra wprost.
- Uploady userów → R2 przez edge `r2-upload-proxy` / `r2-signed-url` (wymagają zalogowania).

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

## Baza `tracks` (stan po sprzątaniu)
- ~406 realnych utworów. Usunięto 66 600 pustych „widm" (5 CC-artystów: Bensound, Kevin MacLeod,
  Scott Buckley, Audionautix, Purple Planet) dosypywanych przez cron. Trigger
  `block_sourceless_demo_tracks` (BEFORE INSERT) blokuje ich powrót. Cron joby 1/8/9 (cc-fetch) = disabled.
- Martwe: ~46 na `cdn1.suno.ai` (403 — skasowane po stronie Suno, nieodzyskiwalne bez oryginałów).

## Deploy (obowiązkowy flow)
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
