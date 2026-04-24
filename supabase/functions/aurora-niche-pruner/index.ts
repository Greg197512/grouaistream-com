// Aurora Niche Pruner — archiwizuje słabo działające nisze
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
    // Reguły progowe (można później przenieść do tabeli reguł)
    const MIN_AGE_DAYS = 14;
    const MIN_VIEWS = 200;
    const MIN_CTR = 0.01; // 1%
    const MIN_REVENUE_PER_DAY = 0.05; // EUR

    const cutoff = new Date(Date.now() - MIN_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: niches, error } = await supabase
      .from("aurora_niches")
      .select("id, niche_name, launched_at, status")
      .eq("status", "launched")
      .lt("launched_at", cutoff);

    if (error) throw error;

    const pruned: any[] = [];

    for (const n of niches ?? []) {
      const { data: perf } = await supabase
        .from("aurora_metric_events")
        .select("event_type")
        .eq("niche_id", n.id);

      const views = perf?.filter((e: any) => e.event_type === "view").length ?? 0;
      const clicks = perf?.filter((e: any) => e.event_type === "click").length ?? 0;
      const leads = perf?.filter((e: any) => e.event_type === "lead").length ?? 0;
      const ctr = views > 0 ? clicks / views : 0;
      const ageDays = Math.max(1, (Date.now() - new Date(n.launched_at).getTime()) / 86400000);
      const revenuePerDay = (leads * 1.0) / ageDays; // szacunek 1 EUR/lead

      const failsViews = views < MIN_VIEWS;
      const failsCTR = views >= MIN_VIEWS && ctr < MIN_CTR;
      const failsRevenue = revenuePerDay < MIN_REVENUE_PER_DAY;

      if (failsViews || failsCTR || failsRevenue) {
        const reason = failsCTR ? "low_ctr" : failsRevenue ? "low_revenue" : "low_traffic";
        await supabase.from("aurora_niches").update({ status: "archived" }).eq("id", n.id);
        await supabase.from("aurora_niche_prune_log").insert({
          niche_id: n.id,
          reason,
          metrics: { views, clicks, ctr, leads, revenuePerDay, ageDays },
          action: "archived",
        });
        pruned.push({ id: n.id, name: n.niche_name, reason });
      }
    }

    return new Response(JSON.stringify({ ok: true, pruned_count: pruned.length, pruned }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
