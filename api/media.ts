// Proxy mediów R2 przez własną domenę (Vercel Edge).
//
// Po co: pliki audio z darmowego publicznego adresu Cloudflare `*.r2.dev`
// potrafią nie grać w elemencie <audio> (zły Content-Type zapisany na obiekcie,
// kaprysy CORS/zakresów na dev-URL), mimo że te same obrazki (<img>) ładują się
// bez problemu. Puszczając plik przez /api/media?u=<url> serwujemy go z NASZEJ
// domeny: ustawiamy poprawny Content-Type audio/wideo, wspieramy zapytania
// zakresowe (przewijanie) i dokładamy nagłówki CORS — dzięki czemu gra ZAWSZE,
// a dodatkowo znów działa płynny crossfade (źródło jest same-origin).
//
// Bezpieczeństwo: przepuszczamy WYŁĄCZNIE nasz publiczny bucket R2 (allowlist),
// więc to nie jest otwarte proxy.
export const config = { runtime: "edge" };

const ALLOWED_HOSTS = new Set<string>([
  "pub-46ecdc3a5ae341fcb16454d732eb9bcd.r2.dev",
]);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type",
};

function contentTypeFromPath(path: string): string | null {
  const ext = (path.split(".").pop() || "").toLowerCase();
  switch (ext) {
    case "mp3": return "audio/mpeg";
    case "m4a": return "audio/mp4";
    case "aac": return "audio/aac";
    case "wav": return "audio/wav";
    case "flac": return "audio/flac";
    case "ogg": return "audio/ogg";
    case "opus": return "audio/opus";
    case "weba": return "audio/webm";
    case "mp4": return "video/mp4";
    case "webm": return "video/webm";
    case "mov": return "video/quicktime";
    case "mkv": return "video/x-matroska";
    default: return null;
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const reqUrl = new URL(req.url);
  const raw = reqUrl.searchParams.get("u") || reqUrl.searchParams.get("url");
  if (!raw) return new Response("Missing u", { status: 400, headers: CORS });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("Bad url", { status: 400, headers: CORS });
  }
  if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.host)) {
    return new Response("Host not allowed", { status: 403, headers: CORS });
  }

  // Przekaż zapytanie zakresowe (przewijanie / strumieniowanie audio).
  const range = req.headers.get("range");
  const upstreamHeaders: Record<string, string> = {};
  if (range) upstreamHeaders["Range"] = range;

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      method: req.method === "HEAD" ? "HEAD" : "GET",
      headers: upstreamHeaders,
      redirect: "follow",
    });
  } catch {
    return new Response("Upstream fetch failed", { status: 502, headers: CORS });
  }

  // Zbuduj nagłówki odpowiedzi: poprawny Content-Type + zakresy + cache + CORS.
  const headers = new Headers(CORS);
  const fixedType = contentTypeFromPath(target.pathname);
  const upstreamType = upstream.headers.get("content-type") || "";
  // Nadpisz, gdy R2 zwrócił octet-stream/pusto, a znamy typ z rozszerzenia.
  if (fixedType && (!upstreamType || upstreamType.includes("application/octet-stream") || upstreamType.includes("binary/octet-stream"))) {
    headers.set("Content-Type", fixedType);
  } else if (upstreamType) {
    headers.set("Content-Type", upstreamType);
  } else if (fixedType) {
    headers.set("Content-Type", fixedType);
  }

  for (const h of ["content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (!headers.has("accept-ranges")) headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "public, max-age=86400");

  return new Response(req.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    headers,
  });
}
