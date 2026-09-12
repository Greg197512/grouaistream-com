-- GrouAI Brain — ożywiony na DARMOWYM, regułowym silniku (bez LLM, bez klucza).
-- Powód: dotychczasowy brain (edge grouai-brain) używał OpenRouter → 402 "brak
-- kredytów" i stał od czerwca. Keyless darmowy LLM po stronie serwera (Pollinations)
-- jest teraz zablokowany budżetem, więc v1 mózgu składa wnioski z agent_events
-- regułami SQL: zdrowie systemu, alarmy, raport finansowy, rekomendacje, puls.
-- Działa w całości w bazie (pg_cron), zero kosztów, Vercel tego nie liczy.
-- LLM dołożymy, gdy pojawi się darmowy klucz (OpenRouter :free / Groq / Gemini).

CREATE OR REPLACE FUNCTION public.brain_tick()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE ev_ids uuid[]; n_events int := 0; snap jsonb; snap_at timestamptz;
        down int; slow int; overdue int; n_alerts int; rev jsonb; src_summary text;
BEGIN
  SELECT array_agg(id) INTO ev_ids FROM (
    SELECT id FROM agent_events WHERE processed_by_brain=false ORDER BY created_at DESC LIMIT 300
  ) e;
  IF ev_ids IS NULL THEN
    UPDATE agent_registry SET last_run_at=now(), last_status='idle', updated_at=now() WHERE name='grouai-brain';
    RETURN jsonb_build_object('ok',true,'events',0);
  END IF;
  n_events := array_length(ev_ids,1);

  SELECT payload, created_at INTO snap, snap_at FROM agent_events
    WHERE event_type='health.snapshot' ORDER BY created_at DESC LIMIT 1;
  IF snap IS NOT NULL THEN
    down := coalesce((snap->>'down_count')::int,0);
    slow := coalesce((snap->>'slow_count')::int,0);
    overdue := coalesce((snap->>'overdue_payouts')::int,0);
    DELETE FROM brain_memory WHERE metadata->>'kind'='health_status';
    INSERT INTO brain_memory(memory_type,title,content,summary,importance,metadata,expires_at)
    VALUES (
      CASE WHEN down>0 THEN 'anomaly' ELSE 'platform_insight' END,
      CASE WHEN down>0 THEN format('Zdrowie: %s uslug nie odpowiada', down)
           WHEN slow>0 THEN format('Zdrowie: %s uslug wolnych', slow)
           ELSE 'System zdrowy - wszystkie uslugi odpowiadaja' END,
      format('down=%s slow=%s payouty>7d=%s (snapshot %s)', down, slow, overdue, snap_at),
      format('down=%s, slow=%s, zalegle payouty=%s', down, slow, overdue),
      CASE WHEN down>0 THEN 9 WHEN slow>0 OR overdue>0 THEN 6 ELSE 3 END,
      jsonb_build_object('by','grouai-brain','kind','health_status'), now()+interval '2 days');
  END IF;

  SELECT count(*) INTO n_alerts FROM agent_events WHERE id = ANY(ev_ids) AND event_type LIKE 'alert.%';
  IF n_alerts > 0 THEN
    INSERT INTO brain_memory(memory_type,title,content,summary,importance,metadata,expires_at)
    SELECT 'anomaly', format('%s nowych alarmow', n_alerts),
           string_agg(DISTINCT event_type, ', '), format('%s alarmow w cyklu', n_alerts), 7,
           jsonb_build_object('by','grouai-brain','kind','alerts'), now()+interval '30 days'
    FROM agent_events WHERE id = ANY(ev_ids) AND event_type LIKE 'alert.%';
  END IF;

  SELECT payload INTO rev FROM agent_events WHERE event_type='revenue.report' ORDER BY created_at DESC LIMIT 1;
  IF rev IS NOT NULL THEN
    DELETE FROM brain_memory WHERE metadata->>'kind'='revenue';
    INSERT INTO brain_memory(memory_type,title,content,summary,importance,metadata,expires_at)
    VALUES('platform_insight','Ostatni raport finansowy', left(rev::text,1000),
           'Podsumowanie streamow / tipow / ROI', 5,
           jsonb_build_object('by','grouai-brain','kind','revenue'), now()+interval '14 days');
  END IF;

  INSERT INTO brain_memory(memory_type,title,content,summary,importance,metadata,expires_at)
  SELECT 'decision', left(coalesce(payload->>'title', payload->>'recommendation','Rekomendacja agenta'),200),
         left(payload::text,800), 'Rekomendacja z agenta', 6,
         jsonb_build_object('by','grouai-brain','kind','recommendation'), now()+interval '30 days'
  FROM agent_events WHERE id = ANY(ev_ids) AND event_type='agent.recommendation';

  SELECT string_agg(format('%sx %s', c, source), ', ') INTO src_summary FROM (
    SELECT source, count(*) c FROM agent_events WHERE id = ANY(ev_ids) GROUP BY source ORDER BY c DESC LIMIT 8
  ) s;
  DELETE FROM brain_memory WHERE metadata->>'kind'='pulse';
  INSERT INTO brain_memory(memory_type,title,content,summary,importance,metadata,expires_at)
  VALUES('platform_insight', format('Puls: %s zdarzen w ostatnim cyklu', n_events),
         coalesce(src_summary,''), coalesce(src_summary,''), 3,
         jsonb_build_object('by','grouai-brain','kind','pulse'), now()+interval '2 days');

  UPDATE agent_events SET processed_by_brain=true, processed_at=now() WHERE id = ANY(ev_ids);
  UPDATE agent_registry SET last_run_at=now(), last_status='ok', success_count=success_count+1, last_error=NULL, updated_at=now() WHERE name='grouai-brain';
  RETURN jsonb_build_object('ok',true,'events',n_events);
END $fn$;

-- Ręczny tick z panelu admina (tylko admin/moderator).
CREATE OR REPLACE FUNCTION public.brain_run_now()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('admin','moderator')) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  RETURN public.brain_tick();
END $fn$;
GRANT EXECUTE ON FUNCTION public.brain_run_now() TO authenticated;

-- Harmonogram: co 10 min (ustawiane przez cron.schedule w bazie).
-- SELECT cron.schedule('grouai-brain-tick','*/10 * * * *','SELECT public.brain_tick();');
