// GROUAI HUB — hub-status
// Publiczny (tylko odczyt, bez sekretów) podgląd zdrowia huba automatyzacji:
// ostatnie sprawdzenie radia, świeże newsy, kolejka social, ostatnie zadania workera.
// Służy też jako cel self-pingu (utrzymuje projekt aktywnym na darmowym planie).
//
// Deploy: verify_jwt = false.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const [{ data: cfgRows }, { data: lastRadio }, { data: lastLogs }, { count: newsCount }, { count: queueCount }, { count: deliverableCount }] =
    await Promise.all([
      db.from("hub_config").select("key, value"),
      db.from("hub_radio_log").select("ts, ok, details").order("ts", { ascending: false }).limit(1).maybeSingle(),
      db.from("hub_log").select("ts, source, level, message").order("ts", { ascending: false }).limit(10),
      db.from("hub_news_items").select("id", { count: "exact", head: true }),
      db.from("hub_social_queue").select("id", { count: "exact", head: true }).eq("status", "queued"),
      db.from("hub_deliverables").select("id", { count: "exact", head: true }),
    ]);

  const cfg: Record<string, string> = {};
  for (const row of cfgRows || []) cfg[row.key] = row.value ?? "";

  const body = {
    ok: true,
    hub: "grouai-hub",
    time: new Date().toISOString(),
    config: {
      ai_key_set: Boolean(cfg["openrouter_api_key"]),
      telegram_set: Boolean(cfg["telegram_bot_token"] && cfg["telegram_chat_id"]),
      discord_set: Boolean(cfg["discord_webhook_url"]),
      brain_ingest_token_set: Boolean(cfg["bvstv_ingest_token"]),
    },
    radio: lastRadio ? { checked_at: lastRadio.ts, ok: lastRadio.ok, details: lastRadio.details } : null,
    news_items_total: newsCount ?? 0,
    social_queue_waiting: queueCount ?? 0,
    deliverables_total: deliverableCount ?? 0,
    recent_log: (lastLogs || []).map((l: any) => `[${l.ts}] ${l.level.toUpperCase()} ${l.source}: ${l.message}`),
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
