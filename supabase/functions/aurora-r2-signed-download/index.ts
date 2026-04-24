// Aurora R2 Signed Download — generuje krótki URL do prywatnego pliku.
// Body: { file_id: uuid, ttl_seconds?: number (default 604800 = 7d, max 90d) }
// Auth: admin LUB klient z aktywną subskrypcją (RLS chroni SELECT na pliku).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { S3Client, GetObjectCommand } from "npm:@aws-sdk/client-s3@3.600.0";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3.600.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function envOrThrow(n: string): string {
  const v = Deno.env.get(n)?.trim();
  if (!v) throw new Error(`Missing ${n}`);
  return v;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // RLS-aware client (uses caller's JWT) — file_id query honors access policies.
    const supabase = createClient(envOrThrow("SUPABASE_URL"), envOrThrow("SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: authHeader } },
    });

    const { file_id, ttl_seconds = 604800 } = await req.json();
    if (!file_id) {
      return new Response(JSON.stringify({ error: "file_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const ttl = Math.min(Math.max(60, Number(ttl_seconds) || 604800), 60 * 60 * 24 * 90);

    const { data: file, error } = await supabase
      .from("aurora_storage_files").select("r2_key, file_name, content_type, public_url, visibility")
      .eq("id", file_id).maybeSingle();
    if (error || !file) {
      return new Response(JSON.stringify({ error: "Not found or no access" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (file.visibility === "public_cdn" && file.public_url) {
      return new Response(JSON.stringify({ url: file.public_url, ttl_seconds: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const client = new S3Client({
      region: "auto",
      endpoint: envOrThrow("S3_ENDPOINT").replace(/\/+$/, ""),
      credentials: { accessKeyId: envOrThrow("S3_ACCESS_KEY_ID"), secretAccessKey: envOrThrow("S3_SECRET_ACCESS_KEY") },
    });
    const bucket = envOrThrow("S3_BUCKET_NAME");
    const cmd = new GetObjectCommand({
      Bucket: bucket, Key: file.r2_key,
      ResponseContentDisposition: `attachment; filename="${file.file_name}"`,
    });
    const url = await getSignedUrl(client, cmd, { expiresIn: ttl });

    return new Response(JSON.stringify({ url, ttl_seconds: ttl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
