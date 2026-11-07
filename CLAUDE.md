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
- Asystent `api/assistant`: klucze AI w Vercel (brak) → Pollinations (darmowe, bywa 402) → **żywy algorytm** (`localAnswer`: katalog utworów,
  skróty funkcji, szablon promptu Studia; bez AI). Tryby: `studio`, `aurora`, `translate`, `daw`. Test: `GET /api/assistant?ping=1[&skip=pollinations]`.
- **Grok usunięty z całej aplikacji (5.11, decyzja Grzegorza):** brak xAI w asystencie, brak wywołań edge `ai-assistant`/`blog-translate`/
  `generate-weekend-challenge` (miały Groka); cron `agents-run` (edge) = strażnik + puls + mail-alarm (raz/6 h), bez agentów `brain_*`.
  Zamienniki: wyzwanie weekendowe `src/lib/weekendChallenge.ts` (trend 7 dni vs 7 dni), tłumaczenie bloga `src/lib/blogTranslate.ts`,
  okienko Studia `StudioPromptDock` (dawniej StudioGrokDock). Nie dodawać Groka z powrotem.
- **Stary hub `bmwtydwpevzhbdplilbr` NIE ISTNIEJE (DNS, 11.2026)** — nie dodawać do niego wywołań. Przepięte: asystent (`hubAI` →
  `/api/assistant`), czat promptów Studia (`mode:"studio"`), Aurora B2B (`mode:"aurora"`, blok `[[ORDER]]` → `aurora_business_orders`),
  silniki Studia (`invokeStudioEngine` → główny projekt), szept nastroju (asystent), Nocne czytanie (`/api/radio-story`), prezent (`/prezent/:id` = SPA).
  Wyłączone: geo/obecność, nauka silnika. Bez zastępstwa (pokazują błąd): cennik B2B, raport Paddle.
  **Profil Neuro** (`src/lib/neuroProfile.ts`, 5.11): liczony w przeglądarce z `listening_history`/`liked_songs`/`mood_sessions` + cechy `tracks`, bez AI, cache 6 h w localStorage.
- **Maile (5.11):** `api/admin-email` (Vercel edge; masowa strumieniuje spacje, do 300 s): admin single/mass (`all_users` = rpc `get_all_users_for_admin`,
  `blog_subscribers`), `action:"b2b-order"` (zlecenie Aurory → `SHOP_NOTIFY_EMAIL` + klient). Transport `mailConfigFromEnv` (`src/lib/shopMail.ts`):
  Resend/Brevo gdy klucz + `SHOP_MAIL_FROM`, inaczej **bez kluczy** `send-transactional-email` głównego projektu (szablon `admin-notification`
  z `fullHtml`, noreply@grouaistream.com, suppressed_emails + tokeny wypisu, dziennik `email_send_log`). Sklep używa tego samego.
  **Doręczanie potwierdzone 5.11** (test `GET /api/admin-email?selftest=1` → tylko `SHOP_NOTIFY_EMAIL`, raz/h).
- **Obieg B2B (5.11):** Aurora (`/business`) → zlecenie `aurora_business_orders` + mail (`admin-email` b2b-order) → admin (`B2BOrdersPanel` →
  `B2BOrderActions`: Wyślij ofertę [cena, termin, notatka → `offer_sent`] / Opłacone / Rozpocznij / Postęp % / Gotowe [result_url] / Anuluj;
  zapis wprost w bazie RLS admina + mail do klienta `api/b2b` `notify`) → klient (`ClientDashboard` + `B2BOrderStatus`: oś czasu, oferta,
  QR Revolut z tytułem `B2B-XXXXXXXX`, „Akceptuję”/„Zapłaciłem” → mail do zespołu, „Pobierz wynik”; Realtime). Linki z maili: `/client-dashboard/:id`.
- **„Czego słucha świat”** (home, `WorldCharts.tsx`): `api/world-charts?c=world|pl|us|gb|nl|ua` (edge, CDN 6 h) — publiczny RSS Apple Music
  (most-played; „Świat” = top 5 z PL/US/GB/DE/FR/ES/IT/NL/UA/BR/JP z flagą) + iTunes lookup w sklepie danego kraju (CDN 1 h; klient odświeża co 30 min, ▲▼ NOWY względem poprzedniej wersji w localStorage `grouai-charts-*`) → fragmenty 30 s w naszym playerze (id `chart-…`, bez zapisu do historii — `UUID_RE` w PlayerContext) + link „Całość”.
- Home bez angielskich resztek i fałszywych danych: teksty `src/lib/homeI18n.ts` (odmiana `tracksLabel`), „Stworzone dla Ciebie” = `PlaylistGrid`
  żywy algorytm (gatunek/nastrój z katalogu, bez płatnego `ai-playlist`), karta radia bez zmyślonych słuchaczy.
- **Blog (7.11):** `/blog` = nagłówek „Dźwięk × Technologia” (grafika Canva `public/blog/hero-sound-tech*.jpg`), pasek „Na antenie” (najnowsze tytuły),
  „Najczęściej czytane” (top 5 wg `view_count`), `ReadingSoundtrack` (utwór z katalogu wg kategorii → główny player). Wpis: `ListenArticle`
  („Posłuchaj artykułu” — speechSynthesis zdanie po zdaniu, podświetlenie akapitu, 1–1,5×), soundtrack, inicjał. Hub bloga usunięty (`hubBlog.ts`).
  Generator nowych wpisów stoi od ~15.06 (brak klucza AI) — ~190 starych wpisów.
- Menu utworu (`TrackOptionsMenu`): pobieranie/offline przez `src/lib/trackFile.ts` (`/api/media?dl=1`), linki `?play=`, dane po otwarciu menu.
- **Studio (5.11, `GET /api/diag-studio` — bez kosztów):** Suno OK (klucz + kredyty, np. 1474), zapis R2 OK, funkcje silników istnieją.
  ACE-Step (`acestep-generate`) woła `/models/lucataco/ace-step/predictions` — model społecznościowy wymaga wersji, prawdopodobnie nie działa
  (nie da się poprawić bez wdrożenia funkcji na bvstv). `fireCoverGeneration` wyłączone (było płatne, wynik nieużywany).
- **Studio Pro = DAW** (`GrouaiStudioShell` → `StudioDAW`, VIP): wygląd jak Mixcraft (5.11, `daw/DawVisuals.tsx`): kostki akcji (AI), LCD transportu, znaczniki części
  (`project.markers`), kolorowe klipy, paski miksera z ikonami; pełna szerokość w zakładce. Asystent: `askDawAssistant` (AI → lokalny parser);
  „zrób utwór/bit X” = tempo+perkusja+bas+akordy+preset+znaczniki (bez płatnego podkładu). Podkład AI (Suno) tylko po `confirm`.
- **DJ Aurexis (dawniej DJ Yellow, 5–6.11):** nazwa artysty `DJ Aurexis` (stałe `ARTIST`/`OLD_ARTIST`; run przemianowuje stare utwory konta; UI scala obie nazwy).
  Pliki: `api/dj-aurexis.ts`, `src/lib/djAurexis.ts`, `DjAurexisAutopilot`, `public/artists/dj-aurexis*.webp`, R2 `dj-aurexis/` (okładka `e-` = z tłem AI z klubów (bez baru i alkoholu) (6 układów × 6 palet: portal, napis, duotone, snopy+EQ, plakat, echo), `b-` = bez tła → ponowna próba; stare adresy `/api/dj-yellow`, `/artists/dj-yellow*.webp` = rewrite w vercel.json; e-mail konta zapasowego bez zmian; env `DJ_AUREXIS_*` → zapas `DJ_YELLOW_*`).  `api/dj-aurexis.ts` (Node, cron 09:07 i 15:07 UTC): 2 utwory/dzień (1 zadanie Suno = 2 klipy, ~12 kredytów), pomysł AI (Pollinations) → zapas algorytm,
  okładki Pollinations → zapas SVG, R2 przez `r2-signed-url`, wpis `tracks` (Electronic, artysta DJ Aurexis) → „Nowe” + radio. Limit 2/dzień, dokańcza
  rozpoczęte zadanie (`generations` status queued). **Działa przez studio GrouAI (decyzja Grzegorza):** gdy właściciel (grzegorzkaron553@gmail.com) jest zalogowany, `DjAurexisAutopilot` (App) raz/dzień
  woła POST `/api/dj-aurexis` z jego tokenem (utwory na jego koncie, artysta DJ Aurexis); Limit liczony po artyście.
  Bez przycisków (decyzja Grzegorza). **2 RÓŻNE utwory** = 2 zadania Suno (1. klip z każdego, ~24 kredyty/dzień); dodatkowe dni: `EXTRA_DAYS` w api (5.11 = 4).
  Okładki = postać DJ Aurexis (stały opis `PERSONA`: dorosły ~28 l., ciemne potargane włosy, biała kurtka bomber na czarnej bluzie — styl z wzoru Grzegorza, bez jego twarzy, różne `SCENES`: kluby, puby, festiwale) + znaczek „AI” (SVG z osadzonym zdjęciem). Wyróżnienie 7 dni (is_boosted).
  Status zwraca `needsCovers` → automat w przeglądarce podmienia stare okładki (do 6 na raz). Po publikacji klient przepuszcza każdy utwór przez studio (`certifyStudioTrack`, `keepCover`: mastering −14 LUFS, WAV, studio_certified; okładka SVG zostaje).
  **DJ Aurexis = Przemek** (user_id 38461bf5-1ba0-4ef9-985a-ae5e9d2b7f72): automat działa też u niego (utwory na jego koncie; RLS nie pozwala przepisać starych).
  Trending Artists: „DJ Aurexis · AI” zawsze 1., portret = `public/artists/dj-aurexis.webp` (zdjęcie od Grzegorza); okładki = wycięta postać z tego zdjęcia (`public/artists/dj-aurexis-cutout.webp`, rembg) na różnych tłach AI (`BACKDROPS`: kluby — parkiet, kabina DJ, lasery; bez baru i alkoholu) + znaczek AI; jego twarzy nie generujemy. Cron/hasło (`DJ_YELLOW_PASSWORD`) — opcja zapasowa. `?status=1`, `?diag=1`, `?run=1`.
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
  W Vercel ustawione: `SHOP_BANK_IBAN/HOLDER/BIC`, `SHOP_REVOLUT_LINK` (revolut.me/grouaaistream), `SHOP_NOTIFY_EMAIL`,
  `SHOP_SELLER_NAME`=Grouarock, `SHOP_SELLER_ADDRESS` (Piastowska 71, 32-660 Chełmek), `SHOP_SELLER_COUNTRY`=PL, `SHOP_SELLER_EMAIL`=grouarock@gmail.com (5.11). `SHOP_VAT_MODE`=exempt (zwolnienie art. 113, start działalności; teksty sklepu/regulaminu to mówią). Brak: NIP, `SHOP_SUPPLIER_EMAIL`.
  Panel admina w sklepie widzi tylko `SHOP_ADMIN_EMAIL`.
  **Przewoźnicy (5.11):** `src/data/shopCarriers.ts` (InPost Paczkomat [kod punktu] / Kurier InPost — tylko PL; DHL, Poczta Polska, DPD, GLS, UPS — UE),
  wybór w koszyku → `payload.shipping.carrier/point`; ceny `SHOP_CARRIER_PRICES` (JSON eurocenty, brak = `SHOP_SHIPPING_EUR_CENTS`=0 → darmowa).
  Admin „Nadaj paczkę” (`action:"ship"`) → `payload.tracking`, status shipped, mail z linkiem śledzenia. Bez API przewoźników (etykiety ręcznie / Printful wysyła sam).
  „Moje zamówienia” = okno z przycisku w nagłówku sklepu; klient może **anulować** (`action:"cancel"`: nieopłacone → cancelled, opłacone → `cancel_requested_at` + mail do admina, zwrot ręcznie;
  po nadaniu nie). Admin: „Kopiuj dane odbiorcy” + „Zamów kuriera ↗” (strona nadania przewoźnika, `send` w shopCarriers). Mikołaj (`XmasDecor`) znika po 60 s.
  RLS: klient może UPDATE własnych zamówień (polityka „clients update own orders”) — także payment_status (do uszczelnienia).
  **Printful (5.11):** edge Vercela blokuje zapora Cloudflare Printful → wywołania przez Node `api/printful-proxy` (tylko z kluczem = `PRINTFUL_API_KEY`).
  Konto ma tylko sklep **Etsy** „Grouadrop” (19013575) — Orders/Products API działa tylko dla sklepu „Manual order platform / API” (type `native`);
  `withApiStore` sam go znajdzie, gdy powstanie. Nowy klucz (wszystkie sklepy) wpisany 5.11 wieczorem. Admin: „Połącz produkty z Printful” (dopasowanie `src/lib/printfulMatch.ts`
  → PUT External ID). Diagnostyka: `GET /api/shop-checkout?diag=printful`. **Import kompletów (6.11):** `?diag=printful-export` (wszystkie sklepy, też Etsy: nazwa, zdjęcia, rozmiary, ceny, variant_id, pliki nadruku) → `src/data/printfulCatalog.ts` (`PF_ITEMS`); zamówienie takiego produktu = `variant_id + files` do GruadropWeb (19023745, native). Po opłaceniu zamówienie idzie **od razu zatwierdzone** (`PRINTFUL_AUTO_CONFIRM` ≠ false) — Printful drukuje, wysyła, pobiera opłatę z karty w Printful. Obecny token nie ma scope `sync_products` — potrzebny nowy (All stores, wszystkie uprawnienia). Menu: „GrouaDrop”.
  **Wygląd (5.11):** `src/components/shop/Storefront.tsx` — baner z filmem bluzy, pasek zaufania, kafelki kategorii, karta produktu (2. zdjęcie po najechaniu,
  szybkie dodanie z rozmiarem), sortowanie, FAQ; framer-motion jednorazowo + `MotionConfig reducedMotion="user"`. Graffiti usunięte (decyzja Grzegorza).
  Katalog `/shop` = filmy + kafelki (lekki); **każdy produkt osobno: `/shop/p/:id`** (`ShopProduct.tsx`); koszyk wspólny `src/lib/shopCart.ts` (`/shop?cart=1` otwiera koszyk).
  **Kolekcje Canva (6.11):** Komplet Studio (bassdept bluza 18000, louder 3001, kubekbeats kubek, padstudio podkładka 518) i Nocna zmiana (afterhours hoodie 18500, nightshift tank 3480, etuieq iPhone 601, plakatnight plakat 18×24) — wzory z Canvy (projekt DAHaLIBonAI), pliki do druku `public/shop/designs/*.png|jpg` (odzież: PNG bez czarnego tła), podglądy `designs/web/`, zdjęcia = mockupy Printful (`/shop/<id>-1.jpg`). Sekcja „Komplety” (`CollectionSets.tsx`, `SHOP_SETS`), „żywy nadruk” (`LivePrint.tsx`, pole `fx` w katalogu: maska luminancji + pole nadruku). Zamówienie = `variant_id + files` (`PF_ITEMS`); gdy Printful odrzuci (brak scope) → powiadomienie „zamów ręcznie” z wariantem i linkiem do nadruku. Narzędzia właściciela w `api/shop-checkout`: `?diag=pf&k=<16 zn. sha256 klucza>&path=/products|/mockup-generator/...&b=<base64 JSON>` (mockupy ~2/min), `?diag=fetch64&k=&u=` (pobranie pliku Canva/Printful), `?diag=printful-probe`.
  **Gadżety (6.11):** osobna karta `/shop/gadzety` (`ShopGadgets.tsx`: karuzela ←→, klik = karta rośnie, obrót 360° wokół Y, neon, szklany panel opisu; w głównym katalogu ukryte, zakładka „✨ Gadżety” w nagłówku + baner). Kategoria „Gadżety” (sluchawkianc, flipsound, galaxy, gamepad, midi25, clearbuds, pixelbox; przedsprzedaż, dostawca „email” → ręcznie), zdjęcia poglądowe z Canvy (`/shop/<id>-1/-2.jpg`, w opisie zastrzeżenie), linki do hurtowni w adminie przy zamówieniu (`src/data/shopSourcing.ts`). Bez konsol z pirackimi grami. Canva AI ma limit kredytów (wyczerpany 6.11), Pollinations bez klucza = 1 obraz/45 s i słaba jakość.
  Stara funkcja `shop-checkout` i tabele `shop_orders`/`gift_codes` nie są używane (brak w bazie prod).

## Vercel
- Team `team_dcuxbMKuCaW05SplN8IdrSIq`. Produkcja `grouaistream.com` = projekt **`grouaistream-com`**
  (`prj_nDY7frLwg4nyMZpywRDLSzclamTZ`). Projekty `grouaistream` i `dist` to duplikaty na tym samym
  repo (do usunięcia — mnożą Build Minutes); **od 5.11 mają Ignored Build Step `exit 0` (nie budują)**.
  Ignored Build Step (ustawiony w panelu projektu 5.11): `bash scripts/vercel-ignore-build.sh` — **buduje tylko produkcję (main)**,
  podglądy gałęzi i zmiany samych `.md`/docs pomijane.
- **Koszty (Grzegorz: „uważaj, aby nie naliczało”):** nic płatnego nie może startować samo ani u gości.
  Płatne: Replicate (teledyski Kling/Hailuo — tylko na klik, z potwierdzeniem), OpenRouter (okładki AI `ai-cover-generate`),
  ElevenLabs/Azure (tylko gdy klucz). Usunięte automaty: teledysk po zmianie okładki, okładki AI z `NewOnServer` u każdego gościa,
  przycisk „dosyp 20k” w Bibliotece. Cron `api/agents-run` (co godz.): strażnik + puls + alarm mailem; agentów AI brak.
  Node-owe funkcje `api/*` importują lokalne pliki z rozszerzeniem `.js` (inaczej ERR_MODULE_NOT_FOUND); edge bundluje sam.
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
  **Głos Novy:** `GET /api/voice?l=&t=` (Vercel edge, cache CDN 30 dni): ElevenLabs (`ELEVENLABS_API_KEY`, `NOVA_ELEVEN_VOICE_ID`) →
  Azure kobiece (`AZURE_SPEECH_KEY/REGION`: Zofia/Ava/Fenna/Polina) → Google TTS (bez klucza). Klient: `src/lib/novaVoice.ts`: **najpierw Piper w przeglądarce (bez kluczy)** — Gosia/Amy/Nathalie/Lada,
  model 20–63 MB pobierany w tle raz (komputer albo telefon na Wi-Fi), potem `/api/voice`, na końcu kobiecy głos systemu.
  Uwaga: edge `elevenlabs-tts` (asystent) ma głosy MĘSKIE — dla Novy nie używać.
  Słuchacz wyłącza Novę przyciskiem (localStorage `grouai-radio-host`). Ujawnienie AI widoczne na stronie radia.
- **Telefony od słuchaczy** (`src/lib/radioCallin.ts`, `components/radio/CallIn.tsx`, `CallInDesk.tsx`): kanał Realtime `radio-callin`
  (jeden wspólny „hub” na kartę!), obecność caller/studio, zdarzenia accept/reject/end/onair/offair. Słuchacz (zalogowany) → kolejka →
  admin „Odbierz” → Nova zapowiada u wszystkich → głos dzwoniącego na `radio-live-voice` (`radioLiveSend.ts`, kawałki 0,9 s). Limit 3 min.
  **realtime-js zwraca istniejący kanał o tej samej nazwie** — nie wolno drugi raz `subscribe()` ani `removeChannel()` cudzego kanału (naprawione też w LiveMicBooth).
- **Serwis ze świata:** raz dziennie o 12:00 (czas PL, okno 5 min, raz na dzień — localStorage `grouai-news-day`), `fetchWorldNewsFlash`
  (dział „Świat” z `/api/news-feed`), męski lektor „Max” (`speakAnchor`: Piper darkman/ryan/rdh, tempo 1,1×; zapas: męski głos systemu,
  `/api/voice?v=m`). Przyciski „News o świecie” i „Opowiadanie” usunięte (auto-opowiadanie co 3 h zostało).
- **Głośność i zdrowie anteny:** GitHub Actions „Radio — głośność i zdrowie anteny” (co pon. + ręcznie; `scripts/measure-loudness.mjs`,
  ffmpeg EBU R128 + silencedetect) → `public/radio-loudness.json` (commit na `main`). Radio: `trackGain` wyrównuje do −14 LUFS (0,3–1,4×),
  `excludedIds` (martwe / < −40 LUFS / >40% ciszy) wypadają z planu autopilota. Podgląd w adminie (RadioAutopilotPreview).
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
**Wyjątek (7.11): `public/push-sw.js`** — worker TYLKO do powiadomień czatu (bez `fetch`, bez cache); `main.tsx` go nie wyrejestrowuje.
Czat GrouAI (`ChatWidget`): nowa wiadomość → dzwonek + głośne „Hej, jesteś?! X pisze do Ciebie!” (`src/lib/chatPush.ts`, głos przeglądarki → `/api/voice`;
przełącznik 🔊, localStorage `grouai-chat-voice`). Push przy zamkniętej apce: przycisk „Włącz” w czacie → `api/chat-push` (Node, `web-push`, VAPID w env)
→ urządzenia w **własnym Supabase sbmf** (`chat_push_subs`, RPC `chat_push_*` z sekretem `PUSH_DB_SECRET`; anon bez dostępu do tabel).
Po wysłaniu wiadomości klient woła `notify` (serwer sprawdza nadawcę); „Do wszystkich” = push do wszystkich max raz/10 min na nadawcę.
iPhone: push tylko w apce z ekranu głównego. Cron `agents-run` pinguje bazę sbmf (`pushDb`), by nie usnęła. Diag: `GET /api/chat-push?diag=1`.
Zasięg „wszyscy”: zalogowany bez zgody dostaje baner (co 3 dni); po zalogowaniu `hello` zapisuje e-mail+język (`chat_push_users`), właściciel raz/dobę
`sync-users` (rpc `get_all_users_for_admin`) → wszyscy zarejestrowani. Odbiorca bez urządzenia push → **e-mail** „Hej, jesteś?!” (send-transactional-email
głównego projektu, max raz/30 min od tej samej osoby; „Do wszystkich” bez maili). Bez zgody urządzenia push się nie da (wymóg przeglądarek).

## Perf / low-power
`src/lib/perf.ts` → `<html data-lowpower>` (słaby sprzęt) i `<html data-touch>` (telefon/tablet): lite Aurora (statyczna),
brak MatrixNotes, `backdrop-filter: none` i stoi `.animate-gradient` (`index.css`). Aurora: **bez plam, wstęg i twarzy** (decyzja Grzegorza 5.11) —
statyczne tło + drobne cząstki na komputerze. Wizualizer home nie rysuje poza ekranem. Nie dokładać wiecznych animacji na home.

## Reguły oszczędzania tokenów (dla agenta)
- Odpowiadaj zwięźle i po polsku; bez powtarzania kontekstu z tego pliku.
- Nie pobieraj całych bundli/HTML (`web_fetch` dużych plików). Do GitHub/Vercel MCP używaj
  `minimal_output`/wąskich filtrów; do `diag-tracks` małych `limit`. Grep z `head_limit`.
- Nie czytaj ponownie plików już wczytanych w sesji; nie re-weryfikuj faktów z tego pliku.
