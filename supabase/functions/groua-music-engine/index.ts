// GrouAI Music Engine v2 — Replicate MusicGen + fingerprint router + R2 archive + generations history
// Endpoint: POST /functions/v1/groua-music-engine
// Body:
//   { action: "generate", prompt, duration?: 4-30, instrumental?: bool, use_fingerprint?: bool, title?: string }
//   { action: "status",   prediction_id, generation_id? }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@3.600.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// MusicGen Meta — stereo-large, najlepsza jakość/cena na Replicate
const MUSICGEN_VERSION = "671ac645ce5e552cc63a54a2bbff63fcf798043055f2a04b1d735e6ee09b7bd6";

const R2_PUBLIC_BASE = "https://pub-46ecdc3a5ae341fcb16454d732eb9bcd.r2.dev";

interface GenerateBody {
  action?: "generate" | "status";
  prompt?: string;
  duration?: number;
  instrumental?: boolean;
  use_fingerprint?: boolean;
  prediction_id?: string;
  generation_id?: string;
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  const supa = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await supa.auth.getUser();
  const userId = userData?.user?.id ?? null;

  try {
    // ============ STATUS ============
    if (action === "status") {
      if (!body.prediction_id) return json({ error: "prediction_id required" }, 400);

      const r = await fetch(`https://api.replicate.com/v1/predictions/${body.prediction_id}`, {
        headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` },
      });
      const data = await r.json();
      if (!r.ok) return json({ error: "Replicate status failed", details: data }, r.status);

      let finalUrl: string | null = null;
      const replicateUrl: string | null =
        typeof data.output === "string" ? data.output :
        Array.isArray(data.output) ? data.output[0] : null;

      // Jeśli succeeded — kopiujemy do R2 i zapisujemy w generations
      if (data.status === "succeeded" && replicateUrl) {
        finalUrl = await archiveToR2(replicateUrl, body.prediction_id);

        if (body.generation_id && userId) {
          await supa.from("generations").update({
            audio_url: finalUrl ?? replicateUrl,
            status: "completed",
          }).eq("id", body.generation_id).eq("user_id", userId);
        }
      } else if (data.status === "failed" || data.status === "canceled") {
        if (body.generation_id && userId) {
          await supa.from("generations").update({
            status: "failed",
          }).eq("id", body.generation_id).eq("user_id", userId);
        }
      }

      return json({
        id: data.id,
        status: data.status,
        output: finalUrl ?? replicateUrl,
        r2_archived: !!finalUrl,
        error: data.error,
        logs_tail: typeof data.logs === "string" ? data.logs.slice(-1500) : null,
      });
    }

    // ============ GENERATE ============
    if (!userId) return json({ error: "unauthorized" }, 401);

    const userPrompt = (body.prompt ?? "").trim();
    if (userPrompt.length < 3) return json({ error: "prompt must be at least 3 characters" }, 400);
    if (userPrompt.length > 800) return json({ error: "prompt too long (max 800)" }, 400);

    const duration = clamp(body.duration ?? 15, 4, 30);
    const useFingerprint = body.use_fingerprint ?? true;
    const instrumental = body.instrumental ?? true;

    // === Router promptów: wzbogać o fingerprint usera ===
    let finalPrompt = userPrompt;
    let fingerprint: any = null;
    let fingerprintApplied = false;

    if (useFingerprint) {
      try {
        const { data: fp } = await supa.rpc("get_user_audio_fingerprint");
        fingerprint = fp;
        if (fp?.has_history) {
          const parts: string[] = [];
          if (fp.dominant_genre) parts.push(fp.dominant_genre);
          if (fp.dominant_subgenre) parts.push(fp.dominant_subgenre);
          if (fp.dominant_mood) parts.push(`${fp.dominant_mood} mood`);
          if (fp.avg_bpm) parts.push(`${fp.avg_bpm} BPM`);
          if (fp.dominant_key) parts.push(`key of ${fp.dominant_key}`);
          if (fp.avg_energy != null) {
            if (fp.avg_energy > 0.7) parts.push("high energy");
            else if (fp.avg_energy < 0.4) parts.push("low energy, chill");
          }
          if (fp.avg_danceability > 0.7) parts.push("danceable");

          if (parts.length) {
            finalPrompt = `${parts.join(", ")}. ${userPrompt}`;
            fingerprintApplied = true;
          }
        }
      } catch (e) {
        console.warn("[groua-music-engine] fingerprint fetch failed:", e);
      }
    }

    if (instrumental) finalPrompt = `instrumental, no vocals, ${finalPrompt}`;

    console.log(`[groua-music-engine] generate user=${userId} dur=${duration}s fp=${fingerprintApplied} prompt="${finalPrompt.slice(0, 100)}…"`);

    const replicatePayload = {
      version: MUSICGEN_VERSION,
      input: {
        model_version: "stereo-large",
        prompt: finalPrompt,
        duration,
        output_format: "mp3",
        normalization_strategy: "loudness",
        temperature: 1.0,
        top_k: 250,
        top_p: 0.0,
        classifier_free_guidance: 3,
      },
    };

    const r = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(replicatePayload),
    });

    const data = await r.json();
    if (!r.ok) {
      console.error("[groua-music-engine] replicate error", data);
      return json({ error: "Replicate prediction failed", details: data }, r.status);
    }

    // Zapisz do generations (status: pending) — user widzi w historii od razu
    const { data: gen } = await supa.from("generations").insert({
      user_id: userId,
      title: body.title || "GrouAI Track",
      genre: fingerprint?.dominant_genre || "ai",
      prompt: finalPrompt.slice(0, 2000),
      instrumental,
      status: "pending",
      replicate_id: data.id,
    }).select().single();

    return json({
      id: data.id,
      generation_id: gen?.id ?? null,
      status: data.status,
      engine: "groua-musicgen-v2",
      duration,
      fingerprint_applied: fingerprintApplied,
      fingerprint_summary: fingerprintApplied ? {
        bpm: fingerprint?.avg_bpm,
        key: fingerprint?.dominant_key,
        genre: fingerprint?.dominant_genre,
        mood: fingerprint?.dominant_mood,
      } : null,
      created_at: data.created_at,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[groua-music-engine] fatal", msg);
    return json({ error: msg }, 500);
  }
});

// === Cloudflare R2 archive (pliki Replicate znikają po 24h) ===
async function archiveToR2(replicateUrl: string, predictionId: string): Promise<string | null> {
  try {
    const endpoint = Deno.env.get("S3_ENDPOINT")?.trim();
    const accessKeyId = Deno.env.get("S3_ACCESS_KEY_ID")?.trim();
    const secretAccessKey = Deno.env.get("S3_SECRET_ACCESS_KEY")?.trim();
    const bucket = Deno.env.get("S3_BUCKET_NAME")?.trim();
    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
      console.warn("[archiveToR2] missing R2 env, returning replicate URL");
      return null;
    }

    const audioRes = await fetch(replicateUrl);
    if (!audioRes.ok) {
      console.error("[archiveToR2] failed to fetch audio:", audioRes.status);
      return null;
    }
    const buffer = new Uint8Array(await audioRes.arrayBuffer());

    const client = new S3Client({
      region: "auto",
      endpoint: endpoint.replace(/\/+$/, ""),
      credentials: { accessKeyId, secretAccessKey },
    });

    const key = `groua-engine/${Date.now()}-${predictionId}.mp3`;
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: "audio/mpeg",
    }));

    const url = `${R2_PUBLIC_BASE}/${key}`;
    console.log("[archiveToR2] archived:", url);
    return url;
  } catch (e) {
    console.error("[archiveToR2] error:", e);
    return null;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, Math.floor(n)));
}
