// Aurora Order Execute — Aurora wykonuje zlecenie autonomicznie (SEO content / audit / landing)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

async function aiCall(system: string, user: string, json = true): Promise<any> {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}`);
  const j = await res.json();
  const content = j.choices?.[0]?.message?.content ?? "";
  return json ? JSON.parse(content) : content;
}

async function executeService(serviceType: string, brief: string, payload: any) {
  switch (serviceType) {
    case "seo_audit":
      return aiCall(
        "Jesteś senior SEO konsultantem. Wykonaj audyt SEO. Zwróć JSON: {score (0-100), issues:[{severity,title,fix}], opportunities:[], action_plan:[]}.",
        `Brief: ${brief}\nDane: ${JSON.stringify(payload)}`,
      );
    case "seo_content":
      return aiCall(
        "Tworzysz artykuł SEO 1000-1500 słów. Zwróć JSON: {title, meta_description, h1, sections:[{heading,body}], faq:[{q,a}], internal_links_suggestions:[]}.",
        `Brief: ${brief}`,
      );
    case "landing_page":
      return aiCall(
        "Projektujesz landing page wysokiej konwersji. Zwróć JSON: {hero:{headline,subheadline,cta}, problem, solution, features:[{title,desc}], social_proof, faq:[{q,a}], final_cta}.",
        `Brief: ${brief}`,
      );
    case "social_post":
      return aiCall(
        "Tworzysz pakiet 7 postów social media. Zwróć JSON: {posts:[{platform,hook,body,hashtags:[],cta}]}.",
        `Brief: ${brief}`,
      );
    case "lead_research":
      return aiCall(
        "Badasz rynek pod leady B2B. Zwróć JSON: {ideal_customer_profile, segments:[{name,size,pain}], outreach_angles:[], sample_emails:[]}.",
        `Brief: ${brief}`,
      );
    case "automation_flow":
      return aiCall(
        "Projektujesz automatyzację n8n. Zwróć JSON: {trigger, nodes:[{type,name,purpose}], variables:[], expected_outcome, eta_minutes}.",
        `Brief: ${brief}`,
      );
    default:
      return aiCall(
        "Wykonaj zlecenie według briefu. Zwróć JSON: {summary, deliverables:[], next_steps:[]}.",
        brief,
      );
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { order_id } = await req.json();
    if (!order_id) throw new Error("order_id required");

    const { data: order, error } = await supabase
      .from("aurora_business_orders")
      .select("*")
      .eq("id", order_id)
      .single();
    if (error || !order) throw new Error("Order not found");

    await supabase.from("aurora_business_orders")
      .update({ status: "in_progress", started_at: order.started_at ?? new Date().toISOString() })
      .eq("id", order_id);

    await supabase.from("aurora_order_events").insert({
      order_id, event_type: "execute_started", message: `Aurora zaczyna: ${order.service_type}`,
    });

    let result: any;
    try {
      result = await executeService(order.service_type, order.brief, order.payload);
    } catch (e) {
      await supabase.from("aurora_business_orders")
        .update({ status: "failed", notes: String(e) })
        .eq("id", order_id);
      await supabase.from("aurora_order_events").insert({
        order_id, event_type: "execute_failed", message: String(e),
      });
      throw e;
    }

    await supabase.from("aurora_business_orders")
      .update({ status: "completed", result, completed_at: new Date().toISOString() })
      .eq("id", order_id);

    await supabase.from("aurora_order_events").insert({
      order_id, event_type: "execute_completed",
      message: "Zlecenie ukończone autonomicznie", data: { keys: Object.keys(result ?? {}) },
    });

    return new Response(JSON.stringify({ ok: true, order_id, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
