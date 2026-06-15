// Shared Cloudflare R2 (S3-compatible) archive helper.
// Used by groua-music-engine and acestep-generate so files survive after the
// upstream provider deletes them.
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@3.600.0";

const R2_PUBLIC_BASE =
  Deno.env.get("R2_PUBLIC_BASE") ||
  "https://pub-46ecdc3a5ae341fcb16454d732eb9bcd.r2.dev";

export interface ArchiveOptions {
  /** Source URL to fetch the binary from (Replicate, ACE-Step, …). */
  sourceUrl: string;
  /** Folder under the bucket, e.g. "acestep" or "groua-engine". */
  folder: string;
  /** Identifier used in the filename (task_id / prediction_id). */
  id: string;
  /** Defaults to "mp3". */
  ext?: string;
  /** Defaults to "audio/mpeg". */
  contentType?: string;
  /** Optional headers passed when fetching the source (e.g. ACE bearer). */
  fetchHeaders?: Record<string, string>;
}

export async function archiveToR2(opts: ArchiveOptions): Promise<string | null> {
  try {
    const endpoint = Deno.env.get("S3_ENDPOINT")?.trim();
    const accessKeyId = Deno.env.get("S3_ACCESS_KEY_ID")?.trim();
    const secretAccessKey = Deno.env.get("S3_SECRET_ACCESS_KEY")?.trim();
    const bucket = Deno.env.get("S3_BUCKET_NAME")?.trim();
    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
      console.warn("[archiveToR2] missing R2 env, returning null");
      return null;
    }

    const res = await fetch(opts.sourceUrl, { headers: opts.fetchHeaders });
    if (!res.ok) {
      console.error("[archiveToR2] fetch source failed:", res.status);
      return null;
    }
    const buffer = new Uint8Array(await res.arrayBuffer());

    const client = new S3Client({
      region: "auto",
      endpoint: endpoint.replace(/\/+$/, ""),
      credentials: { accessKeyId, secretAccessKey },
    });

    const ext = opts.ext || "mp3";
    const key = `${opts.folder}/${Date.now()}-${opts.id}.${ext}`;
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: opts.contentType || "audio/mpeg",
    }));

    return `${R2_PUBLIC_BASE}/${key}`;
  } catch (e) {
    console.error("[archiveToR2] error:", e);
    return null;
  }
}
