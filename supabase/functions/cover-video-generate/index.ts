// cover-video-generate — text-to-video and image-to-video via Replicate (minimax/video-01).
// Result URL is returned to the client which stores it in tracks.video_url.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function pollPrediction(id: string, token: string, timeoutMs = 240000): Promise<string | null> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const r = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await r.json();
    if (d?.status === "succeeded") {
      const out = d.output;
      return typeof out === "string" ? out : Array.isArray(out) ? out[0] : null;
    }
    if (d?.status === "failed" || d?.status === "canceled") {
      console.error("[cover-video-generate] prediction failed:", d?.error);
      return null;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const REPLICATE = Deno.env.get("REPLICATE_API_TOKEN");
  if (!REPLICATE) return json({ error: "REPLICATE_API_TOKEN not configured" }, 500);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const prompt: string = String(body?.prompt || "").slice(0, 800);
  const imageUrl: string | null = body?.image_url ? String(body.image_url) : null;
  if (!prompt && !imageUrl) return json({ error: "prompt or image_url required" }, 400);

  // minimax/video-01 obsługuje prompt + opcjonalne first_frame_image.
  // Dla image-to-video z pustym promptem stosujemy generyczny opis ruchu.
  const finalPrompt = prompt || "cinematic gentle motion, subtle camera drift, atmospheric lighting";

  try {
    const create = await fetch("https://api.replicate.com/v1/models/minimax/video-01/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE}`,
        "Content-Type": "application/json",
        Prefer: "wait=55",
      },
      body: JSON.stringify({
        input: {
          prompt: finalPrompt,
          prompt_optimizer: true,
          ...(imageUrl ? { first_frame_image: imageUrl } : {}),
        },
      }),
    });

    const data = await create.json();
    if (!create.ok) {
      console.error("[cover-video-generate] create failed:", data);
      return json({ error: data?.detail || data?.error || "replicate_error" }, 502);
    }

    let videoUrl: string | null = null;
    const out = data?.output;
    if (out) videoUrl = typeof out === "string" ? out : Array.isArray(out) ? out[0] : null;

    if (!videoUrl && data?.id) {
      videoUrl = await pollPrediction(data.id, REPLICATE);
    }

    if (!videoUrl) return json({ error: "video_generation_timeout" }, 504);
    return json({ video_url: videoUrl });
  } catch (e) {
    console.error("[cover-video-generate] error:", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
