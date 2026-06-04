import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * SEO Bot — autonomous multi-phase SEO agent for grouaistream.com
 *
 * Phases (all or individual):
 *   research   — AI keyword gap + trending topics analysis
 *   generate   — trigger seo-blog-generate N times
 *   translate  — trigger blog-translate for untranslated posts
 *   distribute — sitemap refresh + indexnow ping + notify subscribers
 *   report     — send email summary to admin
 *
 * Body: { action: "full" | "research" | "generate" | "translate" | "distribute" | "report", count?: number }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const LOVABLE_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  const BASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const fnHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${ANON_KEY}`,
    "x-trigger": "seo-bot",
  };

  let action = "full";
  let count = 2;
  let triggeredBy = "cron";

  try {
    const body = await req.json();
    action = body.action || "full";
    count = Math.min(Number(body.count) || 2, 5);
    triggeredBy = body.triggered_by || "cron";
  } catch {
    // defaults
  }

  const results: Record<string, unknown> = {};
  const startTime = Date.now();

  const log = async (type: string, level: "success" | "info" | "error", message: string, meta: unknown = {}) => {
    await supabaseAdmin.rpc("log_seo_activity", {
      _action_type: type,
      _level: level,
      _message: message,
      _metadata: meta,
      _triggered_by: triggeredBy,
    }).catch(() => {});
  };

  await log("seo_bot_start", "info", `SEO Bot uruchomiony — akcja: ${action}`, { count });

  // ─── PHASE 1: RESEARCH ──────────────────────────────────────────────────────
  if (action === "full" || action === "research") {
    try {
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

      // Get existing topics to avoid duplication
      const { data: recent } = await supabaseAdmin
        .from("seo_blog_posts")
        .select("title, category, tags")
        .order("created_at", { ascending: false })
        .limit(50);

      const recentSummary = (recent || [])
        .map((p: { title: string; category: string }) => `${p.category}: ${p.title}`)
        .join("\n");

      const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemma-2-9b-it:free",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: "Jesteś strategiem SEO dla platformy streamingowej AI/muzyka. Zwróć TYLKO valid JSON.",
            },
            {
              role: "user",
              content: `Przeanalizuj poniższe istniejące posty blogowe na grouaistream.com i wskaż TOP 5 tematów słów kluczowych, które są BRAKUJĄCE lub SŁABO pokryte, a mają wysoką szansę na ruch Google w Polsce i Europie w 2026 roku w niszy: AI streaming muzyki, niezależni artyści, monetyzacja muzyki, AI tools dla twórców.

ISTNIEJĄCE POSTY (ostatnie 50):
${recentSummary || "brak"}

Zwróć JSON: {"gaps": [{"topic": "...", "category": "...", "keywords": ["...", "..."], "reason": "..."}], "summary": "..."}`,
            },
          ],
        }),
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const raw = aiData.choices?.[0]?.message?.content || "{}";
        const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
        try {
          const parsed = JSON.parse(cleaned);
          results.research = { success: true, gaps: parsed.gaps?.length || 0, summary: parsed.summary };
          await log("seo_bot_research", "success", `Research: znaleziono ${parsed.gaps?.length || 0} luk tematycznych`, parsed);
        } catch {
          results.research = { success: false, error: "JSON parse failed" };
        }
      } else {
        results.research = { success: false, status: aiRes.status };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.research = { success: false, error: msg };
      await log("seo_bot_research", "error", `Research error: ${msg}`);
    }
  }

  // ─── PHASE 2: GENERATE BLOG POSTS ───────────────────────────────────────────
  if (action === "full" || action === "generate") {
    const generated: unknown[] = [];
    for (let i = 0; i < count; i++) {
      try {
        const r = await fetch(`${BASE_URL}/functions/v1/seo-blog-generate`, {
          method: "POST",
          headers: fnHeaders,
          body: JSON.stringify({}),
        });
        const json = await r.json().catch(() => ({}));
        generated.push({ index: i, status: r.status, post_id: json.post?.id, slug: json.post?.slug });
        // Short pause between generations to avoid rate limits
        if (i < count - 1) await new Promise((res) => setTimeout(res, 3000));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        generated.push({ index: i, error: msg });
      }
    }
    results.generate = { count: generated.length, posts: generated };
    const successCount = generated.filter((g: unknown) => (g as { status?: number }).status === 200).length;
    await log("seo_bot_generate", successCount > 0 ? "success" : "error",
      `Wygenerowano ${successCount}/${count} postów blogowych`, { generated });
  }

  // ─── PHASE 3: TRANSLATE UNTRANSLATED POSTS ──────────────────────────────────
  if (action === "full" || action === "translate") {
    try {
      // Find posts missing EN/NL/UA translations
      const { data: untranslated } = await supabaseAdmin
        .from("seo_blog_posts")
        .select("id, slug, title")
        .eq("is_published", true)
        .is("title_en", null)
        .order("created_at", { ascending: false })
        .limit(5);

      const translateResults: unknown[] = [];
      for (const post of untranslated || []) {
        try {
          const r = await fetch(`${BASE_URL}/functions/v1/blog-translate`, {
            method: "POST",
            headers: fnHeaders,
            body: JSON.stringify({ post_id: post.id }),
          });
          translateResults.push({ post_id: post.id, slug: post.slug, status: r.status });
          if (r.ok) await new Promise((res) => setTimeout(res, 2000));
        } catch (err) {
          translateResults.push({ post_id: post.id, error: err instanceof Error ? err.message : String(err) });
        }
      }

      results.translate = { processed: translateResults.length, items: translateResults };
      await log("seo_bot_translate", "success",
        `Tłumaczenie: przetworzono ${translateResults.length} postów`, { translateResults });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.translate = { success: false, error: msg };
      await log("seo_bot_translate", "error", `Translate error: ${msg}`);
    }
  }

  // ─── PHASE 4: DISTRIBUTE ────────────────────────────────────────────────────
  if (action === "full" || action === "distribute") {
    const distResults: Record<string, unknown> = {};

    // 4a. Refresh sitemap
    try {
      const r = await fetch(`${BASE_URL}/functions/v1/seo-sitemap-generate`, {
        method: "POST",
        headers: fnHeaders,
      });
      distResults.sitemap = { status: r.status, ok: r.ok };
    } catch (err) {
      distResults.sitemap = { error: err instanceof Error ? err.message : String(err) };
    }

    // 4b. IndexNow ping
    try {
      const r = await fetch(`${BASE_URL}/functions/v1/indexnow-ping`, {
        method: "POST",
        headers: fnHeaders,
        body: JSON.stringify({}),
      });
      const json = await r.json().catch(() => ({}));
      distResults.indexnow = { status: r.status, urls_submitted: json.urls_submitted };
    } catch (err) {
      distResults.indexnow = { error: err instanceof Error ? err.message : String(err) };
    }

    // 4c. Notify blog subscribers (best effort)
    try {
      const r = await fetch(`${BASE_URL}/functions/v1/notify-blog-subscribers`, {
        method: "POST",
        headers: fnHeaders,
        body: JSON.stringify({}),
      });
      distResults.notify = { status: r.status };
    } catch (err) {
      distResults.notify = { error: err instanceof Error ? err.message : String(err) };
    }

    results.distribute = distResults;
    await log("seo_bot_distribute", "success", "Dystrybucja zakończona", distResults);
  }

  // ─── PHASE 5: REPORT ────────────────────────────────────────────────────────
  if (action === "full" || action === "report") {
    try {
      // Get blog stats
      const { count: totalPosts } = await supabaseAdmin
        .from("seo_blog_posts")
        .select("id", { count: "exact", head: true })
        .eq("is_published", true);

      const { data: topPosts } = await supabaseAdmin
        .from("seo_blog_posts")
        .select("title, view_count, created_at")
        .eq("is_published", true)
        .order("view_count", { ascending: false })
        .limit(5);

      const elapsedSec = Math.round((Date.now() - startTime) / 1000);

      const reportBody = `
# Raport SEO Bot — ${new Date().toLocaleDateString("pl-PL")}

## Podsumowanie
- Czas działania: ${elapsedSec}s
- Łączna akcja: ${action}
- Wygenerowane posty: ${(results.generate as { count?: number })?.count || 0}

## Status faz
${JSON.stringify(results, null, 2)}

## Blog stats
- Łącznie opublikowanych postów: ${totalPosts || 0}
- Top 5 wg wyświetleń:
${(topPosts || []).map((p: { title: string; view_count: number }) => `  - ${p.title} (${p.view_count} views)`).join("\n")}

---
grouaistream.com SEO Bot
      `.trim();

      // Send email via existing send-email function
      await fetch(`${BASE_URL}/functions/v1/send-email`, {
        method: "POST",
        headers: fnHeaders,
        body: JSON.stringify({
          to: "admin@grouaistream.com",
          subject: `SEO Bot Raport — ${new Date().toLocaleDateString("pl-PL")} — ${totalPosts} postów`,
          body: reportBody,
        }),
      });

      results.report = { sent: true, total_posts: totalPosts, elapsed_sec: elapsedSec };
      await log("seo_bot_report", "success", `Raport wysłany — ${totalPosts} postów, ${elapsedSec}s`, { total_posts: totalPosts });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.report = { sent: false, error: msg };
      await log("seo_bot_report", "error", `Report error: ${msg}`);
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  await log("seo_bot_done", "success", `SEO Bot zakończony w ${elapsed}s — akcja: ${action}`, { elapsed, results });

  return new Response(
    JSON.stringify({ success: true, action, triggered_by: triggeredBy, elapsed_sec: elapsed, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
  );
});
