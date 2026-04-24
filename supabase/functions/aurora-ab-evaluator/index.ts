// Aurora A/B Evaluator — picks winning variants by z-test (p<0.10) over >=200 views/variant.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MIN_VIEWS = 200;
const Z_THRESHOLD = 1.645; // ~p<0.10 one-tailed

function zTest(c1: number, n1: number, c2: number, n2: number): number {
  const p1 = c1 / n1;
  const p2 = c2 / n2;
  const p = (c1 + c2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  if (se === 0) return 0;
  return Math.abs(p1 - p2) / se;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const decisions: any[] = [];

  try {
    const { data: variants } = await supabase
      .from("aurora_landing_variants")
      .select("*")
      .eq("is_winner", false);

    if (!variants?.length) {
      return new Response(JSON.stringify({ ok: true, evaluated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // group by landing_page_id
    const byLanding = new Map<string, any[]>();
    for (const v of variants) {
      const arr = byLanding.get(v.landing_page_id) || [];
      arr.push(v);
      byLanding.set(v.landing_page_id, arr);
    }

    for (const [lpId, vs] of byLanding) {
      if (vs.length < 2) continue;
      const eligible = vs.filter((v) => v.views >= MIN_VIEWS);
      if (eligible.length < 2) continue;

      // pick top by conversion rate
      eligible.sort((a, b) => b.conversions / Math.max(b.views, 1) - a.conversions / Math.max(a.views, 1));
      const top = eligible[0];
      const second = eligible[1];

      const z = zTest(top.conversions, top.views, second.conversions, second.views);
      if (z < Z_THRESHOLD) continue;

      // mark winner
      await supabase
        .from("aurora_landing_variants")
        .update({ is_winner: true, weight: 100 })
        .eq("id", top.id);

      // demote others on this landing
      for (const v of vs) {
        if (v.id === top.id) continue;
        await supabase
          .from("aurora_landing_variants")
          .update({ weight: 0 })
          .eq("id", v.id);
      }

      await supabase.from("aurora_compliance_log").insert({
        action_type: "ab_variant",
        reference_id: top.id,
        reference_table: "aurora_landing_variants",
        decision: "auto_approved",
        notes: `Winner ${top.variant_label} (z=${z.toFixed(2)}, conv=${((top.conversions / top.views) * 100).toFixed(2)}%)`,
      });

      decisions.push({ landing_page_id: lpId, winner: top.variant_label, z });
    }

    return new Response(JSON.stringify({ ok: true, decisions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ab eval error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
