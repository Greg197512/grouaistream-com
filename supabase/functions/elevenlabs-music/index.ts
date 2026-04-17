import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }

    const { prompt, duration, vocals, vocalText, vocalVoiceId } = await req.json();

    if (!prompt || prompt.trim().length === 0) {
      return new Response(JSON.stringify({ error: "No prompt provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sanitize prompt — ElevenLabs ToS rejects certain words/phrases.
    // Replace risky terms with neutral musical equivalents.
    const sanitizePrompt = (raw: string): string => {
      const replacements: Array<[RegExp, string]> = [
        [/\bbeast\s*mode\b/gi, "powerful energetic"],
        [/\brap\b/gi, "hip-hop"],
        [/\branthem\b/gi, "track"],
        [/\bintense\b/gi, "energetic"],
        [/\baggressive\b/gi, "dynamic"],
        [/\bdark\b/gi, "moody"],
        [/\bviolent\b/gi, "powerful"],
        [/\bkill(er)?\b/gi, "strong"],
        [/\bfight\b/gi, "energetic"],
        [/\bweapon\b/gi, "instrument"],
        [/\bdrug\b/gi, "vibe"],
        [/\bsex(ual|y)?\b/gi, "smooth"],
      ];
      let cleaned = raw;
      for (const [re, rep] of replacements) cleaned = cleaned.replace(re, rep);
      return cleaned.trim().substring(0, 1000);
    };

    const cleanPrompt = sanitizePrompt(prompt);
    console.log("[ElevenLabs Music] Generating:", cleanPrompt, "duration:", duration);

    const callMusicApi = async (p: string) =>
      fetch("https://api.elevenlabs.io/v1/music", {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: p,
          duration_seconds: duration || 30,
        }),
      });

    // Step 1: Generate instrumental music (with auto-retry using ElevenLabs' own suggestion)
    let musicResponse = await callMusicApi(cleanPrompt);

    if (!musicResponse.ok && musicResponse.status === 400) {
      const errBody = await musicResponse.clone().text();
      try {
        const parsed = JSON.parse(errBody);
        const suggestion = parsed?.detail?.data?.prompt_suggestion;
        if (suggestion && parsed?.detail?.status === "bad_prompt") {
          console.log("[ElevenLabs Music] Retrying with API suggestion:", suggestion);
          musicResponse = await callMusicApi(suggestion);
        }
      } catch {
        // ignore parse failure
      }
    }

    if (!musicResponse.ok) {
      const errText = await musicResponse.text();
      console.error("[ElevenLabs Music] API error:", musicResponse.status, errText);

      // Detect insufficient credits / quota / payment errors
      const isQuotaError =
        musicResponse.status === 401 ||
        musicResponse.status === 402 ||
        errText.includes("insufficient_credits") ||
        errText.includes("quota_exceeded") ||
        errText.includes("payment_required");

      if (isQuotaError) {
        return new Response(JSON.stringify({
          error: "quota_exceeded",
          message: "Brak kredytów ElevenLabs Music. Twoje konto wyczerpało limit generowania muzyki. Doładuj plan na elevenlabs.io lub spróbuj ponownie po odnowieniu kwoty.",
        }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error(`ElevenLabs Music API error: ${musicResponse.status} - ${errText}`);
    }

    const musicBuffer = await musicResponse.arrayBuffer();
    const musicBase64 = base64Encode(musicBuffer);
    console.log("[ElevenLabs Music] Instrumental generated, size:", musicBuffer.byteLength);

    // Step 2: If vocals requested, generate singing-style TTS vocals
    let vocalBase64: string | null = null;
    if (vocals && vocalText && vocalText.trim().length > 0) {
      console.log("[ElevenLabs Music] Generating singing vocals...");
      
      // Voice selection based on style
      const voiceId = vocalVoiceId || "EXAVITQu4vr4xnSDxMaL"; // Sarah - melodic female
      
      // SINGING-OPTIMIZED SETTINGS:
      // stability 0.15 = maximum expressiveness & pitch variation (singing-like)
      // similarity_boost 0.85 = keep character but allow creative freedom
      // style 1.0 = MAXIMUM stylization — essential for singing delivery
      // speed 0.75 = slower tempo for melodic, song-like phrasing
      const ttsResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: vocalText.substring(0, 3000),
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.15,        // Very low = singing-like variation
              similarity_boost: 0.85,
              style: 1.0,             // Maximum stylization for singing
              use_speaker_boost: true,
              speed: 0.75,            // Slow for melodic delivery
            },
          }),
        }
      );

      if (!ttsResponse.ok) {
        console.error("[ElevenLabs Music] TTS error:", ttsResponse.status);
        // Continue without vocals
      } else {
        const vocalBuffer = await ttsResponse.arrayBuffer();
        vocalBase64 = base64Encode(vocalBuffer);
        console.log("[ElevenLabs Music] Singing vocals generated, size:", vocalBuffer.byteLength);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      music: musicBase64,
      vocals: vocalBase64,
      duration: duration || 30,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[ElevenLabs Music] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
