import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LANGS = [
  { code: "en", name: "English", instr: "Natural, fluent English. Keep music slang authentic. American English." },
  { code: "nl", name: "Dutch (Nederlands)", instr: "Natural Dutch as spoken in Netherlands. Keep music terms in English where natural (DJ, beat, drop, vibe)." },
  { code: "ua", name: "Ukrainian (українська)", instr: "Natural modern Ukrainian. Use Latin for brand names and music tech terms." },
];

const SYSTEM_BASE = `You translate Polish blog posts for GrouAI Stream — an AI music platform by GrouaRock.
RULES:
- PRESERVE markdown exactly (## headings, **bold**, [links](url), > quotes, lists)
- KEEP these unchanged: GrouAI, GrouAI Stream, GrouaRock, GrouaRadio, Spotify, ElevenLabs, Suno, Udio, TikTok, YouTube
- KEEP all URLs intact
- KEEP emotional tone: premium, intimate, slightly poetic
- DO NOT add commentary, prefaces, or "Translation:" labels
- Return ONLY raw translated markdown, nothing else`;

async function translateField(
  apiKey: string,
  text: string,
  lang: { code: string; name: string; instr: string },
  fieldType: "title" | "description" | "content"
): Promise<string> {
  const maxLen = fieldType === "title" ? 80 : fieldType === "description" ? 160 : 100000;
  const constraint = fieldType === "title"
    ? `Keep under ${maxLen} chars. No quotes around it.`
    : fieldType === "description"
    ? `Keep under ${maxLen} chars. Strong hook. No quotes.`
    : `Full markdown article. Preserve every heading, link, list, bold.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: `${SYSTEM_BASE}\n\nTARGET: ${lang.name}. ${lang.instr}\nFIELD: ${fieldType}. ${constraint}` },
        { role: "user", content: text },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI ${res.status}: ${errText}`);
  }
  const data = await res.json();
  let out = data.choices?.[0]?.message?.content?.trim() || "";
  // Strip wrapping quotes/markdown fences if AI added them
  out = out.replace(/^```(?:markdown|md)?\s*/i, "").replace(/```\s*$/, "").trim();
  if ((out.startsWith('"') && out.endsWith('"')) || (out.startsWith("'") && out.endsWith("'"))) {
    out = out.slice(1, -1);
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const body = await req.json().catch(() => ({}));
    const { post_id, batch, force } = body as { post_id?: string; batch?: boolean; force?: boolean };

    // Fetch posts to translate
    let postsQuery = supabase.from("seo_blog_posts").select("id, slug, title, description, content, content_en, content_nl, content_ua");
    if (post_id) {
      postsQuery = postsQuery.eq("id", post_id);
    } else if (batch) {
      // Backfill mode: posts missing any translation
      postsQuery = postsQuery
        .eq("is_published", true)
        .or("content_en.is.null,content_nl.is.null,content_ua.is.null")
        .limit(5);
    } else {
      throw new Error("Provide post_id or batch=true");
    }

    const { data: posts, error: fetchErr } = await postsQuery;
    if (fetchErr) throw fetchErr;
    if (!posts || posts.length === 0) {
      return new Response(JSON.stringify({ ok: true, translated: 0, message: "No posts to translate" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ id: string; status: string; error?: string }> = [];

    for (const post of posts) {
      try {
        await supabase.from("seo_blog_posts").update({ translation_status: "translating" }).eq("id", post.id);

        const updates: Record<string, string> = {};
        for (const lang of LANGS) {
          const contentField = `content_${lang.code}` as keyof typeof post;
          // Skip if already translated and not forcing
          if (!force && post[contentField]) {
            console.log(`Skipping ${lang.code} for ${post.slug} — already translated`);
            continue;
          }

          console.log(`Translating ${post.slug} → ${lang.code}`);
          const [tTitle, tDesc, tContent] = await Promise.all([
            translateField(LOVABLE_API_KEY, post.title, lang, "title"),
            translateField(LOVABLE_API_KEY, post.description, lang, "description"),
            translateField(LOVABLE_API_KEY, post.content, lang, "content"),
          ]);

          updates[`title_${lang.code}`] = tTitle;
          updates[`description_${lang.code}`] = tDesc;
          updates[`content_${lang.code}`] = tContent;
        }

        if (Object.keys(updates).length > 0) {
          updates.translations_updated_at = new Date().toISOString();
          updates.translation_status = "completed";
          const { error: updErr } = await supabase
            .from("seo_blog_posts")
            .update(updates)
            .eq("id", post.id);
          if (updErr) throw updErr;
        } else {
          await supabase.from("seo_blog_posts").update({ translation_status: "completed" }).eq("id", post.id);
        }

        results.push({ id: post.id, status: "ok" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`Translation failed for ${post.id}:`, msg);
        await supabase.from("seo_blog_posts").update({ translation_status: "failed" }).eq("id", post.id);
        results.push({ id: post.id, status: "failed", error: msg });
      }
    }

    return new Response(JSON.stringify({ ok: true, translated: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("blog-translate error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
