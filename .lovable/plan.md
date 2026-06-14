# Plan: Auto-promocja na social media przez n8n

Backend już działa — funkcja `marketing-autopilot` 2× dziennie (10:00 i 16:00 UTC) generuje pack copy (X, Facebook, Instagram, TikTok, LinkedIn + Canva brief + skrypt audio) z najnowszych postów bloga i wysyła payload na webhook n8n. **Brakuje samego workflow w n8n i wpisania URL webhooka.** To dorobimy.

## Co zrobię

### 1. Workflow n8n „GrouAI — Social Distribution"
Zbuduję przez MCP (`create_workflow_from_code`) workflow z węzłami:

- **Webhook (POST)** — punkt wejścia; payload od `marketing-autopilot` zawiera `social.twitter_post`, `social.facebook_post`, `social.instagram_caption`, `social.tiktok_script`, `social.linkedin_post`, `social.canva_brief`, `title`, `url`, `marketing_post_id`.
- **Splitter** (Set + If per platforma) — kieruje tekst do właściwego kanału.
- **X / Twitter** — `Twitter` node, akcja *Create Tweet*, text = `{{$json.social.twitter_post}}`.
- **Facebook Pages** — `Facebook Graph API` node, *Create Post*, message = `{{$json.social.facebook_post}}`.
- **Instagram** — `Instagram` node (Graph API), caption = `{{$json.social.instagram_caption}}` + obraz z `canva_brief` lub fallback OG image z URL bloga.
- **LinkedIn** — `LinkedIn` node, *Create Post*, text = `{{$json.social.linkedin_post}}`.
- **TikTok** — jako *queued* (TikTok API wymaga video, więc tylko zapis skryptu do Notion/Sheets do manualnej obróbki). Opcjonalnie pominę w v1.
- **Callback HTTP Request** — POST z powrotem do funkcji `marketing-callback` (zrobię nową, lekką) z wynikami publikacji per platforma, żeby `marketing_logs` / `marketing_posts` znało status.

Workflow ustawię jako aktywny i wystawię URL webhooka.

### 2. Wpis URL webhooka
URL z n8n wkleję do `aurora_n8n_workflows` (`workflow_id = 'social-distribution'`, `enabled = true`, `webhook_url = <URL>`) przez `supabase--insert`. `marketing-autopilot` już to czyta (`resolveN8nWebhook`).

### 3. Funkcja zwrotna `marketing-callback` (mała, nowa)
- Edge function, przyjmuje `{ marketing_post_id, platform, status, external_url, error }`.
- Aktualizuje `marketing_posts.status` i dopisuje wpis do `marketing_logs`.
- Daje to pętlę sprzężenia zwrotnego, dzięki czemu w panelu admina widać, że post poszedł na X i FB, a IG się wywalił itp.

### 4. Mały panel statusu w adminie (opcjonalnie — powiedz jeśli chcesz)
Sekcja w `BlogDistributionPanel.tsx` pokazująca ostatnie 20 dispatchów z `marketing_posts` + statusy per platforma z `marketing_logs`. Zero zmian, jeśli wystarczy Ci sam fakt że to chodzi.

## Co musisz zrobić Ty (jednorazowo, w n8n po stworzeniu workflow)
Workflow zbuduję, ale **konta social muszą być połączone w n8n jako credentials** — n8n nie pozwala ich utworzyć z zewnątrz:

1. **Twitter/X** — OAuth 2.0 (Developer Portal → app → Client ID/Secret).
2. **Facebook Page + Instagram Business** — Meta Business → Page Access Token (long-lived).
3. **LinkedIn** — OAuth 2.0 (LinkedIn Developers → app → `w_member_social` scope).

Po stworzeniu credentials w n8n workflow automatycznie ich użyje (po Twojej autoryzacji 1 klik).

## Czego NIE robię
- Nie ruszam częstotliwości (zostaje 10:00 i 16:00 UTC).
- Nie zmieniam generatora copy (działa, leci przez Lovable AI Gateway / Gemini).
- TikTok pomijam — wymaga video upload, zrobimy w osobnej iteracji jak będziesz chciał.

## Techniczne szczegóły
- Workflow tworzę przez `mcp_n8n_fsTuo` (n8n MCP już podpięte).
- Nowa funkcja `supabase/functions/marketing-callback/index.ts` + jej deploy.
- `aurora_n8n_workflows` upsert przez `supabase--insert`.
- Brak migracji SQL (tabele już są).

Po Twoim „akceptuję" zaczynam. Po zbudowaniu workflow dam Ci URL webhooka i listę kont, które trzeba połączyć w n8n.