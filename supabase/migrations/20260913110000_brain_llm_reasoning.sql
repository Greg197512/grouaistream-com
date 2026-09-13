-- Warstwa "rozumowania" mózgu przez LLM (OpenAI-compatible, np. xAI/Grok, Groq, Gemini).
-- Konfig + KLUCZ trzymane w tabeli brain_ai_config (RLS bez polityk = dostęp tylko
-- z SECURITY DEFINER; klucza NIE ma w repo). Mózg co 2 h wysyła metadane (notatki
-- agentów + otwarte propozycje — NIGDY dane wrażliwe) i zapisuje EXECUTIVE SUMMARY
-- do brain_memory (kind='exec_summary'). Wszystko przez pg_net, poza Vercelem.
--
-- Klucz ustawia się RAZ, bezpośrednio w bazie (nie w migracji), np.:
--   UPDATE public.brain_ai_config SET api_key='<KLUCZ>', provider='xai',
--          endpoint='https://api.x.ai/v1/chat/completions', model='grok-3-mini', enabled=true WHERE id=1;
-- Darmowa alternatywa (0 zł): provider Groq — endpoint https://api.groq.com/openai/v1/chat/completions, model np. 'llama-3.3-70b-versatile'.

CREATE TABLE IF NOT EXISTS public.brain_ai_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id=1),
  provider text, endpoint text, model text, api_key text,
  enabled boolean DEFAULT true, updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.brain_ai_config ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.brain_ai_pending (request_id bigint PRIMARY KEY, created_at timestamptz DEFAULT now());
ALTER TABLE public.brain_ai_pending ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.brain_reason()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE cfg record; ctx text; props text; sys text; req bigint;
BEGIN
  SELECT * INTO cfg FROM public.brain_ai_config WHERE id=1 AND enabled AND api_key IS NOT NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','no_config'); END IF;
  DELETE FROM public.brain_ai_pending WHERE created_at < now()-interval '1 hour';
  SELECT string_agg(format('- [%s waga=%s] %s: %s', memory_type, importance, title, left(coalesce(summary,content),160)), E'\n')
    INTO ctx FROM (SELECT * FROM brain_memory WHERE metadata->>'by' LIKE 'grouai-brain%' OR metadata->>'by' LIKE 'agent-%'
                   ORDER BY importance DESC, created_at DESC LIMIT 15) m;
  SELECT string_agg(format('- %s: %s', decision_type, left(reasoning,140)), E'\n')
    INTO props FROM (SELECT * FROM agent_decisions WHERE executed=false AND rejected=false ORDER BY created_at DESC LIMIT 10) d;
  sys := 'Jestes CTO i managerem GrouAI OS (platforma muzyczna AI). Na podstawie notatek agentow i otwartych propozycji napisz zwiezle EXECUTIVE SUMMARY po polsku: 3-6 zdan - co najwazniejsze teraz, gdzie ryzyko, co zrobic dzis. Konkretnie, bez zmyslania danych spoza notatek.';
  SELECT net.http_post(
    url := cfg.endpoint,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||cfg.api_key),
    body := jsonb_build_object('model',cfg.model,'temperature',0.4,
      'messages', jsonb_build_array(
        jsonb_build_object('role','system','content',sys),
        jsonb_build_object('role','user','content','NOTATKI:'||E'\n'||coalesce(ctx,'(brak)')||E'\n\nOTWARTE PROPOZYCJE:'||E'\n'||coalesce(props,'(brak)'))))
  ) INTO req;
  INSERT INTO public.brain_ai_pending(request_id) VALUES (req);
  RETURN jsonb_build_object('ok',true,'request_id',req);
END $fn$;

CREATE OR REPLACE FUNCTION public.brain_reason_collect()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE p record; sc int; ct text; txt text; got int := 0;
BEGIN
  FOR p IN SELECT * FROM public.brain_ai_pending LOOP
    SELECT status_code, content INTO sc, ct FROM net._http_response WHERE id=p.request_id;
    IF NOT FOUND THEN
      IF p.created_at < now()-interval '20 minutes' THEN DELETE FROM public.brain_ai_pending WHERE request_id=p.request_id; END IF;
      CONTINUE;
    END IF;
    BEGIN
      IF sc=200 AND ct IS NOT NULL THEN
        txt := (ct::jsonb->'choices'->0->'message'->>'content');
        IF txt IS NOT NULL AND length(txt)>20 THEN
          DELETE FROM brain_memory WHERE metadata->>'kind'='exec_summary';
          INSERT INTO brain_memory(memory_type,title,content,summary,importance,metadata,expires_at)
          VALUES('platform_insight','Executive summary (AI)', txt, left(txt,400), 8,
                 jsonb_build_object('by','grouai-brain-llm','kind','exec_summary'), now()+interval '2 days');
          got := got+1;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    DELETE FROM public.brain_ai_pending WHERE request_id=p.request_id;
  END LOOP;
  RETURN jsonb_build_object('ok',true,'summaries',got);
END $fn$;
-- Crony: reason '30 */2 * * *', collect '32 */2 * * *'.
