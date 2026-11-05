// Dopasowanie wariantów z Printful do naszego katalogu: nazwa produktu (PL/EN/NL) + rozmiar → „External ID”
// (np. "dropbass-M", "torba"). Bez AI — porównanie słów; słowa wspólne dla wielu produktów (np. GROUAROCK) mają małą wagę.
import { SHOP_PRODUCTS } from "../data/shopCatalog";
import { localizeProduct } from "../data/shopCatalogI18n";
import { supplierFor, printfulExternalId } from "../data/shopSuppliers";
import { SHOP_SIZES } from "./shopOrder";

const words = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter((w) => w.length > 1);

const PRODUCTS = SHOP_PRODUCTS.filter((p) => supplierFor(p.id) === "printful").map((p) => {
  const names = (["pl", "en", "nl"] as const).map((l) => localizeProduct(p, l).name);
  return { id: p.id, sizes: p.sizes, words: new Set(words(`${names.join(" ")} ${p.id}`)), glued: names.map((n) => words(n).join("")) };
});
// Ile produktów zawiera dane słowo — im więcej, tym mniej mówi o konkretnym produkcie.
const DF = new Map<string, number>();
for (const p of PRODUCTS) for (const w of p.words) DF.set(w, (DF.get(w) ?? 0) + 1);

const SIZE_ALIAS: Record<string, string> = { XXL: "XXL", "2XL": "XXL", XXXL: "3XL", "3XL": "3XL" };
export function normSize(raw: string | null | undefined): string | null {
  const u = String(raw ?? "").toUpperCase().replace(/\s+/g, "");
  const s = SIZE_ALIAS[u] ?? u;
  return (SHOP_SIZES as readonly string[]).includes(s) ? s : null;
}

/** Wszystkie „External ID”, których oczekuje nasz sklep (produkty drukowane w Printful). */
export const expectedExternalIds = () =>
  PRODUCTS.flatMap((p) => (p.sizes ? SHOP_SIZES.map((s) => printfulExternalId(p.id, s)) : [printfulExternalId(p.id, null)]));

/** Propozycja „External ID” dla wariantu z Printful albo null, gdy nie da się go pewnie dopasować. */
export function suggestExternalId(v: { product: string; name: string; size: string | null }): string | null {
  const text = `${v.product} ${v.name}`;
  const ws = new Set(words(text));
  const glued = words(text).join("");
  let best: { id: string; sizes: boolean; score: number } | null = null;
  for (const p of PRODUCTS) {
    let score = 0;
    for (const w of ws) if (p.words.has(w)) score += 1 / (DF.get(w) ?? 1);
    if (glued.includes(p.id)) score += 3;
    if (p.glued.some((g) => g.length > 6 && glued.includes(g))) score += 3;
    if (!best || score > best.score) best = { id: p.id, sizes: p.sizes, score };
  }
  if (!best || best.score < 1) return null;
  if (!best.sizes) return printfulExternalId(best.id, null);
  const size = normSize(v.size) ?? normSize(v.name.split("/").pop());
  return size ? printfulExternalId(best.id, size) : null;
}
