// Sklep Grouarock: tworzy zamówienie (ceny z serwera, nie od klienta) i, gdy włączone, transakcję Paddle.
// UWAGA: Paddle zabrania sprzedaży towarów fizycznych. Płatność Paddle działa tylko w sandboxie albo po
// ustawieniu SHOP_PADDLE_LIVE=true (na własne ryzyko konta). Domyślnie zamówienie zapisuje się jako "new".
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { gatewayFetch, type PaddleEnv } from "../_shared/paddle.ts";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const CATALOG: Record<string, { name: string; eurCents: number; sizes?: boolean }> = {
  koszulka: { name: "Koszulka „Groua Era 80s”", eurCents: 2990, sizes: true },
  bluza: { name: "Bluza z kapturem GROUAROCK", eurCents: 6490, sizes: true },
  czapka: { name: "Czapka z daszkiem GROUAROCK", eurCents: 3490, sizes: true },
  torba: { name: "Torba bawełniana GROUAROCK", eurCents: 2290 },
  plakat: { name: "Plakat „Groua Era 80s”", eurCents: 1990 },
  naklejki: { name: "Zestaw naklejek GROUAROCK", eurCents: 990 },
  okulary: { name: "Okulary AI GROUAROCK (przedsprzedaż)", eurCents: 14900 },
  asystent: { name: "Asystent AI z ekranem (przedsprzedaż)", eurCents: 9900 },
};
const j = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: H });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: H });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return j({ error: "login_required" }, 401);

    const body = await req.json();
    const lines = Array.isArray(body.items) ? body.items.slice(0, 20) : [];
    const items = lines.map((l: any) => {
      const p = CATALOG[String(l.id)];
      const qty = Math.max(1, Math.min(20, parseInt(l.qty, 10) || 1));
      if (!p) throw new Error("unknown_product");
      return { id: l.id, name: p.name, size: p.sizes ? String(l.size || "M").slice(0, 4) : null, qty, unitCents: p.eurCents };
    });
    if (!items.length) return j({ error: "empty_cart" }, 400);
    const s = body.shipping || {};
    const ship = ["name", "street", "city", "zip", "country"].every((k) => String(s[k] || "").trim().length > 1);
    if (!ship) return j({ error: "shipping_required" }, 400);
    const shipping = Object.fromEntries(["name", "street", "city", "zip", "country", "phone"].map((k) => [k, String(s[k] || "").slice(0, 120)]));
    const total = items.reduce((a: number, i: any) => a + i.unitCents * i.qty, 0);

    const { data: order, error } = await admin.from("shop_orders").insert({
      user_id: u.user.id, email: u.user.email, items, total_cents: total, currency: "EUR", shipping, status: "new",
    }).select("id").single();
    if (error) throw error;

    const env: PaddleEnv = body.environment === "live" ? "live" : "sandbox";
    const paddleOk = env === "sandbox" || Deno.env.get("SHOP_PADDLE_LIVE") === "true";
    if (!paddleOk) return j({ orderId: order.id, payment: "pending" });

    const r = await gatewayFetch(env, "/transactions", {
      method: "POST",
      body: JSON.stringify({
        items: items.map((i: any) => ({
          quantity: i.qty,
          price: {
            description: `${i.name}${i.size ? " " + i.size : ""}`,
            name: i.name,
            unit_price: { amount: String(i.unitCents), currency_code: "EUR" },
            product: { name: i.name, tax_category: "standard" },
          },
        })),
        custom_data: { userId: u.user.id, shopOrderId: order.id },
      }),
    });
    const t = await r.json();
    if (!r.ok || !t?.data?.id) {
      console.error("shop-checkout paddle", JSON.stringify(t));
      return j({ orderId: order.id, payment: "pending" });
    }
    await admin.from("shop_orders").update({ paddle_transaction_id: t.data.id }).eq("id", order.id);
    return j({ orderId: order.id, payment: "paddle", transactionId: t.data.id });
  } catch (e) {
    console.error("shop-checkout", e);
    return j({ error: String((e as Error).message || e) }, 500);
  }
});
