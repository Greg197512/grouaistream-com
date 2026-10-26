// Shared Cloudflare R2 (S3-compatible) archive helper.
// Used by groua-music-engine, suno-generate and others so files survive after the
// upstream provider deletes them.
//
// Zapis idzie zwykłym fetch z podpisem AWS SigV4 (WebCrypto) zamiast @aws-sdk/client-s3:
// SDK w środowisku edge zawieszał się na PutObject (test r2test: „Request aborted” po 30 s),
// przez co utwory zostawały na wygasających linkach dostawcy. Fetch daje twardy limit
// czasu i czytelny kod błędu R2.

const R2_PUBLIC_BASE =
  Deno.env.get("R2_PUBLIC_BASE") ||
  "https://pub-46ecdc3a5ae341fcb16454d732eb9bcd.r2.dev";

const PUT_TIMEOUT_MS = 30_000;

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

export interface PutOptions {
  /** Raw bytes to store. */
  body: Uint8Array | ArrayBuffer;
  /** Folder under the bucket, e.g. "blog-assets". */
  folder: string;
  /** File name (without folder). */
  fileName: string;
  contentType?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const sha256 = async (data: Uint8Array | string) =>
  hex(await crypto.subtle.digest("SHA-256", typeof data === "string" ? enc.encode(data) : data));
async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, enc.encode(data));
}

function r2Env() {
  const endpoint = Deno.env.get("S3_ENDPOINT")?.trim().replace(/\/+$/, "");
  const accessKeyId = Deno.env.get("S3_ACCESS_KEY_ID")?.trim();
  const secretAccessKey = Deno.env.get("S3_SECRET_ACCESS_KEY")?.trim();
  const bucket = Deno.env.get("S3_BUCKET_NAME")?.trim();
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { endpoint, accessKeyId, secretAccessKey, bucket };
}

/** PutObject przez fetch + SigV4. Zwraca publiczny URL albo powód błędu. */
async function signedPut(key: string, body: Uint8Array, contentType: string): Promise<{ url?: string; error?: string }> {
  const env = r2Env();
  if (!env) return { error: "brak sekretów S3_* (R2)" };
  // Endpoint bywa podany razem z nazwą zasobnika — nie dublujemy jej w ścieżce.
  const base = env.endpoint.endsWith(`/${env.bucket}`) ? env.endpoint : `${env.endpoint}/${env.bucket}`;
  const url = new URL(`${base}/${key.split("/").map(encodeURIComponent).join("/")}`);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);
  const payloadHash = await sha256(body);
  const headers: Record<string, string> = {
    "content-type": contentType,
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  const signed = Object.keys(headers).sort();
  const canonical = ["PUT", url.pathname, "", signed.map((h) => `${h}:${headers[h]}\n`).join(""), signed.join(";"), payloadHash].join("\n");
  const scope = `${date}/auto/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256(canonical)].join("\n");
  let k = await hmac(enc.encode(`AWS4${env.secretAccessKey}`), date);
  for (const part of ["auto", "s3", "aws4_request"]) k = await hmac(k, part);
  const signature = hex(await hmac(k, toSign));
  try {
    const r = await fetch(url, {
      method: "PUT",
      headers: {
        ...headers,
        authorization: `AWS4-HMAC-SHA256 Credential=${env.accessKeyId}/${scope}, SignedHeaders=${signed.join(";")}, Signature=${signature}`,
      },
      body,
      signal: AbortSignal.timeout(PUT_TIMEOUT_MS),
    });
    if (!r.ok) return { error: `R2 HTTP ${r.status}: ${(await r.text()).slice(0, 200)}` };
    return { url: `${R2_PUBLIC_BASE}/${key}` };
  } catch (e) {
    return { error: `R2 (${url.host}): ${e instanceof Error ? e.message : String(e)}`.slice(0, 300) };
  }
}

/**
 * Archiwizuje plik do R2 z ponawianiem — pojedyncza przejściowa awaria
 * sieci (fetch źródła albo upload do R2) nie może zostawić utworu na
 * efemerycznym linku dostawcy (np. tempfile.* wygasającym w godziny),
 * bo wtedy playback cicho umiera po czasie, choć w bazie wygląda na
 * "gotowe". Trzy próby z rosnącym odstępem, dopiero potem rezygnacja
 * z null (wołający MUSI to obsłużyć — patrz suno-generate: audio_archived).
 */
export async function archiveToR2(opts: ArchiveOptions): Promise<string | null> {
  if (!r2Env()) {
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

      const key = `${opts.folder}/${Date.now()}-${opts.id}.${opts.ext || "mp3"}`;
      const put = await signedPut(key, buffer, opts.contentType || "audio/mpeg");
      if (put.url) return put.url;
      throw new Error(put.error);
    } catch (e) {
      lastErr = e;
      console.error(`[archiveToR2] attempt ${attempt}/${maxAttempts} failed:`, e);
      if (attempt < maxAttempts) await sleep(400 * attempt * attempt); // 400ms, 1600ms, ...
    }
  }

  console.error("[archiveToR2] gave up after retries:", lastErr);
  return null;
}

/**
 * Upload raw bytes straight to Cloudflare R2. Returns the public URL,
 * or null when R2 credentials are not configured or the upload fails.
 */
export async function putToR2(opts: PutOptions): Promise<string | null> {
  const r = await putToR2Checked(opts);
  return r.url ?? null;
}

/** Jak putToR2, ale zwraca powód niepowodzenia (do diagnostyki). */
export async function putToR2Checked(opts: PutOptions): Promise<{ url?: string; error?: string }> {
  const safeName = opts.fileName.replace(/[^a-zA-Z0-9._/-]/g, "_");
  const key = `${opts.folder.replace(/^\/+|\/+$/g, "")}/${safeName}`;
  const body = opts.body instanceof Uint8Array ? opts.body : new Uint8Array(opts.body);
  const r = await signedPut(key, body, opts.contentType || "application/octet-stream");
  if (r.error) console.error("[putToR2]", r.error);
  return r;
}
