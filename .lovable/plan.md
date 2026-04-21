# Plan: GrouAI Ekosystem — Serce, Mózg i Agenci

## Status: ETAP 1 ✅ + ETAP 2 (newsfeed ✅ + a-r-scout ✅) ZBUDOWANE (2026-04-21)

**ETAP 2 newsfeed**: n8n workflow `GrouAI Brain — Newsfeed Listener` (ID: 2BGWMNP6JFfvwwk9) — aktywny, co 1h pobiera RSS (Pitchfork/RA/Mixmag) + Reddit (r/Music, r/edmproduction) + HackerNews → POST do edge function `brain-newsfeed-ingest` → embedduje przez `text-embedding-004` → zapisuje do `brain_memory` jako `external_signal` z TTL 30 dni. Token autoryzacyjny w tabeli `n8n_ingest_tokens`.

**ETAP 2 a-r-scout**: Edge function `a-r-scout` codziennie 06:00 UTC (cron 'a-r-scout-daily', id 12) liczy "smak platformy" (top gatunki/BPM/mood z 7 dni `listening_history`), skanuje świeże utwory CCMixter w dominujących gatunkach, scoruje (genre match, licencja CC, tagi, mp3 dostępne, mood match), filtruje już posiadane, top 5 wstawia jako `agent_decisions` (`decision_type=import_external_track`) do akceptacji w `/admin/brain` + emituje event `agent.recommendation` dla Mózgu.


Platforma jako **żywy organizm**: każde zdarzenie (upload, stream, tip, mood detection, generacja) trafia do centralnego *Event Busa*, **Mózg** (LLM z pamięcią pgvector) analizuje to w tle i decyduje co zrobić, a wyspecjalizowani **agenci** wykonują konkretne zadania (kuratorowanie, A&R, monitoring, marketing, optymalizacja).

```
Frontend / Edge Functions / Cron
            ↓
      [agent_events]  ← event bus
            ↓
       [grouai-brain] ← Mózg (Gemini 2.5 Pro + pgvector pamięć)
            ↓
   ┌────────┼────────┬────────┬────────┐
   ↓        ↓        ↓        ↓        ↓
Curator  A&R    Health   Revenue   Marketing
Scout   Monitor   Optimizer  Outreach
            ↓
   newsfeed-listener (RSS/Reddit/HN)
   →  brain_memory (embeddingi)
```

---

## ETAP 1 — FUNDAMENT (~30-45 min)

### 1.1 Migracja DB

**Tabela `agent_events`** — centralny event bus
- `id`, `created_at`
- `event_type` text (np. `track.uploaded`, `stream.completed`, `tip.sent`, `mood.detected`, `generation.finished`, `user.signed_up`, `agent.decision`)
- `source` text (`upload`, `studio-router`, `mood-detector`, `payments-webhook`, `cron`, `brain`, etc.)
- `actor_user_id` uuid (kto wywołał, nullable)
- `target_type` text + `target_id` uuid (np. track/playlist/user, nullable)
- `payload` jsonb (kontekst zdarzenia)
- `processed_by_brain` bool default false
- `priority` int default 5 (1 = krytyczne, 10 = info)
- Indeksy: `(processed_by_brain, priority, created_at)`, `(event_type, created_at)`, `(actor_user_id, created_at)`

**Tabela `brain_memory`** — pamięć długoterminowa Mózgu
- `id`, `created_at`
- `memory_type` text (`trend`, `decision`, `news`, `user_insight`, `platform_insight`, `external_signal`)
- `title` text
- `content` text (treść zapamiętana, max 4000 znaków)
- `summary` text (1-zdaniowe streszczenie)
- `embedding` vector(1536) — do semantycznego wyszukiwania
- `importance` int 1-10
- `source_url` text nullable
- `metadata` jsonb (tagi, źródło, related_user_id, related_track_id)
- `expires_at` timestamptz nullable (info o wygasającej promocji znika po dacie)
- Indeks IVFFlat na `embedding` cosine, indeks na `(memory_type, importance, created_at)`

**Tabela `agent_decisions`** — log decyzji Mózgu i agentów
- `id`, `created_at`
- `agent_name` text (`brain`, `curator`, `a-r-scout`, `health-monitor`, etc.)
- `decision_type` text (np. `recommend_promote`, `flag_anomaly`, `generate_content`)
- `reasoning` text (dlaczego)
- `action_taken` jsonb (co konkretnie zrobiono lub propozycja)
- `event_ids` uuid[] (które eventy doprowadziły do decyzji)
- `executed` bool default false
- `executed_at` timestamptz

**Tabela `agent_registry`** — manifest agentów
- `id`, `name` (unique), `description`, `enabled` bool, `cron_schedule` text, `last_run_at`, `last_status`, `success_count`, `error_count`

**RLS**: tylko admini mogą czytać/pisać te tabele bezpośrednio. Edge functions używają service role key.

### 1.2 Edge function `grouai-brain`

Wywoływana przez cron co 5 min + manualnie z UI admin/brain.

Algorytm:
1. Pobierz nieprzetworzone eventy (`processed_by_brain = false`) posortowane po priority/created_at, max 50
2. Pobierz top 10 najbardziej relevantnych wspomnień z `brain_memory` przez podobieństwo embeddingów (zapytanie = streszczenie batch eventów)
3. Wyślij do Gemini 2.5 Pro:
   - System prompt: "Jesteś mózgiem GrouAIStream. Analizujesz strumień zdarzeń platformy muzycznej i decydujesz: a) czy zapisać nową obserwację do pamięci, b) czy wezwać konkretnego agenta, c) czy zignorować."
   - User: lista eventów + relevantna pamięć
   - Output JSON: `{ memories_to_save: [...], agent_calls: [{agent, payload, reasoning}], events_to_skip: [...] }`
4. Zapisz nowe wspomnienia (z embeddingiem przez Lovable AI `text-embedding-004`)
5. Wstaw decyzje do `agent_decisions`
6. Oznacz eventy jako processed

### 1.3 Cron (pg_cron)
- `grouai-brain` — co 5 min
- (etap 2 i 3 dokładamy kolejne)

### 1.4 Helper: `emit_agent_event()` SQL function
Aby z każdej edge function można było jedną linijką wstawić event:
```sql
SELECT public.emit_agent_event('track.uploaded', 'upload', auth.uid(), 'track', _track_id, jsonb_build_object('genre', _genre));
```

---

## ETAP 2 — ZMYSŁY ZEWNĘTRZNE (~30-45 min)

### 2.1 `newsfeed-listener` (n8n workflow + edge function fallback)

**Co robi:** raz na godzinę pobiera świeże dane z:
- RSS Pitchfork, Resident Advisor, Mixmag, NME, The Quietus
- Reddit JSON: `/r/Music`, `/r/edmproduction`, `/r/WeAreTheMusicMakers`, `/r/listentothis` (top dnia)
- HackerNews top 30 (filtruje po słowach: music, audio, AI, generative)
- ProductHunt newest (kategoria: Music)

**Jak:** dla każdego itemu — embedduje tytuł+opis przez `text-embedding-004`, zapisuje do `brain_memory` z `memory_type='external_signal'`, `expires_at = now() + 30 days`.

**Implementacja:** preferowany **n8n workflow** (lepszy do RSS/scrapingu niż Deno), wywołany cron co 1h, pisze do Supabase przez service role.

### 2.2 `a-r-scout` (edge function, cron 1×/dzień)

Agent A&R (Artist & Repertoire) — szuka świeżej muzyki.

**Co robi:**
1. Pobiera audio fingerprint top 100 userów (przez `get_user_audio_fingerprint`)
2. Skanuje: nowe utwory na CCMixter (już mamy `daily-cc-fetch`), nowe playlisty z YouTube (`auto-youtube-fetch`), Suno trending (przez `suno-resolve`)
3. Dla każdego znaleziska: liczy podobieństwo do dominującego BPM/genre/mood platformy
4. Top 5 dziennie → emituje event `agent.recommendation` z payload `{track_url, score, why}` → Mózg decyduje czy promować

---

## ETAP 3 — DOZÓR I KONTROLA (~45 min)

### 3.1 `health-monitor` (edge function, cron co 5 min)

- Pinguje wszystkie kluczowe edge functions (HEAD request lub OPTIONS)
- Sprawdza `email_send_log` — jeśli >5% błędów w ostatniej godzinie → event `alert.email_degraded`
- Sprawdza saldo Lovable AI / Replicate (jeśli jest endpoint, inaczej skip)
- Sprawdza ostatnie payouty pending >7 dni → event `alert.payout_overdue`
- Emit event `health.snapshot` co cykl z metrykami → Mózg uczy się "normalnego" stanu

### 3.2 `revenue-optimizer` (edge function, cron 1×/dzień)

- Analizuje `creator_earnings`, `tip_transactions`, `stream_events`
- Wykrywa anomalie (artist nagle robi 10× więcej streamów → flag potencjalny bot)
- Sugeruje weekendowe wyzwania na podstawie trendów (kto blisko milestone'a)
- Liczy ROI Boost packages
- Emit event `revenue.report` → Mózg decyduje co pokazać adminowi

### 3.3 Strona `/admin/brain` (frontend)

Komponenty:
- **Puls platformy** — live feed eventów (Realtime subscribe na `agent_events`)
- **Co Mózg myśli** — ostatnie 20 wpisów z `brain_memory` (filtrowane po type)
- **Decyzje agentów** — tabela `agent_decisions` z możliwością ręcznego "execute" / "reject"
- **Agent registry** — toggle on/off, status, last run, error count
- **Search w pamięci** — semantyczne wyszukiwanie po `brain_memory` (input → embed → ORDER BY embedding <=> query)
- **Manual brain trigger** — przycisk "Każ Mózgowi przemyśleć teraz" (wywołuje grouai-brain)

---

## Co PODŁĄCZAMY do event busa (już istniejące, bez przepisywania)

Dodać `emit_agent_event()` w tych miejscach:
- `payments-webhook` → `payment.completed`, `subscription.activated`, `subscription.canceled`
- `Upload.tsx` (po pomyślnym upload) → `track.uploaded`
- `useStreamCounter` → `stream.completed`
- `record_stream` SQL func → już to zrobi (event `stream.recorded`)
- `send_tip` SQL func → `tip.sent`
- `MoodDetector` → `mood.detected`
- `studio-generate`, `suno-generate` → `generation.finished`
- `ai-moderate-track` → `track.moderation` (approved/rejected/needs_review)
- `mass-email-dispatch` → `email.batch_sent`
- `seo-blog-generate` → `blog.published`

---

## Stack techniczny — decyzje

- **Logika agentów**: hybrydowo. *Krótkie/realtime* → Supabase Edge Functions. *Długie / RSS / scraping* → n8n workflow (już skonfigurowany via studio-router).
- **LLM Mózgu**: `google/gemini-2.5-pro` (najlepszy reasoning + długi kontekst). Embeddings: `text-embedding-004` przez Lovable AI Gateway (gratis).
- **Pamięć wektorowa**: pgvector (już zainstalowany w projekcie — widać `melody_embeddings`).
- **Cron**: pg_cron (Supabase native).
- **Realtime na frontendzie**: Supabase Realtime na `agent_events` i `agent_decisions`.

---

## Kolejność implementacji (po Twoim "tak buduj")

1. Migracja DB (tabele + RLS + helper function + cron) — 1 wywołanie tool
2. Edge function `grouai-brain` — deploy
3. Podpięcie `emit_agent_event()` w 3-4 najważniejszych miejscach (track.uploaded, stream.recorded, tip.sent, mood.detected)
4. **STOP** — testujemy ETAP 1, oglądamy `/admin/brain` z prawdziwym ruchem
5. Dopiero potem ETAP 2 i 3

---

## Co NIE wchodzi w plan (świadomie)

- **Multi-agent communication via WebSockets** — overkill, eventy w tabeli wystarczą
- **Własny model LLM hostowany u nas** — Gemini Pro to tańsze i lepsze
- **Auto-trading / auto-payouts bez admina** — Mózg tylko sugeruje, człowiek klika
- **Crawler całego internetu** — tylko kilka kuratorowanych źródeł żeby nie zaspamować pamięci
