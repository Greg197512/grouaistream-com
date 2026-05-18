// ElevenLabs Voice Studio — TYLKO głosy, nie muzyka.
// Muzyka generowana przez Suno (pełne piosenki) lub MusicGen (instrumental).
// Ta funkcja: TTS śpiewający + klonowanie głosu + voice apply na ścieżkę.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Presets głosowych (używane wyłącznie do TTS/śpiewu)
const VOICE_PRESETS = {
  sarah: { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", gender: "female", style: "melodic" },
  brian: { id: "nPczCjzI2devNBz1zQrb", name: "Brian", gender: "male", style: "energetic" },
  liam:  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam",  gender: "male", style: "neutral"  },
  aria:  { id: "9BWtsMINqrJLrRacOk9x", name: "Aria",  gender: "female", style: "warm"   },
};

type VoiceStyle = "singing" | "rap" | "whisper" | "powerful" | "soft" | "narrator";

const STYLE_SETTINGS: Record<VoiceStyle, {
  stability: number;
  similarity_boost: number;
  style: number;
  speed: number;
}> = {
  singing:  { stability: 0.15, similarity_boost: 0.85, style: 1.0, speed: 0.75 },
  rap:      { stability: 0.30, similarity_boost: 0.80, style: 0.9, speed: 1.15 },
  whisper:  { stability: 0.70, similarity_boost: 0.90, style: 0.4, speed: 0.85 },
  powerful: { stability: 0.10, similarity_boost: 0.80, style: 1.0, speed: 0.90 },
  soft:     { stability: 0.55, similarity_boost: 0.88, style: 0.6, speed: 0.80 },
  narrator: { stability: 0.55, similarity_boost: 0.75, style: 0.3, speed: 1.00 },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not configured");

    const body = await req.json();

    // === MODE: generate_voice (default) — generuje śpiewający TTS ===
    const mode: string = body.mode || "generate_voice";

    if (mode === "generate_voice" || mode === "singing") {
      const {
        text,
        voiceId,
        voiceStyle = "singing" as VoiceStyle,
        language = "pl",
      } = body;

      if (!text || text.trim().length === 0) {
        return new Response(JSON.stringify({ error: "No text provided", hint: "Pass 'text' field with lyrics or speech." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const selectedVoiceId = voiceId || VOICE_PRESETS.sarah.id;
      const settings = STYLE_SETTINGS[voiceStyle as VoiceStyle] || STYLE_SETTINGS.singing;
      const model = language === "pl" || language === "uk" || language === "nl"
        ? "eleven_multilingual_v2"
        : "eleven_turbo_v2_5";

      console.log("[ElevenLabs Voice] Generating voice:", { voiceId: selectedVoiceId, voiceStyle, model, textLen: text.length });

      const ttsRes = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            text: text.substring(0, 3000),
            model_id: model,
            voice_settings: {
              stability: settings.stability,
              similarity_boost: settings.similarity_boost,
              style: settings.style,
              use_speaker_boost: true,
              speed: settings.speed,
            },
          }),
        }
      );

      if (!ttsRes.ok) {
        const errText = await ttsRes.text();
        console.error("[ElevenLabs Voice] TTS error:", ttsRes.status, errText);

        const isQuota = ttsRes.status === 401 || ttsRes.status === 402 ||
          errText.includes("insufficient_credits") || errText.includes("quota_exceeded");

        if (isQuota) {
          return new Response(JSON.stringify({
            error: "quota_exceeded",
            message: "Brak kredytów ElevenLabs TTS. Doładuj plan na elevenlabs.io.",
          }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        throw new Error(`ElevenLabs TTS error: ${ttsRes.status}`);
      }

      const audioBuffer = await ttsRes.arrayBuffer();
      const audioBase64 = base64Encode(audioBuffer);

      console.log("[ElevenLabs Voice] Generated, bytes:", audioBuffer.byteLength);

      return new Response(JSON.stringify({
        success: true,
        vocals: audioBase64,
        voice_id: selectedVoiceId,
        voice_style: voiceStyle,
        model_used: model,
        size_bytes: audioBuffer.byteLength,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === MODE: list_voices — zwraca dostępne głosy ===
    if (mode === "list_voices") {
      const voicesRes = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: { "xi-api-key": ELEVENLABS_API_KEY },
      });
      if (!voicesRes.ok) throw new Error("Failed to fetch voices");
      const voicesData = await voicesRes.json();
      return new Response(JSON.stringify({
        success: true,
        presets: VOICE_PRESETS,
        custom_voices: voicesData.voices?.map((v: { voice_id: string; name: string; category: string }) => ({
          id: v.voice_id,
          name: v.name,
          category: v.category,
        })) || [],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      error: "unknown_mode",
      available_modes: ["generate_voice", "singing", "list_voices"],
      note: "ElevenLabs is voice-only. Use replicate-musicgen for music generation.",
    }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[ElevenLabs Voice] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
