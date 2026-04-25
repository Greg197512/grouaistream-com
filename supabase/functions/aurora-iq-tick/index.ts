// Liczy bieżące IQ Aurory na podstawie sumy wiedzy, dialogów i jakości.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { count: factsCount } = await supabase.from("aurora_knowledge_base").select("*", { count: "exact", head: true });
    const { count: dlgCount } = await supabase.from("aurora_ai_dialogues").select("*", { count: "exact", head: true });
    const { data: iqRows } = await supabase.from("aurora_knowledge_base").select("iq_value, quality_score").limit(1000);
    const { data: gainRows } = await supabase.from("aurora_ai_dialogues").select("iq_gain").limit(1000);

    const factsIQ = (iqRows ?? []).reduce((s, r: any) => s + (Number(r.iq_value) || 0), 0);
    const dialogIQ = (gainRows ?? []).reduce((s, r: any) => s + (Number(r.iq_gain) || 0), 0);
    const avgQuality = (iqRows ?? []).length ? (iqRows!.reduce((s, r: any) => s + (Number(r.quality_score) || 0), 0) / iqRows!.length) : 0.5;

    const iqScore = Math.round(100 + factsIQ + dialogIQ);

    await supabase.from("aurora_iq_metrics").insert({
      iq_score: iqScore,
      facts_known: factsCount ?? 0,
      dialogues_completed: dlgCount ?? 0,
      avg_quality: avgQuality,
      notes: `auto-tick`,
    });

    return new Response(JSON.stringify({ ok: true, iq_score: iqScore, facts: factsCount, dialogues: dlgCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
