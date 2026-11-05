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
 * Sprzedawca (regulamin, faktury; w prod ustawione nazwa/adres/kraj/e-mail): `SHOP_SELLER_NAME`, `SHOP_SELLER_ADDRESS`, `SHOP_SELLER_COUNTRY` (ISO),
 *  `SHOP_SELLER_TAX_ID`, `SHOP_SELLER_VAT_ID`, `SHOP_SELLER_EMAIL`, `SHOP_VAT_MODE` (oss|domestic|exempt),
 *  `SHOP_VAT_EXEMPT_NOTE`, `SHOP_DELIVERY_DAYS`, `SHOP_SHIPPING_EUR_CENTS`.
 *
 *   GET                                         → konfiguracja publiczna (ShopConfig)
 *   POST { action:"create", items, shipping, method, lang } → { orderId, ref, payment:"stripe", url } | { orderId, ref, payment:"transfer", bank } | { orderId, ref, payment:"pending" }
 *   POST { action:"payinfo", orderId }          → dane do przelewu dla własnego zamówienia
 *   POST { action:"confirm", orderId }          → { orderId, paid } (sprawdza sesję w Stripe; klient albo admin) + realizacja
 *   POST { action:"fulfill", orderId, force? }  → (admin) wysyła opłacone zamówienie do realizacji
 *   POST { action:"printful-check" }            → (admin) które produkty nie są jeszcze podpięte w Printful
 *
 * Realizacja (my jesteśmy pośrednikiem): po opłaceniu odzież/dodatki idą do Printful (`PRINTFUL_API_KEY`,
 * opcjonalnie `PRINTFUL_STORE_ID`, `PRINTFUL_AUTO_CONFIRM=true` = od razu do produkcji, inaczej szkic do zatwierdzenia),
 * gadżety e-mailem do dostawcy (`SHOP_SUPPLIER_EMAIL`). E-maile: `RESEND_API_KEY` albo `BREVO_API_KEY`
 * + `SHOP_MAIL_FROM` (+ `SHOP_MAIL_FROM_NAME`); powiadomienia dla Ciebie na `SHOP_NOTIFY_EMAIL`.
 */
import { cleanShipping, isValidIban, orderBrief, orderRef, priceCart, SHOP_SERVICE_TYPE, SHOP_SOURCE } from "../src/lib/shopOrder";
import { parseVatMode } from "../src/lib/vatOss";
import { localizeProduct } from "../src/data/shopCatalogI18n";
import { SHOP_PRODUCTS } from "../src/data/shopCatalog";
import { supplierFor, printfulExternalId } from "../src/data/shopSuppliers";
import { createPrintfulOrder, printfulAssets, printfulExternalIds, printfulStores, type PrintfulCfg } from "../src/lib/printful";
import { CARRIERS, carrierById, isPointCode, trackingUrl } from "../src/data/shopCarriers";
import { adminMail, customerPaidMail, customerShippedMail, customerTransferMail, mailConfigFromEnv, sendMail, supplierMail, type MailCfg, type MailOrder } from "../src/lib/shopMail";
import type { PricedLine, Shipping } from "../src/lib/shopOrder";

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
/** Cena dostawy u danego przewoźnika: SHOP_CARRIER_PRICES (JSON, eurocenty) albo cena ogólna. */
const carrierCents = (id: string | undefined) => {
  try {
    const m = JSON.parse(env("SHOP_CARRIER_PRICES") ?? "{}") as Record<string, unknown>;
    const v = id ? Number(m[id]) : NaN;
    if (Number.isFinite(v) && v >= 0) return Math.round(v);
  } catch { /* zły JSON → cena ogólna */ }
  return shipCentsEnv();
};
const hasStripe = () => !!env("STRIPE_SECRET_KEY");
// Płatność „Revolut QR”: wystarczy SHOP_REVOLUT_LINK (klient płaci w aplikacji albo kartą); IBAN jest zapasowy.
const bank = () => {
  const iban = env("SHOP_BANK_IBAN"), holder = env("SHOP_BANK_HOLDER"), revolut = env("SHOP_REVOLUT_LINK") ?? null;
  const ibanOk = !!(iban && holder && isValidIban(iban));
  if (!revolut && !ibanOk) return null;
  return { holder: holder ?? "", iban: ibanOk ? iban!.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim() : "", bic: env("SHOP_BANK_BIC") ?? null, revolut };
};

function mailCfg(): MailCfg | null {
  // Resend/Brevo, gdy ustawione; inaczej wysyłka GrouAI przez główny projekt Supabase (bez kluczy).
  return mailConfigFromEnv(env, "GrouaDrop");
}
// Adres naszej strony dla pośrednika Printful (ustawiany na starcie każdego zapytania).
let pfOrigin: string | null = null;
function printfulCfg(): PrintfulCfg | null {
  const token = env("PRINTFUL_API_KEY");
  return token ? { token, storeId: env("PRINTFUL_STORE_ID") ?? null, confirm: env("PRINTFUL_AUTO_CONFIRM") === "true", proxy: pfOrigin } : null;
}

function publicConfig() {
  const name = env("SHOP_SELLER_NAME"), address = env("SHOP_SELLER_ADDRESS");
  return {
    stripe: hasStripe(), transfer: !!bank(), ibanInvalid: !!env("SHOP_BANK_IBAN") && !isValidIban(env("SHOP_BANK_IBAN")!), shippingCents: shipCentsEnv(), deliveryDays: env("SHOP_DELIVERY_DAYS") ?? "5–14",
    seller: name && address ? {
      name, address, country: env("SHOP_SELLER_COUNTRY")?.toUpperCase() ?? null, taxId: env("SHOP_SELLER_TAX_ID") ?? null,
      vatId: env("SHOP_SELLER_VAT_ID") ?? null, email: env("SHOP_SELLER_EMAIL") ?? null,
    } : null,
    // Kontakt widoczny w sklepie nawet bez pełnych danych firmy (adres potrzebny dopiero do faktur).
    contact: { name: name ?? null, email: env("SHOP_SELLER_EMAIL") ?? null },
    carriers: CARRIERS.map((c) => ({ id: c.id, cents: carrierCents(c.id) })),
    vatMode: parseVatMode(env("SHOP_VAT_MODE")), exemptNote: env("SHOP_VAT_EXEMPT_NOTE") ?? null,
    fulfillment: { printful: !!printfulCfg(), printfulAuto: !!printfulCfg()?.confirm, mail: !!mailCfg(), supplierEmail: !!env("SHOP_SUPPLIER_EMAIL"), notify: !!env("SHOP_NOTIFY_EMAIL") },
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
  const carrier = carrierById(shipping.carrier);
  if (!carrier || (carrier.countries && !carrier.countries.includes(shipping.country))) return json({ error: "bad_carrier" }, 400);
  if (carrier.point && !isPointCode(shipping.point ?? "")) return json({ error: "bad_point" }, 400);
  if (!carrier.point) delete shipping.point;
  const lang: Lang = (LANGS as readonly string[]).includes(String(body.lang)) ? (body.lang as Lang) : "en";
  const method = body.method === "card" ? "card" : body.method === "transfer" ? "transfer" : null;
  if (method === "card" && !hasStripe()) return json({ error: "bad_method" }, 400);
  if (method === "transfer" && !bank()) return json({ error: "bad_method" }, 400);
  const shipCents = carrierCents(carrier.id);
  const totalCents = priced.totalCents + shipCents;
  const payload = { items: priced.lines, shipping, shipping_cents: shipCents, total_cents: totalCents, currency: "EUR", method, lang };

  const ins = await rest(auth, "aurora_business_orders", {
    method: "POST",
    body: JSON.stringify({
      user_id: user.id, client_email: user.email, client_name: shipping.name || user.name,
      service_type: SHOP_SERVICE_TYPE, source: SHOP_SOURCE, status: "new", payment_status: "pending",
      price_eur: totalCents / 100, brief: `${orderBrief(priced.lines, totalCents)} · dostawa: ${carrier.name}${shipping.point ? ` ${shipping.point}` : ""}`.slice(0, 4000), payload,
    }),
  });
  const row = Array.isArray(ins.data) ? (ins.data[0] as { id?: string }) : null;
  if (!ins.ok || !row?.id) return json({ error: "order_save_failed", status: ins.status }, 502);
  const orderId = row.id;
  const ref = orderRef(orderId);

  if (method === "transfer") {
    const b = bank()!;
    const mo: MailOrder = { id: orderId, lines: priced.lines, totalCents, shipping, email: user.email, lang };
    const m = mailCfg();
    if (m) {
      const replyTo = env("SHOP_SELLER_EMAIL") ?? env("SHOP_NOTIFY_EMAIL");
      await Promise.all([
        user.email ? sendMail(m, { to: user.email, replyTo, ...customerTransferMail(mo, b) }) : null,
        env("SHOP_NOTIFY_EMAIL") ? sendMail(m, { to: env("SHOP_NOTIFY_EMAIL")!, ...adminMail(mo, "awaiting_transfer", [`Sprawdź w Revolut wpłatę z tytułem ${ref}, potem ustaw „Opłacone” w panelu — realizacja ruszy sama.`]) }) : null,
      ]);
    }
    return json({ orderId, ref, payment: "transfer", bank: { ...b, amountCents: totalCents, reference: ref } });
  }
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
  const all = [...named, ...(shipCents ? [{ name: `${SHIP_NAME[lang]} · ${carrier.name}`, size: null, qty: 1, unitCents: shipCents }] : [])];
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
  const got = await rest(auth, `aurora_business_orders?id=eq.${orderId}&service_type=eq.${SHOP_SERVICE_TYPE}&select=id,client_email,payload,payment_status`);
  const row = Array.isArray(got.data) ? (got.data[0] as { payload?: Record<string, unknown>; payment_status?: string; client_email?: string }) : null;
  if (!row) return json({ error: "not_found" }, 404);
  if (row.payment_status === "paid") return json({ orderId, paid: true });
  const sid = row.payload?.stripe_session_id;
  if (!sid) return json({ orderId, paid: false });
  const s = await stripe(`checkout/sessions/${encodeURIComponent(String(sid))}`);
  const paid = s.ok && s.data.payment_status === "paid" && s.data.metadata?.order_id === orderId;
  if (!paid) return json({ orderId, paid: false });
  const payload = { ...row.payload, stripe_payment_intent: s.data.payment_intent ?? null, amount_total: s.data.amount_total ?? null };
  const upd = await rest(auth, `aurora_business_orders?id=eq.${orderId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "paid", payment_status: "paid", paid_at: new Date().toISOString(), payload }),
  });
  // Płatność potwierdzona w Stripe (nie przez klienta) → można bezpiecznie zlecić realizację.
  const f = upd.ok ? await fulfill(auth, { id: orderId, client_email: (row as { client_email?: string }).client_email ?? null, payload }, false) : null;
  return json({ orderId, paid: upd.ok, fulfillment: f?.state ?? null });
}

type OrderRow = { id: string; client_email: string | null; payment_status?: string; payload: Record<string, unknown> | undefined };
type Fulfillment = { state: "sending" | "sent" | "manual" | "error"; at: string; notes?: string[]; printful?: unknown; supplier_email?: boolean; mails?: { customer?: boolean; admin?: boolean } };

/** Zleca realizację opłaconego zamówienia: Printful + dostawca e-mailowy + e-maile. Jednorazowo (blokada w payload). */
async function fulfill(auth: string, row: OrderRow, force: boolean): Promise<Fulfillment | { state: "skipped" }> {
  const p = (row.payload ?? {}) as Record<string, unknown> & { items?: PricedLine[]; shipping?: Shipping; total_cents?: number; lang?: string; fulfillment?: Fulfillment };
  if (!p.shipping || !Array.isArray(p.items)) return { state: "error", at: new Date().toISOString(), notes: ["Brak pozycji lub adresu"] };
  const prev = p.fulfillment;
  if (prev && !(force && (prev.state === "error" || prev.state === "manual"))) return { state: "skipped" };

  // Blokada: tylko jedno wywołanie przejmuje realizację (warunkowy PATCH).
  const cond = prev ? `&payload->fulfillment->>state=eq.${prev.state}` : "&payload->fulfillment=is.null";
  const claim = await rest(auth, `aurora_business_orders?id=eq.${row.id}${cond}`, {
    method: "PATCH", body: JSON.stringify({ payload: { ...p, fulfillment: { state: "sending", at: new Date().toISOString(), mails: prev?.mails } } }),
  });
  if (!claim.ok || !Array.isArray(claim.data) || claim.data.length === 0) return { state: "skipped" };

  const lang = p.lang === "en" || p.lang === "nl" ? p.lang : "pl";
  const mo: MailOrder = { id: row.id, lines: p.items, totalCents: p.total_cents ?? 0, shipping: p.shipping, email: row.client_email, lang };
  const notes: string[] = [];
  let failed = false, manual = false;
  const out: Fulfillment = { state: "sent", at: new Date().toISOString(), mails: { ...(prev?.mails ?? {}) } };

  const pfLines = p.items.filter((l) => supplierFor(l.id) === "printful");
  const mailLines = p.items.filter((l) => supplierFor(l.id) === "email");
  const pf = printfulCfg();
  if (pfLines.length) {
    if (!pf) { manual = true; notes.push(`Printful niepodłączony — zamów ręcznie: ${pfLines.map((l) => `${l.qty}× ${printfulExternalId(l.id, l.size)}`).join(", ")}`); }
    else {
      const r = await createPrintfulOrder(pf, row.id, pfLines, p.shipping, row.client_email);
      out.printful = r;
      if (r.ok) notes.push(`Printful: zamówienie #${r.id} (${r.status === "draft" ? "szkic — zatwierdź w Printful" : r.status})`);
      else { failed = true; notes.push(`Printful BŁĄD: ${r.error}`); }
    }
  }
  const m = mailCfg();
  const supplier = env("SHOP_SUPPLIER_EMAIL");
  if (mailLines.length) {
    if (supplier && m) {
      out.supplier_email = await sendMail(m, { to: supplier, replyTo: env("SHOP_NOTIFY_EMAIL"), ...supplierMail(mo, mailLines, env("SHOP_SELLER_NAME") ?? "GrouaDrop") });
      notes.push(out.supplier_email ? `Dostawca (${supplier}) dostał zlecenie: ${mailLines.map((l) => l.name).join(", ")}` : `Nie udało się wysłać e-maila do dostawcy ${supplier}`);
      if (!out.supplier_email) failed = true;
    } else { manual = true; notes.push(`Brak dostawcy e-mailowego — zamów ręcznie: ${mailLines.map((l) => `${l.qty}× ${l.name}`).join(", ")}`); }
  }
  if (m) {
    if (row.client_email && !out.mails?.customer) out.mails!.customer = await sendMail(m, { to: row.client_email, replyTo: env("SHOP_SELLER_EMAIL") ?? env("SHOP_NOTIFY_EMAIL"), ...customerPaidMail(mo, env("SHOP_DELIVERY_DAYS") ?? "5–14") });
    if (env("SHOP_NOTIFY_EMAIL")) out.mails!.admin = await sendMail(m, { to: env("SHOP_NOTIFY_EMAIL")!, ...adminMail(mo, "paid", notes) });
  } else notes.push("E-maile wyłączone (brak konfiguracji Supabase w env)");

  out.state = failed ? "error" : manual ? "manual" : "sent";
  out.notes = notes;
  await rest(auth, `aurora_business_orders?id=eq.${row.id}`, { method: "PATCH", body: JSON.stringify({ payload: { ...p, fulfillment: out } }) });
  return out;
}

async function isAdmin(auth: string, userId: string): Promise<boolean> {
  const r = await rest(auth, "rpc/has_role", { method: "POST", body: JSON.stringify({ _user_id: userId, _role: "admin" }) });
  return r.ok && r.data === true;
}

async function fulfillAction(auth: string, user: User, body: Record<string, unknown>) {
  if (!(await isAdmin(auth, user.id))) return json({ error: "forbidden" }, 403);
  const orderId = String(body.orderId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return json({ error: "bad_order" }, 400);
  const got = await rest(auth, `aurora_business_orders?id=eq.${orderId}&service_type=eq.${SHOP_SERVICE_TYPE}&select=id,client_email,payment_status,payload`);
  const row = Array.isArray(got.data) ? (got.data[0] as OrderRow) : null;
  if (!row) return json({ error: "not_found" }, 404);
  if (row.payment_status !== "paid") return json({ error: "not_paid" }, 409);
  return json({ orderId, fulfillment: await fulfill(auth, row, body.force === true) });
}

// Nadanie paczki (admin): przewoźnik + numer → status „Wysłane”, link śledzenia w zamówieniu i e-mail do klienta.
async function shipAction(auth: string, user: User, body: Record<string, unknown>) {
  if (!(await isAdmin(auth, user.id))) return json({ error: "forbidden" }, 403);
  const orderId = String(body.orderId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return json({ error: "bad_order" }, 400);
  const carrier = carrierById(body.carrier);
  const number = String(body.number ?? "").replace(/\s+/g, "").toUpperCase();
  if (!carrier) return json({ error: "bad_carrier" }, 400);
  if (!/^[A-Z0-9-]{4,40}$/.test(number)) return json({ error: "bad_number" }, 400);
  const got = await rest(auth, `aurora_business_orders?id=eq.${orderId}&service_type=eq.${SHOP_SERVICE_TYPE}&select=id,client_email,payment_status,payload`);
  const row = Array.isArray(got.data) ? (got.data[0] as OrderRow) : null;
  if (!row) return json({ error: "not_found" }, 404);
  const tracking = { carrier: carrier.id, number, at: new Date().toISOString() };
  const payload = { ...(row.payload ?? {}), tracking };
  const upd = await rest(auth, `aurora_business_orders?id=eq.${orderId}`, { method: "PATCH", body: JSON.stringify({ status: "shipped", payload }) });
  if (!upd.ok) return json({ error: "save_failed", status: upd.status }, 502);
  const p = payload as { items?: PricedLine[]; shipping?: Shipping; total_cents?: number; lang?: string };
  const m = mailCfg();
  let mailed = false;
  if (m && row.client_email && p.shipping && Array.isArray(p.items)) {
    const lang: Lang = (LANGS as readonly string[]).includes(String(p.lang)) ? (p.lang as Lang) : "pl";
    const mo: MailOrder = { id: row.id, lines: p.items, totalCents: p.total_cents ?? 0, shipping: p.shipping, email: row.client_email, lang };
    mailed = !!(await sendMail(m, { to: row.client_email, replyTo: env("SHOP_SELLER_EMAIL") ?? env("SHOP_NOTIFY_EMAIL"), ...customerShippedMail(mo, carrier.name, number, trackingUrl(carrier.id, number)) }));
  }
  return json({ orderId, tracking, url: trackingUrl(carrier.id, number), mailed });
}

async function printfulCheck(auth: string, user: User) {
  if (!(await isAdmin(auth, user.id))) return json({ error: "forbidden" }, 403);
  const pf = printfulCfg();
  if (!pf) return json({ error: "printful_not_configured" }, 404);
  const r = await printfulExternalIds(pf);
  if (r.ok === false) return json({ error: "printful_error", message: r.error }, 502);
  const have = new Set(r.ids);
  const need = SHOP_PRODUCTS.filter((p) => supplierFor(p.id) === "printful")
    .flatMap((p) => (p.sizes ? ["S", "M", "L", "XL", "XXL", "3XL"].map((s) => printfulExternalId(p.id, s)) : [printfulExternalId(p.id, null)]));
  return json({ linked: need.filter((x) => have.has(x)).length, total: need.length, missing: need.filter((x) => !have.has(x)) });
}

export default async function handler(req: Request): Promise<Response> {
  pfOrigin = env("SITE_URL")?.replace(/\/+$/, "") ?? new URL(req.url).origin;
  if (req.method === "GET") {
    // Diagnostyka Printful bez sekretów (same liczby), cache 5 min: GET ?diag=printful
    if (new URL(req.url).searchParams.get("diag") === "printful") {
      const pf = printfulCfg();
      if (!pf) return json({ configured: false });
      const r = await printfulExternalIds(pf);
      if (r.ok === false) return json({ configured: true, ok: false, error: r.error, storeIdSet: !!pf.storeId, stores: await printfulStores(pf), ...(await printfulAssets({ ...pf, storeId: null })) });
      const have = new Set(r.ids);
      const need = SHOP_PRODUCTS.filter((p) => supplierFor(p.id) === "printful")
        .flatMap((p) => (p.sizes ? ["S", "M", "L", "XL", "XXL", "3XL"].map((s) => printfulExternalId(p.id, s)) : [printfulExternalId(p.id, null)]));
      return new Response(JSON.stringify({ configured: true, ok: true, storeVariants: r.ids.length, linked: need.filter((x) => have.has(x)).length, total: need.length, autoConfirm: pf.confirm }), {
        headers: { "content-type": "application/json", "cache-control": "public, s-maxage=300" },
      });
    }
    return json(publicConfig());
  }
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
    if (body.action === "fulfill") return await fulfillAction(auth, user, body);
    if (body.action === "ship") return await shipAction(auth, user, body);
    if (body.action === "printful-check") return await printfulCheck(auth, user);
    return json({ error: "unknown_action" }, 400);
  } catch {
    return json({ error: "server_error" }, 500);
  }
}
