import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@3.600.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const R2_PUBLIC_BASE = "https://pub-46ecdc3a5ae341fcb16454d732eb9bcd.r2.dev";

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeout));
}

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function buildPrompt({ title, style, description, mode }: { title?: string; style?: string; description?: string; mode?: string }) {
  const styleLower = (style || "").toLowerCase();
  const isRap = /rap|hip[\s-]?hop|trap|drill|grime/.test(styleLower);

  const rapRecipe = `
GENRE-SPECIFIC DIRECTION — RAP / HIP-HOP TOP-TIER ALBUM COVER:
Iconic premium rap artwork energy, luxury noir, neon amber reflections, wet asphalt, powerful central figure, dramatic low-angle composition, editorial fashion styling, cinematic haze, expensive atmosphere.
Shot like a global album campaign on Hasselblad or ARRI, 50mm or 85mm lens, high dynamic range, ultra-premium color grading, deep blacks, hot amber highlights.`;

  const premiumRules = `
ABSOLUTE PHOTOGRAPHIC QUALITY RULES:
- Hyper-realistic PHOTOGRAPH, shot on Hasselblad H6D-100c or Phase One IQ4, 80mm prime lens, f/1.8, ISO 100.
- 8K resolution, RAW photo, ultra-sharp focus, micro-detail in skin / texture / fabric / surface.
- Cinematic lighting: dramatic chiaroscuro, golden-hour or neon rim light, volumetric haze, lens flare subtle.
- Professional color grading: deep true blacks, rich saturation, filmic contrast, Kodak Portra / Fuji 400H look.
- NO text, NO letters, NO logos, NO watermark, NO typography, NO captions, NO numbers anywhere in the image.
- NOT cartoon, NOT illustration, NOT 3D render, NOT CGI, NOT anime — must look like a real photograph taken by a top-tier commercial photographer.
- Square 1:1 composition, full bleed, magazine-cover quality, world-class commercial album artwork.`;

  if (mode === "custom" && description?.trim()) {
    return `Create an extraordinary, highest-tier premium album cover. User direction: "${description.trim()}".${isRap ? rapRecipe : ""}
The image must feel unforgettable, emotionally intense, luxurious, and instantly clickable on a music platform.${premiumRules}`;
  }

  const styleHint = style ? ` Music style: ${style}.` : "";
  return `Create an extraordinary, highest-tier premium album cover for the song "${title || "Untitled"}".${styleHint}${isRap ? rapRecipe : ""}
Visually interpret the title with bold cinematic storytelling, elite art direction, premium lighting, and magnetic composition.${premiumRules}`;
}

async function generateImageBase64(prompt: string, apiKey: string): Promise<string | null> {
  // Kolejność: szybki model (2.5-flash-image, ~30-45s) → fallback flash 3.1-preview (do 90s)
  // Większość uploadów dostanie okładkę w pierwszej próbie, mieści się w 150s edge limit.
  const attempts = [
    { model: "google/gemini-2.5-flash-image", timeoutMs: 60000 },
    { model: "google/gemini-3.1-flash-image-preview", timeoutMs: 70000 },
  ];

  for (const attempt of attempts) {
    try {
      const response = await fetchWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: attempt.model,
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"],
        }),
      }, attempt.timeoutMs);

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[ai-cover-generate] ${attempt.model} failed:`, response.status, errText);
        continue;
      }

      const data = await response.json();
      const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (imageUrl) return imageUrl;
    } catch (error) {
      console.error(`[ai-cover-generate] ${attempt.model} request error:`, error);
    }
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, style, description, mode } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = buildPrompt({ title, style, description, mode });

    console.log(`[ai-cover-generate] Generating cover for "${title}" mode=${mode}`);

    const imageUrl = await generateImageBase64(prompt, LOVABLE_API_KEY);

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "AI generation timed out or returned no image" }),
        { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upload base64 to R2
    const endpoint = Deno.env.get("S3_ENDPOINT");
    const accessKeyId = Deno.env.get("S3_ACCESS_KEY_ID");
    const secretAccessKey = Deno.env.get("S3_SECRET_ACCESS_KEY");
    const bucket = Deno.env.get("S3_BUCKET_NAME");

    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
      return new Response(
        JSON.stringify({ error: "R2 storage not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, "");
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    const key = `covers/ai-${sanitizeFilename(title || "track")}-${Date.now()}.png`;

    const client = new S3Client({
      region: Deno.env.get("S3_REGION") || "auto",
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });

    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: binaryData,
      ContentType: "image/png",
    }));

    const publicUrl = `${R2_PUBLIC_BASE}/${key}`;
    console.log(`[ai-cover-generate] Cover uploaded to R2: ${publicUrl}`);

    return new Response(
      JSON.stringify({ cover_url: publicUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("ai-cover-generate error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
