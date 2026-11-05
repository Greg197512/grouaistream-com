// Faktury sklepu Grouarock: budowa rekordu `aurora_invoices` z zamówienia i wydruk HTML (PL/EN/NL).
import { orderRef, type ShopOrderView } from "./shopOrder";
import { splitGross, vatRateFor, type VatMode } from "./vatOss";

export type Seller = { name: string; address: string; country: string | null; taxId: string | null; vatId: string | null; email: string | null };
/** Publiczna konfiguracja sklepu (GET /api/shop-checkout), ustawiana w zmiennych Vercela. */
export type ShopConfig = {
  stripe: boolean; transfer: boolean; ibanInvalid?: boolean; shippingCents: number; deliveryDays: string;
  seller: Seller | null; contact?: { name: string | null; email: string | null }; carriers?: { id: string; cents: number }[]; vatMode: VatMode | null; exemptNote: string | null;
  fulfillment?: { printful: boolean; printfulAuto: boolean; mail: boolean; supplierEmail: boolean; notify: boolean };
};
export type InvoiceLang = "pl" | "en" | "nl";

export type InvoiceItem = { name: string; qty: number; unit_price: number; unit_net: number; total: number; vat_rate: number };
export type InvoiceRecord = {
  order_id: string; user_id: string; invoice_number: string; invoice_type: "invoice"; status: "issued" | "paid";
  buyer_name: string; buyer_company: string | null; buyer_tax_id: string | null; buyer_address: string; buyer_email: string | null;
  seller_name: string; seller_tax_id: string | null; seller_address: string;
  items: InvoiceItem[]; subtotal_eur: number; vat_rate: number; vat_amount_eur: number; total_eur: number; currency: "EUR";
  issued_at: string; paid_at: string | null;
};

const eur2 = (cents: number) => Math.round(cents) / 100;

/** Kolejny numer w miesiącu: GR/2026/11/0001. */
export function nextInvoiceNumber(last: string | null, now = new Date()): string {
  const prefix = `GR/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/`;
  const n = last?.startsWith(prefix) ? Number(last.slice(prefix.length)) || 0 : 0;
  return prefix + String(n + 1).padStart(4, "0");
}
export const invoicePrefix = (now = new Date()) => `GR/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/`;

/** Rekord faktury z zamówienia. Ceny w zamówieniu są brutto; VAT według trybu z konfiguracji. */
export function buildInvoice(o: ShopOrderView, seller: Seller, mode: VatMode, number: string, now = new Date()): InvoiceRecord {
  const country = o.shipping?.country ?? seller.country ?? "";
  const rate = vatRateFor(country, mode, seller.country);
  const ship = (o.total_cents - o.items.reduce((a, l) => a + l.unitCents * l.qty, 0));
  const lines = [...o.items.map((l) => ({ name: l.size ? `${l.name} (${l.size})` : l.name, qty: l.qty, cents: l.unitCents })),
    ...(ship > 0 ? [{ name: "Wysyłka / Shipping", qty: 1, cents: ship }] : [])];
  const items: InvoiceItem[] = lines.map((l) => ({
    name: l.name, qty: l.qty, unit_price: eur2(l.cents), unit_net: eur2(splitGross(l.cents, rate).netCents),
    total: eur2(l.cents * l.qty), vat_rate: rate,
  }));
  const { netCents, vatCents } = splitGross(o.total_cents, rate);
  const s = o.shipping;
  return {
    order_id: o.id, user_id: o.user_id ?? "", invoice_number: number, invoice_type: "invoice",
    status: o.payment_status === "paid" ? "paid" : "issued",
    buyer_name: s?.name ?? o.email ?? "—", buyer_company: s?.company ?? null, buyer_tax_id: s?.taxId ?? null,
    buyer_address: s ? `${s.street}, ${s.zip} ${s.city}, ${s.country}` : "", buyer_email: o.email,
    seller_name: seller.name, seller_tax_id: seller.vatId || seller.taxId, seller_address: seller.address,
    items, subtotal_eur: eur2(netCents), vat_rate: rate, vat_amount_eur: eur2(vatCents), total_eur: eur2(o.total_cents), currency: "EUR",
    issued_at: now.toISOString(), paid_at: o.paid_at,
  };
}

const L = {
  pl: { title: "Faktura", no: "Nr", issued: "Data wystawienia", sale: "Data sprzedaży", seller: "Sprzedawca", buyer: "Nabywca", tax: "NIP/VAT", item: "Pozycja", qty: "Ilość", unitNet: "Cena netto", rate: "VAT", gross: "Wartość brutto", net: "Razem netto", vat: "VAT", total: "Do zapłaty", paid: "Zapłacono", order: "Zamówienie", exempt: "Sprzedawca zwolniony z VAT.", oss: "VAT naliczony według stawki kraju nabywcy (procedura OSS).", print: "Drukuj / zapisz PDF" },
  en: { title: "Invoice", no: "No.", issued: "Issue date", sale: "Date of supply", seller: "Seller", buyer: "Buyer", tax: "Tax/VAT ID", item: "Item", qty: "Qty", unitNet: "Unit net", rate: "VAT", gross: "Gross", net: "Net total", vat: "VAT", total: "Total due", paid: "Paid", order: "Order", exempt: "Seller exempt from VAT.", oss: "VAT charged at the buyer’s country rate (OSS scheme).", print: "Print / save PDF" },
  nl: { title: "Factuur", no: "Nr.", issued: "Factuurdatum", sale: "Leverdatum", seller: "Verkoper", buyer: "Koper", tax: "Btw-nummer", item: "Omschrijving", qty: "Aantal", unitNet: "Prijs excl.", rate: "Btw", gross: "Bedrag incl.", net: "Totaal excl. btw", vat: "Btw", total: "Te betalen", paid: "Betaald", order: "Bestelling", exempt: "Verkoper is vrijgesteld van btw.", oss: "Btw berekend tegen het tarief van het land van de koper (OSS-regeling).", print: "Afdrukken / PDF opslaan" },
} as const;

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type PrintableInvoice = Pick<InvoiceRecord, "invoice_number" | "buyer_name" | "buyer_company" | "buyer_tax_id" | "buyer_address" | "seller_name" | "seller_tax_id" | "seller_address" | "subtotal_eur" | "vat_rate" | "vat_amount_eur" | "total_eur" | "currency"> & {
  items: unknown; issued_at: string | null; paid_at: string | null; order_id: string | null;
};

/** Pełny dokument HTML faktury do druku lub zapisu jako PDF. */
export function invoiceHtml(inv: PrintableInvoice, lang: InvoiceLang, opts: { mode?: VatMode | null; exemptNote?: string | null } = {}): string {
  const t = L[lang];
  const loc = lang === "pl" ? "pl-PL" : lang === "nl" ? "nl-NL" : "en-GB";
  const money = (v: number) => Number(v).toLocaleString(loc, { style: "currency", currency: inv.currency || "EUR" });
  const date = (d: string | null) => (d ? new Date(d).toLocaleDateString(loc) : "—");
  const items = (Array.isArray(inv.items) ? inv.items : []) as InvoiceItem[];
  const note = opts.mode === "exempt" ? opts.exemptNote || t.exempt : opts.mode === "oss" ? t.oss : "";
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${esc(t.title)} ${esc(inv.invoice_number)}</title>
<style>
body{font:14px/1.45 system-ui,Arial,sans-serif;color:#141414;max-width:820px;margin:32px auto;padding:0 24px}
h1{font-size:26px;margin:0}h1 span{color:#ea580c}.meta{color:#555;margin:6px 0 24px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.box{border:1px solid #ddd;border-radius:10px;padding:12px}
.box h3{margin:0 0 6px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#777}
table{width:100%;border-collapse:collapse;margin:24px 0;font-variant-numeric:tabular-nums}
th,td{padding:8px 6px;border-bottom:1px solid #eee;text-align:left}th{font-size:12px;color:#555;background:#fafafa}
td.n,th.n{text-align:right}.tot{margin-left:auto;width:320px}.tot div{display:flex;justify-content:space-between;padding:4px 0}
.tot .big{font-size:18px;font-weight:700;border-top:2px solid #141414;margin-top:6px;padding-top:8px}
.note{color:#555;font-size:12px;margin-top:24px}button{margin-top:24px;padding:10px 18px;border-radius:999px;border:0;background:#141414;color:#fff;cursor:pointer}
@media print{button{display:none}body{margin:0}}
</style></head><body>
<h1>${esc(t.title)} <span>${esc(inv.invoice_number)}</span></h1>
<div class="meta">${esc(t.issued)}: ${date(inv.issued_at)} · ${esc(t.sale)}: ${date(inv.paid_at ?? inv.issued_at)}${inv.order_id ? ` · ${esc(t.order)} ${esc(orderRef(inv.order_id))}` : ""}</div>
<div class="grid">
<div class="box"><h3>${esc(t.seller)}</h3><b>${esc(inv.seller_name)}</b><br>${esc(inv.seller_address)}${inv.seller_tax_id ? `<br>${esc(t.tax)}: ${esc(inv.seller_tax_id)}` : ""}</div>
<div class="box"><h3>${esc(t.buyer)}</h3><b>${esc(inv.buyer_company || inv.buyer_name)}</b>${inv.buyer_company ? `<br>${esc(inv.buyer_name)}` : ""}<br>${esc(inv.buyer_address)}${inv.buyer_tax_id ? `<br>${esc(t.tax)}: ${esc(inv.buyer_tax_id)}` : ""}</div>
</div>
<table><thead><tr><th>${esc(t.item)}</th><th class="n">${esc(t.qty)}</th><th class="n">${esc(t.unitNet)}</th><th class="n">${esc(t.rate)}</th><th class="n">${esc(t.gross)}</th></tr></thead><tbody>
${items.map((i) => `<tr><td>${esc(i.name)}</td><td class="n">${esc(i.qty)}</td><td class="n">${money(i.unit_net)}</td><td class="n">${esc(i.vat_rate)}%</td><td class="n">${money(i.total)}</td></tr>`).join("")}
</tbody></table>
<div class="tot"><div><span>${esc(t.net)}</span><span>${money(inv.subtotal_eur)}</span></div>
<div><span>${esc(t.vat)} ${esc(inv.vat_rate)}%</span><span>${money(inv.vat_amount_eur)}</span></div>
<div class="big"><span>${esc(inv.paid_at ? t.paid : t.total)}</span><span>${money(inv.total_eur)}</span></div></div>
${note ? `<p class="note">${esc(note)}</p>` : ""}
<button onclick="print()">${esc(t.print)}</button>
</body></html>`;
}

/** Otwiera fakturę w nowej karcie (druk / PDF). */
export function openInvoice(html: string) {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open(); w.document.write(html); w.document.close();
  return true;
}
