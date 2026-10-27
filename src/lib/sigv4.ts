// Podpis AWS SigV4 (WebCrypto) dla Cloudflare R2 — działa w Vercel Edge i w przeglądarce/testach.
// Używane przez /api/r2-upload: podpisane adresy PUT (wysyłka prosto z przeglądarki na R2)
// i podpisane żądania serwisowe (CORS zasobnika).

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const bytes = (d: string | Uint8Array | ArrayBuffer): Uint8Array<ArrayBuffer> => {
  const src = typeof d === "string" ? enc.encode(d) : ArrayBuffer.isView(d) ? d : new Uint8Array(d);
  const out = new Uint8Array(src.length);
  out.set(src);
  return out;
};
export const sha256Hex = async (d: string | Uint8Array) => hex(await crypto.subtle.digest("SHA-256", bytes(d)));
async function hmac(key: Uint8Array | ArrayBuffer, data: string) {
  const k = await crypto.subtle.importKey("raw", bytes(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, bytes(data));
}
/** Kodowanie jak w S3 (RFC 3986), `/` w ścieżce zostaje. */
export const s3Encode = (s: string, keepSlash = false) => {
  const e = encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return keepSlash ? e.replace(/%2F/g, "/") : e;
};

export type Creds = { accessKeyId: string; secretAccessKey: string; region?: string };

async function signature(creds: Creds, amzDate: string, canonical: string) {
  const date = amzDate.slice(0, 8);
  const region = creds.region ?? "auto";
  const scope = `${date}/${region}/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256Hex(canonical)].join("\n");
  let k = await hmac(enc.encode(`AWS4${creds.secretAccessKey}`), date);
  for (const part of [region, "s3", "aws4_request"]) k = await hmac(k, part);
  return { scope, signature: hex(await hmac(k, toSign)) };
}

export const amzDateOf = (d = new Date()) => d.toISOString().replace(/[:-]|\.\d{3}/g, "");

/** Podpisany adres (query-string SigV4), np. PUT prosto z przeglądarki. */
export async function presignUrl(opts: { method: string; url: string; creds: Creds; expires: number; date?: Date }): Promise<string> {
  const u = new URL(opts.url);
  const amzDate = amzDateOf(opts.date);
  const region = opts.creds.region ?? "auto";
  const params: [string, string][] = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${opts.creds.accessKeyId}/${amzDate.slice(0, 8)}/${region}/s3/aws4_request`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(opts.expires)],
    ["X-Amz-SignedHeaders", "host"],
  ];
  const query = params.map(([k, v]) => `${s3Encode(k)}=${s3Encode(v)}`).sort().join("&");
  const canonical = [opts.method, u.pathname, query, `host:${u.host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const { signature: sig } = await signature(opts.creds, amzDate, canonical);
  return `${u.origin}${u.pathname}?${query}&X-Amz-Signature=${sig}`;
}

/** Nagłówki podpisanego żądania (np. PutBucketCors). `query` bez znaku zapytania, np. "cors". */
export async function signHeaders(opts: { method: string; url: string; creds: Creds; body?: Uint8Array; contentType?: string; date?: Date }) {
  const u = new URL(opts.url);
  const amzDate = amzDateOf(opts.date);
  const payloadHash = await sha256Hex(opts.body ?? new Uint8Array(0));
  const headers: Record<string, string> = { host: u.host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate };
  if (opts.contentType) headers["content-type"] = opts.contentType;
  const names = Object.keys(headers).sort();
  const query = [...u.searchParams.entries()].map(([k, v]) => `${s3Encode(k)}=${s3Encode(v)}`).sort().join("&");
  const canonical = [opts.method, u.pathname, query, names.map((n) => `${n}:${headers[n]}\n`).join(""), names.join(";"), payloadHash].join("\n");
  const { scope, signature: sig } = await signature(opts.creds, amzDate, canonical);
  const { host: _host, ...rest } = headers;
  void _host;
  return { ...rest, authorization: `AWS4-HMAC-SHA256 Credential=${opts.creds.accessKeyId}/${scope}, SignedHeaders=${names.join(";")}, Signature=${sig}` };
}

/** MD5 (base64) — S3 wymaga Content-MD5 przy PutBucketCors, a WebCrypto nie ma MD5. */
export function md5Base64(data: Uint8Array): string {
  const s = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);
  const len = data.length;
  const padded = new Uint8Array(((len + 8) >> 6) * 64 + 64);
  padded.set(data);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, (len * 8) >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor((len * 8) / 2 ** 32), true);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let off = 0; off < padded.length; off += 64) {
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F: number, g: number;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      const tmp = D;
      D = C; C = B;
      const x = (A + F + K[i] + view.getUint32(off + g * 4, true)) >>> 0;
      const r = s[(i >> 4) * 4 + (i % 4)];
      B = (B + ((x << r) | (x >>> (32 - r)))) >>> 0;
      A = tmp;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  const out = new Uint8Array(16);
  const ov = new DataView(out.buffer);
  [a0, b0, c0, d0].forEach((v, i) => ov.setUint32(i * 4, v, true));
  return btoa(String.fromCharCode(...out));
}
