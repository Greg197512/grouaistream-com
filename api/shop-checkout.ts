/**
 * Sklep Grouarock na Vercelu (bez Lovable i bez funkcji Supabase).
 *
 * Zamówienie trafia do istniejącej tabeli `aurora_business_orders` (service_type "shop") z tokenem
 * zalogowanego użytkownika, więc działa w ramach jego uprawnień RLS (insert/select/update własnych).
 * Ceny liczy serwer z `src/data/shopCatalog.ts`.
 *
 * Płatności (zmienne w Vercel):
 *  - karta przez Stripe Checkout: `STRIPE_SECRET_KEY`,
 *  - przelew na konto (Revolut): `SHOP_BANK_HOLDER`, `SHOP_BANK_IBAN`, opcjonalnie `SHOP_BANK_BIC`, `SHOP_REVOLUT_LINK`.
 *  Bez żadnej z nich zamówienie zostaje „do opłacenia”, a admin wysyła link ręcznie.
 *  Paddle nie jest tu używany, bo zabrania sprzedaży towarów fizycznych.
 * Sprzedawca (regulamin, faktury): `SHOP_SELLER_NAME`, `SHOP_SELLER_ADDRESS`, `SHOP_SELLER_COUNTRY` (ISO),
 *  `SHOP_SELLER_TAX_ID`, `SHOP_SELLER_VAT_ID`, `SHOP_SELLER_EMAIL`, `SHOP_VAT_MODE` (oss|domestic|exempt),
 *  `SHOP_VAT_EXEMPT_NOTE`, `SHOP_DELIVERY_DAYS`, `SHOP_SHIPPING_EUR_CENTS`.
 *
 *   GET                                         → konfiguracja publiczna (ShopConfig)
 *   POST { action:"create", items, shipping, method, lang } → { orderId, ref, payment:"stripe", url } | { orderId, ref, payment:"transfer", bank } | { orderId, ref, payment:"pending" }
 *   POST { action:"payinfo", orderId }          → dane do przelewu dla własnego zamówienia
 *   POST { action:"confirm", orderId }          → { orderId, paid } (sprawdza sesję w Stripe; klient albo admin)
 */
import { cleanShipping, isValidIban, orderBrief, orderRef, priceCart, SHOP_SERVICE_TYPE, SHOP_SOURCE } from "../src/lib/shopOrder";
import { parseVatMode } from "../src/lib/vatOss";
import { localizeProduct } from "../src/data/shopCatalogI18n";
import { SHOP_PRODUCTS } from "../src/data/shopCatalog";

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

const shipCentsEnv = () => Math.max(0, Math.round(Number(env("SHOP_SHIPPING_EUR_CENTS") ?? 0)) || 0);
const hasStripe = () => !!env("STRIPE_SECRET_KEY");
const bank = () => {
  const iban = env("SHOP_BANK_IBAN"), holder = env("SHOP_BANK_HOLDER");
  return iban && holder && isValidIban(iban) ? { holder, iban: iban.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim(), bic: env("SHOP_BANK_BIC") ?? null, revolut: env("SHOP_REVOLUT_LINK") ?? null } : null;
};

function publicConfig() {
  const name = env("SHOP_SELLER_NAME"), address = env("SHOP_SELLER_ADDRESS");
  return {
    stripe: hasStripe(), transfer: !!bank(), ibanInvalid: !!env("SHOP_BANK_IBAN") && !isValidIban(env("SHOP_BANK_IBAN")!), shippingCents: shipCentsEnv(), deliveryDays: env("SHOP_DELIVERY_DAYS") ?? "5–14",
    seller: name && address ? {
      name, address, country: env("SHOP_SELLER_COUNTRY")?.toUpperCase() ?? null, taxId: env("SHOP_SELLER_TAX_ID") ?? null,
      vatId: env("SHOP_SELLER_VAT_ID") ?? null, email: env("SHOP_SELLER_EMAIL") ?? null,
    } : null,
    vatMode: parseVatMode(env("SHOP_VAT_MODE")), exemptNote: env("SHOP_VAT_EXEMPT_NOTE") ?? null,
  };
}

const LANGS = ["pl", "en", "nl"] as const;
type Lang = (typeof LANGS)[number];
const productById = new Map(SHOP_PRODUCTS.map((p) => [p.id, p]));
const SHIP_NAME: Record<Lang, string> = { pl: "Wysyłka", en: "Shipping", nl: "Verzending" };

async function create(req: Request, auth: string, user: User, body: Record<string, unknown>) {
  const priced = priceCart(body.items);
  if ("error" in priced) return json({ error: priced.error }, 400);
  const shipping = cleanShipping(body.shipping);
  if (!shipping) return json({ error: "bad_shipping" }, 400);
  const lang: Lang = (LANGS as readonly string[]).includes(String(body.lang)) ? (body.lang as Lang) : "en";
  const method = body.method === "card" ? "card" : body.method === "transfer" ? "transfer" : null;
  if (method === "card" && !hasStripe()) return json({ error: "bad_method" }, 400);
  if (method === "transfer" && !bank()) return json({ error: "bad_method" }, 400);
  const shipCents = shipCentsEnv();
  const totalCents = priced.totalCents + shipCents;
  const payload = { items: priced.lines, shipping, shipping_cents: shipCents, total_cents: totalCents, currency: "EUR", method, lang };

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
  const ref = orderRef(orderId);

  if (method === "transfer") return json({ orderId, ref, payment: "transfer", bank: { ...bank(), amountCents: totalCents, reference: ref } });
  if (method !== "card") return json({ orderId, ref, payment: "pending" });

  const origin = siteOrigin(req);
  const f = new URLSearchParams();
  f.set("mode", "payment");
  f.set("client_reference_id", orderId);
  f.set("metadata[order_id]", orderId);
  f.set("payment_intent_data[metadata][order_id]", orderId);
  if (user.email) f.set("customer_email", user.email);
  f.set("locale", lang);
  f.set("success_url", `${origin}/shop?paid=1&order=${orderId}`);
  f.set("cancel_url", `${origin}/shop?cancelled=1&order=${orderId}`);
  const named = priced.lines.map((l) => {
    const p = productById.get(l.id);
    return { ...l, name: p ? localizeProduct(p, lang).name : l.name };
  });
  const all = [...named, ...(shipCents ? [{ name: SHIP_NAME[lang], size: null, qty: 1, unitCents: shipCents }] : [])];
  all.forEach((l, i) => {
    f.set(`line_items[${i}][quantity]`, String(l.qty));
    f.set(`line_items[${i}][price_data][currency]`, "eur");
    f.set(`line_items[${i}][price_data][unit_amount]`, String(l.unitCents));
    f.set(`line_items[${i}][price_data][product_data][name]`, l.size ? `${l.name} · ${l.size}` : l.name);
  });
  const s = await stripe("checkout/sessions", f);
  if (!s.ok || !s.data.url) return json({ orderId, ref, payment: "pending", error: "stripe_failed" });

  await rest(auth, `aurora_business_orders?id=eq.${orderId}`, {
    method: "PATCH",
    body: JSON.stringify({ checkout_url: s.data.url, payload: { ...payload, stripe_session_id: s.data.id } }),
  });
  return json({ orderId, ref, payment: "stripe", url: s.data.url });
}

async function payinfo(auth: string, body: Record<string, unknown>) {
  const orderId = String(body.orderId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return json({ error: "bad_order" }, 400);
  const b = bank();
  if (!b) return json({ error: "transfer_not_configured" }, 404);
  const got = await rest(auth, `aurora_business_orders?id=eq.${orderId}&service_type=eq.${SHOP_SERVICE_TYPE}&select=id,price_eur,payload,payment_status`);
  const row = Array.isArray(got.data) ? (got.data[0] as { price_eur?: number; payload?: { total_cents?: number } }) : null;
  if (!row) return json({ error: "not_found" }, 404);
  const amountCents = row.payload?.total_cents ?? Math.round(Number(row.price_eur ?? 0) * 100);
  return json({ orderId, bank: { ...b, amountCents, reference: orderRef(orderId) } });
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
  if (req.method === "GET") return json(publicConfig());
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
    if (body.action === "payinfo") return await payinfo(auth, body);
    return json({ error: "unknown_action" }, 400);
  } catch {
    return json({ error: "server_error" }, 500);
  }
}
