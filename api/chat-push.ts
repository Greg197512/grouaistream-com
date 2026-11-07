// GrouAI czat — powiadomienia push na telefon/komputer, także gdy apka jest zamknięta (Web Push + VAPID).
// POST (token Supabase użytkownika w Authorization):
//   {action:"subscribe", sub, lang}  → zapis urządzenia (własna baza sbmf, RPC chat_push_* chronione sekretem)
//   {action:"unsubscribe", endpoint} → usunięcie urządzenia
//   {action:"notify", messageId}     → nadawca po wysłaniu wiadomości: push do odbiorcy (albo do wszystkich przy „Do wszystkich”,
//                                      najwyżej raz na 10 min na nadawcę)
//   {action:"test"}                   → próbne powiadomienie na własne urządzenia
//   {action:"hello", lang}           → po zalogowaniu: zapis e-maila i języka (zapasowy e-mail, gdy brak push)
//   {action:"sync-users"}             → admin: wszyscy zarejestrowani (rpc get_all_users_for_admin) → e-maile do zapasu
// Odbiorca bez urządzenia push dostaje e-mail „Hej, jesteś?!” (najwyżej raz na 30 min od tej samej osoby).
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

async function userFrom(auth: string | null): Promise<{ id: string; email: string | null } | null> {
  if (!auth?.startsWith("Bearer ")) return null;
  const r = await fetch(`${SUPA()}/auth/v1/user`, { headers: { apikey: ANON(), authorization: auth }, signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!r?.ok) return null;
  const u = (await r.json().catch(() => null)) as { id?: string; email?: string } | null;
  return u?.id ? { id: u.id, email: u.email ?? null } : null;
}

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const MAIL: Record<string, { subj: (n: string) => string; lead: (n: string) => string; btn: string; foot: string }> = {
  pl: { subj: (n) => `Hej, jesteś?! ${n} pisze do Ciebie na GrouAI`, lead: (n) => `<b>${n}</b> napisał(a) do Ciebie na czacie GrouAI:`, btn: "Odpisz w GrouAI", foot: "Chcesz powiadomień na telefon zamiast maili? Otwórz czat w GrouAI i kliknij „Włącz”." },
  en: { subj: (n) => `Hey, you there?! ${n} is messaging you on GrouAI`, lead: (n) => `<b>${n}</b> sent you a message in GrouAI chat:`, btn: "Reply in GrouAI", foot: "Prefer phone notifications? Open the chat in GrouAI and tap “Włącz” (Enable)." },
  nl: { subj: (n) => `Hé, ben je er?! ${n} stuurt je een bericht op GrouAI`, lead: (n) => `<b>${n}</b> stuurde je een bericht in de GrouAI-chat:`, btn: "Antwoord in GrouAI", foot: "Liever meldingen op je telefoon? Open de chat in GrouAI en tik op „Włącz”." },
};

/** Zapasowy e-mail (transport GrouAI: send-transactional-email głównego projektu — lista wypisów, dziennik). */
async function mailFallback(to: string, lang: string | null, name: string, text: string, senderId: string, msgId: string) {
  const t = MAIL[(lang || "pl").slice(0, 2)] ?? MAIL.pl;
  const url = `https://grouaistream.com/?chat=${senderId}`;
  const html = `<div style="font:16px/1.6 Arial,sans-serif;max-width:560px;margin:auto;padding:24px;background:#0b0b0f;color:#f5f5f5;border-radius:16px">
<h1 style="margin:0 0 6px;font-size:26px;color:#ff7a1a">${esc(t.subj(name).split("!")[0])}!! 👋</h1>
<p style="margin:0 0 12px">${t.lead(esc(name))}</p>
<blockquote style="margin:0 0 18px;padding:12px 16px;border-left:4px solid #ff2bd6;background:#17171f;border-radius:8px">${esc(text)}</blockquote>
<a href="${url}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#ff7a1a;color:#111;font-weight:bold;text-decoration:none">${t.btn}</a>
<p style="margin:18px 0 0;font-size:12px;color:#a1a1aa">${t.foot}</p></div>`;
  const r = await fetch(`${SUPA()}/functions/v1/send-transactional-email`, {
    method: "POST",
    headers: { apikey: ANON(), authorization: `Bearer ${ANON()}`, "content-type": "application/json" },
    body: JSON.stringify({ templateName: "admin-notification", recipientEmail: to, idempotencyKey: `chat-${msgId}`, templateData: { title: t.subj(name), fullHtml: html } }),
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  return !!r?.ok;
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
      try { db = await rpc("chat_push_stats", {}); } catch (e) { db = String((e as Error).message).slice(0, 120); }
      return json({ vapid: !!(pub && priv), publicKey: pub ?? null, db });
    }
    return json({ publicKey: pub ?? null });
  }
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!pub || !priv) return json({ error: "push not configured" }, 503);
  webpush.setVapidDetails("mailto:grouarock@gmail.com", pub, priv);

  const auth = req.auth;
  const me = await userFrom(auth);
  if (!me) return json({ error: "unauthorized" }, 401);
  const uid = me.id;
  const body = (req.body || {}) as { action?: string; sub?: Sub; lang?: string; endpoint?: string; messageId?: string };

  try {
    if (body.action === "subscribe") {
      const s = body.sub;
      if (!s?.endpoint || !/^https:\/\//.test(s.endpoint) || !s.keys?.p256dh || !s.keys?.auth) return json({ error: "bad subscription" }, 400);
      await rpc("chat_push_save", { p_user: uid, p_endpoint: s.endpoint, p_sub: { endpoint: s.endpoint, keys: s.keys }, p_lang: (body.lang || "pl").slice(0, 5) });
      return json({ ok: true });
    }
    if (body.action === "hello") {
      await rpc("chat_push_user_upsert", { p_rows: [{ user_id: uid, email: me.email, lang: (body.lang || "pl").slice(0, 5) }] });
      return json({ ok: true });
    }
    if (body.action === "sync-users") {
      const all = await fetch(`${SUPA()}/rest/v1/rpc/get_all_users_for_admin`, {
        method: "POST", headers: { apikey: ANON(), authorization: auth!, "content-type": "application/json" }, body: "{}", signal: AbortSignal.timeout(15000),
      }).then((r) => (r.ok ? r.json() : null)).catch(() => null) as Array<{ id?: string; email?: string }> | null;
      if (!Array.isArray(all)) return json({ error: "admin only" }, 403);
      const rows = all.filter((u) => u.id).map((u) => ({ user_id: u.id, email: u.email ?? null }));
      let saved = 0;
      for (let i = 0; i < rows.length; i += 500) saved += (await rpc<number>("chat_push_user_upsert", { p_rows: rows.slice(i, i + 500) })) ?? 0;
      return json({ ok: true, users: rows.length, saved });
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
      const r: Record<string, unknown> = await sendTo(rows, (row) => {
        const t = tx(row.lang);
        return {
          title: t.hey,
          body: `${m.is_broadcast ? `${name} (${t.all})` : t.from(name)}: ${text}`,
          url: `/?chat=${m.is_broadcast ? "all" : uid}`,
          tag: m.is_broadcast ? "grouai-chat-all" : `grouai-chat-${uid}`,
        };
      });
      // Brak urządzenia (albo żadne nie przyjęło) → zapasowy e-mail, tylko wiadomości prywatne, max raz/30 min od tej osoby.
      if (!m.is_broadcast && m.recipient_id && r.sent === 0) {
        const info = (await rpc<Array<{ email: string | null; lang: string | null }>>("chat_push_user_get", { p_user: m.recipient_id }))?.[0];
        if (info?.email && (await rpc<boolean>("chat_push_mail_ok", { p_sender: uid, p_recipient: m.recipient_id }))) {
          r.mailed = await mailFallback(info.email, info.lang, name, text, uid, m.id);
        } else r.mailed = false;
      }
      return json({ ok: true, ...r });
    }
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message).slice(0, 200) }, 502);
  }
}
