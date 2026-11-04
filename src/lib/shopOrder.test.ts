import { describe, expect, it } from "vitest";
import { cleanShipping, orderBrief, orderRef, priceCart, toShopOrder } from "./shopOrder";

describe("priceCart", () => {
  it("liczy ceny z katalogu i scala te same pozycje", () => {
    const r = priceCart([{ id: "dropbass", qty: 1, size: "m" }, { id: "dropbass", qty: 2, size: "M" }, { id: "torba", qty: 1, size: "XL" }]);
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.lines).toHaveLength(2);
    expect(r.lines[0]).toMatchObject({ id: "dropbass", size: "M", qty: 3, unitCents: 2990 });
    expect(r.lines[1]).toMatchObject({ id: "torba", size: null });
    expect(r.totalCents).toBe(3 * 2990 + 2290);
  });
  it("odrzuca złe dane", () => {
    expect(priceCart([])).toEqual({ error: "empty_cart" });
    expect(priceCart([{ id: "nie-ma", qty: 1 }])).toEqual({ error: "unknown_product" });
    expect(priceCart([{ id: "torba", qty: 0 }])).toEqual({ error: "bad_quantity" });
    expect(priceCart([{ id: "torba", qty: 1.5 }])).toEqual({ error: "bad_quantity" });
    expect(priceCart([{ id: "dropbass", qty: 1, size: "XXXXL" }])).toEqual({ error: "bad_size" });
    expect(priceCart([{ id: "dropbass", qty: 15, size: "M" }, { id: "dropbass", qty: 10, size: "M" }])).toEqual({ error: "bad_quantity" });
    expect(priceCart("x")).toEqual({ error: "empty_cart" });
  });
});

describe("cleanShipping", () => {
  it("wymaga adresu, telefon opcjonalny", () => {
    expect(cleanShipping({ name: "Jan  Kowalski", street: "Długa 1", city: "Gdańsk", zip: "80-001", country: "pl", company: " " }))
      .toEqual({ name: "Jan Kowalski", street: "Długa 1", city: "Gdańsk", zip: "80-001", country: "PL" });
    expect(cleanShipping({ name: "Jan", street: "Długa 1", city: "Londyn", zip: "E1", country: "GB" })).toBeNull();
    expect(cleanShipping({ name: "Jan", street: "", city: "Gdańsk", zip: "80-001", country: "PL" })).toBeNull();
    expect(cleanShipping(null)).toBeNull();
  });
});

describe("toShopOrder", () => {
  it("mapuje wiersz aurora_business_orders", () => {
    const o = toShopOrder({ id: "a", user_id: "u", client_email: "x@y", price_eur: 29.9, status: "new", payment_status: "pending", created_at: "2026-11-04", payload: { items: [{ id: "torba" }], stripe_session_id: "cs_1" } });
    expect(o.total_cents).toBe(2990);
    expect(o.stripe_session_id).toBe("cs_1");
    expect(o.items).toHaveLength(1);
    expect(orderBrief([{ id: "torba", name: "Torba", size: null, qty: 2, unitCents: 2290 }], 4580)).toContain("2× Torba");
  });
});

describe("orderRef", () => {
  it("krótki tytuł przelewu", () => expect(orderRef("3f2a9c1e-0000-4000-8000-000000000000")).toBe("GR-3F2A9C1E"));
});
