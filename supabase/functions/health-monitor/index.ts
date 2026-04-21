// Health Monitor Agent — pings critical edge functions, watches metrics, emits alerts.
// Cron: every 5 minutes.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

// Critical functions to ping (OPTIONS request — light & cors-friendly)
const CRITICAL_FUNCTIONS = [
  'studio-router',
  'ai-mood-analysis',
  'grouai-brain',
  'send-transactional-email',
  'process-email-queue',
  'ai-assistant',
  'r2-signed-url',
  'payments-webhook',
];

interface PingResult {
  fn: string;
  ok: boolean;
  status: number;
  ms: number;
  error?: string;
}

async function pingFunction(fn: string): Promise<PingResult> {
  const url = `${SUPABASE_URL}/functions/v1/${fn}`;
  const start = Date.now();
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://grouaistream.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type',
      },
      signal: ctrl.signal,
    });
    clearTimeout(timeout);
    const ms = Date.now() - start;
    // Accept 200/204 as healthy. 401/403 also means alive (just auth-blocked).
    const ok = res.status < 500;
    return { fn, ok, status: res.status, ms };
  } catch (err) {
    return { fn, ok: false, status: 0, ms: Date.now() - start, error: String(err) };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const startedAt = Date.now();

  try {
    // 1) Ping critical functions in parallel
    const pings = await Promise.all(CRITICAL_FUNCTIONS.map(pingFunction));
    const downFns = pings.filter((p) => !p.ok);
    const slowFns = pings.filter((p) => p.ok && p.ms > 3000);

    // 2) Email health: failure rate in last hour
    const sinceHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: emailRows } = await supabase
      .from('email_send_log')
      .select('status', { count: 'exact' })
      .gte('created_at', sinceHour);
    const totalEmails = emailRows?.length ?? 0;
    const failedEmails = emailRows?.filter((r: any) => r.status === 'failed').length ?? 0;
    const emailFailureRate = totalEmails > 0 ? failedEmails / totalEmails : 0;

    // 3) Overdue payouts (pending > 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: overduePayouts } = await supabase
      .from('payout_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lt('requested_at', sevenDaysAgo);

    // 4) Stale agent: last_run_at older than 2× cron interval
    const { data: agents } = await supabase
      .from('agent_registry')
      .select('name, cron_schedule, last_run_at, enabled, error_count, last_status')
      .eq('enabled', true);
    const staleAgents: string[] = [];
    const now = Date.now();
    for (const a of agents ?? []) {
      if (!a.last_run_at) continue;
      const ageMin = (now - new Date(a.last_run_at).getTime()) / 60000;
      // Heuristic: anything older than 24h is stale (covers daily crons + 5min crons safely)
      if (ageMin > 24 * 60) staleAgents.push(a.name);
    }

    // 5) Build snapshot
    const snapshot = {
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
      pings: pings.map((p) => ({ fn: p.fn, ok: p.ok, status: p.status, ms: p.ms })),
      down_count: downFns.length,
      slow_count: slowFns.length,
      email: { total_1h: totalEmails, failed_1h: failedEmails, failure_rate: emailFailureRate },
      overdue_payouts: overduePayouts ?? 0,
      stale_agents: staleAgents,
    };

    // 6) Always emit a heartbeat snapshot (low priority)
    await supabase.from('agent_events').insert({
      event_type: 'health.snapshot',
      source: 'health-monitor',
      priority: 8,
      payload: snapshot,
    });

    // 7) Emit alerts (high priority) for actual problems
    const alerts: Array<{ type: string; payload: any }> = [];
    if (downFns.length > 0) {
      alerts.push({
        type: 'alert.functions_down',
        payload: { functions: downFns.map((f) => ({ fn: f.fn, status: f.status, error: f.error })) },
      });
    }
    if (slowFns.length >= 3) {
      alerts.push({
        type: 'alert.functions_slow',
        payload: { functions: slowFns.map((f) => ({ fn: f.fn, ms: f.ms })) },
      });
    }
    if (emailFailureRate > 0.05 && totalEmails >= 10) {
      alerts.push({
        type: 'alert.email_degraded',
        payload: { failure_rate: emailFailureRate, total: totalEmails, failed: failedEmails },
      });
    }
    if ((overduePayouts ?? 0) > 0) {
      alerts.push({
        type: 'alert.payout_overdue',
        payload: { count: overduePayouts },
      });
    }
    if (staleAgents.length > 0) {
      alerts.push({
        type: 'alert.agent_stale',
        payload: { agents: staleAgents },
      });
    }

    if (alerts.length > 0) {
      await supabase.from('agent_events').insert(
        alerts.map((a) => ({
          event_type: a.type,
          source: 'health-monitor',
          priority: 2,
          payload: a.payload,
        })),
      );
    }

    // 8) Update agent_registry
    await supabase
      .from('agent_registry')
      .update({
        last_run_at: new Date().toISOString(),
        last_status: alerts.length > 0 ? 'alerts' : 'ok',
        success_count: 1,
      })
      .eq('name', 'health-monitor');

    return new Response(
      JSON.stringify({ ok: true, snapshot, alerts: alerts.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('health-monitor error', err);
    await supabase
      .from('agent_registry')
      .update({
        last_run_at: new Date().toISOString(),
        last_status: 'error',
        last_error: String(err),
        error_count: 1,
      })
      .eq('name', 'health-monitor');

    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
