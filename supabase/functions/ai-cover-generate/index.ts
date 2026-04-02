import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@3.600.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const R2_PUBLIC_BASE = "https://pub-46ecdc3a5ae341fcb16454d732eb9bcd.r2.dev";

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
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

    let prompt: string;

    if (mode === "custom" && description) {
      prompt = `Create a stunning, photographic-quality album cover art. User description: "${description}". 
The artwork should feel like a high-end professional photography or cinematic still. 
Ultra-realistic, high-resolution, dramatic lighting, rich colors, depth of field. 
No text, no letters, no words on the image. Clean artistic composition.`;
    } else {
      const styleHint = style ? ` The music style is ${style}.` : "";
      prompt = `Create a breathtaking, photographic-quality album cover art for a song called "${title || "Untitled"}".${styleHint}
The image must look like a professional photograph or cinematic movie still — NOT cartoon, NOT illustration, NOT abstract art.
Think: Hasselblad camera quality, dramatic natural or studio lighting, rich vivid colors, shallow depth of field with beautiful bokeh.
The scene should emotionally represent the mood and theme of the song title.
Ultra-realistic, high-resolution, award-winning photography style.
No text, no letters, no words, no logos on the image. On a clean background.`;
    }

    console.log(`[ai-cover-generate] Generating cover for "${title}" mode=${mode}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI image generation failed:", response.status, errText);
      return new Response(
        JSON.stringify({ error: "AI generation failed", status: response.status }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "No image generated" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      forcePathStyle: true,
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
