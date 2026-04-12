import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const { text, mode } = await req.json();
    if (!text || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: "No text provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Voice selection based on mode
    // Daniel (onwK4e9ZLuTAKqWW03F9) - deep, warm, natural male voice for assistant
    // Brian - energetic male voice for DJ (springy, disco, booming)
    const voiceId = mode === "dj" ? "nPczCjzI2devNBz1zQrb" : "onwK4e9ZLuTAKqWW03F9";
    
    // DJ voice: Ultra-expressive, springy disco DJ character
    // Assistant voice: Natural, warm, conversational — like talking to a real person
    // stability 0.50 = balanced expressiveness, similarity_boost 0.75 = natural character
    // style 0.3 = subtle stylization, speed 1.0 = natural pace
    const voiceSettings = mode === "dj" 
      ? { stability: 0.12, similarity_boost: 0.92, style: 1.0, use_speaker_boost: true, speed: 1.1 }
      : { stability: 0.50, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true, speed: 1.0 };

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text.substring(0, 2000),
          model_id: "eleven_multilingual_v2",
          voice_settings: voiceSettings,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("ElevenLabs API error:", response.status, errText);
      
      // Parse quota exceeded specifically
      try {
        const errJson = JSON.parse(errText);
        if (errJson?.detail?.status === "quota_exceeded") {
          return new Response(JSON.stringify({ 
            error: "Voice quota exceeded", 
            quota_exceeded: true,
            message: errJson.detail.message 
          }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch {}
      
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();

    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("TTS error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
