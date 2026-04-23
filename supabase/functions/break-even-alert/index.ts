import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Pobierz koszty MTD bezpośrednio
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const monthKey = monthStart.toISOString().slice(0, 10);

    const { data: costRows } = await supabase
      .from("monthly_cost_reports")
      .select("amount_eur")
      .eq("report_month", monthKey);

    const cost = (costRows ?? []).reduce(
      (s: number, r: { amount_eur: number }) => s + Number(r.amount_eur || 0),
      0
    );

    // Liczymy revenue: subskrypcje + tipy
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("product_id")
      .in("status", ["active", "trialing"])
      .eq("environment", "live");

    let activePro = 0;
    let activeUlt = 0;
    for (const s of subs ?? []) {
      const p = (s.product_id ?? "").toLowerCase();
      if (p.includes("ultimate")) activeUlt++;
      else if (p.includes("pro")) activePro++;
    }

    const now = new Date();
    const daysInMonth = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).getUTCDate();
    const dayOfMonth = now.getUTCDate();
    const prorate = dayOfMonth / daysInMonth;
    const subRevenue = (activePro * 4.99 + activeUlt * 9.99) * prorate;

    const { data: tips } = await supabase
      .from("tip_transactions")
      .select("platform_fee")
      .gte("created_at", monthStart.toISOString());

    const tipRevenue = (tips ?? []).reduce(
      (s: number, r: { platform_fee: number }) => s + Number(r.platform_fee || 0),
      0
    );

    const revenue = subRevenue + tipRevenue;
    const ratio = revenue > 0 ? (cost / revenue) * 100 : cost > 0 ? 9999 : 0;
    const gap = cost - revenue;

    let level: "warning" | "critical" | "emergency" | null = null;
    let message = "";

    if (ratio >= 150) {
      level = "emergency";
      message = `🚨 KRYTYCZNE: Koszty (${cost.toFixed(2)}€) to ${ratio.toFixed(0)}% przychodu (${revenue.toFixed(2)}€). Tracisz ${gap.toFixed(2)}€/mc. Wyłącz n8n, downgrade ElevenLabs, ogranicz Suno dla free.`;
    } else if (ratio >= 100) {
      level = "critical";
      message = `⚠️ STRATA: Koszty (${cost.toFixed(2)}€) przekraczają przychód (${revenue.toFixed(2)}€) o ${gap.toFixed(2)}€. Włącz paywall na Studio/AI DJ.`;
    } else if (ratio >= 80) {
      level = "warning";
      message = `🟡 OSTRZEŻENIE: Koszty na poziomie ${ratio.toFixed(0)}% przychodu. Zostało ${(revenue - cost).toFixed(2)}€ marży.`;
    }

    let alertId: string | null = null;
    if (level) {
      // Sprawdź czy już dziś nie wystawiono tego samego poziomu
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);

      const { data: existing } = await supabase
        .from("cost_alerts")
        .select("id")
        .eq("level", level)
        .gte("triggered_at", todayStart.toISOString())
        .is("dismissed_at", null)
        .maybeSingle();

      if (!existing) {
        const { data: inserted } = await supabase
          .from("cost_alerts")
          .insert({
            level,
            message,
            cost_amount: Number(cost.toFixed(2)),
            revenue_amount: Number(revenue.toFixed(2)),
            ratio_pct: Number(ratio.toFixed(1)),
          })
          .select("id")
          .single();
        alertId = inserted?.id ?? null;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        cost: Number(cost.toFixed(2)),
        revenue: Number(revenue.toFixed(2)),
        ratio_pct: Number(ratio.toFixed(1)),
        gap: Number(gap.toFixed(2)),
        level,
        alert_id: alertId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("break-even-alert error", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
