# 🤖 GrouAI Stream — Silnik Autonomii

## ✅ Co już DZIAŁA (zrobione automatycznie 2026-06-11)

Harmonogram (19 zadań cron) jest **zainstalowany i aktywny** — w Twoim projekcie
Supabase „grouaistream" (`hkbraboqdsonekzxbntr`), który działa jako sterownik
i wywołuje funkcje żywego projektu. Od teraz codziennie, bez niczyjego udziału:

| Godzina (UTC) | Co się dzieje |
|---|---|
| co 15 min | health-monitor — pilnuje, czy funkcje żyją |
| 04:00 | seo-orchestrator — sitemap + blog + bot SEO |
| 05:00 | aurora-revenue-loop — nowe propozycje przychodowe |
| 06:30 | aurora-ab-evaluator — wybór zwycięskich wariantów A/B |
| 07:00 | revenue-optimizer — analiza przychodów i anomalii |
| 08:00 | break-even-alert — alert rentowności |
| co 6 h | aurora-autopilot — nisze + auto-publikacja postów SEO |
| 10:00 i 16:00 | marketing-autopilot — promocja w social mediach (po wgraniu funkcji, pkt 2) |
| pon 02:00 / wt 03:00 | czyszczenie nisz / odświeżanie treści |

## ⚠️ NAJWAŻNIEJSZE: kredyty AI (bez tego silnik nie pisze treści)

Test autopilota zwrócił błąd **`credits_exhausted` (402)** — brama AI nie ma kredytów.
Wejdź na **https://openrouter.ai → Credits** i doładuj konto (np. 10–20 USD),
to samo konto, którego klucz jest ustawiony jako `OPENROUTER_API_KEY` w sekretach
funkcji żywego projektu. Jeśli funkcje na żywym projekcie są stare (sprzed zmiany
kluczy), poproś Lovable o ponowne wdrożenie funkcji z repo.

## Krok 2 — wgraj na ŻYWY projekt (przez Lovable)

Żywa strona działa na projekcie Supabase zarządzanym przez Lovable
(`bvstvawnigyczvofzhps`) — zmiany wgrywa się tam przez czat Lovable:

1. **SQL** — poproś Lovable o wykonanie:
   - `supabase/migrations/20260611120000_referral_program.sql` (program poleceń 20%)
   - sekcje 1–4 z `supabase/migrations/20260611130000_autonomy_engine.sql`
     (tabela `marketing_dispatches`, workflow `social-distribution`, rejestr agentów;
     sekcji 5 z cronami NIE trzeba — harmonogram już działa)
2. **Funkcje** — poproś o wdrożenie:
   - `marketing-autopilot` (NOWA)
   - `payments-webhook` (nalicza prowizje za polecenia z płatności Paddle)
   - `ai-assistant` (zaktualizowana)

## Krok 3 — n8n (publikacja w social mediach)

1. W n8n utwórz workflow zaczynający się od węzła **Webhook** (POST) i skopiuj URL.
2. W panelu admina GrouAI → Aurora → n8n wklej URL przy workflow **social-distribution**.
3. Dodaj w n8n węzły publikujące — payload zawiera gotowe treści:
   - `social.twitter_post`, `social.facebook_post`, `social.instagram_caption`,
     `social.tiktok_script`, `social.linkedin_post`
   - `social.canva_brief` (nagłówek / podtytuł / CTA → grafika w Canva)
   - `social.audio_promo_script` (spot — można wysłać do funkcji `elevenlabs-tts`)
   - `callback_url` — n8n raportuje wynik z powrotem

Dopóki webhook nie jest ustawiony, treści czekają w tabeli `marketing_dispatches`
(status `queued`) — nic nie ginie.

## Jak to zarabia

- **Paddle** — abonamenty Pro/Ultimate (`payments-webhook`).
- **Program poleceń** — każdy użytkownik ma kod, 20% prowizji od płatności
  poleconych przez 12 miesięcy → użytkownicy sami promują platformę.
- **Nisze Aurora** — autopilot sam znajduje i odpala landing pages dla rentownych nisz.
- **SEO** — bot codziennie publikuje posty → darmowy ruch z Google.
- **Outreach reklamowy** — `ad-outreach-process` wysyła oferty reklamowe do leadów (max 20/dzień).
