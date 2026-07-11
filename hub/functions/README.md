# GrouAI Hub — funkcje (projekt Supabase `bmwtydwpevzhbdplilbr`)

Te funkcje **NIE** należą do bvstv/Lovable (`supabase/functions/`). Działają na osobnym
projekcie-hubie GrouAI, który ma klucz `openrouter_api_key` w `hub_config` — dlatego AI
tu żyje, a na bvstv (LIVE) było martwe. Wdrożenie: przez Supabase MCP `deploy_edge_function`
na projekt `bmwtydwpevzhbdplilbr` (nie przez Lovable). To jest kopia referencyjna do wersjonowania.

## aurora-b2b-chat
Inteligentna, rozmowna Aurora B2B. Zbiera brief od klienta i po skompletowaniu wymaganych
pól (usługa + brief + email) przekazuje zlecenie do `aurora-worker`, która realnie wykonuje
pracę (generuje deliverable przez OpenRouter) — **bez n8n**. Lead ląduje w `hub_leads`,
powiadomienie idzie na Discord. Frontend woła ją przez `src/lib/hubAurora.ts` (Business.tsx).

## hub-blog-generate
Generuje świeży, on-brand artykuł blogowy (PL) przez OpenRouter i zapisuje do tabeli
`hub_blog_posts` na hubie. Frontend dokłada te wpisy do bloga (`src/lib/hubBlog.ts`,
BlogIndex + BlogPost fallback) — stare 190 wpisów z bvstv zostają nietknięte.
Cron `hub-blog-daily` (pg_cron na hubie) uruchamia ją codziennie o 07:20 UTC.
Autoryzacja: `?t=<hub_token>` lub nagłówek `x-hub-token`.
