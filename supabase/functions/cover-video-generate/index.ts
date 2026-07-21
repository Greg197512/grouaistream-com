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
  const quality: string = String(body?.quality || "max"); // "max" | "fast"
  if (!prompt && !imageUrl) return json({ error: "prompt or image_url required" }, 400);

  const finalPrompt = prompt || "cinematic gentle motion, subtle camera drift, atmospheric lighting, professional music video aesthetic";

  // Kolejność modeli — od najwyższej jakości. Kling v2.1 Master = top-tier 1080p cinematic.
  // Fallback: Hailuo-02 (świetne image-to-video), potem minimax/video-01.
  const models: Array<{ slug: string; input: Record<string, unknown> }> = [];

  if (quality === "max") {
    // 1) Kling v2.1 Master — najwyższa jakość, 1080p, ~5-10 min
    models.push({
      slug: "kwaivgi/kling-v2.1-master",
      input: {
        prompt: finalPrompt,
        duration: 5,
        aspect_ratio: imageUrl ? undefined : "16:9",
        negative_prompt: "blurry, low quality, distorted, watermark, text",
        ...(imageUrl ? { start_image: imageUrl } : {}),
      },
    });
    // 2) Hailuo-02 — bardzo dobra jakość, szybszy fallback
    models.push({
      slug: "minimax/hailuo-02",
      input: {
        prompt: finalPrompt,
        duration: 6,
        resolution: "1080p",
        prompt_optimizer: true,
        ...(imageUrl ? { first_frame_image: imageUrl } : {}),
      },
    });
  }

  // 3) minimax/video-01 — ostateczny fallback
  models.push({
    slug: "minimax/video-01",
    input: {
      prompt: finalPrompt,
      prompt_optimizer: true,
      ...(imageUrl ? { first_frame_image: imageUrl } : {}),
    },
  });

  let lastError: unknown = null;
  for (const m of models) {
    try {
      console.log(`[cover-video-generate] trying ${m.slug}`);
      const create = await fetch(`https://api.replicate.com/v1/models/${m.slug}/predictions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${REPLICATE}`,
          "Content-Type": "application/json",
          Prefer: "wait=55",
        },
        body: JSON.stringify({ input: m.input }),
      });

      const data = await create.json();
      if (!create.ok) {
        console.warn(`[cover-video-generate] ${m.slug} failed:`, data?.detail || data?.error);
        lastError = data?.detail || data?.error || `HTTP ${create.status}`;
        continue;
      }

      let videoUrl: string | null = null;
      const out = data?.output;
      if (out) videoUrl = typeof out === "string" ? out : Array.isArray(out) ? out[0] : null;

      if (!videoUrl && data?.id) {
        // Kling może potrzebować kilku minut — dłuższy timeout dla max quality
        videoUrl = await pollPrediction(data.id, REPLICATE, m.slug.includes("kling") ? 540000 : 300000);
      }

      if (videoUrl) return json({ video_url: videoUrl, model: m.slug });
      lastError = "no output";
    } catch (e) {
      console.warn(`[cover-video-generate] ${m.slug} error:`, e);
      lastError = e instanceof Error ? e.message : String(e);
    }
  }

  return json({ error: `video_generation_failed: ${lastError}` }, 502);
});
