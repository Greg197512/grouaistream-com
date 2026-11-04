/**
 * Sklep Grouarock na Vercelu (bez Lovable i bez funkcji Supabase).
 *
 * Zamówienie trafia do istniejącej tabeli `aurora_business_orders` (service_type "shop") z tokenem
 * zalogowanego użytkownika, więc działa w ramach jego uprawnień RLS (insert/select/update własnych).
 * Ceny liczy serwer z `src/data/shopCatalog.ts`.
 *
 * Płatność: Stripe Checkout, gdy w Vercel jest `STRIPE_SECRET_KEY`. Bez klucza zamówienie
 * zostaje „do opłacenia”, a admin wysyła link do płatności ręcznie.
 * Paddle nie jest tu używany, bo zabrania sprzedaży towarów fizycznych.
 *
 *   GET                                   → { stripe: boolean }
 *   POST { action:"create", items, shipping } → { orderId, payment:"stripe", url } | { orderId, payment:"pending" }
 *   POST { action:"confirm", orderId }    → { orderId, paid } (sprawdza sesję w Stripe; klient albo admin)
 */
import { cleanShipping, orderBrief, priceCart, SHOP_SERVICE_TYPE, SHOP_SOURCE } from "../src/lib/shopOrder";

export const config = { runtime: "edge" };

const env = (k: string): string | undefined => {
  const v = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[k];
  return v && v.trim() ? v.trim() : undefined;
};
const H = { "content-type": "application/json", "cache-control": "no-store" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: H });

function supa() {
  const url = (env("SUPABASE_URL") ?? env("VITE_SUPABASE_URL"))?.replace(/\/+$/, "");
  const key = env("SUPABASE_ANON_KEY") ?? env("VITE_SUPABASE_PUBLISHABLE_KEY");
  return url && key ? { url, key } : null;
}

type User = { id: string; email: string | null; name: string | null };
async function currentUser(auth: string): Promise<User | null> {
  const s = supa();
  if (!s || !auth.startsWith("Bearer ")) return null;
  try {
    const r = await fetch(`${s.url}/auth/v1/user`, { headers: { apikey: s.key, authorization: auth }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const u = (await r.json()) as { id?: string; email?: string; user_metadata?: Record<string, string> };
    return u.id ? { id: u.id, email: u.email ?? null, name: u.user_metadata?.display_name ?? u.user_metadata?.full_name ?? null } : null;
  } catch {
    return null;
  }
}

/** Zapytanie PostgREST z tokenem użytkownika (RLS decyduje, co wolno). */
async function rest(auth: string, path: string, init: RequestInit = {}) {
  const s = supa()!;
  const r = await fetch(`${s.url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: s.key, authorization: auth, "content-type": "application/json", prefer: "return=representation", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(10000),
  });
  const text = await r.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: r.ok, status: r.status, data };
}

async function stripe(path: string, form?: URLSearchParams) {
  const key = env("STRIPE_SECRET_KEY")!;
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: form ? "POST" : "GET",
    headers: { authorization: `Bearer ${key}`, ...(form ? { "content-type": "application/x-www-form-urlencoded" } : {}) },
    body: form,
    signal: AbortSignal.timeout(15000),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- odpowiedź Stripe bez typów SDK
  const data = (await r.json().catch(() => ({}))) as Record<string, any>;
  return { ok: r.ok, data };
}

function siteOrigin(req: Request): string {
  const fixed = env("SITE_URL");
  if (fixed) return fixed.replace(/\/+$/, "");
  const o = req.headers.get("origin");
  if (o && /^https:\/\/([a-z0-9-]+\.)*(grouaistream\.com|vercel\.app)$/i.test(o)) return o;
  return "https://grouaistream.com";
}

async function create(req: Request, auth: string, user: User, body: Record<string, unknown>) {
  const priced = priceCart(body.items);
  if ("error" in priced) return json({ error: priced.error }, 400);
  const shipping = cleanShipping(body.shipping);
  if (!shipping) return json({ error: "bad_shipping" }, 400);
  const shipCents = Math.max(0, Math.round(Number(env("SHOP_SHIPPING_EUR_CENTS") ?? 0)) || 0);
  const totalCents = priced.totalCents + shipCents;
  const payload = { items: priced.lines, shipping, shipping_cents: shipCents, total_cents: totalCents, currency: "EUR" };

  const ins = await rest(auth, "aurora_business_orders", {
    method: "POST",
    body: JSON.stringify({
      user_id: user.id, client_email: user.email, client_name: shipping.name || user.name,
      service_type: SHOP_SERVICE_TYPE, source: SHOP_SOURCE, status: "new", payment_status: "pending",
      price_eur: totalCents / 100, brief: orderBrief(priced.lines, totalCents), payload,
    }),
  });
  const row = Array.isArray(ins.data) ? (ins.data[0] as { id?: string }) : null;
  if (!ins.ok || !row?.id) return json({ error: "order_save_failed", status: ins.status }, 502);
  const orderId = row.id;

  if (!env("STRIPE_SECRET_KEY")) return json({ orderId, payment: "pending" });

  const origin = siteOrigin(req);
  const f = new URLSearchParams();
  f.set("mode", "payment");
  f.set("client_reference_id", orderId);
  f.set("metadata[order_id]", orderId);
  f.set("payment_intent_data[metadata][order_id]", orderId);
  if (user.email) f.set("customer_email", user.email);
  f.set("locale", "pl");
  f.set("success_url", `${origin}/shop?paid=1&order=${orderId}`);
  f.set("cancel_url", `${origin}/shop?cancelled=1&order=${orderId}`);
  const all = [...priced.lines, ...(shipCents ? [{ name: "Wysyłka", size: null, qty: 1, unitCents: shipCents }] : [])];
  all.forEach((l, i) => {
    f.set(`line_items[${i}][quantity]`, String(l.qty));
    f.set(`line_items[${i}][price_data][currency]`, "eur");
    f.set(`line_items[${i}][price_data][unit_amount]`, String(l.unitCents));
    f.set(`line_items[${i}][price_data][product_data][name]`, l.size ? `${l.name} · ${l.size}` : l.name);
  });
  const s = await stripe("checkout/sessions", f);
  if (!s.ok || !s.data.url) return json({ orderId, payment: "pending", error: "stripe_failed" });

  await rest(auth, `aurora_business_orders?id=eq.${orderId}`, {
    method: "PATCH",
    body: JSON.stringify({ checkout_url: s.data.url, payload: { ...payload, stripe_session_id: s.data.id } }),
  });
  return json({ orderId, payment: "stripe", url: s.data.url });
}

async function confirm(auth: string, body: Record<string, unknown>) {
  const orderId = String(body.orderId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return json({ error: "bad_order" }, 400);
  if (!env("STRIPE_SECRET_KEY")) return json({ orderId, paid: false, error: "stripe_not_configured" });
  // RLS: właściciel widzi swoje zamówienie, admin wszystkie.
  const got = await rest(auth, `aurora_business_orders?id=eq.${orderId}&service_type=eq.${SHOP_SERVICE_TYPE}&select=id,payload,payment_status`);
  const row = Array.isArray(got.data) ? (got.data[0] as { payload?: Record<string, unknown>; payment_status?: string }) : null;
  if (!row) return json({ error: "not_found" }, 404);
  if (row.payment_status === "paid") return json({ orderId, paid: true });
  const sid = row.payload?.stripe_session_id;
  if (!sid) return json({ orderId, paid: false });
  const s = await stripe(`checkout/sessions/${encodeURIComponent(String(sid))}`);
  const paid = s.ok && s.data.payment_status === "paid" && s.data.metadata?.order_id === orderId;
  if (!paid) return json({ orderId, paid: false });
  const upd = await rest(auth, `aurora_business_orders?id=eq.${orderId}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "paid", payment_status: "paid", paid_at: new Date().toISOString(),
      payload: { ...row.payload, stripe_payment_intent: s.data.payment_intent ?? null, amount_total: s.data.amount_total ?? null },
    }),
  });
  return json({ orderId, paid: upd.ok });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "GET") return json({ stripe: !!env("STRIPE_SECRET_KEY"), shippingCents: Number(env("SHOP_SHIPPING_EUR_CENTS") ?? 0) || 0 });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!supa()) return json({ error: "not_configured" }, 503);
  const auth = req.headers.get("authorization") ?? "";
  const user = await currentUser(auth);
  if (!user) return json({ error: "login_required" }, 401);
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { return json({ error: "bad_json" }, 400); }
  try {
    if (body.action === "create") return await create(req, auth, user, body);
    if (body.action === "confirm") return await confirm(auth, body);
    return json({ error: "unknown_action" }, 400);
  } catch {
    return json({ error: "server_error" }, 500);
  }
}
