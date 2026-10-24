# Migracja GrouAI Stream z Lovable do własnego Supabase — stan i dalsze kroki

Cel: cała strona działa bez Lovable. Nowy projekt Supabase: **`grouaistream-prod`**,
ref **`sbmfliylgpqyteezrrtn`** (`https://sbmfliylgpqyteezrrtn.supabase.co`).
Stary (Lovable): `bvstvawnigyczvofzhps` — produkcja nadal na nim, dopóki nie przełączymy.

## Zrobione (2026-10-24)
- Schemat bazy odtworzony z 188 migracji + różnice dociągnięte ze starej bazy
  (tabele, kolumny, funkcje, polityki RLS, wyzwalacze, bucket `radio-audio`, realtime).
- Dane: 31 453 wiersze / 156 tabel, liczby wierszy zgodne (bez `agent_events` — dziennik agentów).
- Konta: 93 użytkowników (`auth.users` + `auth.identities`): 76 e-mail/hasło (hashe przeniesione),
  27 Google (dopasowanie po identyfikatorze konta Google).
- Zadania cron w nowej bazie **wstrzymane** (21) — włączyć dopiero przy przełączeniu.
- Funkcje AI przepięte z bramki Lovable na `_shared/chatGateway.ts` (GEMINI_API_KEY / OPENROUTER_API_KEY).
- Workflow `.github/workflows/supabase-deploy.yml`: wdraża funkcje do nowego projektu
  i kopiuje sekrety z Vault (`fn_*`). Wymaga sekretu GitHub `SUPABASE_ACCESS_TOKEN`.
- Pomocnicze obiekty migracji (do usunięcia po przełączeniu):
  nowa baza `_mig_src`, `_mig_inbox`, `_mig_token`, `_mig_put`, `_mig_load`, `_mig_load_on`,
  `_mig_run`, `_mig_apply_data`, `_mig_secrets_store`; stara baza `_mig_export`.

## Do zrobienia przez właściciela (w przeglądarce — może pomóc Claude Desktop)
Sekretów NIE wklejać do czatu ani repo — tylko w panelach.
1. Token: https://supabase.com/dashboard/account/tokens → nowy token →
   GitHub https://github.com/Greg197512/grouaistream-com/settings/secrets/actions →
   sekret `SUPABASE_ACCESS_TOKEN`.
2. Klucze funkcji: https://supabase.com/dashboard/project/sbmfliylgpqyteezrrtn/functions/secrets
   - wymagane: `SUNO_API_KEY`, `REPLICATE_API_TOKEN`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`,
     `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, `GEMINI_API_KEY` lub `OPENROUTER_API_KEY`
   - opcjonalne: `RESEND_API_KEY`, `ELEVENLABS_API_KEY`, `YOUTUBE_API_KEY`, `PADDLE_LIVE_API_KEY`,
     `PAYMENTS_LIVE_WEBHOOK_SECRET`, `GROQ_API_KEY`, `DEEPSEEK_API_KEY`, `MISTRAL_API_KEY`
3. Google OAuth: Google Cloud Console → Credentials → OAuth client ID (Web),
   redirect URI `https://sbmfliylgpqyteezrrtn.supabase.co/auth/v1/callback` →
   Client ID/Secret w https://supabase.com/dashboard/project/sbmfliylgpqyteezrrtn/auth/providers (Google → Enable).
4. Supabase Auth → URL Configuration: Site URL `https://grouaistream.com`,
   Redirect URLs `https://grouaistream.com/**`, `https://www.grouaistream.com/**`.
5. (Maile auth) Auth → SMTP: smtp.resend.com, port 465, user `resend`, hasło = klucz Resend,
   nadawca `noreply@grouaistream.com`.

## Przełączenie (po krokach 1–4)
1. GitHub Actions → „Supabase — wdrożenie funkcji” → Run workflow; sprawdzić, że przeszło.
2. Kod: `src/pages/Auth.tsx` — Google przez `supabase.auth.signInWithOAuth({ provider: "google",
   options: { redirectTo: origin, queryParams: { prompt: "select_account" } } })` zamiast
   `@/integrations/lovable`; `src/integrations/supabase/client.ts` — zwykły `localStorage`
   zamiast `brokeredPreviewStorage`; usunąć `src/integrations/lovable`, `previewAuthStorage.ts`
   i pakiety `@lovable.dev/*`, `lovable-tagger`.
3. Końcowa synchronizacja danych: w starej bazie `select * from public._mig_export(array[...], 250)`,
   w nowej `select * from public._mig_load(200)` (upsert po kluczu).
4. Vercel (projekt `grouaistream-com`): `VITE_SUPABASE_URL=https://sbmfliylgpqyteezrrtn.supabase.co`,
   `VITE_SUPABASE_PUBLISHABLE_KEY=<anon nowego projektu>`, `VITE_SUPABASE_PROJECT_ID=sbmfliylgpqyteezrrtn`;
   też stałe w `api/health.ts`, `api/diag-tracks.ts`, `api/migrate-media.ts`, `scripts/export-tracks.mjs`.
5. Włączyć cron w nowej bazie (`cron.alter_job(jobid, active := true)`), wyłączyć w starej.
6. Test: radio, katalog, Studio (Suno, wideo), upload na R2, logowanie e-mail i Google.
   Użytkownicy zostaną raz wylogowani (nowy klucz sesji) — hasła działają.
