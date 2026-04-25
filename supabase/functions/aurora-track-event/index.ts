// Aurora Track Event — public endpoint for landing page metrics (view/click/lead/revenue).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const event_type = body.event_type;
    if (!["view", "click", "lead", "revenue"].includes(event_type)) {
      return new Response(JSON.stringify({ error: "invalid_event_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Optimistic counter on variant
    if (body.variant_id && (event_type === "view" || event_type === "click" || event_type === "lead")) {
      const col = event_type === "view" ? "views" : event_type === "click" ? "clicks" : "conversions";
      try { await supabase.rpc("execute_increment_variant", { _variant: body.variant_id, _col: col }); } catch { /* ignore */ }
      // fallback: direct update
      const { data: v } = await supabase
        .from("aurora_landing_variants")
        .select(col)
        .eq("id", body.variant_id)
        .maybeSingle();
      if (v) {
        await supabase
          .from("aurora_landing_variants")
          .update({ [col]: (v as any)[col] + 1 })
          .eq("id", body.variant_id);
      }
    }

    const { error } = await supabase.from("aurora_metric_events").insert({
      niche_id: body.niche_id || null,
      landing_page_id: body.landing_page_id || null,
      variant_id: body.variant_id || null,
      event_type,
      amount_eur: body.amount_eur || null,
      session_id: (body.session_id || "").slice(0, 100),
      referrer: (body.referrer || "").slice(0, 500),
      country: (body.country || "").slice(0, 5),
    });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("track event error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
