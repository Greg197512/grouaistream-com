// VAT dla sklepu Grouarock (sprzedaż B2C w UE). Ceny w katalogu są BRUTTO (z VAT).
//
// Tryby (ustawiane w Vercel: SHOP_VAT_MODE):
//  - "oss"      — stawka kraju nabywcy (procedura OSS, obowiązkowa po przekroczeniu 10 000 EUR
//                 sprzedaży wysyłkowej do innych krajów UE w roku),
//  - "domestic" — stawka kraju sprzedawcy dla wszystkich (poniżej progu 10 000 EUR),
//  - "exempt"   — sprzedawca zwolniony z VAT (np. PL art. 113, NL KOR): 0% i adnotacja na fakturze.
//
// ZAŁOŻENIE: stawki podstawowe według stanu na połowę 2026 r.; przed złożeniem deklaracji OSS
// sprawdź je w bazie TEDB Komisji Europejskiej. Sprzedaż tylko na terenie UE.

export type VatMode = "oss" | "domestic" | "exempt";

export const EU_VAT_STANDARD: Record<string, number> = {
  AT: 20, BE: 21, BG: 20, HR: 25, CY: 19, CZ: 21, DK: 25, EE: 24, FI: 25.5, FR: 20, DE: 19, GR: 24, HU: 27,
  IE: 23, IT: 22, LV: 21, LT: 21, LU: 17, MT: 18, NL: 21, PL: 23, PT: 23, RO: 21, SK: 23, SI: 22, ES: 21, SE: 25,
};
export const EU_COUNTRIES = Object.keys(EU_VAT_STANDARD).sort();

export function isEuCountry(code: unknown): code is string {
  return typeof code === "string" && code.toUpperCase() in EU_VAT_STANDARD;
}

export function parseVatMode(v: unknown): VatMode | null {
  return v === "oss" || v === "domestic" || v === "exempt" ? v : null;
}

/** Stawka VAT (%) dla nabywcy z danego kraju. */
export function vatRateFor(buyerCountry: string, mode: VatMode, sellerCountry: string | null): number {
  if (mode === "exempt") return 0;
  const buyer = buyerCountry.toUpperCase();
  if (mode === "oss") return EU_VAT_STANDARD[buyer] ?? 0;
  return EU_VAT_STANDARD[(sellerCountry ?? "").toUpperCase()] ?? 0;
}

/** Rozbija kwotę brutto (w centach) na netto i VAT. */
export function splitGross(grossCents: number, ratePct: number): { netCents: number; vatCents: number } {
  const netCents = Math.round(grossCents / (1 + ratePct / 100));
  return { netCents, vatCents: grossCents - netCents };
}

/** Kwartał rozliczenia OSS, np. "2026-Q4". */
export function ossQuarter(date: string | Date): string {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
}

export type OssRow = { country: string; rate: number; orders: number; netCents: number; vatCents: number; grossCents: number };

/** Zestawienie do deklaracji OSS: sprzedaż w kwartale wg kraju nabywcy (bez kraju sprzedawcy). */
export function ossReport(
  orders: { country: string | null; grossCents: number; paidAt: string | null }[],
  quarter: string,
  sellerCountry: string | null,
): OssRow[] {
  const rows = new Map<string, OssRow>();
  for (const o of orders) {
    if (!o.paidAt || !o.country || ossQuarter(o.paidAt) !== quarter) continue;
    const c = o.country.toUpperCase();
    if (!isEuCountry(c) || c === (sellerCountry ?? "").toUpperCase()) continue;
    const rate = EU_VAT_STANDARD[c];
    const { netCents, vatCents } = splitGross(o.grossCents, rate);
    const r = rows.get(c) ?? { country: c, rate, orders: 0, netCents: 0, vatCents: 0, grossCents: 0 };
    r.orders += 1; r.netCents += netCents; r.vatCents += vatCents; r.grossCents += o.grossCents;
    rows.set(c, r);
  }
  return [...rows.values()].sort((a, b) => a.country.localeCompare(b.country));
}
