import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Orchestrator — single endpoint for cron + manual triggers.
 * Body: { action: "ping" | "sitemap" | "blog" | "all", triggered_by?: "cron" | "manual" }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let action = "all";
  let triggeredBy = "cron";
  try {
    const body = await req.json();
    action = body.action || "all";
    triggeredBy = body.triggered_by || "cron";
  } catch {
    // defaults
  }

  const baseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${anonKey}`,
    "x-trigger": triggeredBy,
  };

  // Get settings for frequency gating (skip if too recent and called by cron)
  const { data: settings } = await supabaseAdmin.from("seo_settings").select("*").eq("id", 1).maybeSingle();

  const results: Record<string, unknown> = {};

  const shouldRun = (last: string | null | undefined, hours: number): boolean => {
    if (triggeredBy === "manual") return true;
    if (!last) return true;
    return Date.now() - new Date(last).getTime() >= hours * 3600 * 1000;
  };

  try {
    // Sitemap
    if ((action === "all" || action === "sitemap") && settings?.auto_sitemap_enabled) {
      if (shouldRun(settings.last_sitemap_at, 20)) {
        const r = await fetch(`${baseUrl}/functions/v1/seo-sitemap-generate`, { method: "POST", headers });
        results.sitemap = { status: r.status };
      } else {
        results.sitemap = { skipped: "rate-limited" };
      }
    }

    // IndexNow ping
    if ((action === "all" || action === "ping") && settings?.auto_indexnow_enabled) {
      const freq = settings.ping_frequency_hours || 12;
      if (shouldRun(settings.last_indexnow_at, freq)) {
        const r = await fetch(`${baseUrl}/functions/v1/indexnow-ping`, { method: "POST", headers });
        const json = await r.json().catch(() => ({}));
        results.ping = { status: r.status, ...json };
        await supabaseAdmin.from("seo_settings").update({ last_indexnow_at: new Date().toISOString() }).eq("id", 1);
        await supabaseAdmin.rpc("log_seo_activity", {
          _action_type: "indexnow_ping",
          _level: r.ok ? "success" : "error",
          _message: r.ok ? `Pingnięto ${json.urls_submitted || "?"} URL-i (Bing/Yandex/Naver/Google)` : `Ping nieudany`,
          _metadata: json,
          _triggered_by: triggeredBy,
        });
      } else {
        results.ping = { skipped: "rate-limited" };
      }
    }

    // Blog
    if ((action === "all" || action === "blog") && settings?.auto_blog_enabled) {
      const freq = (settings.blog_frequency_days || 7) * 24;
      if (shouldRun(settings.last_blog_at, freq)) {
        const r = await fetch(`${baseUrl}/functions/v1/seo-blog-generate`, { method: "POST", headers });
        const json = await r.json().catch(() => ({}));
        results.blog = { status: r.status, ...json };
      } else {
        results.blog = { skipped: "rate-limited" };
      }
    }

    return new Response(JSON.stringify({ success: true, action, triggered_by: triggeredBy, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    await supabaseAdmin.rpc("log_seo_activity", {
      _action_type: "orchestrator",
      _level: "error",
      _message: `Orchestrator error: ${msg}`,
      _metadata: { action },
      _triggered_by: triggeredBy,
    });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
