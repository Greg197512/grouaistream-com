// Aurora Autopilot — fully autonomous business loop.
// 1) Ensures fresh niches exist (calls scanner if needed)
// 2) Auto-launches top niches matching admin thresholds
// 3) Auto-publishes pending SEO posts as live blog articles
// 4) Logs a summary into aurora_autopilot_settings.last_run_summary
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 70);
}

const RISK_RANK: Record<string, number> = { low: 1, medium: 2, high: 3 };

const POST_TOOL = {
  type: "function",
  function: {
    name: "write_post",
    description: "Write a full SEO blog post.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "<60 chars, includes keyword" },
        description: { type: "string", description: "<160 chars meta description" },
        content_markdown: { type: "string", description: "800-1300 words, markdown, with H2 headings, lists, useful and original" },
        category: { type: "string" },
        tags: { type: "array", items: { type: "string" }, maxItems: 6 },
      },
      required: ["title", "description", "content_markdown", "category", "tags"],
      additionalProperties: false,
    },
  },
};

async function callAuroraScanner(): Promise<number> {
  // Reuse the same scanner edge function via internal HTTP
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/aurora-niche-scanner`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ trigger: "autopilot" }),
  });
  if (!resp.ok) return 0;
  const data = await resp.json().catch(() => ({}));
  return Number(data?.count || 0);
}

async function callAuroraLaunch(niche_id: string): Promise<{ ok: boolean; url?: string; err?: string }> {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/aurora-launch-niche`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ niche_id }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) return { ok: false, err: data?.error || `status ${resp.status}` };
  return { ok: true, url: data?.url };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const summary: any = { started_at: new Date().toISOString(), steps: [] };

  try {
    // 1. Load settings
    const { data: settings } = await supabase
      .from("aurora_autopilot_settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (!settings || !settings.enabled) {
      return new Response(JSON.stringify({ ok: true, skipped: "autopilot_disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Ensure niches exist (top up if discovered < 3)
    const { count: discoveredCount } = await supabase
      .from("aurora_niches")
      .select("*", { count: "exact", head: true })
      .eq("status", "discovered");

    if ((discoveredCount || 0) < 3) {
      const created = await callAuroraScanner();
      summary.steps.push({ step: "scanner", created });
    }

    // 3. Pick & launch top niches matching thresholds
    const maxRisk = RISK_RANK[settings.max_legal_risk] || 1;
    const { data: candidates } = await supabase
      .from("aurora_niches")
      .select("*")
      .eq("status", "discovered")
      .gte("confidence_score", settings.min_confidence)
      .gte("estimated_monthly_revenue_eur", settings.min_revenue_eur)
      .lte("effort_score", settings.max_effort_score)
      .order("estimated_monthly_revenue_eur", { ascending: false })
      .limit(20);

    const eligible = (candidates || []).filter((n: any) => (RISK_RANK[n.legal_risk] || 99) <= maxRisk);
    const toLaunch = eligible.slice(0, settings.max_niches_per_day);

    const launchResults: any[] = [];
    for (const n of toLaunch) {
      const r = await callAuroraLaunch(n.id);
      launchResults.push({ niche: n.niche_name, ...r });
    }
    summary.steps.push({ step: "launch", attempted: toLaunch.length, results: launchResults });

    // 4. Auto-publish pending SEO posts as real blog articles
    let postsPublished = 0;
    if (settings.auto_publish_seo_posts) {
      const { data: pendingSeo } = await supabase
        .from("aurora_revenue_actions")
        .select("*")
        .eq("status", "proposed")
        .eq("action_type", "seo_post")
        .order("created_at", { ascending: true })
        .limit(settings.max_seo_posts_per_day);

      for (const action of pendingSeo || []) {
        try {
          const postTitle = action?.payload?.post_title || action.title;
          const niche = action?.payload?.niche_slug || "general";
          const keywords: string[] = action?.payload?.affiliate_keywords || [];

          const aiResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemma-2-9b-it:free",
              messages: [
                {
                  role: "system",
                  content: "You are Aurora — an SEO writer who delivers genuinely useful, original articles. No fluff, no AI clichés. Use H2 sections, short paragraphs, lists where helpful. Add 1-2 natural mentions of provided keywords.",
                },
                {
                  role: "user",
                  content: `Write a complete SEO blog post.
TITLE SEED: "${postTitle}"
NICHE: ${niche}
SUGGESTED KEYWORDS: ${keywords.join(", ") || "(none)"}
LENGTH: 900-1200 words.
TONE: confident, practical, evergreen.`,
                },
              ],
              tools: [POST_TOOL],
              tool_choice: { type: "function", function: { name: "write_post" } },
            }),
          });

          if (!aiResp.ok) {
            const txt = await aiResp.text();
            console.error("AI post-gen failed", aiResp.status, txt);
            continue;
          }
          const aiData = await aiResp.json();
          const tc = aiData?.choices?.[0]?.message?.tool_calls?.[0];
          if (!tc) continue;
          const post = JSON.parse(tc.function.arguments);

          const slug = `${slugify(post.title)}-${Date.now().toString(36).slice(-4)}`;
          const insertRes = await supabase.from("seo_blog_posts").insert({
            title: post.title,
            slug,
            description: post.description,
            content: post.content_markdown,
            category: post.category || "General",
            tags: post.tags || [],
            is_published: true,
            generated_by_ai: true,
          }).select("id, slug").single();

          if (insertRes.error) {
            console.error("blog insert error", insertRes.error);
            continue;
          }

          const publishedUrl = `/blog/${insertRes.data.slug}`;
          await supabase
            .from("aurora_revenue_actions")
            .update({ status: "published", published_url: publishedUrl })
            .eq("id", action.id);

          postsPublished++;
        } catch (e) {
          console.error("post publish loop error", e);
        }
      }
    }
    summary.steps.push({ step: "seo_publish", published: postsPublished });

    summary.finished_at = new Date().toISOString();

    await supabase
      .from("aurora_autopilot_settings")
      .update({ last_run_at: new Date().toISOString(), last_run_summary: summary, updated_at: new Date().toISOString() })
      .eq("id", 1);

    return new Response(JSON.stringify({ ok: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("autopilot error", e);
    summary.error = e instanceof Error ? e.message : "unknown";
    await supabase
      .from("aurora_autopilot_settings")
      .update({ last_run_at: new Date().toISOString(), last_run_summary: summary })
      .eq("id", 1);
    return new Response(JSON.stringify({ error: summary.error, summary }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
