import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// George — głęboki, dojrzały męski głos (multi-language via eleven_multilingual_v2)
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
  pl: "Historia",
  en: "Story",
  nl: "Verhaal",
  ua: "Історія",
};

// AI system prompts per language — tone/style identical, just localised
const SYSTEM_PROMPTS: Record<Lang, string> = {
  pl: "Jesteś radiowym lektorem-narratorem GrouAI Stream. Tworzysz KRÓTKIE skrypty audio (60-90 sekund mowy ≈ 150-220 słów po polsku) o pionierach muzyki elektronicznej. STYL: ciepły, dojrzały, refleksyjny, emocjonalny — jak narrator dokumentu na BBC. Zacznij intrygująco — sceną, pytaniem, lub konkretnym momentem (datą, miejscem). Wybierz JEDEN najmocniejszy moment z artykułu i opowiedz go z emocjami. Zakończ zaproszeniem żeby przeczytać całą historię na grouaistream.com/blog. NIE używaj markdown, NIE wymieniaj wszystkiego — wybieraj. Pisz ciągłym tekstem, bez nagłówków, bez list. Mów językiem mówionym, krótkimi zdaniami, z naturalnym rytmem. Pauzy oznacz wielokropkiem (...). Możesz dodać jeden cytat artysty.",
  en: "You are the radio narrator for GrouAI Stream. Write SHORT audio scripts (60-90 seconds of speech ≈ 150-220 English words) about pioneers of electronic music. STYLE: warm, mature, reflective, emotional — like a BBC documentary narrator. Open intriguingly — with a scene, a question, or a specific moment (date, place). Pick ONE strongest moment from the article and tell it with emotion. End by inviting listeners to read the full story on grouaistream.com/blog. NO markdown. Don't list everything — curate. Write flowing prose, no headings, no bullet lists. Use spoken language, short sentences, natural rhythm. Mark pauses with ellipses (...). You may include one short artist quote.",
  nl: "Je bent de radio-verteller van GrouAI Stream. Schrijf KORTE audio-scripts (60-90 seconden spraak ≈ 150-220 Nederlandse woorden) over pioniers van elektronische muziek. STIJL: warm, volwassen, reflectief, emotioneel — als een BBC-documentaireverteller. Begin intrigerend — met een scène, een vraag, of een concreet moment (datum, plek). Kies ÉÉN sterkste moment uit het artikel en vertel het met emotie. Eindig met een uitnodiging om het volledige verhaal te lezen op grouaistream.com/blog. GEEN markdown. Niet alles opsommen — selecteer. Schrijf vloeiend proza, geen koppen, geen lijsten. Spreektaal, korte zinnen, natuurlijk ritme. Pauzes markeren met puntjes (...). Eén korte artiestencitaat is toegestaan.",
  ua: "Ти радіоведучий-оповідач GrouAI Stream. Створюй КОРОТКІ аудіо-скрипти (60-90 секунд мовлення ≈ 150-220 українських слів) про піонерів електронної музики. СТИЛЬ: теплий, зрілий, рефлексивний, емоційний — як оповідач документального фільму BBC. Починай інтригуюче — сценою, запитанням, або конкретним моментом (дата, місце). Обери ОДИН найсильніший момент зі статті й розкажи його з емоцією. Завершуй запрошенням прочитати повну історію на grouaistream.com/blog. БЕЗ markdown. Не перелічуй усе — обирай. Пиши плавною прозою, без заголовків, без списків. Розмовна мова, короткі речення, природний ритм. Паузи познач трикрапкою (...). Можеш додати одну коротку цитату артиста.",
};

const USER_PROMPTS: Record<Lang, (title: string, lead: string, content: string) => string> = {
  pl: (t, l, c) => `Artykuł: "${t}"\nLead: ${l}\n\nTreść:\n${c}\n\nNapisz skrypt 60-90 sekund mowy.`,
  en: (t, l, c) => `Article: "${t}"\nLead: ${l}\n\nContent:\n${c}\n\nWrite a 60-90 second speech script.`,
  nl: (t, l, c) => `Artikel: "${t}"\nLead: ${l}\n\nInhoud:\n${c}\n\nSchrijf een script van 60-90 seconden spraak.`,
  ua: (t, l, c) => `Стаття: "${t}"\nЛід: ${l}\n\nЗміст:\n${c}\n\nНапиши скрипт на 60-90 секунд мовлення.`,
};

const FALLBACK_SCRIPTS: Record<Lang, (title: string, desc: string) => string> = {
  pl: (t, d) => `Posłuchaj jednej z najpiękniejszych historii w muzyce elektronicznej. ${t}. ${d} Pełna opowieść czeka na grouaistream.com/blog.`,
  en: (t, d) => `Listen to one of the most beautiful stories in electronic music. ${t}. ${d} The full story awaits at grouaistream.com/blog.`,
  nl: (t, d) => `Luister naar een van de mooiste verhalen in de elektronische muziek. ${t}. ${d} Het volledige verhaal wacht op grouaistream.com/blog.`,
  ua: (t, d) => `Послухай одну з найкрасивіших історій електронної музики. ${t}. ${d} Повна історія чекає на grouaistream.com/blog.`,
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
  // PL is canonical (base column). Other languages live in `{base}_{lang}` columns when available.
  if (lang === "pl") return post[base] || "";
  const localized = post[`${base}_${lang}`];
  return (localized && String(localized).trim().length > 0) ? localized : (post[base] || "");
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY missing");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY missing");

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const triggeredBy = req.headers.get("x-trigger") || "cron";

    // Resolve language from query string OR JSON body OR default
    const url = new URL(req.url);
    let lang: Lang = parseLang(url.searchParams.get("lang"));
    try {
      if (req.method === "POST") {
        const body = await req.clone().json().catch(() => null);
        if (body?.lang) lang = parseLang(body.lang);
      }
    } catch (_) { /* ignore */ }

    // Daily cap: max 2 blog/story radio announcements per day (combined across all kinds & languages)
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const { count: todayCount } = await supabase
      .from("radio_announcements")
      .select("id", { count: "exact", head: true })
      .in("kind", ["music_story_radio", "blog_daily"])
      .gte("created_at", startOfDay.toISOString());
    if ((todayCount ?? 0) >= 2) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "daily_cap_reached", count: todayCount, lang }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Latest published music_stories post not yet announced in this language
    const { data: recentAnnounced } = await supabase
      .from("radio_announcements")
      .select("post_id")
      .eq("kind", "music_story_radio")
      .eq("lang", lang)
      .order("created_at", { ascending: false })
      .limit(20);
    const announcedIds = new Set((recentAnnounced || []).map((r: any) => r.post_id));

    const { data: candidates, error: postErr } = await supabase
      .from("seo_blog_posts")
      .select("id, title, title_en, title_nl, title_ua, slug, description, description_en, description_nl, description_ua, content, content_en, content_nl, content_ua, cover_url")
      .eq("is_published", true)
      .in("category", ["sound_chronicles", "music_stories"])
      .order("created_at", { ascending: false })
      .limit(10);

    if (postErr || !candidates?.length) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "no_music_story_post", lang }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const post = candidates.find((p: any) => !announcedIds.has(p.id)) || candidates[0];

    // 2. Build emotional 60-90s radio script via Lovable AI in target language
    const localizedTitle = pickLocalizedField(post, "title", lang);
    const localizedDesc = pickLocalizedField(post, "description", lang);
    const localizedContent = pickLocalizedField(post, "content", lang);
    const cleanContent = stripMarkdown(localizedContent).slice(0, 2500);

    const aiResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemma-2-9b-it:free",
        messages: [
          { role: "system", content: SYSTEM_PROMPTS[lang] },
          { role: "user", content: USER_PROMPTS[lang](localizedTitle, localizedDesc || "", cleanContent) },
        ],
      }),
    });

    let script = "";
    if (aiResp.ok) {
      const ai = await aiResp.json();
      script = (ai.choices?.[0]?.message?.content || "").trim();
    }

    if (!script) {
      script = FALLBACK_SCRIPTS[lang](localizedTitle, localizedDesc || "");
    }

    // Clean for TTS
    script = script
      .replace(/[*_`#>]/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2000);

    // 3. ElevenLabs TTS — George (multilingual_v2 handles PL/EN/NL/UA natively)
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

    // 4. Upload to storage with language suffix
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    const filePath = `music-stories/${stamp}-${post.slug}-${lang}.mp3`;

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
      kind: "music_story_radio",
      lang,
    });

    // 6. Emit agent event
    await supabase.from("agent_events").insert({
      source: "music-story-radio-announce",
      event_type: "radio.music_story",
      priority: 5,
      target_type: "blog_post",
      target_id: post.id,
      payload: {
        audio_url: audioUrl,
        title: localizedTitle,
        slug: post.slug,
        kind: "music_story_radio",
        voice: "george",
        lang,
        script_preview: script.slice(0, 200),
      },
    });

    await supabase.rpc("log_seo_activity", {
      _action_type: "music_story_radio",
      _level: "success",
      _message: `${LANG_FLAGS[lang]} Audio historia muzyczna [${lang.toUpperCase()}]: "${localizedTitle}"`,
      _metadata: { slug: post.slug, post_id: post.id, audio_url: audioUrl, voice: "george", lang },
      _triggered_by: triggeredBy,
    });

    console.log(`✅ Music story radio ready [${lang}]:`, audioUrl);

    return new Response(
      JSON.stringify({
        success: true,
        post_id: post.id,
        title: localizedTitle,
        audio_url: audioUrl,
        script_length: script.length,
        voice: "George",
        lang,
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
