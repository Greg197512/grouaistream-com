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
  /** Limit czasu pobrania źródła (ms). Domyślnie 20 s — wiszący host nie blokuje funkcji. */
  timeoutMs?: number;
  /** Ile razy ponowić przy przejściowym błędzie (fetch/upload). Domyślnie 3. */
  retries?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Archiwizuje plik do R2 z ponawianiem — pojedyncza przejściowa awaria
 * sieci (fetch źródła albo upload do R2) nie może zostawić utworu na
 * efemerycznym linku dostawcy (np. tempfile.* wygasającym w godziny),
 * bo wtedy playback cicho umiera po czasie, choć w bazie wygląda na
 * "gotowe". Trzy próby z rosnącym odstępem (400ms/1200ms), dopiero
 * potem prawdziwa rezygnacja z null (wołający MUSI to obsłużyć —
 * patrz suno-generate: audio_archived=false ostrzega frontend).
 */
export async function archiveToR2(opts: ArchiveOptions): Promise<string | null> {
  const endpoint = Deno.env.get("S3_ENDPOINT")?.trim();
  const accessKeyId = Deno.env.get("S3_ACCESS_KEY_ID")?.trim();
  const secretAccessKey = Deno.env.get("S3_SECRET_ACCESS_KEY")?.trim();
  const bucket = Deno.env.get("S3_BUCKET_NAME")?.trim();
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    console.warn("[archiveToR2] missing R2 env, returning null");
    return null;
  }

  const maxAttempts = Math.max(1, opts.retries ?? 3);
  let lastErr: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(opts.sourceUrl, {
        headers: opts.fetchHeaders,
        signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
      });
      if (!res.ok) throw new Error(`fetch source failed: HTTP ${res.status}`);
      const buffer = new Uint8Array(await res.arrayBuffer());
      if (buffer.length === 0) throw new Error("source returned empty body");

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
      lastErr = e;
      console.error(`[archiveToR2] attempt ${attempt}/${maxAttempts} failed:`, e);
      if (attempt < maxAttempts) await sleep(400 * attempt * attempt); // 400ms, 1600ms, ...
    }
  }

  console.error("[archiveToR2] gave up after retries:", lastErr);
  return null;
}

export interface PutOptions {
  /** Raw bytes to store. */
  body: Uint8Array | ArrayBuffer;
  /** Folder under the bucket, e.g. "blog-assets". */
  folder: string;
  /** File name (without folder). A timestamp prefix is added when missing. */
  fileName: string;
  contentType?: string;
}

/**
 * Upload raw bytes straight to Cloudflare R2. Returns the public URL,
 * or null when R2 credentials are not configured.
 */
export async function putToR2(opts: PutOptions): Promise<string | null> {
  try {
    const endpoint = Deno.env.get("S3_ENDPOINT")?.trim();
    const accessKeyId = Deno.env.get("S3_ACCESS_KEY_ID")?.trim();
    const secretAccessKey = Deno.env.get("S3_SECRET_ACCESS_KEY")?.trim();
    const bucket = Deno.env.get("S3_BUCKET_NAME")?.trim();
    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
      console.warn("[putToR2] missing R2 env, returning null");
      return null;
    }

    const client = new S3Client({
      region: "auto",
      endpoint: endpoint.replace(/\/+$/, ""),
      credentials: { accessKeyId, secretAccessKey },
    });

    const safeName = opts.fileName.replace(/[^a-zA-Z0-9._/-]/g, "_");
    const key = `${opts.folder.replace(/^\/+|\/+$/g, "")}/${safeName}`;
    const body = opts.body instanceof Uint8Array ? opts.body : new Uint8Array(opts.body);

    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: opts.contentType || "application/octet-stream",
    }));

    return `${R2_PUBLIC_BASE}/${key}`;
  } catch (e) {
    console.error("[putToR2] error:", e);
    return null;
  }
}
