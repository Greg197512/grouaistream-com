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
    const { data: claims, error: claimsErr } = await supabaseAuth.auth.getClaims(auth.replace("Bearer ", ""));
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    // Verify admin role
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", claims.claims.sub)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settings } = await supabase
      .from("aurora_r2_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    const costPerGb = Number(settings?.cost_per_gb_eur ?? 0.0135);
    const margin = Number(settings?.margin_percent ?? 60) / 100;

    const { data: usage } = await supabase
      .from("aurora_storage_client_usage")
      .select("*")
      .order("storage_used_bytes", { ascending: false });

    const { data: plans } = await supabase
      .from("aurora_storage_plans")
      .select("*")
      .eq("active", true)
      .order("storage_gb", { ascending: true });

    const enriched = (usage || []).map((u: any) => {
      const usedGb = Number(u.storage_used_gb || 0);
      const projectedGb = Math.ceil(usedGb * 1.3); // 30% growth headroom
      const r2Cost = usedGb * costPerGb;
      const planRevenue = Number(u.plan_price_eur || 0);
      const realMargin = planRevenue - r2Cost;
      const usagePct = Number(u.usage_percent || 0);

      // Suggest upsell if usage > 75%
      let suggested = null;
      if (usagePct > 75 && plans) {
        const upgrade = plans.find((p: any) => p.storage_gb > Number(u.plan_storage_gb));
        if (upgrade) {
          suggested = {
            plan_code: upgrade.code,
            plan_name: upgrade.name,
            storage_gb: upgrade.storage_gb,
            price_eur: Number(upgrade.price_eur),
            paddle_price_id: upgrade.paddle_price_id,
            reason: `Klient zużył ${usagePct.toFixed(1)}% planu (${usedGb.toFixed(2)} z ${u.plan_storage_gb} GB). Sugeruj upgrade do ${upgrade.name}.`,
          };
        }
      }

      return {
        ...u,
        projected_usage_gb: projectedGb,
        r2_real_cost_eur: Number(r2Cost.toFixed(4)),
        plan_margin_eur: Number(realMargin.toFixed(2)),
        suggested_upgrade: suggested,
      };
    });

    const summary = {
      total_clients: enriched.length,
      total_used_gb: Number(enriched.reduce((s, u) => s + Number(u.storage_used_gb || 0), 0).toFixed(3)),
      total_revenue_eur: Number(enriched.reduce((s, u) => s + Number(u.plan_price_eur || 0), 0).toFixed(2)),
      total_r2_cost_eur: Number(enriched.reduce((s, u) => s + Number(u.r2_real_cost_eur || 0), 0).toFixed(2)),
      total_margin_eur: Number(enriched.reduce((s, u) => s + Number(u.plan_margin_eur || 0), 0).toFixed(2)),
      upsell_candidates: enriched.filter((u) => u.suggested_upgrade).length,
      avg_margin_percent: margin * 100,
    };

    return new Response(JSON.stringify({ summary, clients: enriched, plans, settings }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("aurora-storage-usage-report error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
