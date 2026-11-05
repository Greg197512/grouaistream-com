// Printful (druk na żądanie): tworzenie zamówienia i sprawdzenie, czy produkty są podpięte.
// Działa w funkcji edge (sam fetch). Dokumentacja: https://developers.printful.com/docs/
import type { PricedLine, Shipping } from "./shopOrder";
import { printfulExternalId } from "../data/shopSuppliers";

export type PrintfulCfg = { token: string; storeId?: string | null; confirm: boolean };
const BASE = "https://api.printful.com";

async function pf(cfg: PrintfulCfg, path: string, init: RequestInit = {}) {
  const r = await fetch(BASE + path, {
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
    items: lines.map((l) => ({ external_variant_id: printfulExternalId(l.id, l.size), quantity: l.qty, name: l.name })),
  };
}

export async function createPrintfulOrder(cfg: PrintfulCfg, orderId: string, lines: PricedLine[], ship: Shipping, email: string | null) {
  const res = await pf(cfg, `/orders${cfg.confirm ? "?confirm=true" : ""}`, { method: "POST", body: JSON.stringify(printfulOrderBody(orderId, lines, ship, email)) });
  const o = (res.result ?? {}) as { id?: number; status?: string; dashboard_url?: string };
  return res.ok && o.id ? { ok: true as const, id: o.id, status: o.status ?? "draft", url: o.dashboard_url ?? null } : { ok: false as const, error: res.error ?? `HTTP ${res.status}` };
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
