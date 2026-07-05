// GROUAI HUB — radio-autopilot
// Stróż radia: cron woła tę funkcję co 30 min. Sprawdza publiczny strumień
// Groua Radio (funkcja radio-stream na hkbra): ?f=info + playlistę m3u8.
// Status ląduje w hub_radio_log; awarie w hub_log (i na Telegram, jeśli skonfigurowany).
//
// Auth: ?t=<hub_token> lub x-hub-token. Deploy: verify_jwt = false.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-token",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cfgRows } = await db.from("hub_config").select("key, value");
  const cfg: Record<string, string> = {};
  for (const row of cfgRows || []) cfg[row.key] = row.value ?? "";

  const url = new URL(req.url);
  const token = url.searchParams.get("t") || req.headers.get("x-hub-token") || "";
  if (!cfg["hub_token"] || token !== cfg["hub_token"]) return json({ error: "unauthorized" }, 401);

  const infoUrl = cfg["radio_info_url"] || "https://hkbraboqdsonekzxbntr.supabase.co/functions/v1/radio-stream?f=info";
  const m3u8Url = infoUrl.replace("?f=info", "?f=m3u8");

  const checks: Record<string, unknown> = {};
  let ok = true;
  let problem = "";

  try {
    const r = await fetch(infoUrl, { signal: AbortSignal.timeout(15000) });
    const info = await r.json();
    checks.info_status = r.status;
    checks.station = info?.station_name ?? null;
    checks.is_active = info?.is_active ?? false;
    checks.now_playing = info?.now_playing?.title ?? null;
    if (!r.ok || !info?.is_active) { ok = false; problem = `info: HTTP ${r.status}, is_active=${info?.is_active}`; }
  } catch (e) {
    ok = false;
    problem = `info fetch: ${String(e).slice(0, 120)}`;
    checks.info_error = problem;
  }

  try {
    const r = await fetch(m3u8Url, { signal: AbortSignal.timeout(15000) });
    const text = await r.text();
    const segments = (text.match(/#EXTINF/g) || []).length;
    checks.m3u8_status = r.status;
    checks.m3u8_segments = segments;
    if (!r.ok || segments === 0) { ok = false; problem = problem || `m3u8: HTTP ${r.status}, segments=${segments}`; }
  } catch (e) {
    ok = false;
    problem = problem || `m3u8 fetch: ${String(e).slice(0, 120)}`;
    checks.m3u8_error = String(e).slice(0, 120);
  }

  await db.from("hub_radio_log").insert({ ok, details: checks });

  if (!ok) {
    await db.from("hub_log").insert({
      source: "radio-autopilot", level: "error",
      message: `RADIO PROBLEM: ${problem}`, data: checks,
    });
    if (cfg["telegram_bot_token"] && cfg["telegram_chat_id"]) {
      await fetch(`https://api.telegram.org/bot${cfg["telegram_bot_token"]}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: cfg["telegram_chat_id"],
          text: `🚨 Groua Radio: problem ze strumieniem!\n${problem}\nSprawdź: ${infoUrl}`,
        }),
      }).catch(() => null);
    }
  }

  return json({ ok, checks });
});
