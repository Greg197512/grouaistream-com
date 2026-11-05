// Koszyk sklepu wspólny dla katalogu (/shop) i stron produktów (/shop/p/:id): localStorage + zdarzenie,
// żeby obie strony (i inne karty przeglądarki) widziały ten sam stan.
import { useCallback, useEffect, useState } from "react";
import { SHOP_PRODUCTS, type ShopProduct } from "@/data/shopCatalog";

export type CartLine = { id: string; size: string; qty: number };
const KEY = "gr_cart_v2";
const EVT = "grouai:cart";
const byId = new Map(SHOP_PRODUCTS.map((p) => [p.id, p]));

export function readCart(): CartLine[] {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(c) ? c.filter((l: CartLine) => byId.has(l?.id) && l.qty > 0) : [];
  } catch { return []; }
}
function writeCart(c: CartLine[]) {
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* */ }
  window.dispatchEvent(new Event(EVT));
}

export function useShopCart() {
  const [cart, setCartState] = useState<CartLine[]>(readCart);
  useEffect(() => {
    const sync = () => setCartState(readCart());
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener("storage", sync); };
  }, []);
  const setCart = useCallback((f: CartLine[] | ((c: CartLine[]) => CartLine[])) => {
    const next = typeof f === "function" ? f(readCart()) : f;
    writeCart(next);
    setCartState(next);
  }, []);
  const add = useCallback((p: ShopProduct, size: string) => setCart((c) => {
    const sz = p.sizes ? size : "";
    const k = c.find((l) => l.id === p.id && l.size === sz);
    return k ? c.map((l) => (l === k ? { ...l, qty: Math.min(20, l.qty + 1) } : l)) : [...c, { id: p.id, size: sz, qty: 1 }];
  }), [setCart]);
  const bump = useCallback((i: number, d: number) => setCart((c) => c.flatMap((l, k) => (k !== i ? [l] : l.qty + d < 1 ? [] : [{ ...l, qty: Math.min(20, l.qty + d) }]))), [setCart]);
  const count = cart.reduce((a, l) => a + l.qty, 0);
  const subtotal = cart.reduce((a, l) => a + (byId.get(l.id)?.eurCents ?? 0) * l.qty, 0);
  return { cart, setCart, add, bump, count, subtotal };
}
