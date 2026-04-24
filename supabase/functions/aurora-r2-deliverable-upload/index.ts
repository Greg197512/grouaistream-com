// Aurora R2 Deliverable Upload — Aurora/n8n wgrywają wyniki zleceń do R2.
// Body (JSON): { content_base64 | content_text, file_name, content_type?, category?, niche_id?, order_id?, run_id?, visibility?, storage_subscription_id? }
// Quota: jeśli storage_subscription_id podane — sprawdzamy limit pakietu.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@3.600.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const R2_PUBLIC_BASE = "https://pub-46ecdc3a5ae341fcb16454d732eb9bcd.r2.dev";

function envOrThrow(n: string): string {
  const v = Deno.env.get(n)?.trim();
  if (!v) throw new Error(`Missing ${n}`);
  return v;
}

function safeName(s: string): string {
  return (s || "file.bin").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(envOrThrow("SUPABASE_URL"), envOrThrow("SUPABASE_SERVICE_ROLE_KEY"));

  try {
    const body = await req.json();
    const {
      content_base64, content_text,
      file_name, content_type = "application/octet-stream",
      category = "deliverable",
      niche_id, order_id, run_id,
      visibility = "private",
      storage_subscription_id,
    } = body;

    if (!file_name) {
      return new Response(JSON.stringify({ error: "file_name required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let bytes: Uint8Array;
    if (content_base64) {
      bytes = Uint8Array.from(atob(content_base64), c => c.charCodeAt(0));
    } else if (content_text != null) {
      bytes = new TextEncoder().encode(String(content_text));
    } else {
      return new Response(JSON.stringify({ error: "content_base64 or content_text required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Quota check (jeśli klient ma sub R2)
    if (storage_subscription_id) {
      const { data: sub } = await supabase
        .from("aurora_storage_subscriptions")
        .select("id, status, storage_used_bytes, plan_code, aurora_storage_plans!inner(storage_gb)")
        .eq("id", storage_subscription_id)
        .maybeSingle();
      if (!sub || sub.status !== "active") {
        return new Response(JSON.stringify({ error: "subscription not active" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const limit = (sub as any).aurora_storage_plans.storage_gb * 1024 * 1024 * 1024;
      if (Number(sub.storage_used_bytes) + bytes.length > limit) {
        return new Response(JSON.stringify({ error: "quota_exceeded", used: sub.storage_used_bytes, limit }), {
          status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const client = new S3Client({
      region: "auto",
      endpoint: envOrThrow("S3_ENDPOINT").replace(/\/+$/, ""),
      credentials: { accessKeyId: envOrThrow("S3_ACCESS_KEY_ID"), secretAccessKey: envOrThrow("S3_SECRET_ACCESS_KEY") },
    });
    const bucket = envOrThrow("S3_BUCKET_NAME");

    const prefix = `aurora/${category}${niche_id ? `/${niche_id}` : ""}${order_id ? `/${order_id}` : ""}`;
    const key = `${prefix}/${Date.now()}-${safeName(file_name)}`;

    await client.send(new PutObjectCommand({
      Bucket: bucket, Key: key, Body: bytes, ContentType: content_type,
    }));

    const publicUrl = visibility === "public_cdn" ? `${R2_PUBLIC_BASE}/${key}` : null;

    const { data: row, error } = await supabase.from("aurora_storage_files").insert({
      r2_key: key, public_url: publicUrl, file_name, content_type,
      size_bytes: bytes.length, visibility, category,
      niche_id, order_id, run_id, storage_subscription_id,
    }).select().single();
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, file: row, key, public_url: publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("aurora-r2-deliverable-upload:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
