// Replicate MusicGen-Large — tani default engine (~$0.002 za 30s)
// 90% taniej niż ElevenLabs/Suno. Generuje instrumental w wysokiej jakości.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// MusicGen-Large stereo (Meta) — najlepsza jakość/cena na Replicate
const MUSICGEN_VERSION = "671ac645ce5e552cc63a54a2bbff63fcf798043055f2a04b1d735e6ee09b7bd6";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
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
    const userId = userData.user.id;

    const REPLICATE_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
    if (!REPLICATE_TOKEN) {
      return new Response(JSON.stringify({
        error: "missing_token",
        message: "Brak REPLICATE_API_TOKEN. Skontaktuj się z adminem.",
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const prompt: string = (body.prompt || "").trim();
    const duration: number = Math.min(Math.max(body.duration || 30, 8), 60);
    const generationId: string | null = body.generation_id || null;

    if (!prompt) {
      return new Response(JSON.stringify({ error: "empty_prompt" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[MusicGen] start:", { userId, prompt: prompt.substring(0, 80), duration });

    // POST do Replicate — Prefer: wait pozwala czekać do 60s synchronicznie
    const replicateRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_TOKEN}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({
        version: MUSICGEN_VERSION,
        input: {
          model_version: "stereo-large",
          prompt,
          duration,
          output_format: "mp3",
          normalization_strategy: "peak",
          temperature: 1.0,
          top_k: 250,
          top_p: 0.0,
          classifier_free_guidance: 3,
        },
      }),
    });

    if (!replicateRes.ok) {
      const errText = await replicateRes.text();
      console.error("[MusicGen] API error:", replicateRes.status, errText);

      if (generationId) {
        await supabase.from("studio_generations").update({ status: "failed" }).eq("id", generationId);
      }

      // 402 / quota
      if (replicateRes.status === 402 || errText.includes("billing")) {
        return new Response(JSON.stringify({
          error: "quota_exceeded",
          message: "Replicate wymaga doładowania konta. Skontaktuj się z adminem.",
        }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({
        error: "replicate_error",
        message: "MusicGen tymczasowo niedostępny. Spróbuj ponownie za chwilę.",
        details: errText.substring(0, 200),
      }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const prediction = await replicateRes.json();
    let audioUrl: string | null = prediction.output || null;
    let predictionId: string = prediction.id;

    // Polling jeśli jeszcze nie skończyło
    if (!audioUrl && prediction.status !== "succeeded") {
      let attempts = 0;
      while (attempts < 90) {
        await new Promise(r => setTimeout(r, 2000));
        const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
          headers: { Authorization: `Bearer ${REPLICATE_TOKEN}` },
        });
        const pollData = await pollRes.json();

        if (pollData.status === "succeeded") {
          audioUrl = pollData.output;
          break;
        }
        if (pollData.status === "failed" || pollData.status === "canceled") {
          if (generationId) {
            await supabase.from("studio_generations").update({
              status: "failed",
              error_message: pollData.error || "generation_failed",
            }).eq("id", generationId);
          }
          return new Response(JSON.stringify({
            error: "generation_failed",
            message: "Generowanie nie powiodło się. Spróbuj zmienić prompt.",
          }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        attempts++;
      }
    }

    if (!audioUrl) {
      if (generationId) {
        await supabase.from("studio_generations").update({ status: "timeout" }).eq("id", generationId);
      }
      return new Response(JSON.stringify({
        error: "timeout",
        message: "Generowanie trwa za długo. Spróbuj krótszego utworu.",
      }), { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Aktualizuj studio_generations
    if (generationId) {
      await supabase.from("studio_generations").update({
        audio_url: audioUrl,
        status: "completed",
        platform_track_id: predictionId,
      }).eq("id", generationId);
    }

    console.log("[MusicGen] success:", { predictionId, audioUrl: audioUrl.substring(0, 80) });

    return new Response(JSON.stringify({
      success: true,
      audio_url: audioUrl,
      prediction_id: predictionId,
      generation_id: generationId,
      engine: "musicgen",
      cost_estimate_usd: 0.002 * (duration / 30),
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[MusicGen] error:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "unknown_error",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
