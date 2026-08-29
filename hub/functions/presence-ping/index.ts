// GROUAI HUB — presence-ping: lekki heartbeat obecności zalogowanego usera (LIVE/bvstv).
// Zapisuje (user_id, email, ts) do presence_heartbeat. Klient woła co ~60 s gdy apka otwarta.
// Z tego liczymy „ilu online w czasie” i „szczyt dnia”. Czyścimy stare wpisy (>3 dni).
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
  let user: { id: string; email?: string } | null = null;
  try {
    const live = createClient(cfg["bvstv_url"], cfg["bvstv_anon_key"], { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await live.auth.getUser();
    if (u?.user) user = { id: u.user.id, email: u.user.email ?? undefined };
  } catch { /* brak sesji */ }
  if (!user) return json({ ok: false }, 200);

  try {
    await hub.from("presence_heartbeat").insert({ user_id: user.id, email: user.email });
    // Sprzątanie starych wpisów — ~2% wywołań, żeby tabela nie puchła.
    if (Math.random() < 0.02) {
      const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      await hub.from("presence_heartbeat").delete().lt("ts", cutoff);
    }
  } catch { /* nie blokujemy usera z powodu heartbeatu */ }

  return json({ ok: true });
});
