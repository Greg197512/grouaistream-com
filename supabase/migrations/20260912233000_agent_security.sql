-- Agent Security — regułowy skan bezpieczeństwa (bez LLM, bez klucza, w bazie).
-- Sprawdza: tabele bez RLS, zbyt otwarte polityki (qual=true na SELECT/ALL),
-- zaległe payouty (z ostatniego health.snapshot). Zapisuje rolling-wniosek do
-- brain_memory (kind='security_status') i emituje agent_events 'security.scan'
-- przy realnym problemie. Widoczny w /admin/brain (Agenci + Pamięć). Cron 05:00.

ALTER TABLE public.brain_pending ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.security_scan()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE no_rls int; open_pol int; overdue int; sev int; findings text; snap jsonb; open_tables text;
BEGIN
  SELECT count(*) INTO no_rls FROM pg_tables t
   WHERE t.schemaname='public'
     AND NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                     WHERE c.relname=t.tablename AND n.nspname='public' AND c.relrowsecurity);
  SELECT count(*) INTO open_pol FROM pg_policies
   WHERE schemaname='public' AND cmd IN ('SELECT','ALL') AND qual='true';
  SELECT string_agg(DISTINCT tablename, ', ') INTO open_tables FROM (
    SELECT tablename FROM pg_policies
    WHERE schemaname='public' AND cmd IN ('SELECT','ALL') AND qual='true'
    ORDER BY tablename LIMIT 12) s;
  SELECT payload INTO snap FROM agent_events WHERE event_type='health.snapshot' ORDER BY created_at DESC LIMIT 1;
  overdue := coalesce((snap->>'overdue_payouts')::int, 0);
  sev := CASE WHEN no_rls > 0 THEN 9 WHEN open_pol > 25 OR overdue > 0 THEN 6 ELSE 3 END;
  findings := format('Tabele bez RLS: %s. Polityki dostep-dla-wszystkich (qual=true, SELECT/ALL): %s%s. Zalegle payouty >7d: %s.',
    no_rls, open_pol, CASE WHEN open_tables IS NOT NULL THEN ' [' || open_tables || ']' ELSE '' END, overdue);
  DELETE FROM public.brain_memory WHERE metadata->>'kind'='security_status';
  INSERT INTO public.brain_memory(memory_type,title,content,summary,importance,metadata,expires_at)
  VALUES(CASE WHEN sev>=9 THEN 'anomaly' ELSE 'platform_insight' END,
    format('Bezpieczenstwo: %s tabel bez RLS, %s otwartych polityk', no_rls, open_pol),
    findings, findings, sev,
    jsonb_build_object('by','agent-security','kind','security_status','no_rls',no_rls,'open_policies',open_pol,'overdue_payouts',overdue),
    now()+interval '2 days');
  IF no_rls > 0 OR overdue > 0 THEN
    PERFORM public.emit_agent_event('security.scan','agent-security',NULL,'security',NULL,
      jsonb_build_object('no_rls',no_rls,'open_policies',open_pol,'overdue_payouts',overdue,'findings',findings),
      CASE WHEN no_rls>0 THEN 8 ELSE 5 END);
  END IF;
  UPDATE public.agent_registry SET last_run_at=now(), last_status='ok', success_count=success_count+1, last_error=NULL, updated_at=now() WHERE name='agent-security';
  RETURN jsonb_build_object('ok',true,'no_rls',no_rls,'open_policies',open_pol,'overdue_payouts',overdue,'severity',sev);
END $fn$;

INSERT INTO public.agent_registry(name, description, enabled, cron_schedule)
VALUES('agent-security','Regulowy skan bezpieczenstwa: tabele bez RLS, zbyt otwarte polityki (qual=true), zalegle payouty. Zapisuje do pamieci mozgu i emituje security.scan.', true, '0 5 * * *')
ON CONFLICT (name) DO UPDATE SET description=EXCLUDED.description, cron_schedule=EXCLUDED.cron_schedule, updated_at=now();
-- SELECT cron.schedule('agent-security-scan','0 5 * * *','SELECT public.security_scan();');
