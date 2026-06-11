# 🤖 GrouAI Stream — Silnik Autonomii: instrukcja wdrożenia

Po tym wdrożeniu platforma działa sama: odkrywa nisze, pisze i publikuje posty SEO,
promuje treści w social mediach (przez n8n), nalicza prowizje z programu poleceń
przy płatnościach Paddle i pilnuje własnego zdrowia oraz rentowności.

## Krok 1 — SQL (Supabase Dashboard → SQL Editor)

Otwórz: https://supabase.com/dashboard/project/bvstvawnigyczvofzhps/sql/new

Wklej i uruchom **po kolei** zawartość dwóch plików:
1. `supabase/migrations/20260611120000_referral_program.sql` (program poleceń — jeśli jeszcze nie był wgrany)
2. `supabase/migrations/20260611130000_autonomy_engine.sql` (harmonogram wszystkich pętli)

## Krok 2 — Funkcje (Supabase Dashboard → Edge Functions)

Wgraj/zaktualizuj ręcznie (tak jak zawsze):
- **marketing-autopilot** (NOWA) — `supabase/functions/marketing-autopilot/index.ts`
- **payments-webhook** (zmieniona — prowizje za polecenia) — `supabase/functions/payments-webhook/index.ts`
- **ai-assistant** (zmieniona) — `supabase/functions/ai-assistant/index.ts`

## Krok 3 — n8n (dystrybucja do social mediów)

1. W n8n utwórz workflow z węzłem **Webhook** (metoda POST).
2. Skopiuj adres webhooka.
3. W panelu admina GrouAI → Aurora → n8n znajdź workflow **„Social Media Distribution"**
   (`social-distribution`) i wklej adres webhooka.
4. W n8n dodaj węzły publikujące — payload zawiera gotowe treści:
   - `social.twitter_post`, `social.facebook_post`, `social.instagram_caption`,
     `social.tiktok_script`, `social.linkedin_post`
   - `social.canva_brief` (nagłówek/podtytuł/CTA — do generowania grafiki w Canva)
   - `social.audio_promo_script` (skrypt spotu — można wysłać do funkcji `elevenlabs-tts`)
   - `callback_url` — n8n raportuje wynik z powrotem do platformy

Dopóki webhook nie jest ustawiony, treści i tak są generowane i czekają w tabeli
`marketing_dispatches` ze statusem `queued` — nic nie ginie.

## Co działa automatycznie (czasy UTC)

| Godzina | Co się dzieje |
|---|---|
| co 15 min | health-monitor — pilnuje, czy funkcje żyją |
| 04:00 | seo-orchestrator — sitemap + blog + bot SEO |
| 05:00 | aurora-revenue-loop — nowe propozycje przychodowe |
| 06:30 | aurora-ab-evaluator — wybór zwycięskich wariantów A/B |
| 07:00 | revenue-optimizer — analiza przychodów i anomalii |
| 08:00 | break-even-alert — alert rentowności |
| co 6 h | aurora-autopilot — nisze + auto-publikacja postów SEO |
| 10:00 i 16:00 | marketing-autopilot — promocja treści w social mediach |
| pon 02:00 | aurora-niche-pruner — archiwizacja słabych nisz |
| wt 03:00 | aurora-content-refresher — odświeżanie najlepszych treści |

## Zarabianie

- **Paddle** — subskrypcje i płatności jak dotychczas (`payments-webhook`).
- **Program poleceń** — każdy użytkownik ma kod; 20% prowizji od płatności
  poleconych przez 12 miesięcy. Panel: strona „Zarabiaj z nami".
- **Nisze Aurora** — autopilot sam odpala landing pages dla rentownych nisz.
- **Outreach reklamowy** — `ad-outreach-process` (wywoływany z n8n) wysyła
  oferty reklamowe do leadów (max 20/dzień).
