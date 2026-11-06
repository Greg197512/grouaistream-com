// Printful (druk na żądanie): tworzenie zamówienia i sprawdzenie, czy produkty są podpięte.
// Działa w funkcji edge (sam fetch). Dokumentacja: https://developers.printful.com/docs/
import type { PricedLine, Shipping } from "./shopOrder";
import { printfulExternalId } from "../data/shopSuppliers";
import { pfVariantFor } from "../data/printfulCatalog";

/** `proxy` = adres naszej strony: zapytania idą przez /api/printful-proxy (funkcja Node), bo edge blokuje zapora Printful. */
export type PrintfulCfg = { token: string; storeId?: string | null; confirm: boolean; proxy?: string | null };
const BASE = "https://api.printful.com";

async function pf(cfg: PrintfulCfg, path: string, init: RequestInit = {}) {
  const url = cfg.proxy ? `${cfg.proxy}/api/printful-proxy?path=${encodeURIComponent(path)}` : BASE + path;
  const r = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${cfg.token}`, "content-type": "application/json", accept: "application/json",
      // Bez User-Agent zapora Cloudflare przed api.printful.com odrzuca zapytania z serwera (403 „Attention Required”).
      "user-agent": "GrouaDrop/1.0 (+https://grouaistream.com/shop)",
      ...(cfg.storeId ? { "x-pf-store-id": cfg.storeId } : {}), ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(20000),
  });
  const raw = await r.text().catch(() => "");
  let j: { code?: number; result?: unknown; error?: { message?: string; reason?: string } } = {};
  try { j = JSON.parse(raw); } catch { /* np. strona HTML z zapory */ }
  const msg = j.error?.message ?? (typeof j.result === "string" ? j.result : null) ?? (r.ok ? null : `HTTP ${r.status}${raw ? `: ${raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160)}` : ""}`);
  return { ok: r.ok, status: r.status, result: j.result, error: msg };
}

/** Treść zamówienia Printful. `external_id` = id zamówienia bez myślników (32 znaki) — Printful odrzuci duplikat. */
export function printfulOrderBody(orderId: string, lines: PricedLine[], ship: Shipping, email: string | null) {
  return {
    external_id: orderId.replace(/-/g, "").slice(0, 32),
    shipping: "STANDARD",
    recipient: {
      name: ship.name, company: ship.company || undefined, address1: ship.street, city: ship.city, zip: ship.zip,
      country_code: ship.country, phone: ship.phone || undefined, email: email || undefined,
    },
    // Produkt przeniesiony z Printful → wariant katalogowy + pliki nadruku; inaczej po External ID wariantu w sklepie API.
    items: lines.map((l) => {
      const v = pfVariantFor(l.id, l.size);
      return v
        ? { variant_id: v.variant_id, files: v.files.map((f) => ({ type: f.type, url: f.url })), quantity: l.qty, name: l.name, retail_price: (l.unitCents / 100).toFixed(2) }
        : { external_variant_id: printfulExternalId(l.id, l.size), quantity: l.qty, name: l.name };
    }),
  };
}

export async function createPrintfulOrder(cfg: PrintfulCfg, orderId: string, lines: PricedLine[], ship: Shipping, email: string | null) {
  const res = await pf(cfg, `/orders${cfg.confirm ? "?confirm=true" : ""}`, { method: "POST", body: JSON.stringify(printfulOrderBody(orderId, lines, ship, email)) });
  const o = (res.result ?? {}) as { id?: number; status?: string; dashboard_url?: string };
  return res.ok && o.id ? { ok: true as const, id: o.id, status: o.status ?? "draft", url: o.dashboard_url ?? null } : { ok: false as const, error: res.error ?? `HTTP ${res.status}` };
}

/** Sklepy na koncie Printful (id, nazwa, typ) — do wyboru PRINTFUL_STORE_ID sklepu typu API. */
export async function printfulStores(cfg: PrintfulCfg): Promise<{ id: number; name: string; type: string }[] | { error: string }> {
  const r = await pf({ ...cfg, storeId: null }, "/stores");
  if (!r.ok) return { error: r.error ?? `HTTP ${r.status}` };
  return ((r.result ?? []) as { id: number; name: string; type: string }[]).map((s) => ({ id: s.id, name: s.name, type: s.type }));
}

/** Szablony produktów i pliki do druku na koncie (do zakładania produktów w sklepie API). */
export async function printfulAssets(cfg: PrintfulCfg) {
  const t = await pf(cfg, "/product-templates?limit=100");
  const f = await pf(cfg, "/files?limit=100");
  const tpl = ((t.result ?? {}) as { items?: { id: number; title: string; product_id: number; available_variant_ids?: number[] }[] }).items ?? [];
  const files = (Array.isArray(f.result) ? f.result : []) as { id: number; filename: string; width?: number; height?: number; type?: string }[];
  return {
    templates: t.ok ? tpl.map((x) => ({ id: x.id, title: x.title, product: x.product_id, variants: x.available_variant_ids?.length ?? 0 })) : { error: t.error },
    files: f.ok ? files.map((x) => ({ id: x.id, name: x.filename, w: x.width, h: x.height, type: x.type })) : { error: f.error },
  };
}

/** Lista „External ID” wariantów w sklepie Printful (do sprawdzenia podpięcia produktów). */
export async function printfulExternalIds(cfg: PrintfulCfg): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  const list = await pf(cfg, "/store/products?limit=100");
  if (!list.ok) return { ok: false, error: list.error ?? `HTTP ${list.status}` };
  const products = (list.result ?? []) as { id: number }[];
  const ids: string[] = [];
  for (const p of products.slice(0, 60)) {
    const one = await pf(cfg, `/store/products/${p.id}`);
    const vars = ((one.result ?? {}) as { sync_variants?: { external_id?: string }[] }).sync_variants ?? [];
    for (const v of vars) if (v.external_id) ids.push(v.external_id);
  }
  return { ok: true, ids };
}

// Sklep typu „Manual order platform / API” (w API Printful: type "native"). Gdy PRINTFUL_STORE_ID nie ustawiono,
// znajdujemy go sami (pamięć 10 min) — wystarczy założyć taki sklep w Printful.
let apiStore: { id: string | null; at: number } | null = null;
export async function withApiStore(cfg: PrintfulCfg): Promise<PrintfulCfg> {
  if (cfg.storeId) return cfg;
  if (!apiStore || Date.now() - apiStore.at > 10 * 60_000) {
    const s = await printfulStores(cfg);
    const api = Array.isArray(s) ? s.find((x) => x.type === "native" || /api|manual/i.test(x.type)) : undefined;
    apiStore = { id: api ? String(api.id) : null, at: Date.now() };
  }
  return apiStore.id ? { ...cfg, storeId: apiStore.id } : cfg;
}

export type PfVariant = { id: number; product: string; name: string; size: string | null; color: string | null; externalId: string | null };
/** Wszystkie warianty produktów w sklepie API (do łączenia z naszym katalogiem). */
export async function printfulVariants(cfg: PrintfulCfg): Promise<{ ok: true; variants: PfVariant[] } | { ok: false; error: string }> {
  const list = await pf(cfg, "/store/products?limit=100");
  if (!list.ok) return { ok: false, error: list.error ?? `HTTP ${list.status}` };
  const out: PfVariant[] = [];
  for (const p of ((list.result ?? []) as { id: number }[]).slice(0, 60)) {
    const one = await pf(cfg, `/store/products/${p.id}`);
    const r = (one.result ?? {}) as { sync_product?: { name?: string }; sync_variants?: { id: number; name?: string; size?: string; color?: string; external_id?: string }[] };
    for (const v of r.sync_variants ?? []) {
      out.push({ id: v.id, product: r.sync_product?.name ?? "", name: v.name ?? "", size: v.size ?? null, color: v.color ?? null, externalId: v.external_id ?? null });
    }
  }
  return { ok: true, variants: out };
}

/** Ustawia „External ID” wariantu (np. "dropbass-M"), po którym zamówienia trafiają do właściwego produktu. */
export async function setPrintfulExternalId(cfg: PrintfulCfg, variantId: number, externalId: string) {
  const r = await pf(cfg, `/store/variants/${variantId}`, { method: "PUT", body: JSON.stringify({ external_id: externalId }) });
  return r.ok ? { ok: true as const } : { ok: false as const, error: r.error ?? `HTTP ${r.status}` };
}


export type PfExport = {
  store: string; storeId: number; id: number; name: string; thumb: string | null;
  variants: { size: string | null; color: string | null; price: string | null; currency: string | null; catalogVariantId: number | null; preview: string | null; files: { type: string; url: string | null; preview: string | null }[] }[];
};
/**
 * Pełne komplety produktów ze WSZYSTKICH sklepów Printful (też Etsy „Grouadrop”): nazwa, zdjęcia, rozmiary, kolory, ceny,
 * wariant katalogowy i pliki do druku — do przeniesienia do naszego sklepu. Etsy: /sync/products, sklep API: /store/products.
 */
export async function printfulExport(cfg: PrintfulCfg, max = 80): Promise<{ ok: true; products: PfExport[]; errors: string[] } | { ok: false; error: string }> {
  const stores = await printfulStores(cfg);
  if (!Array.isArray(stores)) return { ok: false, error: stores.error };
  const products: PfExport[] = [], errors: string[] = [];
  for (const st of stores) {
    const c = { ...cfg, storeId: String(st.id) };
    const base = st.type === "native" ? "/store/products" : "/sync/products";
    const list = await pf(c, `${base}?limit=100`);
    if (!list.ok) { errors.push(`${st.name}: ${list.error}`); continue; }
    const ids = ((list.result ?? []) as { id: number }[]).map((x) => x.id).slice(0, Math.max(0, max - products.length));
    // Szczegóły po 8 naraz (funkcja edge ma ~25 s na odpowiedź).
    const details: { id: number; one: Awaited<ReturnType<typeof pf>> }[] = [];
    for (let i = 0; i < ids.length; i += 8) details.push(...(await Promise.all(ids.slice(i, i + 8).map(async (id) => ({ id, one: await pf(c, `${base}/${id}`) })))));
    for (const { id: pid, one } of details) {
      if (!one.ok) { errors.push(`${st.name}/${pid}: ${one.error}`); continue; }
      const r = (one.result ?? {}) as {
        sync_product?: { id: number; name?: string; thumbnail_url?: string };
        sync_variants?: { size?: string; color?: string; retail_price?: string; currency?: string; variant_id?: number; product?: { variant_id?: number; image?: string }; files?: { type?: string; url?: string; preview_url?: string; thumbnail_url?: string }[] }[];
      };
      products.push({
        store: st.name, storeId: st.id, id: r.sync_product?.id ?? pid, name: r.sync_product?.name ?? "", thumb: r.sync_product?.thumbnail_url ?? null,
        variants: (r.sync_variants ?? []).map((v) => ({
          size: v.size ?? null, color: v.color ?? null, price: v.retail_price ?? null, currency: v.currency ?? null,
          catalogVariantId: v.variant_id ?? v.product?.variant_id ?? null,
          preview: (v.files ?? []).find((f) => f.type === "preview")?.preview_url ?? v.product?.image ?? null,
          files: (v.files ?? []).map((f) => ({ type: f.type ?? "default", url: f.url ?? null, preview: f.preview_url ?? f.thumbnail_url ?? null })),
        })),
      });
    }
  }
  return { ok: true, products, errors };
}

/** Uprawnienia (scopes) obecnego klucza — do diagnozy, czego brakuje. */
export async function printfulScopes(cfg: PrintfulCfg): Promise<string[] | { error: string }> {
  const r = await pf({ ...cfg, storeId: null }, "/oauth/scopes");
  if (!r.ok) return { error: r.error ?? `HTTP ${r.status}` };
  return (((r.result ?? {}) as { scopes?: { value?: string }[] }).scopes ?? []).map((x) => x.value ?? "").filter(Boolean);
}
