-- Manager deleguje: mózg (grouai-brain) utrzymuje wyspecjalizowanych agentów
-- świeżych. Gdy agent nie działał >20 h, orchestrator go uruchamia i zapisuje
-- delegację jako event 'brain.delegate' (widoczne w /admin/brain → Puls).
-- To realizuje szczyt piramidy GrouaAI OS: manager nad agentami. Cron: co godzinę.

CREATE OR REPLACE FUNCTION public.brain_delegate()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE ran text[] := '{}';
BEGIN
  IF EXISTS (SELECT 1 FROM agent_registry WHERE name='agent-security' AND enabled
             AND (last_run_at IS NULL OR last_run_at < now()-interval '20 hours')) THEN
    PERFORM public.security_scan();
    PERFORM public.emit_agent_event('brain.delegate','grouai-brain',NULL,'agent',NULL, jsonb_build_object('agent','agent-security'), 4);
    ran := ran || 'agent-security';
  END IF;
  IF EXISTS (SELECT 1 FROM agent_registry WHERE name='agent-data-lite' AND enabled
             AND (last_run_at IS NULL OR last_run_at < now()-interval '20 hours')) THEN
    PERFORM public.data_digest();
    PERFORM public.emit_agent_event('brain.delegate','grouai-brain',NULL,'agent',NULL, jsonb_build_object('agent','agent-data-lite'), 4);
    ran := ran || 'agent-data-lite';
  END IF;
  IF EXISTS (SELECT 1 FROM agent_registry WHERE name='agent-marketing-lite' AND enabled
             AND (last_run_at IS NULL OR last_run_at < now()-interval '20 hours')) THEN
    PERFORM public.marketing_lite();
    PERFORM public.emit_agent_event('brain.delegate','grouai-brain',NULL,'agent',NULL, jsonb_build_object('agent','agent-marketing-lite'), 4);
    ran := ran || 'agent-marketing-lite';
  END IF;
  RETURN jsonb_build_object('ok',true,'delegated',ran);
END $fn$;
-- Cron: SELECT cron.schedule('grouai-brain-delegate','15 * * * *','SELECT public.brain_delegate();');
