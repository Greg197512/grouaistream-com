import { describe, expect, it } from "vitest";
import { EU_COUNTRIES, ossQuarter, ossReport, splitGross, vatRateFor } from "./vatOss";
import { buildInvoice, invoiceHtml, nextInvoiceNumber } from "./shopInvoice";
import { localizeProduct } from "../data/shopCatalogI18n";
import { SHOP_PRODUCTS } from "../data/shopCatalog";
import { SHOP_TEXT } from "../i18n/shop";
import type { ShopOrderView } from "./shopOrder";

describe("VAT", () => {
  it("27 krajów UE", () => expect(EU_COUNTRIES).toHaveLength(27));
  it("stawki według trybu", () => {
    expect(vatRateFor("NL", "oss", "PL")).toBe(21);
    expect(vatRateFor("NL", "domestic", "PL")).toBe(23);
    expect(vatRateFor("DE", "exempt", "PL")).toBe(0);
  });
  it("brutto → netto + VAT", () => {
    expect(splitGross(2990, 23)).toEqual({ netCents: 2431, vatCents: 559 });
    expect(splitGross(2990, 0)).toEqual({ netCents: 2990, vatCents: 0 });
  });
  it("raport OSS pomija kraj sprzedawcy i inne kwartały", () => {
    expect(ossQuarter("2026-11-04T10:00:00Z")).toBe("2026-Q4");
    const r = ossReport([
      { country: "NL", grossCents: 1210, paidAt: "2026-10-02T00:00:00Z" },
      { country: "NL", grossCents: 2420, paidAt: "2026-12-30T00:00:00Z" },
      { country: "PL", grossCents: 5000, paidAt: "2026-11-01T00:00:00Z" },
      { country: "DE", grossCents: 1190, paidAt: "2026-07-01T00:00:00Z" },
      { country: "BE", grossCents: 1210, paidAt: null },
    ], "2026-Q4", "PL");
    expect(r).toEqual([{ country: "NL", rate: 21, orders: 2, netCents: 3000, vatCents: 630, grossCents: 3630 }]);
  });
});

describe("faktury", () => {
  const order: ShopOrderView = {
    id: "3f2a9c1e-0000-4000-8000-000000000000", user_id: "u1", email: "a@b.nl", total_cents: 3980,
    items: [{ id: "dropbass", name: "Koszulka", size: "M", qty: 1, unitCents: 2990 }],
    status: "paid", payment_status: "paid", shipping: { name: "An <b>", street: "Dam 1", city: "Amsterdam", zip: "1012", country: "NL" },
    stripe_session_id: null, created_at: "2026-11-01T00:00:00Z", paid_at: "2026-11-02T00:00:00Z", method: "transfer", lang: "nl", fulfillment: null,
  };
  const seller = { name: "Grouarock", address: "Ulica 1, Gdańsk", country: "PL", taxId: "123", vatId: "PL123", email: null };
  it("numeracja w miesiącu", () => {
    const d = new Date("2026-11-04T00:00:00Z");
    expect(nextInvoiceNumber(null, d)).toBe("GR/2026/11/0001");
    expect(nextInvoiceNumber("GR/2026/11/0041", d)).toBe("GR/2026/11/0042");
    expect(nextInvoiceNumber("GR/2026/10/0041", d)).toBe("GR/2026/11/0001");
  });
  it("OSS: stawka kraju nabywcy, wysyłka jako pozycja", () => {
    const inv = buildInvoice(order, seller, "oss", "GR/2026/11/0001");
    expect(inv.vat_rate).toBe(21);
    expect(inv.items).toHaveLength(2);
    expect(inv.total_eur).toBe(39.8);
    expect(inv.subtotal_eur + inv.vat_amount_eur).toBeCloseTo(39.8, 2);
    expect(inv.status).toBe("paid");
    const html = invoiceHtml({ ...inv, issued_at: inv.issued_at }, "nl", { mode: "oss" });
    expect(html).toContain("Factuur");
    expect(html).toContain("An &lt;b&gt;");
    expect(html).toContain("OSS");
  });
});

describe("tłumaczenia sklepu", () => {
  it("każdy produkt ma EN i NL", () => {
    for (const p of SHOP_PRODUCTS) for (const l of ["en", "nl"] as const) {
      const t = localizeProduct(p, l);
      expect(t.name, `${p.id}/${l}`).not.toMatch(/Koszulka|Bluza|Czapka|Torba|Plakat|Zestaw|Okulary|Asystent/);
      expect(t.desc).not.toBe(p.desc);
    }
  });
  it("słowniki mają te same klucze", () => {
    const keys = (o: object) => Object.keys(o).sort();
    expect(keys(SHOP_TEXT.en)).toEqual(keys(SHOP_TEXT.pl));
    expect(keys(SHOP_TEXT.nl)).toEqual(keys(SHOP_TEXT.pl));
    expect(keys(SHOP_TEXT.nl.errors)).toEqual(keys(SHOP_TEXT.pl.errors));
  });
});
