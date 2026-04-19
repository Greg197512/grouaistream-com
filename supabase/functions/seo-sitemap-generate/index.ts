import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HOST = "grouaistream.com";

const STATIC_URLS: Array<{ loc: string; priority: string; changefreq: string }> = [
  { loc: "/", priority: "1.0", changefreq: "daily" },
  { loc: "/radio", priority: "0.9", changefreq: "hourly" },
  { loc: "/radio-live", priority: "0.9", changefreq: "hourly" },
  { loc: "/search", priority: "0.8", changefreq: "weekly" },
  { loc: "/library", priority: "0.7", changefreq: "weekly" },
  { loc: "/upload", priority: "0.8", changefreq: "weekly" },
  { loc: "/suno", priority: "0.8", changefreq: "weekly" },
  { loc: "/movies", priority: "0.7", changefreq: "weekly" },
  { loc: "/earn", priority: "0.9", changefreq: "weekly" },
  { loc: "/server", priority: "0.6", changefreq: "weekly" },
  { loc: "/blog", priority: "0.8", changefreq: "daily" },
  { loc: "/auth", priority: "0.5", changefreq: "monthly" },
  { loc: "/legal", priority: "0.3", changefreq: "monthly" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const triggeredBy = req.headers.get("x-trigger") || "cron";

  try {
    // Fetch dynamic content
    const [tracksRes, playlistsRes, blogRes] = await Promise.all([
      supabaseAdmin
        .from("tracks")
        .select("id, created_at")
        .not("audio_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(5000),
      supabaseAdmin
        .from("playlists")
        .select("id, updated_at")
        .eq("is_public", true)
        .limit(5000),
      supabaseAdmin
        .from("seo_blog_posts")
        .select("slug, updated_at")
        .eq("is_published", true)
        .limit(5000),
    ]);

    const today = new Date().toISOString().split("T")[0];
    const urls: string[] = [];

    // Static
    for (const u of STATIC_URLS) {
      urls.push(
        `<url><loc>https://${HOST}${u.loc}</loc><lastmod>${today}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`
      );
    }

    // Tracks
    for (const t of tracksRes.data || []) {
      const lastmod = (t.created_at as string).split("T")[0];
      urls.push(
        `<url><loc>https://${HOST}/track/${t.id}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>`
      );
    }

    // Playlists
    for (const p of playlistsRes.data || []) {
      const lastmod = (p.updated_at as string).split("T")[0];
      urls.push(
        `<url><loc>https://${HOST}/playlist/${p.id}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.5</priority></url>`
      );
    }

    // Blog
    for (const b of blogRes.data || []) {
      const lastmod = (b.updated_at as string).split("T")[0];
      urls.push(
        `<url><loc>https://${HOST}/blog/${b.slug}</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`
      );
    }

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;

    // Update settings + log
    await supabaseAdmin.from("seo_settings").update({ last_sitemap_at: new Date().toISOString() }).eq("id", 1);
    await supabaseAdmin.rpc("log_seo_activity", {
      _action_type: "sitemap_generate",
      _level: "success",
      _message: `Wygenerowano sitemap z ${urls.length} URL-ami`,
      _metadata: {
        total_urls: urls.length,
        tracks: tracksRes.data?.length || 0,
        playlists: playlistsRes.data?.length || 0,
        blog: blogRes.data?.length || 0,
      },
      _triggered_by: triggeredBy,
    });

    return new Response(sitemap, {
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
      status: 200,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    await supabaseAdmin.rpc("log_seo_activity", {
      _action_type: "sitemap_generate",
      _level: "error",
      _message: `Błąd generowania sitemap: ${msg}`,
      _metadata: {},
      _triggered_by: triggeredBy,
    });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
