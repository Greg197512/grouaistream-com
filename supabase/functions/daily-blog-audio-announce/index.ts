import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Brian — energetic male voice (also used by DJ)
const VOICE_ID_BRIAN = "nPczCjzI2devNBz1zQrb";

const stripMarkdown = (md: string): string =>
  md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~>]/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY missing");

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Get latest published blog post
    const { data: post, error: postErr } = await supabase
      .from("seo_blog_posts")
      .select("id, title, slug, description, content, cover_url, category")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (postErr || !post) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "no_published_post" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Build short Polish radio announcement script via Lovable AI
    const cleanContent = stripMarkdown(post.content || "").slice(0, 1200);
    let script = "";

    if (LOVABLE_API_KEY) {
      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content:
                  "Jesteś radiowym lektorem GrouAIStream. Stwórz KRÓTKĄ (max 4 zdania, ~25 sekund mowy) zapowiedź wpisu z bloga w stylu DJ-a radiowego. Zacznij od 'Cześć, tu GrouAI Stream. Świeży wpis na blogu:'. Bez markdown, bez linków, tylko tekst do czytania na żywo. Zachęć do kliknięcia.",
              },
              {
                role: "user",
                content: `Tytuł: ${post.title}\nKategoria: ${post.category || "ogólne"}\nLead: ${post.description || ""}\nFragment: ${cleanContent}`,
              },
            ],
          }),
        });
        if (aiResp.ok) {
          const ai = await aiResp.json();
          script = (ai.choices?.[0]?.message?.content || "").trim();
        }
      } catch (e) {
        console.error("AI script error:", e);
      }
    }

    if (!script) {
      script = `Cześć, tu GrouAI Stream. Świeży wpis na blogu: ${post.title}. ${post.description || ""} Sprawdź teraz na grouaistream.com!`;
    }

    // Clean for TTS
    script = script
      .replace(/[*_`#>]/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 1500);

    // 3. ElevenLabs TTS — Brian (male)
    const ttsResp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID_BRIAN}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: script,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.8,
            style: 0.4,
            use_speaker_boost: true,
            speed: 1.05,
          },
        }),
      }
    );

    if (!ttsResp.ok) {
      const errTxt = await ttsResp.text();
      throw new Error(`ElevenLabs error ${ttsResp.status}: ${errTxt.slice(0, 200)}`);
    }

    const audioBuffer = await ttsResp.arrayBuffer();
    const audioBytes = new Uint8Array(audioBuffer);

    // 4. Upload to storage
    const today = new Date().toISOString().slice(0, 10);
    const filePath = `blog-announcements/${today}-${post.slug}.mp3`;

    // ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.find((b) => b.name === "radio-audio")) {
      await supabase.storage.createBucket("radio-audio", { public: true });
    }

    const { error: upErr } = await supabase.storage
      .from("radio-audio")
      .upload(filePath, audioBytes, {
        contentType: "audio/mpeg",
        upsert: true,
      });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    const { data: pub } = supabase.storage.from("radio-audio").getPublicUrl(filePath);
    const audioUrl = pub.publicUrl;

    // 5. Save to radio_announcements table
    await supabase.from("radio_announcements").insert({
      post_id: post.id,
      post_title: post.title,
      post_slug: post.slug,
      script,
      audio_url: audioUrl,
      voice_id: VOICE_ID_BRIAN,
      scheduled_for: new Date().toISOString(),
      kind: "blog_daily",
    });

    // 6. Emit agent event so Brain / Radio can react
    await supabase.from("agent_events").insert({
      source: "daily-blog-audio-announce",
      event_type: "radio.announcement",
      priority: 4,
      target_type: "blog_post",
      target_id: post.id,
      payload: {
        audio_url: audioUrl,
        title: post.title,
        slug: post.slug,
        kind: "blog_daily",
        script_preview: script.slice(0, 160),
      },
    });

    console.log("✅ Blog audio announce ready:", audioUrl);

    return new Response(
      JSON.stringify({
        success: true,
        post_id: post.id,
        title: post.title,
        audio_url: audioUrl,
        script_length: script.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("daily-blog-audio-announce error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
