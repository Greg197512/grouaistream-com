// Marketing Autopilot — autonomiczna dystrybucja treści promocyjnych.
// 1) Wybiera świeże posty bloga (lub evergreen fallback) jeszcze nie promowane
// 2) Generuje AI copy dla każdej platformy (X, Facebook, Instagram, TikTok, LinkedIn)
//    + brief Canva + skrypt ElevenLabs — przez Lovable AI Gateway (Gemini)
// 3) Zapisuje wynik w marketing_posts
// 4) Wysyła pakiet do n8n (jeden webhook → n8n rozsyła na X/FB/IG/TT/LI)
//    URL z admin_settings.n8n_webhook_url (fallback: aurora_n8n_workflows."social-distribution")
// 5) Loguje wszystko w marketing_logs
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const SITE_URL = "https://grouaistream.com";
const MODEL = "google/gemini-2.5-flash";
const MAX_DISPATCHES_PER_RUN = 3;

async function generateSocialPack(title: string, description: string, url: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
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
    if (res.status === 429) throw new Error("AI rate limit (429) — try again later");
    if (res.status === 402) throw new Error("AI credits exhausted (402) — top up Lovable AI credits");
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

async function resolveN8nWebhook(supabase: any): Promise<string | null> {
  // 1) preferred: aurora_n8n_workflows row for social-distribution
  const { data: wf } = await supabase
    .from("aurora_n8n_workflows")
    .select("webhook_url, enabled")
    .eq("workflow_id", "social-distribution")
    .maybeSingle();
  if (wf?.enabled && wf?.webhook_url) return wf.webhook_url;

  // 2) fallback: global admin_settings.n8n_webhook_url
  const { data: s } = await supabase
    .from("admin_settings")
    .select("n8n_webhook_url")
    .eq("id", 1)
    .maybeSingle();
  return s?.n8n_webhook_url || null;
}

async function dispatchToN8n(webhookUrl: string, payload: Record<string, unknown>) {
  const resp = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await resp.text().catch(() => "");
  return { ok: resp.ok, status: resp.status, body: text.slice(0, 500) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const summary: Record<string, unknown> = { started_at: new Date().toISOString() };

  try {
    const webhookUrl = await resolveN8nWebhook(supabase);
    summary.n8n_webhook_configured = !!webhookUrl;

    // 1. Świeże posty bloga z ostatnich 24h
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: freshPosts } = await supabase
      .from("seo_blog_posts")
      .select("id, title, slug, description, created_at")
      .eq("is_published", true)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10);

    // Już promowane w ciągu ostatnich 7 dni
    const { data: recentPosts } = await supabase
      .from("marketing_posts")
      .select("titles")
      .gte("created_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString());

    const dispatchedTitles = new Set<string>();
    for (const p of recentPosts || []) {
      for (const t of p.titles || []) dispatchedTitles.add(t);
    }

    let candidates = (freshPosts || []).filter((p: any) => !dispatchedTitles.has(p.title));

    // 2. Fallback: brak świeżych → evergreen
    if (candidates.length === 0) {
      const { data: evergreen } = await supabase
        .from("seo_blog_posts")
        .select("id, title, slug, description, created_at")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(30);
      candidates = (evergreen || [])
        .filter((p: any) => !dispatchedTitles.has(p.title))
        .slice(0, 1);
    }

    candidates = candidates.slice(0, MAX_DISPATCHES_PER_RUN);
    summary.candidates = candidates.length;

    const results: any[] = [];
    for (const post of candidates) {
      const url = `${SITE_URL}/blog/${post.slug}`;
      try {
        const pack = await generateSocialPack(post.title, post.description || "", url);

        const platforms = ["x", "facebook", "instagram", "tiktok", "linkedin"];
        const contentText = [
          pack.twitter_post,
          pack.facebook_post,
          pack.instagram_caption,
          pack.tiktok_script,
          pack.linkedin_post,
        ].filter(Boolean).join("\n\n---\n\n");

        // zapisz w marketing_posts
        const { data: mp } = await supabase
          .from("marketing_posts")
          .insert({
            content_text: contentText,
            captions: pack,
            titles: [post.title],
            platforms,
            status: webhookUrl ? "publishing" : "generated",
          })
          .select("id")
          .single();

        const dispatchPayload = {
          marketing_post_id: mp?.id,
          content_type: "blog_post",
          title: post.title,
          url,
          site: SITE_URL,
          social: pack,
          platforms,
          generated_at: new Date().toISOString(),
        };

        let dispatch: { ok: boolean; status: number; body: string } | null = null;
        if (webhookUrl) {
          dispatch = await dispatchToN8n(webhookUrl, dispatchPayload);
        }

        await supabase.from("marketing_logs").insert({
          post_id: mp?.id,
          action: webhookUrl ? "dispatch_n8n" : "queued_no_webhook",
          api_payload: dispatchPayload as any,
          response: dispatch as any,
          next_action: webhookUrl && !dispatch?.ok ? "retry" : null,
        });

        if (mp?.id) {
          await supabase
            .from("marketing_posts")
            .update({
              status: webhookUrl && dispatch?.ok ? "published" : (webhookUrl ? "failed" : "generated"),
              published_at: webhookUrl && dispatch?.ok ? new Date().toISOString() : null,
            })
            .eq("id", mp.id);
        }

        results.push({
          title: post.title,
          marketing_post_id: mp?.id,
          dispatched: !!dispatch?.ok,
          status: dispatch?.status ?? null,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "unknown";
        await supabase.from("marketing_logs").insert({
          action: "error",
          response: { title: post.title, error: msg } as any,
        });
        results.push({ title: post.title, dispatched: false, error: msg });
      }
    }

    summary.results = results;
    summary.finished_at = new Date().toISOString();

    await supabase
      .from("agent_registry")
      .upsert({ name: "marketing-autopilot", last_run_at: new Date().toISOString(), last_status: "ok" }, { onConflict: "name" });

    return new Response(JSON.stringify({ ok: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("marketing-autopilot error", e);
    await supabase
      .from("agent_registry")
      .upsert({ name: "marketing-autopilot", last_run_at: new Date().toISOString(), last_status: "error", last_error: msg }, { onConflict: "name" });
    return new Response(JSON.stringify({ error: msg, summary }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
