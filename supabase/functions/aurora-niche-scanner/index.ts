// Aurora Niche Scanner — autonomous discovery of profitable micro-niches
// outside of music. Uses Lovable AI + light web signals to propose ventures.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;

// Seed categories Aurora may explore (NOT music — separate revenue universe)
const EXPLORATION_SEEDS = [
  "AI productivity tools for solopreneurs",
  "digital wellness & sleep optimization",
  "remote work gear curation",
  "indie hacker SaaS micro-tools",
  "pet tech & training apps",
  "sustainable home swaps",
  "language learning micro-courses",
  "no-code automation templates",
  "small business compliance helpers (EU)",
  "personal finance for freelancers",
  "AI-generated print-on-demand niches",
  "newsletter curation in underserved verticals",
  "directory sites for emerging professions",
  "boring B2B Chrome extensions",
  "evergreen recipe & meal-plan micro-sites",
  "hobby gear comparison sites (woodworking, knitting, 3D printing)",
];

const SCANNER_TOOL = {
  type: "function",
  function: {
    name: "report_niches",
    description: "Report 3-5 profitable, low-effort micro-niches Aurora can launch autonomously.",
    parameters: {
      type: "object",
      properties: {
        niches: {
          type: "array",
          items: {
            type: "object",
            properties: {
              niche_name: { type: "string", description: "Sharp, specific niche name (e.g. 'AI meeting summarizer for freelance lawyers')" },
              category: { type: "string" },
              description: { type: "string" },
              target_audience: { type: "string" },
              search_volume_estimate: { type: "number", description: "Rough monthly search volume estimate" },
              competition_level: { type: "string", enum: ["low", "medium", "high"] },
              monetization_methods: {
                type: "array",
                items: { type: "string" },
                description: "e.g. 'affiliate', 'display ads', 'paid newsletter', 'digital download', 'lead-gen', 'sponsored posts'"
              },
              estimated_monthly_revenue_eur: { type: "number" },
              confidence_score: { type: "number", description: "0..1" },
              effort_score: { type: "number", description: "1=easy 10=hard" },
              legal_risk: { type: "string", enum: ["low", "medium", "high"] },
              domain_suggestions: { type: "array", items: { type: "string" } },
              content_pillars: { type: "array", items: { type: "string" }, description: "5-8 SEO content cluster topics" },
              first_actions: { type: "array", items: { type: "string" }, description: "Concrete first 5 actions to launch" },
            },
            required: ["niche_name", "category", "description", "monetization_methods", "estimated_monthly_revenue_eur", "confidence_score", "first_actions"],
            additionalProperties: false,
          },
        },
      },
      required: ["niches"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Pick 3 random seeds to explore this run
    const shuffled = [...EXPLORATION_SEEDS].sort(() => Math.random() - 0.5).slice(0, 3);

    // Avoid duplicates: fetch existing niche names
    const { data: existing } = await supabase
      .from("aurora_niches")
      .select("niche_name")
      .order("discovered_at", { ascending: false })
      .limit(80);
    const existingNames = (existing || []).map((n: any) => n.niche_name).join(", ");

    const systemPrompt = `You are Aurora — the autonomous business intelligence of GrouAI Stream.
Your task: scan the open web and your training knowledge for SHARP, MONETIZABLE micro-niches OUTSIDE of music/audio.
Optimize for:
- Low competition, evergreen demand
- Solopreneur-friendly: launchable as a static site / newsletter / digital download / Chrome extension
- LEGAL & ETHICAL only. Reject anything grey-area.
- Realistic monthly revenue 50–2000€ within 90 days
- Avoid niches we already discovered: ${existingNames || "(none yet)"}
Be ruthless. Better 3 sharp niches than 5 vague ones.`;

    const userPrompt = `Today explore these seed directions and propose 3-5 micro-niches we could launch THIS WEEK:
${shuffled.map((s, i) => `${i + 1}. ${s}`).join("\n")}

For each: name it sharply, estimate revenue, list monetization paths, suggest 2-3 .com domains, list 5-8 SEO pillars, and give 5 first concrete actions a fully autonomous AI could execute.`;

    const aiResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemma-2-9b-it:free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [SCANNER_TOOL],
        tool_choice: { type: "function", function: { name: "report_niches" } },
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "credits_exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      console.error("AI gateway error", aiResp.status, txt);
      throw new Error(`AI gateway ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI returned no tool call");
    const args = JSON.parse(toolCall.function.arguments);
    const niches = args.niches || [];

    // Insert each niche
    const rows = niches.map((n: any) => ({
      niche_name: n.niche_name,
      category: n.category || "general",
      description: n.description || null,
      target_audience: n.target_audience || null,
      search_volume_estimate: Math.round(n.search_volume_estimate || 0),
      competition_level: n.competition_level || "unknown",
      monetization_methods: n.monetization_methods || [],
      estimated_monthly_revenue_eur: Number(n.estimated_monthly_revenue_eur || 0).toFixed(2),
      confidence_score: Math.min(1, Math.max(0, Number(n.confidence_score || 0))).toFixed(2),
      effort_score: Math.min(10, Math.max(1, Math.round(n.effort_score || 5))),
      legal_risk: n.legal_risk || "low",
      domain_suggestions: n.domain_suggestions || [],
      content_pillars: n.content_pillars || [],
      first_actions: n.first_actions || [],
      market_signals: { seeds_explored: shuffled, ai_model: "gemini-2.5-pro" },
      status: "discovered",
    }));

    const { data: inserted, error: insErr } = await supabase
      .from("aurora_niches")
      .insert(rows)
      .select();

    if (insErr) throw insErr;

    return new Response(
      JSON.stringify({ ok: true, count: inserted?.length || 0, niches: inserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("aurora-niche-scanner error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
