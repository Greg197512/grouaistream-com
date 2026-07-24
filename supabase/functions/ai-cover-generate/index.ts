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

  const premiumRules = ` Hyper-realistic photo, cinematic lighting, deep blacks, neon amber highlights, 1:1 square, no text, no logos, magazine-quality album cover.`;

  if (mode === "custom" && description?.trim()) {
    return `Premium album cover. ${description.trim()}.${isRap ? " Luxury noir rap aesthetic, neon amber, wet asphalt." : ""}${premiumRules}`;
  }

  const styleHint = style ? ` Style: ${style}.` : "";
  return `Premium album cover for "${title || "Untitled"}".${styleHint}${isRap ? " Luxury noir rap aesthetic, neon amber, wet asphalt." : ""}${premiumRules}`;
}

async function generateImageBase64(
  prompt: string,
  apiKey: string,
  referenceImage?: string | null,
): Promise<string | null> {
  const attempts = [
    { model: "google/gemini-2.5-flash-image", timeoutMs: 60000 },
    { model: "google/gemini-2.5-flash-image-preview", timeoutMs: 70000 },
  ];

  // Jeśli mamy zdjęcie referencyjne — image-to-image (edycja/restyling).
  const content: any = referenceImage
    ? [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: referenceImage } },
      ]
    : prompt;

  for (const attempt of attempts) {
    try {
      const response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://grouaistream.com",
          "X-Title": "GrouAI Stream",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: attempt.model,
          messages: [{ role: "user", content }],
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
    const { title, style, description, mode, reference_image } = await req.json();
    const OPENROUTER_API_KEY = Deno.env.get("LOVABLE_API_KEY") || Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENROUTER_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = reference_image
      ? `Restyle this image into a premium album cover. ${description?.trim() || ""}. Keep the main subject recognizable but transform lighting, mood and color grading. Cinematic, ultra-detailed, magazine-quality, no text, no logos, 1:1 square.`
      : buildPrompt({ title, style, description, mode });

    console.log(`[ai-cover-generate] Generating cover for "${title}" mode=${mode} ref=${!!reference_image}`);

    const imageUrl = await generateImageBase64(prompt, OPENROUTER_API_KEY, reference_image);

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
