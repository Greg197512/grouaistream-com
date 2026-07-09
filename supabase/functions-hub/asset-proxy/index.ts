// GROUAI HUB — asset-proxy
// Serwuje wybrane pliki z grouaistream.com z nagłówkami CORS (potrzebne np. do
// programowego uploadu logo w panelach zewnętrznych serwisów).
// Whitelist ścieżek — nie jest to otwarte proxy.
const ALLOWED: Record<string, string> = {
  "logo": "https://grouaistream.com/logo-icon.png",
  "og": "https://grouaistream.com/og-image.jpg",
};

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const key = url.searchParams.get("a") || "logo";
  const target = ALLOWED[key];
  if (!target) return new Response("not_found", { status: 404 });
  const r = await fetch(target);
  if (!r.ok) return new Response("upstream_error", { status: 502 });
  const bytes = await r.arrayBuffer();
  return new Response(bytes, {
    headers: {
      "Content-Type": r.headers.get("Content-Type") || "image/png",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
