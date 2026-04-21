import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// George — single multilingual voice (consistent brand across PL/EN/NL/UA)
const VOICE_ID_GEORGE = "JBFqnCBsd6RMkjVDRZzb";

type Lang = "pl" | "en" | "nl" | "ua";
const SUPPORTED_LANGS: Lang[] = ["pl", "en", "nl", "ua"];

const LANG_FLAGS: Record<Lang, string> = {
  pl: "🇵🇱",
  en: "🇬🇧",
  nl: "🇳🇱",
  ua: "🇺🇦",
};

const LANG_LABELS: Record<Lang, string> = {
  pl: "Blog",
  en: "Blog",
  nl: "Blog",
  ua: "Блог",
};

const SYSTEM_PROMPTS: Record<Lang, string> = {
  pl: "Jesteś radiowym lektorem GrouAIStream. Stwórz KRÓTKĄ (max 4 zdania, ~25 sekund mowy) zapowiedź wpisu z bloga w stylu DJ-a radiowego. Zacznij od 'Cześć, tu GrouAI Stream. Świeży wpis na blogu:'. Bez markdown, bez linków, tylko tekst do czytania na żywo. Zachęć do kliknięcia.",
  en: "You are a radio host for GrouAIStream. Write a SHORT (max 4 sentences, ~25 seconds of speech) blog post announcement in radio-DJ style. Start with 'Hi, this is GrouAI Stream. A fresh post on the blog:'. No markdown, no links, just text to read live. Encourage listeners to check it out.",
  nl: "Je bent een radio-host van GrouAIStream. Schrijf een KORTE (max 4 zinnen, ~25 seconden spraak) aankondiging van een blogpost in radio-DJ stijl. Begin met 'Hoi, dit is GrouAI Stream. Een nieuwe post op de blog:'. Geen markdown, geen links, alleen tekst om live voor te lezen. Moedig luisteraars aan om te kijken.",
  ua: "Ти радіоведучий GrouAIStream. Напиши КОРОТКЕ (макс. 4 речення, ~25 секунд мовлення) оголошення допису з блогу у стилі радіо-діджея. Починай зі слів 'Привіт, це GrouAI Stream. Свіжий допис у блозі:'. Без markdown, без посилань, тільки текст для зачитування наживо. Запроси послухати.",
};

const FALLBACKS: Record<Lang, (t: string, d: string) => string> = {
  pl: (t, d) => `Cześć, tu GrouAI Stream. Świeży wpis na blogu: ${t}. ${d} Sprawdź teraz na grouaistream.com!`,
  en: (t, d) => `Hi, this is GrouAI Stream. A fresh post on the blog: ${t}. ${d} Check it out now at grouaistream.com!`,
  nl: (t, d) => `Hoi, dit is GrouAI Stream. Een nieuwe post op de blog: ${t}. ${d} Bekijk het nu op grouaistream.com!`,
  ua: (t, d) => `Привіт, це GrouAI Stream. Свіжий допис у блозі: ${t}. ${d} Зайди зараз на grouaistream.com!`,
};

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

const parseLang = (raw: string | null | undefined): Lang => {
  const v = (raw || "pl").toLowerCase();
  return (SUPPORTED_LANGS as string[]).includes(v) ? (v as Lang) : "pl";
};

const pickLocalizedField = (post: any, base: "title" | "description" | "content", lang: Lang): string => {
  if (lang === "pl") return post[base] || "";
  const localized = post[`${base}_${lang}`];
  return (localized && String(localized).trim().length > 0) ? localized : (post[base] || "");
};

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
    const triggeredBy = req.headers.get("x-trigger") || "cron";

    // Resolve language
    const url = new URL(req.url);
    let lang: Lang = parseLang(url.searchParams.get("lang"));
    try {
      if (req.method === "POST") {
        const body = await req.clone().json().catch(() => null);
        if (body?.lang) lang = parseLang(body.lang);
      }
    } catch (_) { /* ignore */ }

    // 1. Get latest published blog post
    const { data: post, error: postErr } = await supabase
      .from("seo_blog_posts")
      .select("id, title, title_en, title_nl, title_ua, slug, description, description_en, description_nl, description_ua, content, content_en, content_nl, content_ua, cover_url, category")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (postErr || !post) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "no_published_post", lang }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const localizedTitle = pickLocalizedField(post, "title", lang);
    const localizedDesc = pickLocalizedField(post, "description", lang);
    const localizedContent = pickLocalizedField(post, "content", lang);
    const cleanContent = stripMarkdown(localizedContent).slice(0, 1200);

    // 2. Build short radio announcement script via Lovable AI in target language
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
              { role: "system", content: SYSTEM_PROMPTS[lang] },
              {
                role: "user",
                content: `Title: ${localizedTitle}\nCategory: ${post.category || "general"}\nLead: ${localizedDesc || ""}\nExcerpt: ${cleanContent}`,
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
      script = FALLBACKS[lang](localizedTitle, localizedDesc || "");
    }

    // Clean for TTS
    script = script
      .replace(/[*_`#>]/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 1500);

    // 3. ElevenLabs TTS — George (multilingual_v2 handles all 4 languages)
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

    // 4. Upload to storage (lang-suffixed filename)
    const today = new Date().toISOString().slice(0, 10);
    const filePath = `blog-announcements/${today}-${post.slug}-${lang}.mp3`;

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

    // 5. Save to radio_announcements (with language)
    await supabase.from("radio_announcements").insert({
      post_id: post.id,
      post_title: localizedTitle,
      post_slug: post.slug,
      script,
      audio_url: audioUrl,
      voice_id: VOICE_ID_GEORGE,
      scheduled_for: new Date().toISOString(),
      kind: "blog_daily",
      lang,
    });

    // 5b. Inject into radio_schedule (per-language slot)
    try {
      // Estimate duration ~14 chars/sec, min 15s, max 45s for short blog announce
      const estimatedDuration = Math.min(45, Math.max(15, Math.round(script.length / 14)));

      const { data: maxRow } = await supabase
        .from("radio_schedule")
        .select("position")
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextPosition = ((maxRow?.position as number | undefined) ?? 0) + 1;

      await supabase.from("radio_schedule").insert({
        item_type: "announcement",
        custom_title: `${LANG_FLAGS[lang]} ${LANG_LABELS[lang]}: ${localizedTitle}`,
        custom_audio_url: audioUrl,
        custom_duration: estimatedDuration,
        position: nextPosition,
        lang,
      });
    } catch (schedErr) {
      console.warn("Could not insert into radio_schedule:", schedErr);
    }

    // 6. Emit agent event
    await supabase.from("agent_events").insert({
      source: "daily-blog-audio-announce",
      event_type: "radio.announcement",
      priority: 4,
      target_type: "blog_post",
      target_id: post.id,
      payload: {
        audio_url: audioUrl,
        title: localizedTitle,
        slug: post.slug,
        kind: "blog_daily",
        lang,
        script_preview: script.slice(0, 160),
      },
    });

    console.log(`✅ Blog audio announce ready [${lang}]:`, audioUrl);

    return new Response(
      JSON.stringify({
        success: true,
        post_id: post.id,
        title: localizedTitle,
        audio_url: audioUrl,
        script_length: script.length,
        lang,
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
