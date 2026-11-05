/**
 * Wysyłka maili GrouAI (zastępuje hub-email-send ze starego, nieistniejącego huba).
 *
 * POST (Authorization: Bearer <token Supabase użytkownika>):
 *  - { mode: "single", to, subject, html }                       — admin
 *  - { mode: "mass", subject, html, audience?: "all_users" | "blog_subscribers" } — admin
 *  - { action: "b2b-order", orderId }  — zalogowany klient po złożeniu zlecenia B2B (Aurora):
 *      powiadomienie dla SHOP_NOTIFY_EMAIL + potwierdzenie dla klienta (tylko własne zlecenie, RLS).
 *
 * Transport: Resend/Brevo, gdy w Vercel jest klucz + SHOP_MAIL_FROM; inaczej funkcja
 * send-transactional-email głównego projektu (noreply@grouaistream.com, lista wypisów, dziennik email_send_log).
 * Bez kosztów: nic tu nie startuje samo.
 */
import { mailConfigFromEnv, sendMail, type MailCfg } from "../src/lib/shopMail";

// Edge (jak shop-checkout — bundler rozwiązuje importy z src/). Masowa wysyłka strumieniuje spacje co kilka sekund
// (JSON.parse je ignoruje), więc odpowiedź startuje od razu i może trwać do 300 s.
export const config = { runtime: "edge" };

const env = (k: string): string | undefined => {
  const v = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env?.[k];
  return v && v.trim() ? v.trim() : undefined;
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

function supa() {
  const url = (env("VITE_SUPABASE_URL") ?? env("SUPABASE_URL"))?.replace(/\/$/, "");
  const key = env("SUPABASE_ANON_KEY") ?? env("VITE_SUPABASE_PUBLISHABLE_KEY");
  return url && key ? { url, key } : null;
}
async function rest(auth: string, path: string, init: RequestInit = {}) {
  const s = supa()!;
  const r = await fetch(`${s.url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: s.key, authorization: auth, "content-type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(15000),
  });
  const text = await r.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: r.ok, status: r.status, data };
}
async function getUser(auth: string): Promise<{ id: string; email: string | null } | null> {
  const s = supa()!;
  try {
    const r = await fetch(`${s.url}/auth/v1/user`, { headers: { apikey: s.key, authorization: auth }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const u = (await r.json()) as { id?: string; email?: string };
    return u.id ? { id: u.id, email: u.email ?? null } : null;
  } catch { return null; }
}
async function isAdmin(auth: string, userId: string) {
  const r = await rest(auth, "rpc/has_role", { method: "POST", body: JSON.stringify({ _user_id: userId, _role: "admin" }) });
  return r.ok && r.data === true;
}

const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i;
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Ramka maila GrouAI (gdy panel przysyła sam fragment treści). */
function frame(html: string) {
  if (/<html[\s>]/i.test(html)) return html;
  return `<!doctype html><html><body style="margin:0;background:#0b0712;font:15px/1.6 Arial,sans-serif;color:#18181b">
<div style="max-width:600px;margin:0 auto;padding:24px"><div style="background:#ffffff;border-radius:18px;padding:28px">
<div style="font-weight:900;font-size:20px;margin-bottom:16px">GrouAI <span style="color:#f97316">Stream</span></div>${html}</div>
<p style="color:#a1a1aa;font-size:12px;text-align:center;margin-top:16px">grouaistream.com · Otrzymujesz tę wiadomość jako użytkownik GrouAI Stream.
Wypisanie: odpowiedz „wypisz” albo użyj linku wypisu w programie pocztowym.</p></div></body></html>`;
}

async function sendMany(cfg: MailCfg, to: string[], subject: string, html: string) {
  let sent = 0, errors = 0;
  const queue = to.slice();
  const worker = async () => {
    for (let e = queue.shift(); e; e = queue.shift()) {
      (await sendMail(cfg, { to: e, subject, html })) ? sent++ : errors++;
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, to.length) }, worker));
  return { sent, errors };
}

async function recipients(auth: string, audience: string): Promise<string[]> {
  if (audience === "blog_subscribers") {
    const r = await rest(auth, "blog_newsletter_subscribers?select=email&unsubscribed_at=is.null&limit=10000");
    return Array.isArray(r.data) ? (r.data as { email?: string }[]).map((x) => x.email ?? "") : [];
  }
  const r = await rest(auth, "rpc/get_all_users_for_admin", { method: "POST", body: "{}" });
  return Array.isArray(r.data) ? (r.data as { email?: string }[]).map((x) => x.email ?? "") : [];
}

async function b2bOrder(auth: string, user: { id: string; email: string | null }, cfg: MailCfg, orderId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return json({ success: false, error: "bad_order" }, 400);
  // RLS: klient widzi tylko własne zlecenie — nie da się tym wysłać maila o cudzym.
  const got = await rest(auth, `aurora_business_orders?id=eq.${orderId}&user_id=eq.${user.id}&select=id,service_type,brief,client_email,client_name,created_at&limit=1`);
  const o = Array.isArray(got.data) ? (got.data[0] as Record<string, string> | undefined) : undefined;
  if (!o) return json({ success: false, error: "not_found" }, 404);
  const short = o.id.slice(0, 8).toUpperCase();
  const brief = esc(o.brief).replace(/\n/g, "<br>");
  const out: Record<string, boolean> = {};
  const notify = env("SHOP_NOTIFY_EMAIL");
  if (notify) {
    out.admin = await sendMail(cfg, {
      to: notify, key: `b2b-admin-${o.id}`,
      subject: `🧾 Nowe zlecenie B2B #${short} (${o.service_type})`,
      html: frame(`<h1 style="font-size:20px;margin:0 0 12px">Nowe zlecenie od Aurory</h1>
<p><b>Usługa:</b> ${esc(o.service_type)}<br><b>Klient:</b> ${esc(o.client_name || "—")} &lt;${esc(o.client_email || user.email || "—")}&gt;</p>
<div style="background:#f4f4f5;border-radius:12px;padding:14px">${brief}</div>
<p><a href="https://grouaistream.com/admin" style="color:#f97316;font-weight:700">Otwórz panel admina → Zlecenia B2B</a></p>`),
    });
  }
  const clientMail = o.client_email || user.email;
  if (clientMail && EMAIL_RE.test(clientMail)) {
    out.client = await sendMail(cfg, {
      to: clientMail, key: `b2b-client-${o.id}`, replyTo: notify,
      subject: `Twoje zlecenie #${short} w GrouAI Stream`,
      html: frame(`<h1 style="font-size:20px;margin:0 0 12px">Dziękujemy — zlecenie przyjęte</h1>
<p>Zespół GrouAI przygotuje wycenę i odezwie się na ten adres. Status zobaczysz w panelu klienta.</p>
<div style="background:#f4f4f5;border-radius:12px;padding:14px">${brief}</div>
<p><a href="https://grouaistream.com/client-dashboard/${o.id}" style="color:#f97316;font-weight:700">Panel klienta</a></p>`),
    });
  }
  return json({ success: true, ...out });
}

async function handlePost(req: Request): Promise<Response> {
  if (!supa()) return json({ success: false, error: "Brak konfiguracji Supabase w Vercel" }, 500);
  const auth = req.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+/.test(auth)) return json({ success: false, error: "Zaloguj się" }, 401);
  const user = await getUser(auth);
  if (!user) return json({ success: false, error: "Sesja wygasła — zaloguj się ponownie" }, 401);
  const cfg = mailConfigFromEnv(env, "GrouAI Stream");
  if (!cfg) return json({ success: false, error: "Wysyłka nieskonfigurowana" }, 500);

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* */ }

  if (body.action === "b2b-order") return b2bOrder(auth, user, cfg, String(body.orderId ?? ""));

  if (!(await isAdmin(auth, user.id))) return json({ success: false, error: "Tylko admin może wysyłać maile" }, 403);
  const subject = String(body.subject ?? "").trim().slice(0, 200);
  const html = String(body.html ?? "");
  if (!subject || !html.trim()) return json({ success: false, error: "Brak tematu albo treści" }, 400);
  const full = frame(html);

  if (body.mode === "single") {
    const to = String(body.to ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(to)) return json({ success: false, error: "Nieprawidłowy adres e-mail" }, 400);
    const ok = await sendMail(cfg, { to, subject, html: full });
    return json({ success: ok, recipientCount: 1, sent: ok ? 1 : 0, errors: ok ? 0 : 1, subject, mode: "single", ...(ok ? {} : { error: "Serwer pocztowy odrzucił wiadomość" }) });
  }

  if (body.mode === "mass") {
    const audience = body.audience === "blog_subscribers" ? "blog_subscribers" : "all_users";
    const raw = await recipients(auth, audience);
    const uniq = [...new Set(raw.map((e) => e.trim().toLowerCase()).filter((e) => EMAIL_RE.test(e)))];
    const skipped = raw.length - uniq.length;
    if (!uniq.length) return json({ success: false, error: "Brak odbiorców", recipientCount: 0, skipped });
    const enc = new TextEncoder();
    const stream = new ReadableStream({
      async start(ctrl) {
        const beat = setInterval(() => { try { ctrl.enqueue(enc.encode(" ")); } catch { /* */ } }, 5000);
        try {
          const { sent, errors } = await sendMany(cfg, uniq, subject, full);
          ctrl.enqueue(enc.encode(JSON.stringify({ success: sent > 0, recipientCount: uniq.length, sent, errors, skipped, subject, mode: "mass", provider: cfg.provider })));
        } catch (e) {
          ctrl.enqueue(enc.encode(JSON.stringify({ success: false, error: String(e).slice(0, 200) })));
        } finally {
          clearInterval(beat);
          ctrl.close();
        }
      },
    });
    return new Response(stream, { headers: { "content-type": "application/json", "cache-control": "no-store" } });
  }
  return json({ success: false, error: "Nieznany tryb" }, 400);
}

async function handleGet(req: Request): Promise<Response> {
  const cfg = mailConfigFromEnv(env);
  const notify = env("SHOP_NOTIFY_EMAIL");
  // ?selftest=1 — próbny mail TYLKO na stały adres właściciela (SHOP_NOTIFY_EMAIL), najwyżej raz na godzinę (klucz idempotencji).
  if (new URL(req.url).searchParams.get("selftest") === "1" && cfg && notify) {
    const hour = new Date().toISOString().slice(0, 13);
    const ok = await sendMail(cfg, {
      to: notify, key: `selftest-${hour}`,
      subject: "✅ Test wysyłki GrouAI Stream",
      html: frame(`<h1 style="font-size:20px;margin:0 0 12px">Wysyłka maili działa</h1><p>To próbna wiadomość z ${esc(hour.replace("T", " "))}:00 UTC (${esc(cfg.provider)}).</p>`),
    });
    return json({ ok, provider: cfg.provider, to: notify.replace(/^(.).*(@.*)$/, "$1***$2") });
  }
  return json({ ok: !!cfg, provider: cfg?.provider ?? null, notify: !!notify });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "POST") return handlePost(req);
  if (req.method === "GET") return handleGet(req);
  return json({ error: "method" }, 405);
}
