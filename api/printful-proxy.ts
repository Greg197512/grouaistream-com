// Klucz Printful zmieniony 5.11 (2) — wdrożenie wczytuje nowy PRINTFUL_API_KEY.
// Pośrednik do api.printful.com w zwykłej funkcji Node.
// Powód: zapytania z funkcji edge Vercela zatrzymuje zapora Cloudflare przed Printful (403 „Attention Required”),
// a z funkcji Node przechodzą. Wywołuje go api/shop-checkout (edge).
// Bezpieczeństwo: działa tylko z kluczem równym PRINTFUL_API_KEY (Authorization: Bearer …) i tylko dla
// ścieżek sklepu Printful: /store/products, /orders, /stores, /store/variants (PUT: External ID), /product-templates, /files, /sync/* (sklepy Etsy — import kompletów), /oauth/scopes (jakie uprawnienia ma klucz). Klucza nie zwraca ani nie zapisuje.
import { timingSafeEqual } from "node:crypto";

export const config = { maxDuration: 30 };

const ALLOWED = /^\/(store\/products|store\/variants|sync\/products|sync\/variants|orders|stores|product-templates|files|oauth\/scopes)(\/[\w-]+)*(\?[\w=&%.-]*)?$/;
const same = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function handler(req: any, res: any) {
  const key = process.env.PRINTFUL_API_KEY || "";
  const auth = String(req.headers.authorization || "");
  if (!key || !same(auth, `Bearer ${key}`)) return res.status(403).json({ error: "forbidden" });
  const path = String(req.query?.path || "");
  if (!ALLOWED.test(path)) return res.status(400).json({ error: "bad_path" });
  const method = req.method === "POST" ? "POST" : req.method === "PUT" ? "PUT" : "GET";
  const headers: Record<string, string> = {
    authorization: auth, accept: "application/json", "content-type": "application/json",
    "user-agent": "GrouaDrop/1.0 (+https://grouaistream.com/shop)",
  };
  const store = req.headers["x-pf-store-id"];
  if (store) headers["x-pf-store-id"] = String(store);
  const body = method !== "GET" ? (typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {})) : undefined;
  try {
    const r = await fetch(`https://api.printful.com${path}`, { method, headers, body, signal: AbortSignal.timeout(25000) });
    const text = await r.text();
    res.setHeader("content-type", r.headers.get("content-type") || "application/json");
    res.setHeader("cache-control", "no-store");
    return res.status(r.status).send(text);
  } catch (e) {
    return res.status(502).json({ error: "printful_unreachable", message: String((e as Error)?.message || e).slice(0, 200) });
  }
}
