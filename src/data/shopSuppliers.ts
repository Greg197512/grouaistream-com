// Kto realizuje który produkt (my jesteśmy pośrednikiem):
//  - "printful": druk na żądanie w Printful (drukuje i wysyła prosto do klienta),
//  - "email":    dostawca dostaje zamówienie e-mailem (SHOP_SUPPLIER_EMAIL) i sam wysyła do klienta.
// Produkty bez wpisu idą do Printful.
export type Supplier = "printful" | "email";

export const PRODUCT_SUPPLIER: Record<string, Supplier> = {
  okulary: "email",
  asystent: "email",
};
export const supplierFor = (productId: string): Supplier => PRODUCT_SUPPLIER[productId] ?? "printful";

/** „External ID” wariantu, który trzeba wpisać przy produkcie w Printful, np. "dropbass-M" albo "torba". */
export const printfulExternalId = (productId: string, size: string | null) => (size ? `${productId}-${size}` : productId);
