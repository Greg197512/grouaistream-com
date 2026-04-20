// GrouAI Music Engine — Replicate MusicGen wrapper (MVP, działa zanim własny silnik się wytrenuje)
// Endpoint: POST /functions/v1/groua-music-engine
// Body:
//   { action: "generate", prompt, duration?: 8|15|30, model_version?: "stereo-large"|"large"|"melody-large", instrumental?: bool }
//   { action: "status",   prediction_id }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Latest stable MusicGen on Replicate (Meta) — działa od ręki, bez fine-tune
// Wersję można nadpisać przez body.model_version_hash
const MUSICGEN_MODEL = "meta/musicgen";
const MUSICGEN_VERSION = "671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb";

const MODEL_PRESETS: Record<string, string> = {
  "stereo-large": "stereo-large",
  "large": "large",
  "melody-large": "melody-large",
  "stereo-melody-large": "stereo-melody-large",
};

interface GenerateBody {
  action?: "generate" | "status";
  prompt?: string;
  duration?: number;
  model_version?: string;
  instrumental?: boolean;
  prediction_id?: string;
  title?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
  if (!REPLICATE_API_TOKEN) {
    return json({ error: "REPLICATE_API_TOKEN is not configured" }, 500);
  }

  let body: GenerateBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const action = body.action ?? "generate";

  // Auth (best-effort; action może być wywołana z UI lub serwerowo)
  const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
  const supabaseAnon = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  const supa = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await supa.auth.getUser();
  const userId = userData?.user?.id ?? null;

  try {
    if (action === "status") {
      if (!body.prediction_id) return json({ error: "prediction_id required" }, 400);
      const r = await fetch(`https://api.replicate.com/v1/predictions/${body.prediction_id}`, {
        headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` },
      });
      const data = await r.json();
      if (!r.ok) {
        return json({ error: "Replicate status failed", details: data }, r.status);
      }
      return json({
        id: data.id,
        status: data.status, // starting | processing | succeeded | failed | canceled
        output: data.output,
        error: data.error,
        logs_tail: typeof data.logs === "string" ? data.logs.slice(-1500) : null,
      });
    }

    // === GENERATE ===
    const prompt = (body.prompt ?? "").trim();
    if (prompt.length < 3) return json({ error: "prompt must be at least 3 characters" }, 400);
    if (prompt.length > 800) return json({ error: "prompt too long (max 800)" }, 400);

    const duration = clamp(body.duration ?? 15, 4, 30);
    const modelVersion = MODEL_PRESETS[body.model_version ?? "stereo-large"] ?? "stereo-large";

    const finalPrompt = body.instrumental
      ? `instrumental, no vocals, ${prompt}`
      : prompt;

    const replicatePayload = {
      version: MUSICGEN_VERSION,
      input: {
        prompt: finalPrompt,
        model_version: modelVersion,
        duration,
        output_format: "mp3",
        normalization_strategy: "loudness",
        temperature: 1.0,
        top_k: 250,
        top_p: 0.0,
        classifier_free_guidance: 3,
      },
    };

    console.log(`[groua-music-engine] generate user=${userId} dur=${duration}s model=${modelVersion} prompt="${prompt.slice(0, 80)}…"`);

    const r = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(replicatePayload),
    });

    const data = await r.json();
    if (!r.ok) {
      console.error("[groua-music-engine] replicate error", data);
      return json({ error: "Replicate prediction failed", details: data }, r.status);
    }

    return json({
      id: data.id,
      status: data.status,
      engine: "groua-musicgen-v1",
      duration,
      model_version: modelVersion,
      poll_url: `${supabaseUrl}/functions/v1/groua-music-engine`,
      created_at: data.created_at,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[groua-music-engine] fatal", msg);
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, Math.floor(n)));
}
