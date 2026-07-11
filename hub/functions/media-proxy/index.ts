// GROUAI HUB — media-proxy: serwuje pliki z replicate.delivery / hub storage z CORS,
// żeby ffmpeg.wasm w przeglądarce mógł je pobrać do sklejenia teledysku.
// Ograniczone do zaufanych hostów (nie jest to otwarte proxy).
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, range",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const url = new URL(req.url);
  const u = url.searchParams.get("u");
  if (!u) return new Response("missing_url", { status: 400, headers: cors });

  let host: string;
  try { host = new URL(u).host.toLowerCase(); } catch { return new Response("bad_url", { status: 400, headers: cors }); }
  const allowed =
    host === "replicate.delivery" || host.endsWith(".replicate.delivery") ||
    host.endsWith(".supabase.co") || host === "grouaistream.com" || host.endsWith(".grouaistream.com");
  if (!allowed) return new Response("forbidden_host", { status: 403, headers: cors });

  try {
    const upstream = await fetch(u);
    if (!upstream.ok || !upstream.body) return new Response("upstream_error", { status: 502, headers: cors });
    return new Response(upstream.body, {
      headers: {
        ...cors,
        "Content-Type": upstream.headers.get("Content-Type") || "application/octet-stream",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    return new Response("fetch_failed: " + String(e).slice(0, 100), { status: 502, headers: cors });
  }
});
