// GROUAI HUB — geo-track: łapie IP + miasto + urządzenie/przeglądarkę + ISP zalogowanego usera.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "";
}

// Prosty parser user-agent → { device, os, browser }.
function parseUA(ua: string): { device: string; os: string; browser: string } {
  const u = ua || "";
  let os = "";
  if (/Windows NT 10/.test(u)) os = "Windows 10/11";
  else if (/Windows/.test(u)) os = "Windows";
  else if (/iPhone|iPad|iPod/.test(u)) os = "iOS";
  else if (/Android/.test(u)) os = "Android";
  else if (/Mac OS X/.test(u)) os = "macOS";
  else if (/Linux/.test(u)) os = "Linux";
  let browser = "";
  if (/Edg\//.test(u)) browser = "Edge";
  else if (/OPR\/|Opera/.test(u)) browser = "Opera";
  else if (/SamsungBrowser/.test(u)) browser = "Samsung Internet";
  else if (/Chrome\//.test(u) && !/Chromium/.test(u)) browser = "Chrome";
  else if (/Firefox\//.test(u)) browser = "Firefox";
  else if (/Safari\//.test(u) && /Version\//.test(u)) browser = "Safari";
  const device = /Mobile|iPhone|Android.*Mobile/.test(u)
    ? "Telefon"
    : /iPad|Tablet/.test(u)
    ? "Tablet"
    : u
    ? "Komputer"
    : "";
  return { device, os, browser };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const hub = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cfgRows } = await hub.from("hub_config").select("key, value");
  const cfg: Record<string, string> = {};
  for (const row of cfgRows || []) cfg[row.key] = row.value ?? "";

  // Auth: zalogowany user LIVE (bvstv).
  const authHeader = req.headers.get("Authorization") ?? "";
  let user: { id: string; email?: string } | null = null;
  try {
    const live = createClient(cfg["bvstv_url"], cfg["bvstv_anon_key"], { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await live.auth.getUser();
    if (u?.user) user = { id: u.user.id, email: u.user.email ?? undefined };
  } catch { /* brak sesji */ }
  if (!user) return json({ ok: false }, 200);

  const ip = clientIp(req);
  const ua = req.headers.get("user-agent") || "";
  const { device, os, browser } = parseUA(ua);

  // Geolokalizacja — ipwho.is: darmowe, bez klucza, https. Zwraca też ISP + lat/lng.
  let city = "", region = "", country = "", cc = "", isp = "";
  let lat: number | null = null, lng: number | null = null;
  const isPrivate = !ip || /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fc|fd)/i.test(ip);
  if (!isPrivate) {
    try {
      const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, { signal: AbortSignal.timeout(6000) });
      const g = await r.json();
      if (g?.success) {
        city = g.city || ""; region = g.region || ""; country = g.country || ""; cc = g.country_code || "";
        isp = g?.connection?.isp || g?.connection?.org || "";
        lat = typeof g.latitude === "number" ? g.latitude : null;
        lng = typeof g.longitude === "number" ? g.longitude : null;
      }
    } catch { /* geo padło — zapisz samo IP */ }
  }

  const nowIso = new Date().toISOString();
  const fields = {
    email: user.email, ip, city, region, country, country_code: cc,
    user_agent: ua.slice(0, 400), device, os, browser, isp, lat, lng,
  };
  try {
    const { data: existing } = await hub.from("user_geo").select("user_id, hits").eq("user_id", user.id).maybeSingle();
    if (existing) {
      await hub.from("user_geo").update({ ...fields, last_seen: nowIso, hits: (existing.hits || 1) + 1 }).eq("user_id", user.id);
    } else {
      await hub.from("user_geo").insert({ user_id: user.id, ...fields, first_seen: nowIso, last_seen: nowIso, hits: 1 });
    }
  } catch (e) {
    return json({ ok: false, error: String(e) }, 200);
  }

  return json({ ok: true, city, country });
});
