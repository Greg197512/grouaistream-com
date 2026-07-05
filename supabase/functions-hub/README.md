# GROUAI HUB — automatyzacje bez n8n

n8n przestał działać (nieopłacony abonament). Ten katalog zawiera funkcje, które go
zastępują — wdrożone na **własnym projekcie Supabase Grega** `bmwtydwpevzhbdplilbr`
(nazwa „raport-nl-pl", org osrtxwxwdghaurciwnvz). Hub jest w 100% niezależny od n8n
i od Lovable.

Adres bazowy: `https://bmwtydwpevzhbdplilbr.supabase.co/functions/v1`

## Funkcje (wdrożone 2026-07-05, verify_jwt = false, auth własnym tokenem)

| Funkcja | Co robi | Zastępuje w n8n |
|---|---|---|
| `aurora-worker` | Wykonuje zlecenia Aurory (audyt SEO, teksty, landing, social, automatyzacje, lead research) przez OpenRouter (łańcuch modeli z fallbackiem) i raportuje wynik do `aurora-n8n-callback` na LIVE. Kopia wyniku w `hub_deliverables`. Przetestowany E2E 2026-07-05. | wszyscy „pracownicy" (Marek, Lena, Kuba, Mia, Tomek, Ola) |
| `social-distribution` | Odbiera pakiet z `marketing-autopilot`, publikuje na Telegram/Discord (gdy skonfigurowane w `hub_config`), raportuje do `marketing-callback`. Bez kanałów: kolejkuje w `hub_social_queue` i zwraca 503. | workflow social-distribution |
| `newsfeed-fetcher` | Co 2h pobiera RSS (MBW, Pitchfork, TechCrunch AI, HN), deduplikuje, zapisuje w `hub_news_items`; gdy ustawiony `bvstv_ingest_token` — pcha do Mózgu (`brain-newsfeed-ingest`). | cron RSS → Mózg |
| `radio-autopilot` | Co 30 min sprawdza strumień Groua Radio (info + m3u8), loguje do `hub_radio_log`, alarmuje na Telegram przy awarii. | stróż radia (zaległy deploy na hkbra) |
| `capture-lead` | Publiczny formularz lead-gen (Google Ads). RODO: zapis TYLKO za zgodą; łapie gclid+utm; mail powitalny przez grouarock.com; B2B odpala Aurorę. Zapis do `hub_leads`. | — (nowy, lead-gen) |
| `hub-leads` | Podgląd leadów + eksport CSV / Customer Match (auth `?t=hub_token`). | — |
| `hub-status` | Publiczny JSON ze zdrowiem huba (bez sekretów). | — |

**Landingi Google Ads** (statyczne, `public/lp/`): `firma.html` (B2B), `artysta.html`, `sluchaj.html` + wspólne `lead.js`/`lead.css`. Serwowane przez Vercel. Pełny plan kampanii: `GOOGLE_ADS_PLAN.md`.

## Harmonogram (pg_cron na hubie)

- `hub-radio-watch` — `*/30 * * * *`
- `hub-newsfeed` — `15 */2 * * *`
- `hub-newsletter-weekly` — `0 9 * * 5` → woła `notify-blog-subscribers` na LIVE
  z wbudowanym tokenem automatyzacji (wysyła najnowszy opublikowany post; idempotencja
  po stronie `send-transactional-email` chroni przed dublami).
- `hub-self-ping` — `*/23 * * * *` → `hub-status` (utrzymuje projekt aktywnym na Free).

## Konfiguracja: tabela `hub_config` (odczyt tylko service_role)

| klucz | znaczenie |
|---|---|
| `hub_token` | token autoryzujący wywołania funkcji (`?t=...`) — USTAWIONY |
| `openrouter_api_key` | klucz OpenRouter — **USTAWIONY 2026-07-05** (klucz „grouai-hub" z konta Grega) |
| `openrouter_models` | łańcuch modeli z fallbackiem; przy 0 kredytów działa na modelach `:free` (Nemotron 550B → gpt-oss-120b → Llama 3.3 70B → Hermes 405B); po doładowaniu kredytów warto dopisać na początek płatny model |
| `openrouter_model` | pojedynczy model zapasowy (legacy) |
| `bvstv_url` | URL projektu LIVE |
| `bvstv_ingest_token` | token z panelu admina (AI Builder / n8n boty) do pchania newsów do Mózgu — pusty |
| `telegram_bot_token` + `telegram_chat_id` | kanał publikacji social + alarmy radia — puste |
| `discord_webhook_url` | alternatywny kanał — pusty |

Wartości wpisuje się SQL-em w projekcie huba, np.:
`UPDATE hub_config SET value='sk-or-v1-...' WHERE key='openrouter_api_key';`

## Przepięcie LIVE → hub (wymaga zalogowania jako admin na grouaistream.com)

W panelu admina → Aurora → n8n ustawić `webhook_url` (dla WSZYSTKICH workflow
usługowych oraz `social-distribution`) na:

- pracownicy: `https://bmwtydwpevzhbdplilbr.supabase.co/functions/v1/aurora-worker?t=<hub_token>`
- social: `https://bmwtydwpevzhbdplilbr.supabase.co/functions/v1/social-distribution?t=<hub_token>`

`<hub_token>` = wartość `hub_config.hub_token` (jest też w raporcie z sesji 2026-07-05).

## Czego hub NIE naprawia

- **Brak `OPENROUTER_API_KEY` na projekcie LIVE (bvstv)** — czat Aurory, seo-orchestrator,
  aurora-autopilot itd. działają na LIVE i potrzebują klucza TAM. Sekrety bvstv można
  zmienić tylko przez Lovable (wymaga opłacenia) — albo stopniowo przenosić kolejne
  funkcje na hub.
- Publikacja na X/FB/IG/TikTok/LinkedIn — wymaga API tych platform; hub publikuje na
  Telegram/Discord i trzyma resztę w kolejce `hub_social_queue`.
