# GrouAI Stream — analiza stanu, wydajności i plan globalnej widoczności (lipiec 2026)

Raport z pełnego przeglądu repozytorium, infrastruktury (Vercel + Supabase/Lovable Cloud +
hub `raport-nl-pl` + Cloudflare R2) oraz danych o użytkownikach dostępnych z tego środowiska.

---

## 1. Co mamy dzisiaj (stan faktyczny)

**Stack:** Vite + React 18 + TypeScript + Tailwind/shadcn, hosting Vercel, baza główna
Lovable Cloud (projekt `bvstvawnigyczvofzhps`), hub pomocniczy Supabase `bmwtydwpevzhbdplilbr`
(leady, geo, blog hubowy, kolejka social), streaming audio z Cloudflare R2.

**Skala kodu:** 42 strony (route-level lazy loading ✅), ~128 komponentów-katalogów,
**ponad 60 funkcji edge** (AI studio, Aurora B2B, SEO bot, mood detection, płatności Paddle).

**Co już jest zrobione dobrze:**
- code-splitting per strona + stabilne `manualChunks` dla vendorów,
- `Cache-Control: immutable` dla `/assets/` w `vercel.json`,
- prerender SEO (`scripts/prerender.mjs`) dla 5 tras: `/`, `/radio`, `/earn`, `/movies`, `/legal`,
- bogaty JSON-LD (WebApplication, Organization, WebSite+SearchAction, RadioStation, FAQ…),
- automat SEO po stronie backendu: `seo-orchestrator` → `seo-bot`, `seo-blog-generate`, `seo-sitemap-generate`,
- landingi leadowe `/lp/*.html` + lejek Aurora B2B + plany reklamowe (GOOGLE_ADS_PLAN.md, MARKETING_B2B_ADS.md),
- twardy kill-switch starego Service Workera (naprawiona pętla odświeżeń).

---

## 2. Użytkownicy — ile osób mamy

**Dokładna liczba zarejestrowanych kont jest w bazie głównej (Lovable Cloud), do której to
środowisko nie ma dostępu sieciowego.** Liczbę widać w aplikacji: **Panel Admina → kafelek
„Użytkownicy”** (RPC `get_admin_stats` → `total_users` = `count(*)` z `public.profiles`).

Twarde dane, które udało się pobrać z huba (`user_geo`, śledzenie od 12.07.2026):

| Metryka | Wartość |
|---|---|
| Unikalni zalogowani użytkownicy (12–16.07) | **7** |
| Geografia | 6× Polska (Bytom, Warszawa ×2, Wrocław, Prochowice, Kolbuszowa), 1× Holandia (Utrecht — właściciel) |
| Najaktywniejszy user (poza właścicielem) | 11 logowań w 4 dni |
| Leady B2B (`hub_leads`) | 1 |
| Posty blogowe huba | 6 |
| Kolejka social (`hub_social_queue`) | 53 wpisy |

Wniosek: produkt jest gotowy technologicznie, ale **ruch jest śladowy** — wąskim gardłem
nie jest kod, tylko dystrybucja i widoczność. Na tym trzeba skupić 80% energii.

---

## 3. 🔴 PILNE — bezpieczeństwo (zrobić przed marketingiem)

### 3.1. Tabela `user_geo` na hubie ma WYŁĄCZONY RLS
Tabela zawiera **e-maile, adresy IP i lokalizacje użytkowników**, a każdy, kto ma publiczny
klucz anon huba, może ją **czytać i modyfikować w całości**. To incydent RODO w zarodku —
naprawić przed jakąkolwiek kampanią, która ściągnie ruch (i boty).

Naprawa jest bezpieczna: obie funkcje (`geo-track`, `admin-geo-list`) używają
`SERVICE_ROLE_KEY`, który omija RLS, więc nic się nie zepsuje:

```sql
ALTER TABLE public.user_geo ENABLE ROW LEVEL SECURITY;
-- celowo BEZ polityk: dostęp tylko przez service_role (edge functions)
```

### 3.2. Plik `.env` z kluczami jest w repo
Klucze anon są z założenia publiczne, ale `VITE_PAYMENTS_CLIENT_TOKEN="live_…"` i nawyk
trzymania `.env` w gicie to ryzyko. Dodać `.env` do `.gitignore`, zostawić `.env.example`.

---

## 4. Wydajność — co bym zrobił (kolejność wg zysku)

1. **Podzielić tłumaczenia na języki (największy szybki zysk).**
   `src/i18n/translations.ts` ma **~290 KB** i wchodzi do głównego bundla przez
   `LanguageProvider` — każdy odwiedzający pobiera 4 języki naraz. Podział na
   `pl.ts / en.ts / nl.ts / ua.ts` + dynamiczny `import()` w `LanguageContext`
   = ok. 200+ KB mniej w krytycznej ścieżce.

2. **Fonty: usunąć render-blocking.**
   - `src/index.css` zaczyna się od `@import url('https://fonts.googleapis.com/...Inter...Space+Grotesk...')`
     — to najwolniejszy możliwy wzorzec (CSS blokuje CSS).
   - `index.html` ładuje Material Icons drugim blokującym stylesheetem, mimo że
     `@fontsource/material-icons` jest już w dependencies i **nieużywany**.
   - Rozwiązanie: self-host przez `@fontsource` (Inter, Space Grotesk, Material Icons),
     `font-display: swap`, usunąć oba zewnętrzne stylesheety i preconnecty do fonts.googleapis.

3. **Wyrzucić martwe meta z `index.html`:** `Cache-Control no-cache/Pragma/Expires` jako
   `http-equiv` nic nie dają (nagłówki ustawia Vercel), a sygnalizują crawlerom „nie cachuj”.
   HSTS też nie działa z meta — przenieść do `vercel.json` → `headers`.

4. **Audyt bundla raz na release:** `rollup-plugin-visualizer` + budżet Lighthouse w CI
   (GitHub Action `treosh/lighthouse-ci-action`, budżet: LCP < 2.5 s, JS początkowy < 300 KB).
   Ciężkie biblioteki (tensorflow, face-api, ffmpeg, three, xlsx, jspdf) są dziś w lazy
   chunkach — budżet w CI pilnuje, żeby tak zostało.

5. **Wrócić do Service Workera — ale poprawnie.** PWA wyleciała słusznie (pętla reloadów),
   ale bez SW nie ma offline i szybkich powrotów. Bezpieczny wariant: Workbox z
   `registerType: "prompt"` (bez auto-reload na `controllerchange`), cache tylko dla
   `/assets/*` i okładek; audio nigdy. Wtedy też `PWAInstallPrompt` odzyska sens.

6. **Obrazy:** okładki i og-image serwować przez Cloudflare Images/R2 z resize
   (`?width=`), `loading="lazy"` + `width/height` na kafelkach playlist.

---

## 5. SEO techniczne — dziury, które realnie blokują widoczność

1. **Brak weryfikacji Google Search Console** — `google-site-verification` w `index.html`
   jest **pusty** (Bing jest zweryfikowany, Google nie!). Bez GSC nie ma: indeksacji na
   żądanie, raportu pokrycia, Core Web Vitals, informacji o karach. **To jest krok nr 1.**

2. **Statyczny `public/sitemap.xml` przykrywa dynamiczny.** Jest świetna funkcja
   `seo-sitemap-generate` (dodaje posty bloga), ale robots.txt wskazuje
   `grouaistream.com/sitemap.xml`, a Vercel serwuje **statyczny plik z `lastmod 2026-05-18`**
   — posty bloga nie trafiają do sitemap. Naprawa: usunąć `public/sitemap.xml` i dodać
   rewrite w `vercel.json`:
   `{ "source": "/sitemap.xml", "destination": "https://bvstvawnigyczvofzhps.supabase.co/functions/v1/seo-sitemap-generate" }`.

3. **Blog nie jest prerenderowany.** Blog to nasz silnik SEO (AI generuje posty), ale
   `/blog/:slug` to pusty shell SPA — meta ustawia dopiero JS (`document.title` w
   `BlogPost.tsx`). Google to przeżuje z opóźnieniem, ale FB/LinkedIn/X **nie zobaczą OG
   w ogóle** (udostępnienia bez podglądu). Naprawa: rozszerzyć `scripts/prerender.mjs`,
   żeby przy buildzie pobierał opublikowane posty z Supabase i generował
   `dist/blog/<slug>/index.html` z pełną treścią + meta (build i tak leci po każdym pushu).

4. **Fałszywe dane w JSON-LD — ryzyko kary.** `aggregateRating 4.8 (150 ocen)` i
   `numTracks: 1000` są zmyślone na sztywno. Google traktuje samoocenę bez widocznych
   recenzji jako spam strukturalny (manual action = zniknięcie rich results). Usunąć albo
   podpiąć prawdziwe liczby.

5. **hreflang bez sensu:** `pl`, `en` i `x-default` wskazują ten sam URL. Albo usunąć,
   albo (docelowo, patrz §6) zrobić prawdziwe wersje `/en/…`.

6. **`sameAs: []` w Organization** — brak jakichkolwiek profili społecznościowych
   powiązanych z marką. Google buduje z tego Knowledge Graph.

7. **Sprawdzić, czy produkcja nie blokuje botów.** Zautomatyzowany fetch strony głównej
   dostał **HTTP 403** (może to być firewall/Bot Protection Vercela). Zweryfikować w GSC
   „Sprawdzenie adresu URL” → „Pobierz jak Google”. Jeśli Googlebot dostaje 403 — to
   tłumaczy niewidzialność strony i jest ważniejsze niż wszystko powyżej.

---

## 6. Plan „widoczni wszędzie” — dystrybucja globalna

**Fundament językowy:** strona celuje w cały świat, ale tytuł, opis i `og:locale` są
po polsku. Docelowo: prawdziwe ścieżki językowe (`/en/`, `/nl/`, `/uk/`) prerenderowane
buildem + poprawny hreflang. Rynek streamingu AI jest globalny — **EN musi być pierwsze**.

**Kanały (wykorzystują to, co JUŻ istnieje w repo):**

| Kanał | Jak to zrobić u nas | Koszt |
|---|---|---|
| **Katalogi radiowe** | Mamy `radio.m3u`/`radio.pls` + stream RadioKing → zgłosić GrouaRadio do TuneIn, myTuner, Streema, radio-browser.info, Radio Garden | 0 zł |
| **Search Console + Bing + IndexNow** | Weryfikacja GSC (pkt 5.1), IndexNow ping z `seo-orchestrator` po każdym poście bloga | 0 zł |
| **Social autopilot** | `hub_social_queue` (53 wpisy) + funkcja `social-distribution` już istnieją — podpiąć realne konta: X, TikTok, Instagram, YouTube Shorts, LinkedIn (B2B) i wpisać profile w `sameAs` | 0 zł |
| **Embeddable player = maszyna backlinków** | Mamy `/radio/embed` (`RadioEmbed.tsx`) — dać artystom kod `<iframe>` „umieść swój utwór na swojej stronie”; każdy embed to link zwrotny | 0 zł |
| **Launch platformy** | Product Hunt, Hacker News „Show HN”, AlternativeTo, There's An AI For That, Futurepedia — unikalny hak: „streaming bez botów / verified human streams” | 0 zł |
| **Społeczności twórców** | r/SunoAI, r/WeAreTheMusicMakers, r/AImusic, grupy FB polskich twórców Suno — program „wgraj utwór, zarabiaj na uczciwych odsłuchach” | 0 zł |
| **Google Ads** | Plan już spisany w GOOGLE_ADS_PLAN.md z gotowymi landingami `/lp/*` i lejkiem leadów | budżet |
| **PR/media** | Historia „pierwsza platforma z weryfikacją ludzkich odsłuchów — koniec fake streamów” → media muzyczne i tech (PL: Spider's Web, Antyweb; EN: MusicTech, MBW) | 0 zł |

**Pętla wzrostu do włączenia:** artysta wgrywa utwór → dostaje ładną stronę utworu
(prerender + OG) i widget → udostępnia u siebie → jego słuchacze się rejestrują →
program poleceń `?ref=` (już zaimplementowany w `main.tsx`!) nagradza oba konta.
Dziś ta pętla istnieje w kodzie, ale nikt jej nie widzi — bo brakuje pkt 5.3 (OG dla
podstron) i dystrybucji.

---

## 7. Kolejność działań

**Tydzień 1 (krytyczne, ~1 dzień pracy):**
1. RLS na `user_geo` (§3.1) + `.env` poza repo (§3.2)
2. Weryfikacja Google Search Console + przesłanie sitemap (§5.1)
3. Test „czy Googlebot dostaje 403” (§5.7)
4. Rewrite `/sitemap.xml` → funkcja dynamiczna (§5.2)
5. Usunięcie fałszywego `aggregateRating`/`numTracks` (§5.4)

**Tydzień 2–4 (wydajność + SEO treści):**
6. Podział tłumaczeń per język (§4.1) i self-host fontów (§4.2)
7. Prerender postów bloga + stron utworów z pełnym OG (§5.3)
8. Zgłoszenie radia do katalogów, launch na Product Hunt/AlternativeTo (§6)
9. Podpięcie realnych profili social + `sameAs` (§5.6)

**Kwartał (wzrost):**
10. Wersje językowe `/en/` z hreflang (§6)
11. Powrót PWA/Service Workera w wariancie bezpiecznym (§4.5)
12. Google Ads wg istniejącego planu + pętla poleceń `?ref=` jako oficjalny program

Miarą sukcesu nie jest Lighthouse, tylko dwie liczby raz w tygodniu:
**zaindeksowane strony w GSC** i **`total_users` w panelu admina**.
