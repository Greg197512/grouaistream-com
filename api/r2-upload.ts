// Wgrywanie plików na Cloudflare R2 przez Vercel (bez Supabase Edge i bez Lovable).
//
// Przeglądarka prosi o podpisany adres PUT (tylko zalogowani — sprawdzamy token Supabase),
// a potem wysyła plik PROSTO na R2 — bez limitu rozmiaru funkcji. Żeby przeglądarka mogła
// wysłać PUT na inny serwer, zasobnik potrzebuje CORS — ustawia go akcja "setup-cors"
// (stała polityka; klient woła ją sam raz, gdy pierwszy PUT zostanie zablokowany).
//
// Zmienne w Vercel (Settings → Environment Variables): R2_ACCOUNT_ID (albo R2_ENDPOINT),
// R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY; opcjonalnie R2_BUCKET, R2_PUBLIC_BASE.
import { md5Base64, presignUrl, signHeaders, s3Encode } from "../src/lib/sigv4";

export const config = { runtime: "edge" };

const env = (k: string) => (typeof process !== "undefined" ? process.env[k]?.trim() : undefined) || undefined;

function r2() {
  const accessKeyId = env("R2_ACCESS_KEY_ID") ?? env("S3_ACCESS_KEY_ID");
  const secretAccessKey = env("R2_SECRET_ACCESS_KEY") ?? env("S3_SECRET_ACCESS_KEY");
  const account = env("R2_ACCOUNT_ID");
  const endpoint = (env("R2_ENDPOINT") ?? env("S3_ENDPOINT") ?? (account ? `https://${account}.r2.cloudflarestorage.com` : ""))?.replace(/\/+$/, "");
  const bucket = env("R2_BUCKET") ?? env("S3_BUCKET_NAME") ?? "grouaistream-tracks";
  const publicBase = (env("R2_PUBLIC_BASE") ?? "https://pub-46ecdc3a5ae341fcb16454d732eb9bcd.r2.dev").replace(/\/+$/, "");
  if (!accessKeyId || !secretAccessKey || !endpoint) return null;
  const base = endpoint.endsWith(`/${bucket}`) ? endpoint : `${endpoint}/${bucket}`;
  return { creds: { accessKeyId, secretAccessKey, region: "auto" }, base, publicBase };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

/** Użytkownik z tokenu Supabase (ten sam login co na stronie). */
async function userId(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization") ?? "";
  const url = env("SUPABASE_URL") ?? env("VITE_SUPABASE_URL");
  const key = env("SUPABASE_ANON_KEY") ?? env("VITE_SUPABASE_PUBLISHABLE_KEY");
  if (!auth.startsWith("Bearer ") || !url || !key) return null;
  try {
    const r = await fetch(`${url.replace(/\/+$/, "")}/auth/v1/user`, { headers: { apikey: key, authorization: auth }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    return ((await r.json()) as { id?: string }).id ?? null;
  } catch {
    return null;
  }
}

const CORS_XML = `<?xml version="1.0" encoding="UTF-8"?><CORSConfiguration><CORSRule><AllowedOrigin>*</AllowedOrigin><AllowedMethod>GET</AllowedMethod><AllowedMethod>HEAD</AllowedMethod><AllowedMethod>PUT</AllowedMethod><AllowedHeader>*</AllowedHeader><ExposeHeader>ETag</ExposeHeader><ExposeHeader>Content-Length</ExposeHeader><ExposeHeader>Content-Range</ExposeHeader><MaxAgeSeconds>86400</MaxAgeSeconds></CORSRule></CORSConfiguration>`;

async function bucketCors(c: NonNullable<ReturnType<typeof r2>>, method: "PUT" | "GET") {
  const url = `${c.base}?cors`;
  const body = method === "PUT" ? new TextEncoder().encode(CORS_XML) : undefined;
  const headers = await signHeaders({ method, url, creds: c.creds, body, contentType: body ? "application/xml" : undefined });
  const r = await fetch(url, { method, headers: body ? { ...headers, "content-md5": md5Base64(body) } : headers, body, signal: AbortSignal.timeout(15000) });
  return { ok: r.ok, status: r.status, detail: (await r.text()).slice(0, 500) };
}

const clean = (s: string, max: number) => s.replace(/[^a-zA-Z0-9._/-]/g, "_").replace(/\.{2,}/g, ".").replace(/^\/+|\/+$/g, "").slice(0, max);

export default async function handler(req: Request): Promise<Response> {
  const c = r2();
  if (req.method === "GET") return json({ configured: Boolean(c) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!c) return json({ error: "R2 nie jest skonfigurowane w Vercel (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)", configured: false }, 503);

  let body: { action?: string; fileName?: string; contentType?: string; folder?: string };
  try { body = await req.json(); } catch { return json({ error: "Zły JSON" }, 400); }

  try {
    if (body.action === "setup-cors") return json(await bucketCors(c, "PUT"));
    if (body.action === "cors-status") return json(await bucketCors(c, "GET"));
    if (body.action !== "sign") return json({ error: "Nieznana akcja" }, 400);

    const uid = await userId(req);
    if (!uid) return json({ error: "Zaloguj się, aby wgrywać pliki." }, 401);
    if (!body.fileName) return json({ error: "Brak nazwy pliku" }, 400);
    const folder = clean(body.folder || "tracks", 120) || "tracks";
    const key = `${folder}/${Date.now()}-${clean(body.fileName, 100) || "upload.bin"}`;
    const objectUrl = `${c.base}/${key.split("/").map((p) => s3Encode(p)).join("/")}`;
    const uploadUrl = await presignUrl({ method: "PUT", url: objectUrl, creds: c.creds, expires: 3600 });
    return json({ uploadUrl, publicUrl: `${c.publicBase}/${key}`, key, method: "PUT" });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Błąd" }, 500);
  }
}
