// HYBRID router AI: bierze fingerprint usera + prompt i wybiera najlepszy model
// (Suno = pełne utwory z wokalem, ElevenLabs = krótki precyzyjny wokal, MusicGen = instrumental z BPM/key)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateRequest {
  prompt?: string;
  use_fingerprint?: boolean; // "Brzmiej jak moje top 10"
  engine?: "auto" | "musicgen" | "suno" | "elevenlabs"; // auto = router decyduje
  quality?: "standard" | "premium"; // standard = MusicGen (tani), premium = Suno/ElevenLabs
  duration_seconds?: number;
  instrumental?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body: GenerateRequest = await req.json();
    let finalPrompt = (body.prompt || "").trim();
    let fingerprint: any = null;

    // === STEP 1: Auto-fingerprint jeśli user kliknął "Brzmiej jak moje top 10"
    if (body.use_fingerprint) {
      const { data: fp, error: fpErr } = await supabase.rpc("get_user_audio_fingerprint");
      if (fpErr) console.error("[fingerprint] err:", fpErr);
      fingerprint = fp;

      if (!fp || fp.error || !fp.has_history) {
        return new Response(JSON.stringify({
          error: "no_history",
          message: fp?.message || "Posłuchaj kilka utworów żeby AI poznało Twój gust.",
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Buduj prompt z fingerprintu
      const parts: string[] = [];
      if (fp.dominant_genre) parts.push(`gatunek ${fp.dominant_genre}`);
      if (fp.dominant_subgenre) parts.push(`(${fp.dominant_subgenre})`);
      if (fp.dominant_mood) parts.push(`mood: ${fp.dominant_mood}`);
      if (fp.avg_bpm) parts.push(`${fp.avg_bpm} BPM`);
      if (fp.dominant_key) parts.push(`tonacja ${fp.dominant_key}`);
      if (fp.avg_energy > 0.7) parts.push("wysoka energia");
      else if (fp.avg_energy < 0.4) parts.push("niska energia, chillout");
      if (fp.avg_danceability > 0.7) parts.push("taneczny");
      if (fp.top_artists?.length) parts.push(`w stylu: ${fp.top_artists.slice(0, 3).join(", ")}`);

      finalPrompt = parts.join(", ") + (finalPrompt ? `. Dodatkowe wytyczne: ${finalPrompt}` : "");
    }

    if (!finalPrompt) {
      return new Response(JSON.stringify({ error: "empty_prompt" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === STEP 2: Router — wybiera silnik na podstawie promptu i preferencji
    let engine = body.engine || "auto";
    const duration = body.duration_seconds || 30;
    const instrumental = body.instrumental ?? false;

    if (engine === "auto") {
      // Heurystyka: krótki wokal → ElevenLabs, długi pełny utwór → Suno
      if (duration <= 30 && !instrumental) engine = "elevenlabs";
      else engine = "suno";
    }

    // === STEP 3: Stwórz wpis w studio_generations (status: pending)
    const { data: gen, error: genErr } = await supabase
      .from("studio_generations")
      .insert({
        user_id: userId,
        ai_model: engine,
        prompt: finalPrompt.substring(0, 2000),
        status: "pending",
        duration_seconds: duration,
        bpm: fingerprint?.avg_bpm || null,
        music_key: fingerprint?.dominant_key || null,
        genre: fingerprint?.dominant_genre || null,
        subgenre: fingerprint?.dominant_subgenre || null,
        mood: fingerprint?.dominant_mood || null,
        metadata: {
          used_fingerprint: !!body.use_fingerprint,
          fingerprint_snapshot: fingerprint,
          engine_chosen: engine,
        },
      })
      .select()
      .single();

    if (genErr || !gen) {
      console.error("[studio-generate] insert err:", genErr);
      return new Response(JSON.stringify({ error: "db_insert_failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === STEP 4: Trigger generację w odpowiednim silniku (fire-and-forget)
    // Wynik zostanie zapisany do studio_generations przez webhook lub poll
    let triggerResult: any = { triggered: true, engine };

    try {
      if (engine === "elevenlabs") {
        const elKey = Deno.env.get("ELEVENLABS_API_KEY");
        if (elKey) {
          // ElevenLabs Music API
          const elResp = await fetch("https://api.elevenlabs.io/v1/music/compositions", {
            method: "POST",
            headers: { "xi-api-key": elKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: finalPrompt,
              music_length_ms: Math.min(duration * 1000, 90000),
            }),
          });
          if (elResp.ok) {
            const elData = await elResp.json();
            triggerResult.external_id = elData.composition_id || elData.id;
            await supabase.from("studio_generations").update({
              platform_track_id: triggerResult.external_id,
              status: "processing",
            }).eq("id", gen.id);
          } else {
            const errText = await elResp.text();
            console.error("[elevenlabs] err:", elResp.status, errText);
            triggerResult.error = `elevenlabs_${elResp.status}`;
          }
        }
      } else if (engine === "suno") {
        const sunoKey = Deno.env.get("SUNO_API_KEY");
        if (sunoKey) {
          const sunoResp = await fetch("https://api.sunoapi.org/api/v1/generate", {
            method: "POST",
            headers: { Authorization: `Bearer ${sunoKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: finalPrompt,
              customMode: false,
              instrumental,
              model: "V4",
            }),
          });
          if (sunoResp.ok) {
            const sunoData = await sunoResp.json();
            triggerResult.external_id = sunoData.data?.taskId || sunoData.taskId;
            await supabase.from("studio_generations").update({
              platform_track_id: triggerResult.external_id,
              status: "processing",
            }).eq("id", gen.id);
          } else {
            const errText = await sunoResp.text();
            console.error("[suno] err:", sunoResp.status, errText);
            triggerResult.error = `suno_${sunoResp.status}`;
          }
        }
      }
    } catch (e) {
      console.error("[studio-generate] trigger err:", e);
      triggerResult.error = e instanceof Error ? e.message : "trigger_failed";
    }

    return new Response(JSON.stringify({
      success: true,
      generation_id: gen.id,
      engine,
      prompt: finalPrompt,
      fingerprint,
      ...triggerResult,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[studio-generate] error:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "unknown_error",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
