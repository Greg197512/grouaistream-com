// Aurora Launch Niche — converts a discovered niche into a live landing page
// at /n/<slug> and seeds 5 SEO post proposals tied to it.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

const LAUNCH_TOOL = {
  type: "function",
  function: {
    name: "launch_niche",
    description: "Generate a full launch package for a niche.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Page title (60 chars max, includes keyword)" },
        meta_description: { type: "string", description: "Under 160 chars" },
        hero_headline: { type: "string" },
        hero_subheadline: { type: "string" },
        cta_text: { type: "string" },
        sections: {
          type: "array",
          description: "4-6 content sections for the landing page",
          items: {
            type: "object",
            properties: {
              heading: { type: "string" },
              body: { type: "string", description: "100-200 words per section" },
            },
            required: ["heading", "body"],
            additionalProperties: false,
          },
        },
        affiliate_keywords: { type: "array", items: { type: "string" } },
        seo_post_titles: { type: "array", items: { type: "string" }, description: "5 SEO blog post titles" },
      },
      required: ["title", "meta_description", "hero_headline", "hero_subheadline", "cta_text", "sections", "seo_post_titles"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { niche_id } = await req.json();
    if (!niche_id) throw new Error("niche_id required");

    const { data: niche, error: nErr } = await supabase
      .from("aurora_niches")
      .select("*")
      .eq("id", niche_id)
      .single();
    if (nErr || !niche) throw new Error("niche not found");

    if (niche.status === "launched") {
      return new Response(JSON.stringify({ ok: true, already: true, url: niche.launched_url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: "You are Aurora — premium copywriter & SEO strategist. Output: conversion-grade, original, emotionally resonant. Match niche language (English unless niche is local-language).",
          },
          {
            role: "user",
            content: `Launch this niche as a live landing page:
NAME: ${niche.niche_name}
CATEGORY: ${niche.category}
AUDIENCE: ${niche.target_audience || "n/a"}
DESCRIPTION: ${niche.description}
MONETIZATION: ${(niche.monetization_methods || []).join(", ")}
PILLARS: ${(niche.content_pillars || []).join(", ")}

Produce: SEO title, meta description, hero, 4-6 deep content sections, CTA, and 5 SEO blog post titles for the content cluster.`,
          },
        ],
        tools: [LAUNCH_TOOL],
        tool_choice: { type: "function", function: { name: "launch_niche" } },
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("AI gateway error", aiResp.status, txt);
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "credits_exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI returned no tool call");
    const pkg = JSON.parse(toolCall.function.arguments);

    const slug = slugify(niche.niche_name);
    const launchUrl = `/n/${slug}`;

    // Upsert into aurora_landing_pages with the schema we have
    const { error: lpErr } = await supabase
      .from("aurora_landing_pages")
      .upsert(
        {
          slug,
          niche: niche.niche_name,
          title: pkg.title,
          meta_description: pkg.meta_description,
          hero_headline: pkg.hero_headline,
          hero_subheadline: pkg.hero_subheadline,
          sections: pkg.sections || [],
          cta_text: pkg.cta_text || "Dowiedz się więcej",
          cta_url: "/",
          status: "live",
        },
        { onConflict: "slug" }
      );

    if (lpErr) {
      console.error("landing page upsert error", lpErr);
    }

    // Seed 5 SEO post proposals tied to this niche
    const seoActions = (pkg.seo_post_titles || []).slice(0, 5).map((title: string) => ({
      action_type: "seo_post",
      title: `[${niche.niche_name}] ${title}`,
      summary: `SEO content cluster for niche '${niche.niche_name}'`,
      payload: {
        niche_id: niche.id,
        niche_slug: slug,
        post_title: title,
        affiliate_keywords: pkg.affiliate_keywords || [],
      },
      status: "proposed",
      estimated_revenue_eur: Math.round((Number(niche.estimated_monthly_revenue_eur) || 100) / 5),
    }));

    if (seoActions.length > 0) {
      await supabase.from("aurora_revenue_actions").insert(seoActions);
    }

    await supabase
      .from("aurora_niches")
      .update({
        status: "launched",
        launched_at: new Date().toISOString(),
        launched_url: launchUrl,
      })
      .eq("id", niche_id);

    return new Response(
      JSON.stringify({ ok: true, url: launchUrl, slug, seo_actions_created: seoActions.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("aurora-launch-niche error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
