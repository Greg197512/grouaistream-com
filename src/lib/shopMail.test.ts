import { describe, expect, it } from "vitest";
import { adminMail, customerPaidMail, customerTransferMail, supplierMail, type MailOrder } from "./shopMail";
import { printfulOrderBody } from "./printful";
import { supplierFor } from "../data/shopSuppliers";

const o: MailOrder = {
  id: "3f2a9c1e-0000-4000-8000-000000000000", totalCents: 9480, email: "a@b.nl", lang: "nl",
  lines: [{ id: "dropbass", name: "Koszulka „Drop The Bass”", size: "M", qty: 2, unitCents: 2990 }, { id: "okulary", name: "Okulary <AI>", size: null, qty: 1, unitCents: 3500 }],
  shipping: { name: "An de Vries", street: "Dam 1", city: "Amsterdam", zip: "1012 JS", country: "NL", phone: "+31 6" },
};

describe("e-maile sklepu", () => {
  it("klient dostaje e-mail w swoim języku", () => {
    const m = customerPaidMail(o, "3–7");
    expect(m.subject).toBe("Betaling ontvangen: bestelling GR-3F2A9C1E");
    expect(m.html).toContain("3–7 werkdagen");
    expect(m.html).toContain("Okulary &lt;AI&gt;");
  });
  it("przelew: IBAN i tytuł", () => {
    const m = customerTransferMail({ ...o, lang: "pl" }, { holder: "Grzegorz Karon", iban: "LT39 3250 0225 7672 5699", bic: "REVOLT21" });
    expect(m.html).toContain("LT39 3250 0225 7672 5699");
    expect(m.html).toContain("GR-3F2A9C1E");
  });
  it("admin i dostawca", () => {
    expect(adminMail(o, "paid", ["Printful: #1"]).subject).toContain("[GrouaDrop] Opłacone zamówienie GR-3F2A9C1E");
    const s = supplierMail(o, o.lines.filter((l) => supplierFor(l.id) === "email"), "GrouaDrop");
    expect(s.html).toContain("Dam 1");
    expect(s.html).not.toContain("Drop The Bass");
  });
});

describe("Printful", () => {
  it("zamówienie z External ID wariantów", () => {
    const b = printfulOrderBody(o.id, o.lines.filter((l) => supplierFor(l.id) === "printful"), o.shipping, o.email);
    expect(b.external_id).toBe("3f2a9c1e000040008000000000000000");
    expect(b.items).toEqual([{ external_variant_id: "dropbass-M", quantity: 2, name: "Koszulka „Drop The Bass”" }]);
    expect(b.recipient).toMatchObject({ country_code: "NL", zip: "1012 JS", email: "a@b.nl" });
  });
});
