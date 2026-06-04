// Aurora Launch Niche — converts a discovered niche into a live landing page
// at /n/<slug> and seeds 5 SEO post proposals tied to it.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAI } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^|-$)/g, "")
    .slice(0, 60);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { nicheId } = await req.json();
    if (!nicheId) {
      return new Response(JSON.stringify({ ok: false, error: "nicheId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: niche, error: nErr } = await supabase
      .from("aurora_niches")
      .select("*")
      .eq("id", nicheId)
      .single();

    if (nErr || !niche) {
      return new Response(JSON.stringify({ ok: false, error: "Niche not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (niche.status === "launched") {
      return new Response(JSON.stringify({ ok: true, already: true, url: niche.launched_url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const monetization = ((niche.monetization_methods ?? []) as string[]).join(", ");

    const messages = [
      {
        role: "system" as const,
        content: "You are Aurora — premium copywriter & SEO strategist. Output: conversion-grade, original, emotionally resonant. Match niche language (English or Polish based on niche). Return ONLY valid JSON, no markdown.",
      },
      {
        role: "user" as const,
        content: `Launch this niche as a live landing page:
NAME: ${niche.niche_name}
DESCRIPTION: ${niche.description}
MONETIZATION: ${monetization}

Return JSON with exactly these fields:
{
  "title": "Page title (60 chars max, includes keyword)",
  "meta_description": "Under 160 chars",
  "hero_headline": "string",
  "hero_subheadline": "string",
  "cta_text": "string",
  "sections": [{"heading": "string", "body": "100-200 words per section"}, ...],
  "affiliate_keywords": ["keyword1", ...],
  "seo_post_titles": ["SEO blog post title 1", "title 2", "title 3", "title 4", "title 5"]
}`,
      },
    ];

    const aiText = await callAI(messages, { model: "grok-3-mini", maxTokens: 4096 });
    let pkg: any;
    try {
      pkg = JSON.parse(aiText);
    } catch {
      // Try to extract JSON from response
      const match = aiText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("AI returned non-JSON: " + aiText.slice(0, 200));
      pkg = JSON.parse(match[0]);
    }

    const slug = slugify(niche.niche_name);
    const launchUrl = `/n/${slug}`;

    // Upsert into aurora_landing_pages
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
      console.error("Landing page upsert error:", lpErr);
      return new Response(JSON.stringify({ ok: false, error: lpErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update niche status
    await supabase
      .from("aurora_niches")
      .update({ status: "launched", launched_url: launchUrl, launched_at: new Date().toISOString() })
      .eq("id", nicheId);

    // Seed 5 SEO post proposals tied to this niche
    const postTitles: string[] = pkg.seo_post_titles || [];
    for (const postTitle of postTitles.slice(0, 5)) {
      await supabase.from("aurora_post_proposals").insert({
        niche_id: nicheId,
        title: postTitle,
        status: "proposed",
        created_at: new Date().toISOString(),
      });
    }

    return new Response(
      JSON.stringify({ ok: true, url: launchUrl, slug, title: pkg.title }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("aurora-launch-niche error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
