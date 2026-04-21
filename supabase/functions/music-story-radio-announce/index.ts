import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// George — głęboki, dojrzały męski głos (wybór użytkownika)
const VOICE_ID_GEORGE = "JBFqnCBsd6RMkjVDRZzb";

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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY missing");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const triggeredBy = req.headers.get("x-trigger") || "cron";

    // 1. Latest published music_stories post that hasn't been announced as music_story_radio yet
    //    (OR fall back to latest if all already announced)
    const { data: recentAnnounced } = await supabase
      .from("radio_announcements")
      .select("post_id")
      .eq("kind", "music_story_radio")
      .order("created_at", { ascending: false })
      .limit(20);
    const announcedIds = new Set((recentAnnounced || []).map((r: any) => r.post_id));

    const { data: candidates, error: postErr } = await supabase
      .from("seo_blog_posts")
      .select("id, title, slug, description, content, cover_url")
      .eq("is_published", true)
      .eq("category", "music_stories")
      .order("created_at", { ascending: false })
      .limit(10);

    if (postErr || !candidates?.length) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "no_music_story_post" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const post = candidates.find((p: any) => !announcedIds.has(p.id)) || candidates[0];

    // 2. Build emotional 60-90s radio script via Lovable AI
    const cleanContent = stripMarkdown(post.content || "").slice(0, 2500);

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
            content:
              "Jesteś radiowym lektorem-narratorem GrouAI Stream. Tworzysz KRÓTKIE skrypty audio (60-90 sekund mowy ≈ 150-220 słów po polsku) o pionierach muzyki elektronicznej. STYL: ciepły, dojrzały, refleksyjny, emocjonalny — jak narrator dokumentu na BBC. Zacznij intrygująco — sceną, pytaniem, lub konkretnym momentem (datą, miejscem). Wybierz JEDEN najmocniejszy moment z artykułu i opowiedz go z emocjami. Zakończ zaproszeniem żeby przeczytać całą historię na grouaistream.com/blog. NIE używaj markdown, NIE wymieniaj wszystkiego — wybieraj. Pisz ciągłym tekstem, bez nagłówków, bez list. Mów językiem mówionym, krótkimi zdaniami, z naturalnym rytmem. Pauzy oznacz wielokropkiem (...). Możesz dodać jeden cytat artysty.",
          },
          {
            role: "user",
            content: `Artykuł: "${post.title}"\nLead: ${post.description || ""}\n\nTreść:\n${cleanContent}\n\nNapisz skrypt 60-90 sekund mowy.`,
          },
        ],
      }),
    });

    let script = "";
    if (aiResp.ok) {
      const ai = await aiResp.json();
      script = (ai.choices?.[0]?.message?.content || "").trim();
    }

    if (!script) {
      script = `Posłuchaj jednej z najpiękniejszych historii w muzyce elektronicznej. ${post.title}. ${post.description || ""} Pełna opowieść czeka na grouaistream.com/blog.`;
    }

    // Clean for TTS
    script = script
      .replace(/[*_`#>]/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2000);

    // 3. ElevenLabs TTS — George (deep male, emotional)
    const ttsResp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID_GEORGE}?output_format=mp3_44100_128`,
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
            // Emotional, expressive, narrator-like
            stability: 0.4,
            similarity_boost: 0.85,
            style: 0.55,
            use_speaker_boost: true,
            speed: 0.98,
          },
        }),
      }
    );

    if (!ttsResp.ok) {
      const errTxt = await ttsResp.text();
      throw new Error(`ElevenLabs ${ttsResp.status}: ${errTxt.slice(0, 200)}`);
    }

    const audioBuffer = await ttsResp.arrayBuffer();
    const audioBytes = new Uint8Array(audioBuffer);

    // 4. Upload to storage
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    const filePath = `music-stories/${stamp}-${post.slug}.mp3`;

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

    // 5. Save to radio_announcements
    await supabase.from("radio_announcements").insert({
      post_id: post.id,
      post_title: post.title,
      post_slug: post.slug,
      script,
      audio_url: audioUrl,
      voice_id: VOICE_ID_GEORGE,
      scheduled_for: new Date().toISOString(),
      kind: "music_story_radio",
    });

    // 5b. Inject into radio_schedule so the live radio plays it between tracks
    try {
      // Estimate spoken duration: ~14 chars/sec for Polish speech, min 45s, max 120s
      const estimatedDuration = Math.min(120, Math.max(45, Math.round(script.length / 14)));

      const { data: maxRow } = await supabase
        .from("radio_schedule")
        .select("position")
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextPosition = ((maxRow?.position as number | undefined) ?? 0) + 1;

      await supabase.from("radio_schedule").insert({
        item_type: "announcement",
        custom_title: `🎹 Historia: ${post.title}`,
        custom_audio_url: audioUrl,
        custom_duration: estimatedDuration,
        position: nextPosition,
      });
    } catch (schedErr) {
      console.warn("Could not insert into radio_schedule:", schedErr);
    }

    // 6. Emit agent event
    await supabase.from("agent_events").insert({
      source: "music-story-radio-announce",
      event_type: "radio.music_story",
      priority: 5,
      target_type: "blog_post",
      target_id: post.id,
      payload: {
        audio_url: audioUrl,
        title: post.title,
        slug: post.slug,
        kind: "music_story_radio",
        voice: "george",
        script_preview: script.slice(0, 200),
      },
    });

    await supabase.rpc("log_seo_activity", {
      _action_type: "music_story_radio",
      _level: "success",
      _message: `Audio historia muzyczna w radiu: "${post.title}"`,
      _metadata: { slug: post.slug, post_id: post.id, audio_url: audioUrl, voice: "george" },
      _triggered_by: triggeredBy,
    });

    console.log("✅ Music story radio ready:", audioUrl);

    return new Response(
      JSON.stringify({
        success: true,
        post_id: post.id,
        title: post.title,
        audio_url: audioUrl,
        script_length: script.length,
        voice: "George",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("music-story-radio-announce error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
