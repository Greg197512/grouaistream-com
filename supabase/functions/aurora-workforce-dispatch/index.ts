// Aurora Workforce Dispatch
// Modes:
//  - { action: "enqueue", scope, payload?, priority?, max_attempts? }
//  - { action: "dispatch", limit?: number }   -> claim N jobs and trigger their workflows
//  - { action: "complete", job_id, success, result?, error?, run_id? }
//
// Aurora używa tego endpointu jako "dyspozytor pracy". Dzięki RPC z SKIP LOCKED
// dwóch pracowników nie weźmie tego samego zadania.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Auth: musi być admin (RPC wymagają has_role)
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action ?? "dispatch";

    // ENQUEUE
    if (action === "enqueue") {
      const { scope, payload = {}, priority = 100, max_attempts = 3 } = body;
      if (!scope || typeof scope !== "string") {
        return json({ error: "scope required" }, 400);
      }
      const { data, error } = await userClient.rpc("aurora_workforce_enqueue", {
        _scope: scope, _payload: payload, _priority: priority, _max_attempts: max_attempts,
      });
      if (error) throw error;
      return json({ ok: true, job_id: data });
    }

    // COMPLETE
    if (action === "complete") {
      const { job_id, success, result = {}, error: errMsg = null, run_id = null } = body;
      if (!job_id) return json({ error: "job_id required" }, 400);
      const { data, error } = await userClient.rpc("aurora_workforce_complete_job", {
        _job_id: job_id, _success: !!success, _result: result, _error: errMsg, _run_id: run_id,
      });
      if (error) throw error;
      return json({ ok: true, result: data });
    }

    // DISPATCH (default): claim up to N jobs and trigger n8n
    const limit = Math.min(Math.max(Number(body?.limit ?? 5), 1), 25);
    const dispatched: any[] = [];

    for (let i = 0; i < limit; i++) {
      const { data: claim, error: claimErr } = await userClient.rpc(
        "aurora_workforce_claim_job",
        { _lock_seconds: 600 },
      );
      if (claimErr) throw claimErr;
      if (!claim || !claim.job_id) break;

      // Trigger workflow w n8n przez istniejący endpoint
      const triggerUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/aurora-n8n-trigger`;
      const triggerRes = await fetch(triggerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader,
        },
        body: JSON.stringify({
          workflow_id: claim.workflow_id,
          payload: {
            ...(claim.payload ?? {}),
            __workforce: {
              job_id: claim.job_id,
              scope: claim.scope,
              worker_id: claim.worker_id,
              worker_name: claim.worker_name,
              complete_callback: `${Deno.env.get("SUPABASE_URL")}/functions/v1/aurora-workforce-dispatch`,
            },
          },
          trigger_source: `workforce:${claim.scope}`,
        }),
      });

      const triggerJson = await triggerRes.json().catch(() => ({}));

      // Jeśli trigger od razu padł — zamknij job jako fail (bez czekania na callback)
      if (!triggerRes.ok || triggerJson?.ok === false) {
        await supabase.rpc("aurora_workforce_complete_job", {
          _job_id: claim.job_id,
          _success: false,
          _result: triggerJson ?? {},
          _error: triggerJson?.error ?? `trigger_failed_${triggerRes.status}`,
          _run_id: triggerJson?.run_id ?? null,
        });
      } else {
        // Zaktualizuj job o run_id (callback z n8n potem zamknie zadanie)
        if (triggerJson?.run_id) {
          await supabase
            .from("aurora_workforce_jobs")
            .update({ run_id: triggerJson.run_id, status: "running", started_at: new Date().toISOString() })
            .eq("id", claim.job_id);
        }
      }

      dispatched.push({
        job_id: claim.job_id,
        scope: claim.scope,
        worker: claim.worker_name,
        triggered: triggerRes.ok,
        run_id: triggerJson?.run_id ?? null,
      });
    }

    return json({ ok: true, dispatched_count: dispatched.length, dispatched });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
