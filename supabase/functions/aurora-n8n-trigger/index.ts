// Aurora n8n Trigger — Aurora wywołuje workflow n8n i tworzy run-log.
// Body: { workflow_id: string, payload?: any, order_id?: uuid, niche_id?: uuid, trigger_source?: string }
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

  try {
    const { workflow_id, payload = {}, order_id, niche_id, trigger_source = "aurora" } = await req.json();
    if (!workflow_id) {
      return new Response(JSON.stringify({ error: "workflow_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: wf, error: wfErr } = await supabase
      .from("aurora_n8n_workflows")
      .select("id, workflow_id, name, webhook_url, enabled")
      .eq("workflow_id", workflow_id)
      .maybeSingle();
    if (wfErr) throw wfErr;
    if (!wf || !wf.enabled || !wf.webhook_url) {
      return new Response(JSON.stringify({ error: "workflow not available" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: run, error: runErr } = await supabase
      .from("aurora_n8n_runs")
      .insert({
        workflow_db_id: wf.id, workflow_id, order_id, niche_id, trigger_source,
        input_payload: payload, status: "running",
      })
      .select().single();
    if (runErr) throw runErr;

    // Callback URL podawany do n8n, by mógł raportować z powrotem
    const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/aurora-n8n-callback`;

    let dispatchStatus = 0;
    let dispatchError: string | null = null;
    try {
      const res = await fetch(wf.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          run_id: run.id,
          workflow_id,
          order_id, niche_id,
          callback_url: callbackUrl,
          payload,
        }),
      });
      dispatchStatus = res.status;
      if (!res.ok) dispatchError = `HTTP ${res.status}`;
    } catch (e) {
      dispatchError = String(e);
    }

    if (dispatchError) {
      await supabase.rpc("aurora_n8n_run_finalize", {
        _run_id: run.id, _status: "failed", _output: {}, _error: dispatchError,
      });
    }

    return new Response(JSON.stringify({
      ok: !dispatchError, run_id: run.id, dispatch_status: dispatchStatus, error: dispatchError,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
