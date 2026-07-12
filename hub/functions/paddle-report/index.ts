// GROUAI HUB — paddle-report: realne płatności z Paddle (API) dla panelu admina.
// Admin-only (bvstv has_role). Klucz: hub_config.paddle_api_key; środowisko: hub_config.paddle_env (live|sandbox).
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
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

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

  const key = cfg["paddle_api_key"];
  if (!key) return json({ ok: false, error: "no_key", message: "Brak klucza API Paddle (hub_config.paddle_api_key)" }, 200);
  const env = (cfg["paddle_env"] || "live").toLowerCase();
  const base = env === "sandbox" ? "https://sandbox-api.paddle.com" : "https://api.paddle.com";

  try {
    let url: string | null = `${base}/transactions?order_by=created_at[DESC]&per_page=30&status=completed`;
    const all: any[] = [];
    for (let p = 0; p < 10 && url; p++) {
      const r: Response = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
      if (!r.ok) {
        const e = await r.json().catch(() => null);
        return json({ ok: false, error: "paddle_error", status: r.status, message: e?.error?.detail || e?.error?.code || `Paddle HTTP ${r.status}` }, 200);
      }
      const j = await r.json();
      for (const t of (j.data || [])) all.push(t);
      url = (j.meta?.pagination?.has_more && j.meta?.pagination?.next) ? j.meta.pagination.next : null;
    }
    const totals: Record<string, number> = {};
    for (const t of all) {
      const cur = t.currency_code || "?";
      const amt = parseInt(t.details?.totals?.total || "0", 10) || 0;
      totals[cur] = (totals[cur] || 0) + amt;
    }
    const recent = all.slice(0, 25).map((t) => ({
      amount: parseInt(t.details?.totals?.total || "0", 10) || 0,
      currency: t.currency_code,
      status: t.status,
      date: t.created_at,
    }));
    return json({ ok: true, env, count: all.length, totals, recent });
  } catch (e) {
    return json({ ok: false, error: "exception", message: String(e).slice(0, 160) }, 200);
  }
});
