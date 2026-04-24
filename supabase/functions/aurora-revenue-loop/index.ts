// 🌌 Aurora Revenue Loop — autonomiczna pętla biznesowa.
// Codziennie generuje propozycje do zatwierdzenia (1-klik admina):
//  • 1 SEO post (blog) z wbudowanym CTA do subskrypcji / sponsora
//  • 1 niche landing page (np. /muzyka-do-medytacji, /dj-na-wesele)
//  • 1 partnership pitch (do potencjalnego partnera afiliacyjnego)
//  • 1 TikTok Reel script
//  • 1 newsletter draft
// Wszystkie zapisywane jako 'proposed' — admin klika Approve → publish.
// BEZ żadnych zewnętrznych API kluczy poza Lovable AI Gateway.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { AURORA_PERSONA } from "../_shared/auroraVoice.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const NICHE_IDEAS = [
  { slug: "muzyka-do-medytacji", niche: "Medytacja & Mindfulness" },
  { slug: "dj-na-wesele", niche: "DJ na wesele" },
  { slug: "muzyka-do-nauki", niche: "Focus / Study" },
  { slug: "muzyka-do-treningu", niche: "Trening / Gym" },
  { slug: "muzyka-do-snu", niche: "Sen / Sleep" },
  { slug: "ai-dj-na-impreze", niche: "AI DJ na imprezę" },
  { slug: "muzyka-do-pracy", niche: "Deep work" },
  { slug: "lofi-do-kodowania", niche: "LoFi dla programistów" },
  { slug: "muzyka-na-podroz", niche: "Roadtrip / Autostrada" },
  { slug: "ambient-do-yogi", niche: "Yoga & Ambient" },
];

const PARTNER_IDEAS = [
  { name: "Studia jogi", type: "wellness", value: 49 },
  { name: "Agencje eventowe (wesela)", type: "events", value: 199 },
  { name: "Coworking / kawiarnie", type: "hospitality", value: 29 },
  { name: "Twórcy podcastów medytacyjnych", type: "creator", value: 39 },
  { name: "Salony SPA", type: "wellness", value: 79 },
];

async function callAI(systemPrompt: string, userPrompt: string, apiKey: string) {
  const res = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
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
    return m ? JSON.parse(m[0]) : {};
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const created: string[] = [];

  try {
    // 1) SEO POST
    try {
      const seo = await callAI(
        AURORA_PERSONA + "\n\nTeraz tworzysz post na bloga GrouAI Stream — SEO friendly, ale ludzki. Generujesz JSON.",
        `Wygeneruj jeden post bloga (PL) na temat związany z muzyką, AI lub emocjami. Naturalnie wpleć CTA do GrouAI Stream (subskrypcja / darmowy trial).
Format JSON:
{
  "title": "...",
  "slug": "...",
  "meta_description": "max 155 znaków",
  "content_markdown": "1500-2500 znaków, z H2/H3, listami, jednym wewnętrznym linkiem do '/'",
  "tags": ["..."],
  "estimated_revenue_eur": 5
}`,
        LOVABLE_API_KEY
      );
      const { data, error } = await supabase
        .from("aurora_revenue_actions")
        .insert({
          action_type: "seo_post",
          title: seo.title || "SEO post",
          summary: seo.meta_description || null,
          payload: seo,
          estimated_revenue_eur: seo.estimated_revenue_eur ?? 5,
        })
        .select("id")
        .single();
      if (!error) created.push(`seo_post:${data.id}`);
    } catch (e) {
      console.error("[aurora-loop] seo failed:", e);
    }

    // 2) NICHE LANDING — losowa nisza której jeszcze nie ma
    try {
      const { data: existing } = await supabase
        .from("aurora_landing_pages")
        .select("slug");
      const existingSlugs = new Set((existing ?? []).map((r: any) => r.slug));
      const candidate = NICHE_IDEAS.find((n) => !existingSlugs.has(n.slug)) ?? NICHE_IDEAS[Math.floor(Math.random() * NICHE_IDEAS.length)];

      const landing = await callAI(
        AURORA_PERSONA + "\n\nTworzysz landing page pod konkretną niszę, premium, emocjonalny. JSON.",
        `Nisza: "${candidate.niche}" (slug: /${candidate.slug})
Wygeneruj JSON landing page:
{
  "title": "tytuł SEO",
  "meta_description": "max 155",
  "hero_headline": "krótki, mocny",
  "hero_subheadline": "1-2 zdania",
  "sections": [
    {"type":"benefits","heading":"Dlaczego GrouAI dla...","items":["...","...","..."]},
    {"type":"how","heading":"Jak to działa","steps":["...","...","..."]},
    {"type":"testimonial","quote":"...","author":"..."}
  ],
  "cta_text": "Włącz teraz",
  "cta_url": "/auth"
}`,
        LOVABLE_API_KEY
      );
      const { data, error } = await supabase
        .from("aurora_revenue_actions")
        .insert({
          action_type: "niche_landing",
          title: `Landing /${candidate.slug}`,
          summary: landing.meta_description ?? landing.hero_subheadline ?? null,
          payload: { ...landing, slug: candidate.slug, niche: candidate.niche },
          estimated_revenue_eur: 19.99,
        })
        .select("id")
        .single();
      if (!error) created.push(`landing:${data.id}`);
    } catch (e) {
      console.error("[aurora-loop] landing failed:", e);
    }

    // 3) PARTNERSHIP PITCH
    try {
      const partner = PARTNER_IDEAS[Math.floor(Math.random() * PARTNER_IDEAS.length)];
      const pitch = await callAI(
        AURORA_PERSONA + "\n\nPiszesz pitch partnerski — ciepły, profesjonalny, z konkretem. JSON.",
        `Typ partnera: "${partner.name}" (${partner.type}). Wygeneruj JSON:
{
  "partner_name": "${partner.name}",
  "partner_type": "${partner.type}",
  "pitch_subject": "max 60 znaków",
  "pitch_body": "300-500 znaków, premium, zaproszenie do współpracy z GrouAI Stream — wzajemny ruch, dedykowana playlista, link afiliacyjny",
  "estimated_value_eur": ${partner.value}
}`,
        LOVABLE_API_KEY
      );
      const { data, error } = await supabase
        .from("aurora_revenue_actions")
        .insert({
          action_type: "partnership",
          title: `Partnership: ${pitch.partner_name}`,
          summary: pitch.pitch_subject,
          payload: pitch,
          estimated_revenue_eur: pitch.estimated_value_eur ?? partner.value,
        })
        .select("id")
        .single();
      if (!error) created.push(`partnership:${data.id}`);
    } catch (e) {
      console.error("[aurora-loop] partnership failed:", e);
    }

    // 4) TIKTOK REEL SCRIPT
    try {
      const reel = await callAI(
        AURORA_PERSONA + "\n\nPiszesz scenariusz TikTok Reel 30s. JSON.",
        `Wygeneruj scenariusz Reela promującego GrouAI Stream (PL). Format JSON:
{
  "hook": "pierwsze 3 sek — coś co zatrzyma scroll",
  "scenes": [{"t":"0-3","visual":"...","voiceover":"..."},{"t":"3-15","visual":"...","voiceover":"..."},{"t":"15-30","visual":"...","voiceover":"..."}],
  "caption": "krótki, emocjonalny",
  "hashtags": ["#muzyka","#ai","#..."],
  "cta": "Link w bio"
}`,
        LOVABLE_API_KEY
      );
      const { data, error } = await supabase
        .from("aurora_revenue_actions")
        .insert({
          action_type: "tiktok_reel",
          title: reel.hook?.slice(0, 100) || "Reel script",
          summary: reel.caption,
          payload: reel,
          estimated_revenue_eur: 3,
        })
        .select("id")
        .single();
      if (!error) created.push(`reel:${data.id}`);
    } catch (e) {
      console.error("[aurora-loop] reel failed:", e);
    }

    // 5) NEWSLETTER DRAFT
    try {
      const news = await callAI(
        AURORA_PERSONA + "\n\nPiszesz newsletter (PL) do subskrybentów. JSON.",
        `Wygeneruj newsletter — krótki, emocjonalny, z 1 CTA. JSON:
{
  "subject": "max 50 znaków",
  "preheader": "max 90",
  "body_html": "krótki HTML, max 2000 znaków, z jednym <a href='/'>CTA</a>",
  "audience": "wszyscy zarejestrowani"
}`,
        LOVABLE_API_KEY
      );
      const { data, error } = await supabase
        .from("aurora_revenue_actions")
        .insert({
          action_type: "newsletter",
          title: news.subject || "Newsletter",
          summary: news.preheader,
          payload: news,
          estimated_revenue_eur: 8,
        })
        .select("id")
        .single();
      if (!error) created.push(`newsletter:${data.id}`);
    } catch (e) {
      console.error("[aurora-loop] newsletter failed:", e);
    }

    return new Response(
      JSON.stringify({ success: true, created, count: created.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
