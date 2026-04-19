import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@3.600.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ingest-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const R2_PUBLIC_BASE = "https://pub-46ecdc3a5ae341fcb16454d732eb9bcd.r2.dev";
const MAX_AUDIO_BYTES = 50 * 1024 * 1024; // 50MB safety cap per track

interface IngestPayload {
  title: string;
  artist: string;
  source: "cc_mixter" | "fma" | "jamendo" | "ia" | "musicbrainz" | "suno_scraped" | "spotify_meta" | "youtube_meta" | "other";
  audio_url?: string;
  external_id?: string;
  source_url?: string;
  lyrics?: string;
  genre?: string;
  subgenre?: string;
  mood?: string;
  language?: string;
  duration_seconds?: number;
  cover_url?: string;
  license?: string;
  audio_features?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  skip_r2_upload?: boolean; // optional override: keep original URL (e.g. metadata-only items)
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "track.mp3";
}

function guessExtension(url: string, contentType: string | null): string {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("mpeg")) return "mp3";
  if (ct.includes("wav")) return "wav";
  if (ct.includes("ogg")) return "ogg";
  if (ct.includes("flac")) return "flac";
  if (ct.includes("mp4") || ct.includes("m4a") || ct.includes("aac")) return "m4a";
  const m = url.split("?")[0].match(/\.([a-zA-Z0-9]{2,5})$/);
  return (m?.[1] || "mp3").toLowerCase();
}

let s3Client: S3Client | null = null;
function getS3(): { client: S3Client; bucket: string } | null {
  const endpoint = Deno.env.get("S3_ENDPOINT")?.trim();
  const accessKeyId = Deno.env.get("S3_ACCESS_KEY_ID")?.trim();
  const secretAccessKey = Deno.env.get("S3_SECRET_ACCESS_KEY")?.trim();
  const bucket = Deno.env.get("S3_BUCKET_NAME")?.trim();
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) return null;
  if (!s3Client) {
    s3Client = new S3Client({
      region: "auto",
      endpoint: endpoint.replace(/\/+$/, ""),
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return { client: s3Client, bucket };
}

async function mirrorToR2(audioUrl: string, source: string, title: string): Promise<{ publicUrl: string; key: string; bytes: number } | null> {
  const s3 = getS3();
  if (!s3) {
    console.warn("[ingest] S3 not configured — skipping R2 mirror");
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(audioUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "GrouAI-Ingest/1.0" },
    });
    clearTimeout(timeoutId);
    if (!res.ok || !res.body) {
      console.warn(`[ingest] download failed ${res.status} for ${audioUrl}`);
      return null;
    }
    const contentType = res.headers.get("content-type");
    const buffer = new Uint8Array(await res.arrayBuffer());
    if (buffer.byteLength === 0) return null;
    if (buffer.byteLength > MAX_AUDIO_BYTES) {
      console.warn(`[ingest] file too large (${buffer.byteLength} bytes) — skipping`);
      return null;
    }

    const ext = guessExtension(audioUrl, contentType);
    const safeTitle = sanitizeFilename(title);
    const key = `ingest/${source}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeTitle}.${ext}`;

    await s3.client.send(new PutObjectCommand({
      Bucket: s3.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType || "audio/mpeg",
    }));

    return { publicUrl: `${R2_PUBLIC_BASE}/${key}`, key, bytes: buffer.byteLength };
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn("[ingest] R2 mirror error:", err instanceof Error ? err.message : err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const token = req.headers.get("x-ingest-token") || url.searchParams.get("token") || "";
    if (!token) {
      return new Response(JSON.stringify({ error: "missing_token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: tokenRow, error: tokenError } = await supabase
      .from("n8n_ingest_tokens")
      .select("id, is_active, source_type, total_ingests")
      .eq("token", token)
      .maybeSingle();

    if (tokenError || !tokenRow || !tokenRow.is_active) {
      return new Response(JSON.stringify({ error: "invalid_token" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const items: IngestPayload[] = Array.isArray(body) ? body : [body];

    if (items.length > 100) {
      return new Response(JSON.stringify({ error: "batch_too_large", max: 100 }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = {
      ingested: 0,
      skipped: 0,
      r2_uploaded: 0,
      r2_failed: 0,
      total_bytes: 0,
      errors: [] as Array<{ title: string; error: string }>,
    };

    for (const item of items) {
      if (!item.title || !item.artist || !item.source) {
        results.skipped++;
        continue;
      }

      try {
        // 1) Mirror audio to R2 (preferred path)
        let storedAudioUrl = item.audio_url || null;
        let r2Key: string | null = null;
        if (item.audio_url && !item.skip_r2_upload) {
          const mirrored = await mirrorToR2(item.audio_url, item.source, item.title);
          if (mirrored) {
            storedAudioUrl = mirrored.publicUrl;
            r2Key = mirrored.key;
            results.r2_uploaded++;
            results.total_bytes += mirrored.bytes;
          } else {
            results.r2_failed++;
            // Keep original URL as fallback so metadata still lands in catalog
          }
        }

        // 2) Insert into catalog
        const { data: catalogId, error: catErr } = await supabase.rpc("add_to_song_catalog", {
          _title: item.title.substring(0, 500),
          _artist: item.artist.substring(0, 300),
          _source: item.source,
          _audio_url: storedAudioUrl,
          _external_id: item.external_id || null,
          _lyrics: item.lyrics || null,
          _genre: item.genre || null,
          _mood: item.mood || null,
          _duration: item.duration_seconds || null,
          _license: item.license || "unknown",
          _metadata: {
            ...(item.metadata || {}),
            subgenre: item.subgenre,
            language: item.language,
            cover_url: item.cover_url,
            source_url: item.source_url,
            original_audio_url: item.audio_url,
            r2_key: r2Key,
            r2_mirrored: r2Key !== null,
          },
          _ingested_by: `n8n:${tokenRow.source_type}`,
        });

        if (catErr) throw new Error(catErr.message);
        if (!catalogId) {
          results.skipped++;
          continue;
        }

        // 3) Audio features
        if (item.audio_features) {
          const af = item.audio_features as any;
          await supabase.from("audio_features").upsert({
            catalog_id: catalogId,
            bpm: af.bpm,
            music_key: af.music_key,
            music_mode: af.music_mode,
            time_signature: af.time_signature || "4/4",
            energy: af.energy,
            danceability: af.danceability,
            valence: af.valence,
            acousticness: af.acousticness,
            instrumentalness: af.instrumentalness,
            loudness_db: af.loudness_db,
            speechiness: af.speechiness,
            liveness: af.liveness,
            analyzed_by: `n8n:${tokenRow.source_type}`,
          }, { onConflict: "catalog_id" });
        }

        // 4) Auto-add legal sources to training_dataset
        const isLegal = ["cc_mixter", "fma", "jamendo", "ia", "musicbrainz"].includes(item.source);
        if (isLegal && storedAudioUrl && (item.lyrics || item.genre)) {
          const promptText = [
            item.genre || "music",
            item.subgenre,
            item.mood,
            item.lyrics ? `with lyrics: ${item.lyrics.substring(0, 200)}` : "instrumental",
          ].filter(Boolean).join(", ");

          await supabase.from("training_dataset").upsert({
            catalog_id: catalogId,
            prompt_text: promptText,
            audio_url: storedAudioUrl,
            duration_seconds: item.duration_seconds,
            quality_score: 0.8,
            opt_in: true,
          }, { onConflict: "catalog_id" });
        }

        results.ingested++;
      } catch (e) {
        results.errors.push({
          title: item.title,
          error: e instanceof Error ? e.message : "unknown",
        });
      }
    }

    await supabase
      .from("n8n_ingest_tokens")
      .update({
        last_used_at: new Date().toISOString(),
        total_ingests: (tokenRow.total_ingests || 0) + results.ingested,
      })
      .eq("id", tokenRow.id);

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[n8n-music-ingest] error:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "unknown_error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
