// Sklep Grouarock: wycena koszyka i sprawdzenie adresu. Używane przez serwer (api/shop-checkout),
// więc ceny zawsze pochodzą z katalogu, a nie od przeglądarki.
// Import względny (nie "@/"), bo plik jest też pakowany do funkcji Vercela w api/.
import { SHOP_PRODUCTS, type ShopProduct } from "../data/shopCatalog";

export const SHOP_SERVICE_TYPE = "shop";
export const SHOP_SOURCE = "grouarock-shop";
export const SHOP_SIZES = ["S", "M", "L", "XL", "XXL", "3XL"] as const;
export const SHOP_MAX_QTY = 20;

export type CartItem = { id: string; qty: number; size?: string };
export type PricedLine = { id: string; name: string; size: string | null; qty: number; unitCents: number };
export type Shipping = { name: string; street: string; city: string; zip: string; country: string; phone?: string };

const byId = new Map<string, ShopProduct>(SHOP_PRODUCTS.map((p) => [p.id, p]));

/** Wycenia koszyk według katalogu. Zwraca błąd dla nieznanych produktów, złych ilości i rozmiarów. */
export function priceCart(items: unknown): { lines: PricedLine[]; totalCents: number } | { error: string } {
  if (!Array.isArray(items) || items.length === 0) return { error: "empty_cart" };
  if (items.length > 50) return { error: "too_many_items" };
  const lines: PricedLine[] = [];
  for (const raw of items as CartItem[]) {
    const p = byId.get(String(raw?.id ?? ""));
    if (!p) return { error: "unknown_product" };
    const qty = Number(raw.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > SHOP_MAX_QTY) return { error: "bad_quantity" };
    let size: string | null = null;
    if (p.sizes) {
      size = String(raw.size ?? "").toUpperCase();
      if (!(SHOP_SIZES as readonly string[]).includes(size)) return { error: "bad_size" };
    }
    const same = lines.find((l) => l.id === p.id && l.size === size);
    if (same) {
      same.qty += qty;
      if (same.qty > SHOP_MAX_QTY) return { error: "bad_quantity" };
    } else lines.push({ id: p.id, name: p.name, size, qty, unitCents: p.eurCents });
  }
  return { lines, totalCents: lines.reduce((a, l) => a + l.unitCents * l.qty, 0) };
}

/** Czyści adres wysyłki; telefon jest opcjonalny, pozostałe pola wymagane. */
export function cleanShipping(s: unknown): Shipping | null {
  const o = (s ?? {}) as Record<string, unknown>;
  const f = (k: string, max = 120) => String(o[k] ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const out: Shipping = { name: f("name"), street: f("street", 160), city: f("city"), zip: f("zip", 16), country: f("country", 60), phone: f("phone", 32) };
  if ([out.name, out.street, out.city, out.zip, out.country].some((v) => v.length < 2)) return null;
  if (!out.phone) delete out.phone;
  return out;
}

/** Krótki opis zamówienia do kolumny `brief` (widoczny w panelach admina). */
export function orderBrief(lines: PricedLine[], totalCents: number): string {
  const items = lines.map((l) => `${l.qty}× ${l.name}${l.size ? ` (${l.size})` : ""}`).join(", ");
  return `Sklep Grouarock: ${items} · razem ${(totalCents / 100).toFixed(2)} EUR`.slice(0, 4000);
}

/** Wiersz z `aurora_business_orders` w kształcie używanym przez sklep i panel admina. */
export type ShopOrderView = {
  id: string; user_id: string | null; email: string | null; items: PricedLine[]; total_cents: number;
  status: string; payment_status: string; shipping: Shipping | null; stripe_session_id: string | null; created_at: string;
};
export function toShopOrder(row: Record<string, unknown>): ShopOrderView {
  const p = (row.payload ?? {}) as { items?: unknown; total_cents?: unknown; shipping?: Shipping; stripe_session_id?: string };
  const str = (v: unknown) => (v == null ? null : String(v));
  return {
    id: String(row.id), user_id: str(row.user_id), email: str(row.client_email),
    items: Array.isArray(p.items) ? (p.items as PricedLine[]) : [],
    total_cents: typeof p.total_cents === "number" && Number.isFinite(p.total_cents) ? p.total_cents : Math.round(Number(row.price_eur ?? 0) * 100),
    status: String(row.status ?? "new"), payment_status: String(row.payment_status ?? "pending"),
    shipping: p.shipping ?? null, stripe_session_id: p.stripe_session_id ?? null, created_at: String(row.created_at),
  };
}
