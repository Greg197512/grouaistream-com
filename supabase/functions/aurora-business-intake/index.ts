// Aurora Business Intake — przyjmuje zlecenia od klientów (web form / n8n webhook / API)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

const SERVICE_TYPES = ["seo_audit", "seo_content", "landing_page", "social_post", "automation_flow", "lead_research", "other"];

async function planWithAI(brief: string, serviceType: string) {
  if (!OPENROUTER_API_KEY) return null;
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemma-2-9b-it:free",
      messages: [
        { role: "system", content: "Jesteś Aurorą — autonomicznym wykonawcą zleceń biznesowych (SEO, copy, automatyzacje). Na podstawie briefu zwróć JSON: {steps: [{title, description, tool}], estimated_hours, deliverables: [], next_action}. tool ∈ ['ai-write','seo-research','n8n-flow','manual-review']." },
        { role: "user", content: `Typ usługi: ${serviceType}\n\nBrief klienta:\n${brief}` },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) return null;
  const j = await res.json();
  try { return JSON.parse(j.choices?.[0]?.message?.content ?? "{}"); }
  catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json();
    const {
      source = "webhook",
      client_email, client_name, client_company,
      service_type = "other", brief, budget_eur = 0, deadline,
      payload = {}, priority = 5, n8n_workflow_id,
    } = body;

    if (!brief || typeof brief !== "string" || brief.length < 10) {
      return new Response(JSON.stringify({ error: "brief is required (min 10 chars)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!SERVICE_TYPES.includes(service_type)) {
      return new Response(JSON.stringify({ error: `service_type must be one of ${SERVICE_TYPES.join(", ")}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Aurora planuje
    const ai_plan = await planWithAI(brief, service_type);

    // 2) Zapisz zlecenie
    const { data: order, error } = await supabase
      .from("aurora_business_orders")
      .insert({
        source, client_email, client_name, client_company,
        service_type, brief, budget_eur, deadline,
        payload, priority, n8n_workflow_id,
        ai_plan, status: ai_plan ? "planned" : "received",
      })
      .select()
      .single();
    if (error) throw error;

    await supabase.from("aurora_order_events").insert({
      order_id: order.id,
      event_type: "intake",
      message: ai_plan ? "Aurora zaplanowała zlecenie" : "Zlecenie odebrane (planowanie ręczne)",
      data: { ai_plan },
    });

    // 3) Auto-trigger n8n jeśli powiązany workflow
    if (n8n_workflow_id) {
      const { data: wf } = await supabase
        .from("aurora_n8n_workflows")
        .select("webhook_url, enabled, auto_assign")
        .eq("workflow_id", n8n_workflow_id)
        .maybeSingle();
      if (wf?.enabled && wf?.webhook_url && wf?.auto_assign) {
        try {
          const res = await fetch(wf.webhook_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order_id: order.id, brief, service_type, ai_plan, payload }),
          });
          await supabase.from("aurora_order_events").insert({
            order_id: order.id,
            event_type: "n8n_dispatched",
            message: `n8n webhook → ${res.status}`,
            data: { workflow_id: n8n_workflow_id, status: res.status },
          });
          await supabase.from("aurora_business_orders")
            .update({ status: "in_progress", started_at: new Date().toISOString() })
            .eq("id", order.id);
        } catch (e) {
          await supabase.from("aurora_order_events").insert({
            order_id: order.id, event_type: "n8n_error",
            message: String(e), data: {},
          });
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, order_id: order.id, ai_plan }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
