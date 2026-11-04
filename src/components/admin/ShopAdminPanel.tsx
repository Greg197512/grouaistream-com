import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SHOP_PRODUCTS } from "@/data/shopCatalog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SHOP_SERVICE_TYPE, toShopOrder, type ShopOrderView as Order } from "@/lib/shopOrder";

const STATUSES = ["new", "paid", "shipped", "cancelled", "refunded"] as const;
const LABEL: Record<string, string> = { new: "Nowe", paid: "Opłacone", shipped: "Wysłane", cancelled: "Anulowane", refunded: "Zwrot" };
const eur = (c: number) => (c / 100).toLocaleString("pl-PL", { style: "currency", currency: "EUR" });

export function ShopAdminPanel() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("aurora_business_orders").select("*").eq("service_type", SHOP_SERVICE_TYPE).order("created_at", { ascending: false }).limit(500);
    if (error) toast.error("Nie udało się pobrać zamówień: " + error.message);
    setOrders((data ?? []).map((r) => toShopOrder(r as Record<string, unknown>)));
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (id: string, status: string) => {
    const patch: Record<string, unknown> = { status };
    if (status === "paid") { patch.payment_status = "paid"; patch.paid_at = new Date().toISOString(); }
    if (status === "refunded") patch.payment_status = "refunded";
    const { error } = await supabase.from("aurora_business_orders").update(patch as never).eq("id", id);
    if (error) return toast.error(error.message);
    setOrders((o) => o.map((x) => (x.id === id ? { ...x, status, payment_status: (patch.payment_status as string) ?? x.payment_status } : x)));
    toast.success("Status zmieniony");
  };
  // Sprawdza w Stripe, czy zamówienie zostało opłacone (gdy klient zamknął kartę przed powrotem).
  const verify = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch("/api/shop-checkout", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${session?.access_token ?? ""}` }, body: JSON.stringify({ action: "confirm", orderId: id }) });
    const j = await r.json().catch(() => ({}));
    if (j.paid) { toast.success("Opłacone w Stripe"); load(); } else toast.info(j.error === "stripe_not_configured" ? "Brak klucza Stripe w Vercel" : "Stripe: jeszcze nieopłacone");
  };
  const stats = useMemo(() => {
    const paid = orders.filter((o) => o.status === "paid" || o.status === "shipped");
    const byProd: Record<string, number> = {};
    orders.filter((o) => o.status !== "cancelled" && o.status !== "refunded").forEach((o) => o.items.forEach((i) => { byProd[i.id] = (byProd[i.id] || 0) + i.qty; }));
    return { count: orders.length, fresh: orders.filter((o) => o.status === "new").length, revenue: paid.reduce((a, o) => a + o.total_cents, 0), byProd };
  }, [orders]);
  const shown = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[["Zamówienia", String(stats.count)], ["Do obsłużenia", String(stats.fresh)], ["Przychód (opłacone)", eur(stats.revenue)], ["Produkty w katalogu", String(SHOP_PRODUCTS.length)]].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-border bg-card p-4"><div className="text-xs text-muted-foreground">{k}</div><div className="text-2xl font-bold tabular-nums">{v}</div></div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="font-semibold mb-3">Katalog i sprzedaż</h3>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-muted-foreground"><th className="py-1">Produkt</th><th>Cena</th><th>Typ</th><th className="text-right">Sprzedane szt.</th></tr></thead>
          <tbody>{SHOP_PRODUCTS.map((p) => (
            <tr key={p.id} className="border-t border-border"><td className="py-1.5">{p.name}</td><td>{eur(p.eurCents)} · {p.pln} zł</td><td>{p.preorder ? "przedsprzedaż" : "standard"}</td><td className="text-right tabular-nums">{stats.byProd[p.id] || 0}</td></tr>
          ))}</tbody></table></div>
        <p className="text-xs text-muted-foreground mt-2">Ceny zmienisz w src/data/shopCatalog.ts (serwer api/shop-checkout czyta ten sam plik). Zamówienia są w tabeli aurora_business_orders (typ „shop”).</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {["all", ...STATUSES].map((s) => (
          <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)}>{s === "all" ? "Wszystkie" : LABEL[s]}</Button>
        ))}
        <Button size="sm" variant="ghost" onClick={load}>Odśwież</Button>
      </div>

      {loading ? <p className="text-muted-foreground">Ładowanie…</p> : shown.length === 0 ? <p className="text-muted-foreground">Brak zamówień.</p> : (
        <div className="space-y-3">
          {shown.map((o) => (
            <div key={o.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><div className="font-semibold">#{o.id.slice(0, 8)} · {eur(o.total_cents)}</div><div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("pl-PL")} · {o.email}</div></div>
                <select className="rounded-md border border-border bg-background px-2 py-1 text-sm" value={o.status} onChange={(e) => setStatus(o.id, e.target.value)} aria-label="Status">
                  {STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
                </select>
              </div>
              <ul className="text-sm">{o.items.map((i, k) => <li key={k}>{i.qty} × {i.name}{i.size ? ` (${i.size})` : ""} · {eur(i.unitCents * i.qty)}</li>)}</ul>
              {o.shipping && <div className="text-sm text-muted-foreground">Wysyłka: {o.shipping.name}, {o.shipping.street}, {o.shipping.zip} {o.shipping.city}, {o.shipping.country}{o.shipping.phone ? `, tel. ${o.shipping.phone}` : ""}</div>}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Płatność: {o.payment_status === "paid" ? "opłacone" : o.payment_status === "refunded" ? "zwrot" : "oczekuje"}</span>
                {o.stripe_session_id && <span>· Stripe {o.stripe_session_id.slice(0, 18)}…</span>}
                {o.stripe_session_id && o.payment_status !== "paid" && <Button size="sm" variant="outline" onClick={() => verify(o.id)}>Sprawdź płatność</Button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
