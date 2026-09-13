-- Agenci OS na Groku: Developer + Tester. Wspólny system pytań do LLM (ai_ask) z
-- routowaniem odpowiedzi po 'purpose' w brain_reason_collect. Wszystko przez pg_net
-- do brain_ai_config (Grok/OpenAI-compatible), wyniki lądują w brain_memory.
-- Crony (ustawiane w bazie): kolektor co 10 min, developer 08:20, tester 08:40.

ALTER TABLE public.brain_ai_pending ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'exec_summary';

CREATE OR REPLACE FUNCTION public.ai_ask(_purpose text, _system text, _user text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE cfg record; req bigint;
BEGIN
  SELECT * INTO cfg FROM public.brain_ai_config WHERE id=1 AND enabled AND api_key IS NOT NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','no_config'); END IF;
  DELETE FROM public.brain_ai_pending WHERE created_at < now()-interval '1 hour';
  SELECT net.http_post(
    url := cfg.endpoint,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||cfg.api_key),
    body := jsonb_build_object('model',cfg.model,'temperature',0.4,
      'messages', jsonb_build_array(
        jsonb_build_object('role','system','content',_system),
        jsonb_build_object('role','user','content',_user)))
  ) INTO req;
  INSERT INTO public.brain_ai_pending(request_id, purpose) VALUES (req, _purpose);
  RETURN jsonb_build_object('ok',true,'request_id',req,'purpose',_purpose);
END $fn$;

CREATE OR REPLACE FUNCTION public.brain_reason_collect()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE p record; sc int; ct text; txt text; got int := 0;
        mtype text; mtitle text; mkind text; mby text; mimp int;
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
          IF p.purpose='dev_review' THEN
            mtype:='decision'; mtitle:='Diagnoza (Developer AI)'; mkind:='dev_review'; mby:='agent-developer'; mimp:=7;
          ELSIF p.purpose='qa_report' THEN
            mtype:='platform_insight'; mtitle:='Raport QA (Tester AI)'; mkind:='qa_report'; mby:='agent-tester'; mimp:=7;
          ELSE
            mtype:='platform_insight'; mtitle:='Executive summary (AI)'; mkind:='exec_summary'; mby:='grouai-brain-llm'; mimp:=8;
          END IF;
          DELETE FROM brain_memory WHERE metadata->>'kind'=mkind;
          INSERT INTO brain_memory(memory_type,title,content,summary,importance,metadata,expires_at)
          VALUES(mtype, mtitle, txt, left(txt,400), mimp,
                 jsonb_build_object('by',mby,'kind',mkind,'model','grok'), now()+interval '3 days');
          got := got+1;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    DELETE FROM public.brain_ai_pending WHERE request_id=p.request_id;
  END LOOP;
  RETURN jsonb_build_object('ok',true,'collected',got);
END $fn$;

CREATE OR REPLACE FUNCTION public.developer_agent()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE errs text; alerts text; snap jsonb; pings text; sys text; ctx text;
BEGIN
  SELECT string_agg(format('- %s: status=%s bledy=%s ost.blad=%s', name, coalesce(last_status,'?'), error_count, left(coalesce(last_error,'-'),120)), E'\n')
    INTO errs FROM agent_registry WHERE last_status='error' OR error_count>0;
  SELECT string_agg(format('- %s: %s', event_type, left(coalesce(payload::text,'{}'),140)), E'\n')
    INTO alerts FROM (SELECT * FROM agent_events WHERE event_type LIKE 'alert.%' AND created_at>now()-interval '24 hours' ORDER BY created_at DESC LIMIT 8) a;
  SELECT payload INTO snap FROM agent_events WHERE event_type='health.snapshot' ORDER BY created_at DESC LIMIT 1;
  SELECT string_agg(format('%s: %s (%sms)', e->>'fn', CASE WHEN (e->>'ok')::bool THEN 'ok' ELSE 'DOWN' END, e->>'ms'), ', ')
    INTO pings FROM jsonb_array_elements(coalesce(snap->'pings','[]'::jsonb)) e WHERE NOT (e->>'ok')::bool OR (e->>'ms')::int > 2500;
  ctx := 'BLEDY AGENTOW:'||E'\n'||coalesce(errs,'(brak)')||E'\n\nALARMY 24h:'||E'\n'||coalesce(alerts,'(brak)')||E'\n\nWOLNE/DOWN FUNKCJE:'||E'\n'||coalesce(pings,'(brak)');
  sys := 'Jestes Senior Developerem GrouAI OS (React/Vite + Supabase + Vercel). Na podstawie sygnalow technicznych podaj zwiezla DIAGNOZE i konkretne kroki naprawcze po polsku, wg priorytetu. Jesli brak problemow - napisz krotko, ze system stabilny. Bez zmyslania.';
  UPDATE agent_registry SET last_run_at=now(), last_status='ok', success_count=success_count+1, last_error=NULL, updated_at=now() WHERE name='agent-developer';
  RETURN public.ai_ask('dev_review', sys, ctx);
END $fn$;

CREATE OR REPLACE FUNCTION public.tester_agent()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE r_pub int; r_vip int; no_rls int; orphan_likes int; orphan_pt int; brain_stale bool; results text; sys text;
BEGIN
  SELECT count(*) INTO r_pub FROM radio_schedule WHERE station='public' AND item_type='track';
  SELECT count(*) INTO r_vip FROM radio_schedule WHERE station='vip' AND item_type='track';
  SELECT count(*) INTO no_rls FROM pg_tables t WHERE t.schemaname='public'
     AND NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname=t.tablename AND n.nspname='public' AND c.relrowsecurity);
  SELECT count(*) INTO orphan_likes FROM liked_songs l WHERE NOT EXISTS (SELECT 1 FROM tracks t WHERE t.id=l.track_id);
  SELECT count(*) INTO orphan_pt FROM playlist_tracks p WHERE NOT EXISTS (SELECT 1 FROM tracks t WHERE t.id=p.track_id);
  SELECT (last_run_at IS NULL OR last_run_at < now()-interval '30 minutes') INTO brain_stale FROM agent_registry WHERE name='grouai-brain';
  results := format(
    'TEST radio.public_nonempty: %s (%s)'||E'\n'||'TEST radio.vip_nonempty: %s (%s)'||E'\n'||
    'TEST rls.all_tables: %s (tabel bez RLS: %s)'||E'\n'||'TEST integrity.orphan_liked: %s (%s)'||E'\n'||
    'TEST integrity.orphan_playlist: %s (%s)'||E'\n'||'TEST brain.fresh: %s',
    CASE WHEN r_pub>0 THEN 'PASS' ELSE 'FAIL' END, r_pub,
    CASE WHEN r_vip>0 THEN 'PASS' ELSE 'FAIL' END, r_vip,
    CASE WHEN no_rls=0 THEN 'PASS' ELSE 'FAIL' END, no_rls,
    CASE WHEN orphan_likes=0 THEN 'PASS' ELSE 'WARN' END, orphan_likes,
    CASE WHEN orphan_pt=0 THEN 'PASS' ELSE 'WARN' END, orphan_pt,
    CASE WHEN brain_stale THEN 'FAIL (mozg nie tyka)' ELSE 'PASS' END);
  sys := 'Jestes QA/Testerem GrouAI OS. Ocen wyniki testow integralnosci: podsumuj co PRZESZLO i co NIE, oszacuj ryzyko i zaproponuj poprawki oraz 2-3 dodatkowe testy. Po polsku, zwiezle.';
  UPDATE agent_registry SET last_run_at=now(), last_status='ok', success_count=success_count+1, last_error=NULL, updated_at=now() WHERE name='agent-tester';
  RETURN public.ai_ask('qa_report', sys, results);
END $fn$;

INSERT INTO public.agent_registry(name, description, enabled, cron_schedule) VALUES
 ('agent-developer','Diagnostyka techniczna (bledy agentow, alarmy, wolne funkcje) -> Grok proponuje fix. Wynik w pamieci (dev_review).', true, '20 8 * * *'),
 ('agent-tester','Testy integralnosci (radio, RLS, sieroty, swiezosc mozgu) -> Grok ocenia i proponuje poprawki. Wynik w pamieci (qa_report).', true, '40 8 * * *')
ON CONFLICT (name) DO UPDATE SET description=EXCLUDED.description, cron_schedule=EXCLUDED.cron_schedule, updated_at=now();

-- Crony (uruchom w bazie po deployu, jesli nie ustawione):
-- SELECT cron.schedule('grouai-ai-collect','*/10 * * * *','SELECT public.brain_reason_collect();');
-- SELECT cron.schedule('agent-developer','20 8 * * *','SELECT public.developer_agent();');
-- SELECT cron.schedule('agent-tester','40 8 * * *','SELECT public.tester_agent();');
