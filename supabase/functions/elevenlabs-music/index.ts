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

    console.log("[ElevenLabs Music] Generating:", prompt, "duration:", duration);

    // Step 1: Generate instrumental music
    const musicResponse = await fetch("https://api.elevenlabs.io/v1/music", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: prompt.substring(0, 1000),
        duration_seconds: duration || 30,
      }),
    });

    if (!musicResponse.ok) {
      const errText = await musicResponse.text();
      console.error("[ElevenLabs Music] API error:", musicResponse.status, errText);
      throw new Error(`ElevenLabs Music API error: ${musicResponse.status} - ${errText}`);
    }

    const musicBuffer = await musicResponse.arrayBuffer();
    const musicBase64 = base64Encode(musicBuffer);
    console.log("[ElevenLabs Music] Instrumental generated, size:", musicBuffer.byteLength);

    // Step 2: If vocals requested, generate TTS vocals
    let vocalBase64: string | null = null;
    if (vocals && vocalText && vocalText.trim().length > 0) {
      console.log("[ElevenLabs Music] Generating vocals...");
      
      // Use Sarah voice for singing (female) or Roger for male
      const voiceId = vocalVoiceId || "EXAVITQu4vr4xnSDxMaL"; // Sarah - melodic female
      
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
              stability: 0.3,       // Expressive, sing-like
              similarity_boost: 0.8,
              style: 0.7,           // Stylized delivery
              use_speaker_boost: true,
              speed: 0.9,           // Slightly slower for singing feel
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
        console.log("[ElevenLabs Music] Vocals generated, size:", vocalBuffer.byteLength);
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
