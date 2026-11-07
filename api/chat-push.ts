// GrouAI czat — powiadomienia push na telefon/komputer, także gdy apka jest zamknięta (Web Push + VAPID).
// POST (token Supabase użytkownika w Authorization):
//   {action:"subscribe", sub, lang}  → zapis urządzenia (własna baza sbmf, RPC chat_push_* chronione sekretem)
//   {action:"unsubscribe", endpoint} → usunięcie urządzenia
//   {action:"notify", messageId}     → nadawca po wysłaniu wiadomości: push do odbiorcy (albo do wszystkich przy „Do wszystkich”,
//                                      najwyżej raz na 10 min na nadawcę)
//   {action:"test"}                   → próbne powiadomienie na własne urządzenia
// GET ?diag=1 → stan konfiguracji (bez sekretów).
// Env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_DB_URL, PUSH_DB_KEY (publishable), PUSH_DB_SECRET.
import webpush from "web-push";

export const config = { maxDuration: 30 };

type Sub = { endpoint: string; keys: { p256dh: string; auth: string } };
type Row = { endpoint: string; user_id: string; sub: Sub; lang: string | null };

const env = (k: string) => (process.env[k] || "").trim() || undefined;
const SUPA = () => (env("SUPABASE_URL") ?? env("VITE_SUPABASE_URL") ?? "https://bvstvawnigyczvofzhps.supabase.co").replace(/\/+$/, "");
const ANON = () => env("SUPABASE_ANON_KEY") ?? env("VITE_SUPABASE_PUBLISHABLE_KEY") ?? "";

type Out = { status: number; body: unknown };
const json = (body: unknown, status = 200): Out => ({ status, body });

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const url = env("PUSH_DB_URL")?.replace(/\/+$/, ""), key = env("PUSH_DB_KEY");
  if (!url || !key) throw new Error("push db not configured");
  const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ p_secret: env("PUSH_DB_SECRET") ?? "", ...args }),
    signal: AbortSignal.timeout(10000),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`rpc ${fn} ${r.status}: ${t.slice(0, 200)}`);
  return (t ? JSON.parse(t) : null) as T;
}

async function userFrom(auth: string | null): Promise<string | null> {
  if (!auth?.startsWith("Bearer ")) return null;
  const r = await fetch(`${SUPA()}/auth/v1/user`, { headers: { apikey: ANON(), authorization: auth }, signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!r?.ok) return null;
  const u = (await r.json().catch(() => null)) as { id?: string } | null;
  return u?.id ?? null;
}

async function rest<T>(path: string, auth: string): Promise<T | null> {
  const r = await fetch(`${SUPA()}/rest/v1/${path}`, { headers: { apikey: ANON(), authorization: auth }, signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!r?.ok) return null;
  return (await r.json().catch(() => null)) as T;
}

const TXT: Record<string, { hey: string; from: (n: string) => string; all: string; test: string }> = {
  pl: { hey: "Hej, jesteś!! 👋", from: (n) => `${n} pisze do Ciebie`, all: "do wszystkich", test: "Powiadomienia działają — tak zawołamy, gdy ktoś napisze." },
  en: { hey: "Hey, you there!! 👋", from: (n) => `${n} is messaging you`, all: "to everyone", test: "Notifications work — this is how we'll call you." },
  nl: { hey: "Hé, ben je er!! 👋", from: (n) => `${n} stuurt je een bericht`, all: "aan iedereen", test: "Meldingen werken — zo roepen we je." },
  uk: { hey: "Гей, ти тут!! 👋", from: (n) => `${n} пише тобі`, all: "всім", test: "Сповіщення працюють." },
};
const tx = (l: string | null) => TXT[(l || "pl").slice(0, 2)] ?? TXT.pl;

async function sendTo(rows: Row[], make: (r: Row) => Record<string, unknown>) {
  let sent = 0, gone = 0;
  await Promise.all(rows.map(async (row) => {
    try {
      await webpush.sendNotification(row.sub, JSON.stringify(make(row)), { TTL: 3600, urgency: "high", topic: "grouai-chat" });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) { gone++; await rpc("chat_push_delete", { p_endpoint: row.endpoint }).catch(() => {}); }
    }
  }));
  return { sent, gone, devices: rows.length };
}

type In = { method: string; url: string; auth: string | null; body: unknown };

// Vercel Node (req, res) → wspólna logika.
export default async function handler(req: any, res: any) {
  let body: unknown = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const out = await run({ method: req.method, url: `https://x${req.url}`, auth: (req.headers?.authorization as string) ?? null, body: body ?? {} });
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  res.status(out.status).send(JSON.stringify(out.body));
}

async function run(req: In): Promise<Out> {
  const pub = env("VAPID_PUBLIC_KEY"), priv = env("VAPID_PRIVATE_KEY");
  if (req.method === "GET") {
    const u = new URL(req.url);
    if (u.searchParams.get("diag")) {
      let db: unknown = "?";
      try { db = await rpc("chat_push_count", {}); } catch (e) { db = String((e as Error).message).slice(0, 120); }
      return json({ vapid: !!(pub && priv), publicKey: pub ?? null, db });
    }
    return json({ publicKey: pub ?? null });
  }
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!pub || !priv) return json({ error: "push not configured" }, 503);
  webpush.setVapidDetails("mailto:grouarock@gmail.com", pub, priv);

  const auth = req.auth;
  const uid = await userFrom(auth);
  if (!uid) return json({ error: "unauthorized" }, 401);
  const body = (req.body || {}) as { action?: string; sub?: Sub; lang?: string; endpoint?: string; messageId?: string };

  try {
    if (body.action === "subscribe") {
      const s = body.sub;
      if (!s?.endpoint || !/^https:\/\//.test(s.endpoint) || !s.keys?.p256dh || !s.keys?.auth) return json({ error: "bad subscription" }, 400);
      await rpc("chat_push_save", { p_user: uid, p_endpoint: s.endpoint, p_sub: { endpoint: s.endpoint, keys: s.keys }, p_lang: (body.lang || "pl").slice(0, 5) });
      return json({ ok: true });
    }
    if (body.action === "unsubscribe") {
      if (body.endpoint) await rpc("chat_push_delete", { p_endpoint: body.endpoint });
      return json({ ok: true });
    }
    if (body.action === "test") {
      const rows = await rpc<Row[]>("chat_push_list", { p_users: [uid] });
      const r = await sendTo(rows ?? [], (row) => ({ title: tx(row.lang).hey, body: tx(row.lang).test, url: "/?chat=open", tag: "grouai-chat-test" }));
      return json({ ok: true, ...r });
    }
    if (body.action === "notify") {
      if (!body.messageId || !/^[0-9a-f-]{36}$/i.test(body.messageId)) return json({ error: "bad id" }, 400);
      const msgs = await rest<Array<{ id: string; sender_id: string; recipient_id: string | null; is_broadcast: boolean; content: string; created_at: string }>>(
        `chat_messages?id=eq.${body.messageId}&select=id,sender_id,recipient_id,is_broadcast,content,created_at`, auth!);
      const m = msgs?.[0];
      if (!m || m.sender_id !== uid) return json({ error: "not your message" }, 403);
      if (Date.now() - new Date(m.created_at).getTime() > 5 * 60 * 1000) return json({ error: "too old" }, 409);
      const prof = await rest<Array<{ display_name: string | null }>>(`profiles?user_id=eq.${uid}&select=display_name`, auth!);
      const name = (prof?.[0]?.display_name || "GrouAI").slice(0, 40);
      let rows: Row[];
      if (m.is_broadcast) {
        const ok = await rpc<boolean>("chat_push_bcast_ok", { p_user: uid });
        if (!ok) return json({ ok: true, throttled: true });
        rows = ((await rpc<Row[]>("chat_push_list", { p_users: null })) ?? []).filter((r) => r.user_id !== uid);
      } else {
        if (!m.recipient_id) return json({ ok: true, sent: 0 });
        rows = (await rpc<Row[]>("chat_push_list", { p_users: [m.recipient_id] })) ?? [];
      }
      const text = m.content.slice(0, 140);
      const r = await sendTo(rows, (row) => {
        const t = tx(row.lang);
        return {
          title: t.hey,
          body: `${m.is_broadcast ? `${name} (${t.all})` : t.from(name)}: ${text}`,
          url: `/?chat=${m.is_broadcast ? "all" : uid}`,
          tag: m.is_broadcast ? "grouai-chat-all" : `grouai-chat-${uid}`,
        };
      });
      return json({ ok: true, ...r });
    }
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message).slice(0, 200) }, 502);
  }
}
