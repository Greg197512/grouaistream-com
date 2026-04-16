import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { audioBase64, name, description } = await req.json();

    if (!audioBase64 || audioBase64.length < 1000) {
      return new Response(JSON.stringify({ error: "No audio provided or too short" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Identify user from JWT
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData } = await supabase.auth.getUser(jwt);
    const userId = userData?.user?.id;

    console.log("[VoiceClone] Cloning voice:", name, "user:", userId, "size:", audioBase64.length);

    const binary = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
    const audioBlob = new Blob([binary], { type: "audio/webm" });

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
    const voiceId = result.voice_id;
    console.log("[VoiceClone] Voice cloned:", voiceId);

    // Save to user_voices table (so user doesn't have to clone again)
    let savedRecord = null;
    if (userId && voiceId) {
      const label = (name || "Mój głos").substring(0, 80);
      const { data: inserted, error: insertErr } = await supabase
        .from("user_voices")
        .upsert(
          { user_id: userId, voice_id: voiceId, label, is_default: true },
          { onConflict: "user_id,voice_id" }
        )
        .select()
        .single();

      if (insertErr) {
        console.error("[VoiceClone] DB save error:", insertErr);
      } else {
        savedRecord = inserted;
        // Reset other voices' default flag
        await supabase
          .from("user_voices")
          .update({ is_default: false })
          .eq("user_id", userId)
          .neq("id", inserted.id);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      voiceId,
      name: name || "GrouAI User Voice",
      saved: !!savedRecord,
      record: savedRecord,
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
