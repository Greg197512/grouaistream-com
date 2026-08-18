import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// GROUAI — radio-night-story: NOCNE CZYTANIE o 22:40 (wt/pt).
// Bierze najnowszy wpis z bloga, przerabia go na spokojne, nocne opowiadanie
// (lektor George, ElevenLabs), wrzuca audio do bucketa radio-audio i wstawia na
// początek radio_schedule, żeby poszło na żywo. Wzorowane na daily-blog-audio-announce.
// Deploy na projekcie aplikacji (radio_schedule / radio-audio / ELEVENLABS_API_KEY są tam).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// George — ten sam ciepły, wielojęzyczny głos co reszta radia (spójna marka).
const VOICE_ID_GEORGE = "JBFqnCBsd6RMkjVDRZzb";

const SYSTEM_PROMPT =
  "Jesteś nocnym lektorem radia GrouAI Stream. Jest 22:40 — pora na spokojne, kameralne czytanie. " +
  "Na podstawie wpisu z bloga stwórz NOCNE OPOWIADANIE do przeczytania na żywo: ciepłe, refleksyjne, płynne, " +
  "jakbyś opowiadał słuchaczowi przy jednym świetle nocnej lampki. Zacznij od krótkiego, cichego powitania " +
  "(np. „Dobry wieczór, tu GrouAI Stream. Jest 22:40…”). Prowadź myśl jak gawędę: obrazowo, bez żargonu, " +
  "bez wypunktowań i nagłówków, samą prozą do czytania. Trzymaj się faktów z wpisu — nic nie zmyślaj. " +
  "Na końcu delikatnie zaproś: pełny tekst na grouaistream.com, dobranoc. " +
  "Długość: 350–550 słów (około 2,5–3,5 minuty mowy). Zwróć TYLKO czysty tekst do czytania, bez markdown i linków.";

const FALLBACK = (t: string, d: string) =>
  `Dobry wieczór, tu GrouAI Stream. Jest 22:40 — pora zwolnić. Dziś na blogu: ${t}. ${d} ` +
  `Zostań z nami na chwilę, niech muzyka poniesie resztę. Pełny tekst znajdziesz na grouaistream.com. Dobranoc.`;

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
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY missing");

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Kill switch opcjonalny (radio_config.night_story_enabled = false → pomiń).
    try {
      const { data: cfg } = await supabase.from("radio_config").select("night_story_enabled").limit(1).single();
      if (cfg && cfg.night_story_enabled === false) {
        return new Response(JSON.stringify({ skipped: true, reason: "night_story_disabled" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } catch (_) { /* brak kolumny/wiersza — domyślnie włączone */ }

    // Najnowszy opublikowany wpis (PL).
    const { data: post, error: postErr } = await supabase
      .from("seo_blog_posts")
      .select("id, title, slug, description, content, cover_url, category")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (postErr || !post) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_published_post" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const cleanContent = stripMarkdown(post.content || "").slice(0, 3500);

    // Skrypt nocnego opowiadania (OpenRouter). Fallback, gdy AI padnie.
    let script = "";
    if (OPENROUTER_API_KEY) {
      try {
        const aiResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            temperature: 0.7,
            max_tokens: 1600,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: `Tytuł: ${post.title}\nKategoria: ${post.category || "ogólne"}\nZajawka: ${post.description || ""}\nTreść wpisu:\n${cleanContent}` },
            ],
          }),
        });
        if (aiResp.ok) {
          const ai = await aiResp.json();
          script = (ai.choices?.[0]?.message?.content || "").trim();
        }
      } catch (e) { console.error("AI script error:", e); }
    }
    if (!script || script.length < 200) script = FALLBACK(post.title, post.description || "");

    // Czyszczenie pod TTS.
    script = script.replace(/[*_`#>]/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\s+/g, " ").trim().slice(0, 3500);

    // ElevenLabs TTS — spokojne, nocne ustawienia (wolniej, stabilniej).
    const ttsResp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID_GEORGE}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: script,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.6, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true, speed: 0.96 },
        }),
      }
    );
    if (!ttsResp.ok) {
      const errTxt = await ttsResp.text();
      throw new Error(`ElevenLabs error ${ttsResp.status}: ${errTxt.slice(0, 200)}`);
    }
    const audioBytes = new Uint8Array(await ttsResp.arrayBuffer());

    // Upload do bucketa radio-audio.
    const today = new Date().toISOString().slice(0, 10);
    const filePath = `night-stories/${today}-${post.slug}.mp3`;
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.find((b) => b.name === "radio-audio")) {
      await supabase.storage.createBucket("radio-audio", { public: true });
    }
    const { error: upErr } = await supabase.storage.from("radio-audio").upload(filePath, audioBytes, { contentType: "audio/mpeg", upsert: true });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
    const audioUrl = supabase.storage.from("radio-audio").getPublicUrl(filePath).data.publicUrl;

    // Zapis do radio_announcements (jak sibling).
    await supabase.from("radio_announcements").insert({
      post_id: post.id, post_title: post.title, post_slug: post.slug,
      script, audio_url: audioUrl, voice_id: VOICE_ID_GEORGE,
      scheduled_for: new Date().toISOString(), kind: "night_story", lang: "pl",
    });

    // Wstaw na początek radio_schedule → poleci na żywo. Najpierw usuń poprzednie nocne czytanie.
    try {
      const estimatedDuration = Math.min(300, Math.max(60, Math.round(script.length / 14)));
      const titleWithFlag = `🌙 Nocne czytanie: ${post.title}`;
      await supabase.from("radio_schedule").delete().eq("item_type", "announcement").ilike("custom_title", "🌙 Nocne czytanie:%");
      const { data: minRow } = await supabase.from("radio_schedule").select("position").order("position", { ascending: true }).limit(1).maybeSingle();
      const minPos = (minRow?.position as number | undefined) ?? 0;
      await supabase.from("radio_schedule").insert({
        item_type: "announcement", custom_title: titleWithFlag, custom_audio_url: audioUrl,
        custom_duration: estimatedDuration, position: minPos - 1, lang: "pl",
      });
    } catch (schedErr) { console.warn("radio_schedule insert:", schedErr); }

    return new Response(JSON.stringify({ success: true, title: post.title, audio_url: audioUrl, script_length: script.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("radio-night-story error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
