// GROUAI HUB — admin-geo-list: zwraca listę IP/miasto userów. Tylko dla admina LIVE.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const hub = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cfgRows } = await hub.from("hub_config").select("key, value");
  const cfg: Record<string, string> = {};
  for (const row of cfgRows || []) cfg[row.key] = row.value ?? "";

  const authHeader = req.headers.get("Authorization") ?? "";
  try {
    const live = createClient(cfg["bvstv_url"], cfg["bvstv_anon_key"], { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await live.auth.getUser();
    if (!u?.user) return json({ ok: false, error: "unauthorized" }, 401);
    const { data: isAdmin } = await live.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
    if (isAdmin !== true) return json({ ok: false, error: "forbidden" }, 403);
  } catch {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const { data, error } = await hub.from("user_geo").select("*").order("last_seen", { ascending: false }).limit(2000);
  if (error) return json({ ok: false, error: error.message }, 200);
  return json({ ok: true, rows: data || [] });
});
