import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_ANON_KEY"),
      { global: { headers: { Authorization: auth } } },
    );
    const { data: claims } = await supabaseAuth.auth.getClaims(auth.replace("Bearer ", ""));
    const userId = claims?.claims?.sub;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const { data: roleRow } = await supabase
      .from("user_roles").select("role")
      .eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const {
      client_email,
      client_company,
      plan_code,
      current_usage_gb = 0,
      projected_usage_gb,
      rationale,
      expires_in_days = 14,
    } = body;

    if (!client_email || !plan_code) {
      return new Response(JSON.stringify({ error: "client_email and plan_code required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: plan } = await supabase
      .from("aurora_storage_plans")
      .select("*")
      .eq("code", plan_code)
      .maybeSingle();

    if (!plan) {
      return new Response(JSON.stringify({ error: "Plan not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settings } = await supabase
      .from("aurora_r2_settings").select("cost_per_gb_eur").limit(1).maybeSingle();
    const costPerGb = Number(settings?.cost_per_gb_eur ?? 0.0135);
    const r2Cost = (Number(projected_usage_gb || current_usage_gb) || 0) * costPerGb;
    const margin = Number(plan.price_eur) - r2Cost;

    const expiresAt = new Date(Date.now() + Number(expires_in_days) * 86400000).toISOString();

    const { data: offer, error } = await supabase
      .from("aurora_storage_offers")
      .insert({
        client_email,
        client_company,
        recommended_plan_code: plan_code,
        current_usage_gb,
        projected_usage_gb: projected_usage_gb || current_usage_gb,
        monthly_price_eur: plan.price_eur,
        margin_eur: Number(margin.toFixed(2)),
        rationale: rationale || `Aurora rekomenduje plan ${plan.name} (${plan.storage_gb}GB) — przewidywane zużycie ${projected_usage_gb || current_usage_gb}GB.`,
        status: "draft",
        expires_at: expiresAt,
        metadata: { paddle_price_id: plan.paddle_price_id, generated_by: "aurora" },
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ offer }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("aurora-storage-offer-create error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
