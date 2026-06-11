// Marketing Autopilot — autonomiczna dystrybucja treści promocyjnych.
// 1) Wybiera świeże treści do promocji (blog / landing pages)
// 2) Generuje AI copy dla każdej platformy (X, Facebook, Instagram, TikTok, LinkedIn)
// 3) Dodaje brief graficzny dla Canva i skrypt audio dla ElevenLabs
// 4) Wysyła pakiet do n8n (workflow "social-distribution") przez aurora-n8n-trigger
// 5) Loguje wszystko w marketing_dispatches
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;

const SITE_URL = "https://grouaistream.com";
const MODEL = "google/gemma-2-9b-it:free";
const MAX_DISPATCHES_PER_RUN = 3;

async function generateSocialPack(title: string, description: string, url: string) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are the marketing engine of GrouAI Stream (grouaistream.com) — an AI music streaming platform with radio, AI DJ, mood playlists and a creator earnings program. Write engaging, natural social media copy. Polish language for Facebook, English for the rest. No AI clichés, no spam vibes. Return STRICT JSON only.",
        },
        {
          role: "user",
          content: `Create a social media promotion pack for this content:
TITLE: ${title}
DESCRIPTION: ${description}
URL: ${url}

Return JSON with exactly these keys:
{
  "twitter_post": "max 260 chars, 2-3 hashtags, include URL",
  "facebook_post": "po polsku, 2-3 zdania + link",
  "instagram_caption": "engaging caption, 5 hashtags",
  "tiktok_script": "15-second video script, hook in first 2 seconds",
  "linkedin_post": "professional angle, 2 short paragraphs",
  "hashtags": ["array", "of", "6", "hashtags"],
  "canva_brief": { "headline": "max 6 words", "subheadline": "max 12 words", "cta": "max 4 words" },
  "audio_promo_script": "20-second radio spot script in Polish, friendly tone"
}`,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content);
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("AI returned no JSON");
    return JSON.parse(m[0]);
  }
}

async function dispatchToN8n(payload: Record<string, unknown>): Promise<{ ok: boolean; detail: string }> {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/aurora-n8n-trigger`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({
      workflow_id: "social-distribution",
      trigger_source: "marketing-autopilot",
      payload,
    }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) return { ok: false, detail: data?.error || `status ${resp.status}` };
  return { ok: true, detail: "dispatched" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const summary: Record<string, unknown> = { started_at: new Date().toISOString() };

  try {
    // 1. Świeże posty bloga z ostatnich 24h, jeszcze nie promowane
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: freshPosts } = await supabase
      .from("seo_blog_posts")
      .select("id, title, slug, description, created_at")
      .eq("is_published", true)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10);

    const { data: alreadyDispatched } = await supabase
      .from("marketing_dispatches")
      .select("content_ref")
      .gte("created_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString());

    const dispatchedRefs = new Set((alreadyDispatched || []).map((d: any) => d.content_ref));
    let candidates = (freshPosts || []).filter((p: any) => !dispatchedRefs.has(`blog:${p.id}`));

    // 2. Fallback: brak świeżych treści → re-promocja evergreen posta
    if (candidates.length === 0) {
      const { data: evergreen } = await supabase
        .from("seo_blog_posts")
        .select("id, title, slug, description, created_at")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(30);
      candidates = (evergreen || []).filter((p: any) => !dispatchedRefs.has(`blog:${p.id}`)).slice(0, 1);
    }

    candidates = candidates.slice(0, MAX_DISPATCHES_PER_RUN);
    summary.candidates = candidates.length;

    const results: any[] = [];
    for (const post of candidates) {
      const url = `${SITE_URL}/blog/${post.slug}`;
      try {
        const pack = await generateSocialPack(post.title, post.description || "", url);

        const dispatchPayload = {
          content_type: "blog_post",
          title: post.title,
          url,
          site: SITE_URL,
          social: pack,
          generated_at: new Date().toISOString(),
        };

        const n8n = await dispatchToN8n(dispatchPayload);

        await supabase.from("marketing_dispatches").insert({
          content_type: "blog_post",
          content_ref: `blog:${post.id}`,
          title: post.title,
          url,
          social_payload: pack,
          status: n8n.ok ? "dispatched" : "queued",
          dispatched_at: n8n.ok ? new Date().toISOString() : null,
          error: n8n.ok ? null : n8n.detail,
        });

        results.push({ title: post.title, dispatched: n8n.ok, detail: n8n.detail });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "unknown";
        await supabase.from("marketing_dispatches").insert({
          content_type: "blog_post",
          content_ref: `blog:${post.id}`,
          title: post.title,
          url,
          status: "error",
          error: msg,
        });
        results.push({ title: post.title, dispatched: false, detail: msg });
      }
    }

    summary.results = results;
    summary.finished_at = new Date().toISOString();

    await supabase
      .from("agent_registry")
      .update({ last_run_at: new Date().toISOString(), last_status: "ok" })
      .eq("name", "marketing-autopilot");

    return new Response(JSON.stringify({ ok: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("marketing-autopilot error", e);
    await supabase
      .from("agent_registry")
      .update({ last_run_at: new Date().toISOString(), last_status: "error", last_error: msg })
      .eq("name", "marketing-autopilot");
    return new Response(JSON.stringify({ error: msg, summary }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
