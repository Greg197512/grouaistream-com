// Migracja mediów utworów (okładki, audio, pliki wideo) z zewnętrznych hostów na Cloudflare R2.
//
// GET /api/migrate-media?token=…&after=<uuid>&limit=40
//   → { processed, moved, failed, next_after, done, errors[] }
// Wołaj w pętli z next_after, aż done = true.
//
// Bezpieczeństwo: endpoint działa tylko z jednorazowym tokenem, który baza weryfikuje
// (tabela media_migration_token przechowuje wyłącznie skrót SHA-256 i datę ważności).
// Kandydatów i zapis adresów robią funkcje SECURITY DEFINER w bazie (mm_candidates, mm_apply):
// zapis przyjmuje wyłącznie adresy z naszego R2. Endpoint nie przyjmuje adresów z zewnątrz.
//
// Wymagane zmienne (Vercel): S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET_NAME.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash, createHmac } from "node:crypto";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://bvstvawnigyczvofzhps.supabase.co";
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
const R2_PUBLIC = process.env.R2_PUBLIC_BASE || "https://pub-46ecdc3a5ae341fcb16454d732eb9bcd.r2.dev";

const TIME_BUDGET_MS = 45_000;
const FETCH_TIMEOUT_MS = 12_000;
const CONCURRENCY = 6;

type Row = { id: string; audio_url: string | null; cover_url: string | null; video_url: string | null };
type Field = "audio_url" | "cover_url" | "video_url";

const isHttp = (u: string | null): u is string => !!u && /^https?:\/\//i.test(u);
const isVideoFile = (u: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u);
const needsMove = (f: Field, u: string | null): u is string =>
  isHttp(u) && !u.startsWith(R2_PUBLIC) && (f !== "video_url" || isVideoFile(u));

const TYPES: Record<string, string> = {
  mp3: "audio/mpeg", wav: "audio/wav", flac: "audio/flac", m4a: "audio/mp4", ogg: "audio/ogg",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
  mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", m4v: "video/mp4",
};
const EXT_FROM_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(TYPES).map(([e, t]) => [t, e === "jpeg" ? "jpg" : e]),
);

function pickExt(url: string, contentType: string | null, field: Field): { ext: string; type: string } {
  const ct = (contentType || "").split(";")[0].trim().toLowerCase();
  if (EXT_FROM_TYPE[ct]) return { ext: EXT_FROM_TYPE[ct], type: ct };
  const m = url.split("?")[0].toLowerCase().match(/\.([a-z0-9]{2,4})$/);
  if (m && TYPES[m[1]]) return { ext: m[1], type: TYPES[m[1]] };
  const ext = field === "audio_url" ? "mp3" : field === "video_url" ? "mp4" : "jpg";
  return { ext, type: TYPES[ext] };
}

// --- AWS SigV4 (S3 PutObject na R2) ---------------------------------------
const sha256Hex = (d: Buffer | string) => createHash("sha256").update(d).digest("hex");
const hmac = (k: Buffer | string, d: string) => createHmac("sha256", k).update(d).digest();

async function putToR2(key: string, body: Buffer, contentType: string): Promise<void> {
  const endpoint = (process.env.S3_ENDPOINT || "").trim().replace(/\/+$/, "");
  const accessKey = (process.env.S3_ACCESS_KEY_ID || "").trim();
  const secret = (process.env.S3_SECRET_ACCESS_KEY || "").trim();
  const bucket = (process.env.S3_BUCKET_NAME || "").trim();
  const url = new URL(`${endpoint}/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body);
  const headers: Record<string, string> = {
    host: url.host,
    "content-type": contentType,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonical = [
    "PUT", url.pathname, "",
    Object.keys(headers).sort().map((h) => `${h}:${headers[h]}\n`).join(""),
    signedHeaders, payloadHash,
  ].join("\n");
  const scope = `${date}/auto/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonical)].join("\n");
  const kSigning = hmac(hmac(hmac(hmac(`AWS4${secret}`, date), "auto"), "s3"), "aws4_request");
  const signature = createHmac("sha256", kSigning).update(toSign).digest("hex");
  const r = await fetch(url, {
    method: "PUT",
    headers: {
      ...headers,
      authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!r.ok) throw new Error(`R2 PUT ${r.status}: ${(await r.text()).slice(0, 160)}`);
}

// --- Baza (PostgREST RPC, klucz publiczny + token) -------------------------
async function rpc(fn: string, args: Record<string, unknown>): Promise<any> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${fn} ${r.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

export default async function handler(req: any, res: any) {
  const started = Date.now();
  res.setHeader("Cache-Control", "no-store");
  const token = String(req.query?.token || "");
  const after = req.query?.after ? String(req.query.after) : null;
  const limit = Math.min(Math.max(Number(req.query?.limit) || 40, 1), 120);

  const missing = ["S3_ENDPOINT", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_BUCKET_NAME"]
    .filter((k) => !process.env[k]);
  if (missing.length) return res.status(503).json({ ok: false, error: "missing_env", missing });
  if (!token) return res.status(401).json({ ok: false, error: "no_token" });

  let rows: Row[];
  try {
    rows = (await rpc("mm_candidates", { p_token: token, p_after: after, p_limit: limit })) || [];
  } catch (e) {
    return res.status(403).json({ ok: false, error: "candidates_failed", detail: String((e as Error).message) });
  }

  const errors: { id: string; field: string; error: string }[] = [];
  let moved = 0;
  let index = 0;
  const processed: string[] = [];

  const worker = async () => {
    while (index < rows.length && Date.now() - started < TIME_BUDGET_MS) {
      const t = rows[index++];
      for (const field of ["audio_url", "cover_url", "video_url"] as const) {
        const src = t[field];
        if (!needsMove(field, src)) continue;
        try {
          const r = await fetch(src, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), redirect: "follow" });
          if (!r.ok) throw new Error(`źródło HTTP ${r.status}`);
          const buf = Buffer.from(await r.arrayBuffer());
          if (!buf.length) throw new Error("pusty plik");
          const { ext, type } = pickExt(src, r.headers.get("content-type"), field);
          const folder = field === "audio_url" ? "tracks" : field === "cover_url" ? "covers" : "videos";
          const key = `${folder}/migrated-${t.id}-${field}.${ext}`; // deterministyczny klucz: ponowienie nadpisuje
          await putToR2(key, buf, type);
          await rpc("mm_apply", { p_token: token, p_id: t.id, p_field: field, p_url: `${R2_PUBLIC}/${key}` });
          moved++;
        } catch (e) {
          errors.push({ id: t.id, field, error: String((e as Error).message).slice(0, 160) });
        }
      }
      processed.push(t.id);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // Kursor: ostatni wiersz z ciągłego prefiksu przetworzonych (wiersze w kolejności id).
  const done_ = new Set(processed);
  let nextAfter = after;
  for (const r of rows) { if (done_.has(r.id)) nextAfter = r.id; else break; }

  return res.status(200).json({
    ok: true,
    processed: processed.length,
    moved,
    failed: errors.length,
    next_after: nextAfter,
    done: rows.length < limit && processed.length === rows.length,
    ms: Date.now() - started,
    errors: errors.slice(0, 15),
  });
}
