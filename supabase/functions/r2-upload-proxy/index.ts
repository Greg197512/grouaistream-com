import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@3.600.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const R2_REGION = "auto";
const R2_PUBLIC_BASE = "https://pub-46ecdc3a5ae341fcb16454d732eb9bcd.r2.dev";

function requireEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.replace(/\/+$/, "");
}

function sanitizeFilename(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100) || "upload.bin";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const folderValue = formData.get("folder");

    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: "file is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const folder = typeof folderValue === "string" && folderValue.trim()
      ? folderValue.trim().replace(/^\/+|\/+$/g, "")
      : "tracks";

    const endpoint = normalizeEndpoint(requireEnv("S3_ENDPOINT"));
    const accessKeyId = requireEnv("S3_ACCESS_KEY_ID");
    const secretAccessKey = requireEnv("S3_SECRET_ACCESS_KEY");
    const bucket = requireEnv("S3_BUCKET_NAME");

    const client = new S3Client({
      region: R2_REGION,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });

    const safeName = sanitizeFilename(file.name);
    const key = `${folder}/${Date.now()}-${safeName}`;
    const buffer = await file.arrayBuffer();

    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: new Uint8Array(buffer),
      ContentType: file.type || "application/octet-stream",
    }));

    return new Response(JSON.stringify({ publicUrl: `${R2_PUBLIC_BASE}/${key}`, key }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("r2-upload-proxy error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});