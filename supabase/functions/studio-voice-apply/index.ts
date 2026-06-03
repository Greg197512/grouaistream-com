// Studio Voice Apply — aplikuje głos ElevenLabs (śpiew/wokal) na wygenerowaną ścieżkę muzyczną.
// Muzyka pochodzi z Suno lub MusicGen. ElevenLabs dostarcza TYLKO głosy.
// Zwraca osobno: vocals base64 + instrukcje do miksowania w przeglądarce.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type VocalStyle = "singing" | "rap" | "whisper" | "powerful" | "soft";

const STYLE_SETTINGS: Record<VocalStyle, {
  stability: number;
  similarity_boost: number;
  style: number;
  speed: number;
}> = {
  singing:  { stability: 0.12, similarity_boost: 0.85, style: 1.0, speed: 0.75 },
  rap:      { stability: 0.28, similarity_boost: 0.78, style: 0.9, speed: 1.20 },
  whisper:  { stability: 0.70, similarity_boost: 0.90, style: 0.4, speed: 0.85 },
  powerful: { stability: 0.08, similarity_boost: 0.82, style: 1.0, speed: 0.88 },
  soft:     { stability: 0.55, similarity_boost: 0.88, style: 0.6, speed: 0.80 },
};

// Auto-select best voice based on genre and style
const selectVoiceId = (genre: string, vocalStyle: VocalStyle, customVoiceId?: string): string => {
  if (customVoiceId) return customVoiceId;
  const femaleGenres = ["Pop", "R&B", "Disco", "Jazz", "Ambient", "Lo-fi", "Indie", "Classical"];
  const maleEnergetic = ["Electronic", "House", "Trap", "Metal", "Rock", "Hip-Hop"];
  if (vocalStyle === "rap") return "nPczCjzI2devNBz1zQrb"; // Brian — rap voice
  if (femaleGenres.includes(genre)) return "EXAVITQu4vr4xnSDxMaL"; // Sarah — melodic female
  if (maleEnergetic.includes(genre)) return "nPczCjzI2devNBz1zQrb"; // Brian — energetic male
  return "TX3LPaxmHKxFdv7VOQHJ"; // Liam — versatile default
};

// Split long lyrics into chunks to avoid TTS character limits
const chunkLyrics = (text: string, maxChars = 2500): string[] => {
  if (text.length <= maxChars) return [text];
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    if ((current + "\n\n" + p).length > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = p;
    } else {
      current = current ? current + "\n\n" + p : p;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text.substring(0, maxChars)];
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY not configured");

    const body = await req.json();
    const {
      lyrics,
      voiceId: customVoiceId,
      vocalStyle = "singing" as VocalStyle,
      genre = "Pop",
      language = "pl",
      generation_id,
    } = body;

    if (!lyrics || lyrics.trim().length === 0) {
      return new Response(JSON.stringify({
        error: "no_lyrics",
        message: "Podaj słowa piosenki w polu 'lyrics'.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const voiceId = selectVoiceId(genre, vocalStyle as VocalStyle, customVoiceId);
    const settings = STYLE_SETTINGS[vocalStyle as VocalStyle] || STYLE_SETTINGS.singing;
    const model = ["pl", "nl", "uk", "de", "fr", "es"].includes(language)
      ? "eleven_multilingual_v2"
      : "eleven_turbo_v2_5";

    console.log("[studio-voice-apply] voice:", voiceId, "style:", vocalStyle, "model:", model);

    // Generate vocals — może być kilka chunków dla długich tekstów
    const chunks = chunkLyrics(lyrics.trim());
    const vocalParts: Uint8Array[] = [];

    for (const chunk of chunks) {
      const ttsRes = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            text: chunk,
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
        const isQuota = ttsRes.status === 401 || ttsRes.status === 402 ||
          errText.includes("insufficient_credits") || errText.includes("quota_exceeded");

        if (isQuota) {
          return new Response(JSON.stringify({
            error: "quota_exceeded",
            message: "Brak kredytów ElevenLabs. Doładuj plan na elevenlabs.io.",
          }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        throw new Error(`ElevenLabs TTS error ${ttsRes.status}: ${errText.substring(0, 200)}`);
      }

      const buf = await ttsRes.arrayBuffer();
      vocalParts.push(new Uint8Array(buf));
    }

    // Concatenate all vocal chunks
    const totalLen = vocalParts.reduce((s, p) => s + p.length, 0);
    const combined = new Uint8Array(totalLen);
    let offset = 0;
    for (const part of vocalParts) {
      combined.set(part, offset);
      offset += part.length;
    }

    const vocalsBase64 = base64Encode(combined);
    console.log("[studio-voice-apply] vocals generated, bytes:", totalLen);

    // Opcjonalnie: zaktualizuj studio_generations jeśli generation_id podane
    if (generation_id) {
      await supabase.from("studio_generations").update({
        metadata: { voice_applied: true, voice_id: voiceId, vocal_style: vocalStyle },
      }).eq("id", generation_id);
    }

    return new Response(JSON.stringify({
      success: true,
      vocals: vocalsBase64,
      voice_id: voiceId,
      vocal_style: vocalStyle,
      chunks_generated: chunks.length,
      size_bytes: totalLen,
      // Mix instructions for browser-side audio processing
      mix_settings: {
        music_gain: 0.55,        // tło muzyczne ciszej (55%)
        vocal_gain: 0.95,        // wokal na przodzie
        harmony_gain: 0.18,      // lekka harmonia +3 półtony
        reverb_decay: 2.5,       // sala koncertowa 2.5s
        vocal_start_delay: 0.4,  // krótkie opóźnienie wejścia wokalu
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[studio-voice-apply] error:", err);
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : "unknown_error",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
