// Produkty przeniesione z Printful (komplety: wariant katalogowy + pliki nadruku). Zamówienie takiego produktu idzie
// do sklepu API „GruadropWeb” jako variant_id + files — Printful drukuje dokładnie ten nadruk i wysyła do klienta.
// Klucz wariantu = rozmiar z naszego koszyka (np. "M") albo "_" dla produktów bez rozmiaru. Uzupełnia import z ?diag=printful-export.
export type PfFile = { type: string; url: string };
export type PfItem = { variants: Record<string, { variant_id: number; files: PfFile[] }> };
export const PF_ITEMS: Record<string, PfItem> = {};

export const pfVariantFor = (productId: string, size: string | null) => PF_ITEMS[productId]?.variants[size ?? "_"] ?? null;
