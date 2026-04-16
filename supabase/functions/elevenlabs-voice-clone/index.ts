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

    const { audioBase64, name, description } = await req.json();

    if (!audioBase64 || audioBase64.length < 1000) {
      return new Response(JSON.stringify({ error: "No audio provided or too short" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[VoiceClone] Cloning voice:", name, "audio size:", audioBase64.length);

    // Decode base64 → Uint8Array → Blob
    const binary = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
    const audioBlob = new Blob([binary], { type: "audio/webm" });

    // ElevenLabs Instant Voice Clone (multipart/form-data)
    const formData = new FormData();
    formData.append("name", (name || "GrouAI User Voice").substring(0, 100));
    formData.append("description", (description || "Voice cloned via GrouAI Studio for AI singing").substring(0, 500));
    formData.append("files", audioBlob, "voice-sample.webm");
    formData.append("remove_background_noise", "true");

    const cloneResponse = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
      body: formData,
    });

    if (!cloneResponse.ok) {
      const errText = await cloneResponse.text();
      console.error("[VoiceClone] API error:", cloneResponse.status, errText);

      // Detect quota / payment errors (cloning requires Creator+ plan)
      const isQuotaError =
        cloneResponse.status === 401 ||
        cloneResponse.status === 402 ||
        errText.includes("voice_limit_reached") ||
        errText.includes("can_not_use_instant_voice_cloning") ||
        errText.includes("insufficient_credits") ||
        errText.includes("payment_required");

      if (isQuotaError) {
        return new Response(JSON.stringify({
          error: "quota_exceeded",
          message: "Klonowanie głosu wymaga planu ElevenLabs Creator lub wyższego. Doładuj plan na elevenlabs.io aby używać własnego głosu.",
        }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error(`Voice clone failed: ${cloneResponse.status} - ${errText}`);
    }

    const result = await cloneResponse.json();
    console.log("[VoiceClone] Voice cloned:", result.voice_id);

    return new Response(JSON.stringify({
      success: true,
      voiceId: result.voice_id,
      name: name || "GrouAI User Voice",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[VoiceClone] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
