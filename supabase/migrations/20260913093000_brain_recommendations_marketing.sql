-- Rekomendacje: mózg + Agent Marketing-lite tworzą PROPOZYCJE (agent_decisions,
-- pending) do zatwierdzenia w panelu /admin/brain → Decyzje. Bez LLM, bez kosztów.
-- brain_propose = dedup po decision_type (jedna otwarta propozycja danego typu).
-- brain_tick woła brain_propose dla: zaległych payoutów, usług down, zalewu alarmów.
-- marketing_lite: z danych (odsłuchania/nowi twórcy/top) → propozycje marketingowe.

CREATE OR REPLACE FUNCTION public.brain_propose(_agent text, _dtype text, _reasoning text, _action jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
BEGIN
  IF EXISTS (SELECT 1 FROM public.agent_decisions WHERE decision_type=_dtype AND executed=false AND rejected=false) THEN
    RETURN;
  END IF;
  INSERT INTO public.agent_decisions(agent_name, decision_type, reasoning, action_taken, executed, rejected)
  VALUES(_agent, _dtype, _reasoning, _action, false, false);
END $fn$;

CREATE OR REPLACE FUNCTION public.marketing_lite()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE nt int; nc int; ns int; tot_t int;
BEGIN
  SELECT count(*) INTO nt FROM tracks WHERE created_at > now()-interval '7 days';
  SELECT count(*) INTO nc FROM profiles WHERE created_at > now()-interval '7 days';
  SELECT count(*) INTO ns FROM stream_events WHERE streamed_at > now()-interval '7 days';
  SELECT count(*) INTO tot_t FROM tracks;
  IF ns < tot_t * 0.1 THEN
    PERFORM public.brain_propose('agent-marketing-lite','marketing.low_plays',
      format('Malo odsluchan: %s w 7 dni przy %s utworach w katalogu. Proponuje kampanie promujaca playlisty/nowosci na social (X, Instagram, TikTok).', ns, tot_t),
      jsonb_build_object('type','social_campaign','streams_7d',ns,'catalog',tot_t,'channels', jsonb_build_array('X','Instagram','TikTok')));
  END IF;
  IF nc = 0 THEN
    PERFORM public.brain_propose('agent-marketing-lite','marketing.no_new_creators',
      '0 nowych tworcow w 7 dni. Proponuje akcje pozyskania tworcow: zaproszenia, kampania "wrzuc swoj utwor", wspolprace ze szkolami/kolektywami.',
      jsonb_build_object('type','creator_acquisition','new_creators_7d',0));
  END IF;
  PERFORM public.brain_propose('agent-marketing-lite','marketing.promote_top',
    'Wypromuj TOP utwory tygodnia: post na social + sekcja na stronie glownej.',
    jsonb_build_object('type','promote_top_weekly'));
  UPDATE public.agent_registry SET last_run_at=now(), last_status='ok', success_count=success_count+1, last_error=NULL, updated_at=now() WHERE name='agent-marketing-lite';
  RETURN jsonb_build_object('ok',true,'streams_7d',ns,'new_creators_7d',nc,'catalog',tot_t);
END $fn$;

INSERT INTO public.agent_registry(name, description, enabled, cron_schedule)
VALUES('agent-marketing-lite','Z danych (odsluchania, nowi tworcy, top) tworzy PROPOZYCJE marketingowe jako decyzje do zatwierdzenia w panelu. Bez LLM.', true, '0 7 * * *')
ON CONFLICT (name) DO UPDATE SET description=EXCLUDED.description, cron_schedule=EXCLUDED.cron_schedule, updated_at=now();
-- Crony: SELECT cron.schedule('agent-marketing-lite','0 7 * * *','SELECT public.marketing_lite();');
-- brain_tick (patrz migracja 20260912230000) dostal wywolania brain_propose dla payouts/down/alerts.
