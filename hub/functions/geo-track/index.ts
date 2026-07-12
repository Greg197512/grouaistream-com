// GROUAI HUB — geo-track: łapie IP + miasto zalogowanego usera LIVE i zapisuje w user_geo.
// Supabase trzyma IP tylko w logach auth (niedostępne z klienta), więc łapiemy je tu
// (przeglądarka woła tę funkcję bezpośrednio → x-forwarded-for = realne IP usera).
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

  // Geolokalizacja — ipwho.is: darmowe, bez klucza, https.
  let city = "", region = "", country = "", cc = "";
  const isPrivate = !ip || /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fc|fd)/i.test(ip);
  if (!isPrivate) {
    try {
      const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, { signal: AbortSignal.timeout(6000) });
      const g = await r.json();
      if (g?.success) { city = g.city || ""; region = g.region || ""; country = g.country || ""; cc = g.country_code || ""; }
    } catch { /* geo padło — zapisz samo IP */ }
  }

  const nowIso = new Date().toISOString();
  try {
    const { data: existing } = await hub.from("user_geo").select("user_id, hits").eq("user_id", user.id).maybeSingle();
    if (existing) {
      await hub.from("user_geo").update({
        email: user.email, ip, city, region, country, country_code: cc,
        last_seen: nowIso, hits: (existing.hits || 1) + 1,
      }).eq("user_id", user.id);
    } else {
      await hub.from("user_geo").insert({
        user_id: user.id, email: user.email, ip, city, region, country, country_code: cc,
        first_seen: nowIso, last_seen: nowIso, hits: 1,
      });
    }
  } catch (e) {
    return json({ ok: false, error: String(e) }, 200);
  }

  return json({ ok: true, city, country });
});
