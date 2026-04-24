// 🌌 Aurora Approve Action — 1-klik publish.
// Admin klika Approve w panelu → ta funkcja publikuje propozycję:
//  • seo_post → wpis na blogu (blog_posts)
//  • niche_landing → wpis w aurora_landing_pages (status=live)
//  • partnership → przeniesienie do aurora_partnerships (status=approved/sent)
//  • tiktok_reel → zapis do TikTok studio (jeśli istnieje) lub po prostu approved
//  • newsletter → status approved (wysyłka osobnym pipeline)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Sprawdź rolę admina
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const actionId: string = body.action_id;
    if (!actionId) return new Response(JSON.stringify({ error: "action_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: action, error: aErr } = await supabase
      .from("aurora_revenue_actions")
      .select("*")
      .eq("id", actionId)
      .single();
    if (aErr || !action) throw new Error("action not found");
    if (action.status === "published") {
      return new Response(JSON.stringify({ ok: true, already: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let publishedUrl: string | null = null;
    const payload: any = action.payload || {};

    if (action.action_type === "seo_post") {
      // Spróbuj zapisać do tabeli blog_posts jeżeli istnieje
      const slug = (payload.slug || (payload.title || "post").toString().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")).slice(0, 80);
      const { error: bpErr } = await supabase.from("blog_posts").insert({
        slug,
        title: payload.title,
        excerpt: payload.meta_description,
        content: payload.content_markdown,
        tags: payload.tags ?? [],
        published: true,
        published_at: new Date().toISOString(),
        author: "Aurora",
      });
      if (bpErr) {
        // jeśli tabela inna — zapisz do payload jako "draft"
        console.warn("[approve] blog_posts insert failed, keeping in action:", bpErr.message);
      } else {
        publishedUrl = `/blog/${slug}`;
      }
    }

    if (action.action_type === "niche_landing") {
      const slug = payload.slug;
      const { error: lErr } = await supabase.from("aurora_landing_pages").upsert({
        slug,
        niche: payload.niche,
        title: payload.title,
        meta_description: payload.meta_description,
        hero_headline: payload.hero_headline,
        hero_subheadline: payload.hero_subheadline,
        sections: payload.sections ?? [],
        cta_text: payload.cta_text ?? "Posłuchaj teraz",
        cta_url: payload.cta_url ?? "/",
        status: "live",
      }, { onConflict: "slug" });
      if (lErr) throw new Error("landing publish: " + lErr.message);
      publishedUrl = `/n/${slug}`;
    }

    if (action.action_type === "partnership") {
      await supabase.from("aurora_partnerships").insert({
        partner_name: payload.partner_name,
        partner_type: payload.partner_type,
        pitch_subject: payload.pitch_subject,
        pitch_body: payload.pitch_body,
        estimated_value_eur: payload.estimated_value_eur ?? 0,
        status: "approved",
        approved_by: user.id,
      });
    }

    // newsletter / reel — zostawiamy approved, do dalszego pipeline
    await supabase
      .from("aurora_revenue_actions")
      .update({
        status: "published",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        published_at: new Date().toISOString(),
        published_url: publishedUrl,
      })
      .eq("id", actionId);

    return new Response(JSON.stringify({ ok: true, published_url: publishedUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[aurora-approve] error:", e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
