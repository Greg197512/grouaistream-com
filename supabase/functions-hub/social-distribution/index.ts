// GROUAI HUB — social-distribution
// Zastępuje workflow n8n "social-distribution". Odbiera pakiet z marketing-autopilot (LIVE),
// publikuje do skonfigurowanych kanałów (Telegram / Discord) i raportuje wynik
// do marketing-callback na LIVE. Gdy żaden kanał nie jest skonfigurowany,
// zapisuje pakiet w hub_social_queue i zwraca 503 (LIVE nie oznaczy posta jako opublikowany).
//
// Auth: ?t=<hub_token> lub x-hub-token. Deploy: verify_jwt = false.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-token",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function loadConfig(db: any): Promise<Record<string, string>> {
  const { data } = await db.from("hub_config").select("key, value");
  const cfg: Record<string, string> = {};
  for (const row of data || []) cfg[row.key] = row.value ?? "";
  return cfg;
}

async function sendTelegram(botToken: string, chatId: string, text: string) {
  const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: false }),
  });
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok && body?.ok !== false, status: r.status, detail: body?.description ?? null };
}

async function sendDiscord(webhookUrl: string, content: string) {
  const r = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: content.slice(0, 1900) }),
  });
  return { ok: r.ok, status: r.status, detail: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const cfg = await loadConfig(db);

  const url = new URL(req.url);
  const token = url.searchParams.get("t") || req.headers.get("x-hub-token") || "";
  if (!cfg["hub_token"] || token !== cfg["hub_token"]) return json({ error: "unauthorized" }, 401);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const social = body.social ?? {};
  const title: string = body.title ?? "";
  const link: string = body.url ?? "https://grouaistream.com";
  const marketingPostId: string | null = body.marketing_post_id ?? null;

  const channels: Array<{ name: string; send: () => Promise<{ ok: boolean; status: number; detail: string | null }> }> = [];

  if (cfg["telegram_bot_token"] && cfg["telegram_chat_id"]) {
    const text = [title, "", social.facebook_post || social.twitter_post || "", "", link]
      .filter((s: string) => s !== undefined && s !== null).join("\n").trim();
    channels.push({ name: "telegram", send: () => sendTelegram(cfg["telegram_bot_token"], cfg["telegram_chat_id"], text) });
  }
  if (cfg["discord_webhook_url"]) {
    const text = `**${title}**\n${social.twitter_post || social.facebook_post || ""}\n${link}`;
    channels.push({ name: "discord", send: () => sendDiscord(cfg["discord_webhook_url"], text) });
  }

  // Zawsze zachowaj pakiet po stronie huba
  const { data: queued } = await db
    .from("hub_social_queue")
    .insert({ marketing_post_id: marketingPostId, title, url: link, payload: body, status: channels.length ? "publishing" : "queued" })
    .select("id")
    .single();

  if (channels.length === 0) {
    await db.from("hub_log").insert({
      source: "social-distribution", level: "warn",
      message: `Pakiet "${title}" zakolejkowany — brak skonfigurowanych kanałów (telegram/discord)`,
      data: { marketing_post_id: marketingPostId },
    });
    return json({ ok: false, queued: true, reason: "no_channels_configured" }, 503);
  }

  const liveUrl = cfg["bvstv_url"] || "https://bvstvawnigyczvofzhps.supabase.co";
  const results: any[] = [];
  for (const ch of channels) {
    const res = await ch.send();
    results.push({ platform: ch.name, ...res });
    // Raport per platforma do LIVE marketing-callback (best effort)
    await fetch(`${liveUrl}/functions/v1/marketing-callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        marketing_post_id: marketingPostId,
        platform: ch.name,
        status: res.ok ? "published" : "failed",
        error: res.ok ? null : `HTTP ${res.status} ${res.detail ?? ""}`.trim(),
        title,
      }),
    }).catch(() => null);
  }

  const anyOk = results.some((r) => r.ok);
  await db.from("hub_social_queue").update({
    status: anyOk ? "published" : "failed",
    result: results,
    published_at: anyOk ? new Date().toISOString() : null,
  }).eq("id", queued?.id);

  await db.from("hub_log").insert({
    source: "social-distribution", level: anyOk ? "info" : "error",
    message: `Dystrybucja "${title}": ${results.map((r) => `${r.platform}=${r.ok ? "OK" : "FAIL"}`).join(", ")}`,
    data: { marketing_post_id: marketingPostId, results },
  });

  return json({ ok: anyOk, results }, anyOk ? 200 : 502);
});
