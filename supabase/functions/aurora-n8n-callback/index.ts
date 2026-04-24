// Aurora n8n Callback — n8n raportuje tu status / kroki / wynik.
// Public (verify_jwt=false). Body warianty:
//   { run_id, type: "step", step_index, node_name, status, message?, data? }
//   { run_id, type: "finish", status: "success"|"failed", output?, error? }
//   { run_id, type: "log", message, data? }
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
    const body = await req.json();
    const { run_id, type } = body;
    if (!run_id || !type) {
      return new Response(JSON.stringify({ error: "run_id and type required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "step") {
      const { step_index = 0, node_name = "step", status = "success", message, data = {}, duration_ms } = body;
      await supabase.from("aurora_n8n_run_steps").insert({
        run_id, step_index, node_name, status, message, data, duration_ms,
      });
      // Promote run to partial-failed if step failed
      if (status === "failed") {
        await supabase.from("aurora_n8n_runs").update({ status: "partial" }).eq("id", run_id);
      }
    } else if (type === "log") {
      await supabase.from("aurora_n8n_run_steps").insert({
        run_id, step_index: 999, node_name: "log", status: "success",
        message: body.message || "", data: body.data || {},
      });
    } else if (type === "finish") {
      const { status = "success", output = {}, error } = body;
      const { data, error: rpcErr } = await supabase.rpc("aurora_n8n_run_finalize", {
        _run_id: run_id, _status: status, _output: output, _error: error || null,
      });
      if (rpcErr) throw rpcErr;
      // Jeśli z runem powiązane jest zlecenie — dopisz event
      const { data: run } = await supabase.from("aurora_n8n_runs").select("order_id").eq("id", run_id).maybeSingle();
      if (run?.order_id) {
        await supabase.from("aurora_order_events").insert({
          order_id: run.order_id, event_type: `n8n_${status}`,
          message: error || `n8n run ${status}`, data: { run_id, output },
        });
        if (status === "success") {
          await supabase.from("aurora_business_orders").update({
            status: "completed", completed_at: new Date().toISOString(), result: output,
          }).eq("id", run.order_id);
        }
      }
      return new Response(JSON.stringify({ ok: true, finalize: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      return new Response(JSON.stringify({ error: "unknown type" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
