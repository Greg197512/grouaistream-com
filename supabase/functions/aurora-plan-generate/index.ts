// Aurora Plan Generate — po opłaceniu generuje mapę działań i przydziela pracowników n8n
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

async function aiPlan(serviceType: string, brief: string): Promise<any> {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY missing");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemma-2-9b-it:free",
      messages: [
        {
          role: "system",
          content: `Jesteś senior PM. Rozbij zlecenie ${serviceType} na 4-7 logicznych etapów. Każdy etap MUSI mieć: title, description, scope (np. "stream.marketing.seo", "aurora.research", "stream.support"), eta_minutes (5-120). Zwróć JSON: {steps:[{title, description, scope, eta_minutes}], total_eta_minutes, summary}.`,
        },
        { role: "user", content: `Brief: ${brief}` },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}`);
  const j = await res.json();
  return JSON.parse(j.choices?.[0]?.message?.content ?? "{}");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { order_id } = await req.json();
    if (!order_id) throw new Error("order_id required");

    const { data: order, error } = await supabase
      .from("aurora_business_orders").select("*").eq("id", order_id).single();
    if (error || !order) throw new Error("Order not found");

    // Check if plan exists
    const { data: existing } = await supabase
      .from("aurora_order_plan_steps").select("id").eq("order_id", order_id).limit(1);
    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ ok: true, message: "Plan already exists" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate plan via AI
    const plan = await aiPlan(order.service_type, order.brief);
    const steps = Array.isArray(plan.steps) ? plan.steps : [];

    // For each step: find or create worker by scope
    const { data: workers } = await supabase
      .from("aurora_workers").select("id, scopes, status, workflow_id");
    const { data: workflows } = await supabase
      .from("aurora_n8n_workflows").select("id, workflow_id, name").eq("enabled", true).limit(20);

    const matchWorker = (scope: string) => {
      const active = (workers ?? []).filter((w: any) => w.status === "active");
      return active.find((w: any) =>
        (w.scopes ?? []).some((s: string) =>
          s === scope || (s.endsWith(".*") && scope.startsWith(s.replace(".*", ".")))
        )
      );
    };

    // Insert plan steps
    const stepsToInsert = steps.map((s: any, i: number) => {
      const worker = matchWorker(s.scope ?? "aurora.general");
      let workflowId = worker?.workflow_id ?? null;
      if (!workflowId && workflows && workflows.length > 0) {
        workflowId = workflows[i % workflows.length].workflow_id;
      }
      return {
        order_id,
        step_index: i,
        title: s.title ?? `Etap ${i + 1}`,
        description: s.description ?? "",
        scope: s.scope ?? "aurora.general",
        assigned_worker_id: worker?.id ?? null,
        workflow_id: workflowId,
        eta_minutes: Number(s.eta_minutes) || 30,
        status: "pending",
      };
    });

    if (stepsToInsert.length > 0) {
      const { error: insErr } = await supabase.from("aurora_order_plan_steps").insert(stepsToInsert);
      if (insErr) throw insErr;
    }

    await supabase.from("aurora_business_orders").update({
      workflow_map: { summary: plan.summary, total_eta: plan.total_eta_minutes, steps_count: steps.length },
      status: order.status === "paid" || order.status === "pending" ? "in_progress" : order.status,
      started_at: order.started_at ?? new Date().toISOString(),
    }).eq("id", order_id);

    await supabase.from("aurora_order_events").insert({
      order_id, event_type: "plan_generated",
      message: `Aurora wygenerowała mapę: ${steps.length} etapów (~${plan.total_eta_minutes ?? 0} min)`,
      data: { steps_count: steps.length },
    });

    return new Response(JSON.stringify({ ok: true, steps_count: steps.length, summary: plan.summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
