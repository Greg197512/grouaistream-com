import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function translateField(text: string, targetLang: string): Promise<string> {
  if (!text || text.trim() === "") return text;
  const messages = [
    {
      role: "system" as const,
      content: `You are a professional translator. Translate the following text to ${targetLang}. Return only the translated text, no explanations.`,
    },
    { role: "user" as const, content: text },
  ];
  return await callAI(messages, { model: "grok-3-mini", maxTokens: 4096 });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { postId, targetLanguages } = await req.json();

    if (!postId || !targetLanguages || !Array.isArray(targetLanguages)) {
      return new Response(
        JSON.stringify({ error: "postId and targetLanguages array are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the original post
    const { data: post, error: fetchError } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("id", postId)
      .single();

    if (fetchError || !post) {
      return new Response(
        JSON.stringify({ error: "Post not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (const lang of targetLanguages) {
      try {
        const translatedTitle = await translateField(post.title, lang);
        const translatedExcerpt = await translateField(post.excerpt || "", lang);
        const translatedContent = await translateField(post.content, lang);
        const translatedMetaTitle = await translateField(post.meta_title || post.title, lang);
        const translatedMetaDesc = await translateField(post.meta_description || post.excerpt || "", lang);

        // Check if translation already exists
        const { data: existing } = await supabase
          .from("blog_post_translations")
          .select("id")
          .eq("post_id", postId)
          .eq("language_code", lang)
          .single();

        const translationData = {
          post_id: postId,
          language_code: lang,
          title: translatedTitle,
          excerpt: translatedExcerpt,
          content: translatedContent,
          meta_title: translatedMetaTitle,
          meta_description: translatedMetaDesc,
          updated_at: new Date().toISOString(),
        };

        if (existing) {
          await supabase
            .from("blog_post_translations")
            .update(translationData)
            .eq("id", existing.id);
        } else {
          await supabase
            .from("blog_post_translations")
            .insert({ ...translationData, created_at: new Date().toISOString() });
        }

        results.push({ lang, status: "success" });
      } catch (err) {
        console.error(`Error translating to ${lang}:`, err);
        results.push({ lang, status: "error", error: String(err) });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
