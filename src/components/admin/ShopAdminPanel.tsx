import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SHOP_PRODUCTS } from "@/data/shopCatalog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SHOP_SERVICE_TYPE, orderRef, toShopOrder, type ShopOrderView as Order } from "@/lib/shopOrder";
import { buildInvoice, invoiceHtml, invoicePrefix, nextInvoiceNumber, openInvoice, type ShopConfig } from "@/lib/shopInvoice";
import { ossQuarter, ossReport } from "@/lib/vatOss";

const STATUSES = ["new", "paid", "shipped", "cancelled", "refunded"] as const;
const LABEL: Record<string, string> = { new: "Nowe", paid: "Opłacone", shipped: "Wysłane", cancelled: "Anulowane", refunded: "Zwrot" };
const eur = (c: number) => (c / 100).toLocaleString("pl-PL", { style: "currency", currency: "EUR" });
type Inv = Record<string, unknown> & { order_id: string; invoice_number: string };
const FSTATE: Record<string, string> = { sending: "wysyłanie…", sent: "przekazane do realizacji", manual: "do zamówienia ręcznie", error: "błąd realizacji" };
const MISSING_ENV = "Uzupełnij w Vercel: SHOP_SELLER_NAME, SHOP_SELLER_ADDRESS, SHOP_SELLER_COUNTRY i SHOP_VAT_MODE";

const lastQuarters = (n: number) => {
  const out: string[] = []; const d = new Date();
  for (let i = 0; i < n; i++) { out.push(ossQuarter(d)); d.setUTCMonth(d.getUTCMonth() - 3); }
  return out;
};

export function ShopAdminPanel() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<Record<string, Inv>>({});
  const [cfg, setCfg] = useState<ShopConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [quarter, setQuarter] = useState(() => ossQuarter(new Date()));

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("aurora_business_orders").select("*").eq("service_type", SHOP_SERVICE_TYPE).order("created_at", { ascending: false }).limit(500);
    if (error) toast.error("Nie udało się pobrać zamówień: " + error.message);
    const list = (data ?? []).map((r) => toShopOrder(r as Record<string, unknown>));
    setOrders(list);
    if (list.length) {
      const { data: inv } = await supabase.from("aurora_invoices").select("*").in("order_id", list.map((o) => o.id));
      setInvoices(Object.fromEntries((inv ?? []).map((i) => [String(i.order_id), i as Inv])));
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch("/api/shop-checkout").then((r) => (r.ok ? r.json() : null)).then(setCfg).catch(() => setCfg(null)); }, []);

  const setStatus = async (id: string, status: string) => {
    const patch: Record<string, unknown> = { status };
    if (status === "paid") { patch.payment_status = "paid"; patch.paid_at = new Date().toISOString(); }
    if (status === "refunded") patch.payment_status = "refunded";
    const { error } = await supabase.from("aurora_business_orders").update(patch as never).eq("id", id);
    if (error) return toast.error(error.message);
    setOrders((o) => o.map((x) => (x.id === id ? { ...x, status, payment_status: (patch.payment_status as string) ?? x.payment_status, paid_at: (patch.paid_at as string) ?? x.paid_at } : x)));
    toast.success("Status zmieniony");
    // Opłacone (np. przelew sprawdzony w Revolut) → realizacja rusza automatycznie.
    if (status === "paid") fulfillNow(id);
  };

  const callApi = async (body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch("/api/shop-checkout", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${session?.access_token ?? ""}` }, body: JSON.stringify(body) });
    return { ok: r.ok, j: await r.json().catch(() => ({})) };
  };
  // Zlecenie realizacji: Printful / dostawca e-mailowy + e-maile do klienta i do Ciebie.
  const fulfillNow = async (id: string, force = false) => {
    const { ok, j } = await callApi({ action: "fulfill", orderId: id, force });
    if (!ok) return toast.error(j.error === "forbidden" ? "Tylko admin" : j.error === "not_paid" ? "Zamówienie nieopłacone" : "Nie udało się zlecić realizacji");
    const st = j.fulfillment?.state;
    if (st === "skipped") toast.info("Zamówienie już przekazane do realizacji");
    else if (st === "sent") toast.success("Przekazane do realizacji");
    else toast.warning((j.fulfillment?.notes ?? []).join(" · ") || "Sprawdź realizację");
    load();
  };
  const [pfCheck, setPfCheck] = useState<{ linked: number; total: number; missing: string[] } | null>(null);
  const checkPrintful = async () => {
    const { ok, j } = await callApi({ action: "printful-check" });
    if (!ok) return toast.error(j.error === "printful_not_configured" ? "Brak PRINTFUL_API_KEY w Vercel" : j.message || "Błąd Printful");
    setPfCheck(j);
  };

  // Sprawdza w Stripe, czy zamówienie zostało opłacone (gdy klient zamknął kartę przed powrotem).
  const verify = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch("/api/shop-checkout", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${session?.access_token ?? ""}` }, body: JSON.stringify({ action: "confirm", orderId: id }) });
    const j = await r.json().catch(() => ({}));
    if (j.paid) { toast.success("Opłacone w Stripe"); load(); } else toast.info(j.error === "stripe_not_configured" ? "Brak klucza Stripe w Vercel" : "Stripe: jeszcze nieopłacone");
  };

  // Faktura do opłaconego zamówienia: numer GR/RRRR/MM/NNNN, VAT według SHOP_VAT_MODE (OSS / krajowy / zwolnienie).
  const issue = async (o: Order) => {
    if (!cfg?.seller || !cfg.vatMode) return toast.error(MISSING_ENV);
    if (!o.user_id) return toast.error("Zamówienie bez użytkownika");
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: last } = await supabase.from("aurora_invoices").select("invoice_number").like("invoice_number", `${invoicePrefix()}%`).order("invoice_number", { ascending: false }).limit(1);
      const number = nextInvoiceNumber(last?.[0]?.invoice_number ?? null);
      const rec = buildInvoice(o, cfg.seller, cfg.vatMode, number);
      const { data, error } = await supabase.from("aurora_invoices").insert(rec as never).select("*").single();
      if (!error && data) {
        setInvoices((m) => ({ ...m, [o.id]: data as Inv }));
        toast.success(`Faktura ${number} wystawiona`);
        return;
      }
      if (!String(error?.message).includes("duplicate")) return toast.error("Nie udało się wystawić faktury: " + error?.message);
    }
    toast.error("Konflikt numeracji faktur, spróbuj ponownie");
  };
  const showInvoice = (o: Order) => {
    const inv = invoices[o.id];
    if (!inv) return;
    const lang = o.lang === "en" || o.lang === "nl" ? o.lang : "pl";
    if (!openInvoice(invoiceHtml(inv as never, lang, { mode: cfg?.vatMode, exemptNote: cfg?.exemptNote }))) toast.error("Przeglądarka zablokowała nowe okno");
  };

  const stats = useMemo(() => {
    const paid = orders.filter((o) => o.payment_status === "paid" && o.status !== "refunded");
    const byProd: Record<string, number> = {};
    orders.filter((o) => o.status !== "cancelled" && o.status !== "refunded").forEach((o) => o.items.forEach((i) => { byProd[i.id] = (byProd[i.id] || 0) + i.qty; }));
    return { count: orders.length, fresh: orders.filter((o) => o.status === "new" || o.status === "paid").length, revenue: paid.reduce((a, o) => a + o.total_cents, 0), byProd };
  }, [orders]);

  const oss = useMemo(() => ossReport(
    orders.filter((o) => o.payment_status === "paid" && o.status !== "refunded").map((o) => ({ country: o.shipping?.country ?? null, grossCents: o.total_cents, paidAt: o.paid_at ?? o.created_at })),
    quarter, cfg?.seller?.country ?? null,
  ), [orders, quarter, cfg]);
  const ossTotal = oss.reduce((a, r) => ({ net: a.net + r.netCents, vat: a.vat + r.vatCents, gross: a.gross + r.grossCents }), { net: 0, vat: 0, gross: 0 });
  const ossCsv = () => {
    const rows = [["Kraj", "Stawka %", "Zamówienia", "Netto EUR", "VAT EUR", "Brutto EUR"], ...oss.map((r) => [r.country, String(r.rate), String(r.orders), (r.netCents / 100).toFixed(2), (r.vatCents / 100).toFixed(2), (r.grossCents / 100).toFixed(2)])];
    const blob = new Blob([rows.map((r) => r.join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `oss-${quarter}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  const shown = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[["Zamówienia", String(stats.count)], ["Do obsłużenia", String(stats.fresh)], ["Przychód (opłacone)", eur(stats.revenue)], ["Produkty w katalogu", String(SHOP_PRODUCTS.length)]].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-border bg-card p-4"><div className="text-xs text-muted-foreground">{k}</div><div className="text-2xl font-bold tabular-nums">{v}</div></div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 text-sm">
        <h3 className="font-semibold mb-2">Konfiguracja sklepu (zmienne Vercel)</h3>
        <ul className="grid gap-1 sm:grid-cols-2">
          <li>Karta (Stripe): <b>{cfg?.stripe ? "włączona" : "brak STRIPE_SECRET_KEY"}</b></li>
          <li>Przelew (Revolut): <b>{cfg?.transfer ? "włączony" : cfg?.ibanInvalid ? "SHOP_BANK_IBAN jest nieprawidłowy" : "brak SHOP_BANK_HOLDER / SHOP_BANK_IBAN"}</b></li>
          <li>Sprzedawca: <b>{cfg?.seller ? `${cfg.seller.name} (${cfg.seller.country ?? "kraj?"})` : "brak SHOP_SELLER_NAME / SHOP_SELLER_ADDRESS"}</b></li>
          <li>Printful (druk i wysyłka): <b>{cfg?.fulfillment?.printful ? (cfg.fulfillment.printfulAuto ? "włączony, od razu do produkcji" : "włączony, szkice do zatwierdzenia") : "brak PRINTFUL_API_KEY"}</b></li>
          <li>Dostawca gadżetów: <b>{cfg?.fulfillment?.supplierEmail ? "e-mail ustawiony" : "brak SHOP_SUPPLIER_EMAIL"}</b></li>
          <li>E-maile: <b>{cfg?.fulfillment?.mail ? "włączone" : "brak RESEND_API_KEY / BREVO_API_KEY + SHOP_MAIL_FROM"}</b></li>
          <li>Powiadomienia: <b>{cfg?.fulfillment?.notify ? "na SHOP_NOTIFY_EMAIL" : "brak SHOP_NOTIFY_EMAIL"}</b></li>
          <li>VAT: <b>{cfg?.vatMode === "oss" ? "OSS (stawka kraju nabywcy)" : cfg?.vatMode === "domestic" ? "krajowy (stawka sprzedawcy)" : cfg?.vatMode === "exempt" ? "zwolnienie z VAT" : "brak SHOP_VAT_MODE"}</b></li>
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={checkPrintful}>Sprawdź podpięcie produktów w Printful</Button>
          {pfCheck && <span>Podpięte warianty: <b>{pfCheck.linked}/{pfCheck.total}</b></span>}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Printful: utwórz sklep typu „Manual order platform / API”, dodaj produkty z grafikami i przy każdym wariancie wpisz External ID: <code>produkt-ROZMIAR</code> (np. <code>dropbass-M</code>, <code>3am-XXL</code>), a bez rozmiaru samo <code>torba</code>, <code>plakat</code>. Okulary i asystent AI idą e-mailem do dostawcy.</p>
        {pfCheck && pfCheck.missing.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground break-words">Brakuje „External ID” w Printful: {pfCheck.missing.join(", ")}</p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">VAT OSS: sprzedaż do innych krajów UE</h3>
          <div className="flex items-center gap-2">
            <select className="rounded-md border border-border bg-background px-2 py-1 text-sm" value={quarter} onChange={(e) => setQuarter(e.target.value)} aria-label="Kwartał">
              {lastQuarters(8).map((q) => <option key={q}>{q}</option>)}
            </select>
            <Button size="sm" variant="outline" onClick={ossCsv} disabled={!oss.length}>CSV</Button>
          </div>
        </div>
        {oss.length === 0 ? <p className="text-sm text-muted-foreground">Brak opłaconej sprzedaży do innych krajów UE w {quarter}.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm tabular-nums">
            <thead><tr className="text-left text-muted-foreground"><th className="py-1">Kraj</th><th>Stawka</th><th className="text-right">Zamówienia</th><th className="text-right">Netto</th><th className="text-right">VAT</th><th className="text-right">Brutto</th></tr></thead>
            <tbody>{oss.map((r) => <tr key={r.country} className="border-t border-border"><td className="py-1.5">{r.country}</td><td>{r.rate}%</td><td className="text-right">{r.orders}</td><td className="text-right">{eur(r.netCents)}</td><td className="text-right">{eur(r.vatCents)}</td><td className="text-right">{eur(r.grossCents)}</td></tr>)}
              <tr className="border-t-2 border-border font-semibold"><td className="py-1.5" colSpan={3}>Razem</td><td className="text-right">{eur(ossTotal.net)}</td><td className="text-right">{eur(ossTotal.vat)}</td><td className="text-right">{eur(ossTotal.gross)}</td></tr>
            </tbody></table></div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Deklarację OSS składa się co kwartał (do końca miesiąca po kwartale) w urzędzie skarbowym kraju rejestracji. Stawki sprawdź przed złożeniem w bazie TEDB Komisji Europejskiej. Poniżej progu 10 000 EUR rocznie możesz stosować stawkę krajową (SHOP_VAT_MODE=domestic).</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="font-semibold mb-3">Katalog i sprzedaż</h3>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-muted-foreground"><th className="py-1">Produkt</th><th>Cena</th><th>Typ</th><th className="text-right">Sprzedane szt.</th></tr></thead>
          <tbody>{SHOP_PRODUCTS.map((p) => (
            <tr key={p.id} className="border-t border-border"><td className="py-1.5">{p.name}</td><td>{eur(p.eurCents)} · {p.pln} zł</td><td>{p.preorder ? "przedsprzedaż" : "standard"}</td><td className="text-right tabular-nums">{stats.byProd[p.id] || 0}</td></tr>
          ))}</tbody></table></div>
        <p className="text-xs text-muted-foreground mt-2">Ceny (brutto, z VAT) zmienisz w src/data/shopCatalog.ts; serwer api/shop-checkout czyta ten sam plik. Zamówienia są w tabeli aurora_business_orders (typ „shop”), faktury w aurora_invoices.</p>
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
                <div><div className="font-semibold">{orderRef(o.id)} · {eur(o.total_cents)}</div><div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("pl-PL")} · {o.email} · {o.method === "transfer" ? "przelew" : o.method === "card" ? "karta" : "bez płatności"} · {(o.lang ?? "pl").toUpperCase()}</div></div>
                <select className="rounded-md border border-border bg-background px-2 py-1 text-sm" value={o.status} onChange={(e) => setStatus(o.id, e.target.value)} aria-label="Status">
                  {STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
                </select>
              </div>
              {o.fulfillment?.notes && o.fulfillment.notes.length > 0 && <ul className="text-xs text-muted-foreground list-disc pl-4">{o.fulfillment.notes.map((n, k) => <li key={k}>{n}</li>)}</ul>}
              <ul className="text-sm">{o.items.map((i, k) => <li key={k}>{i.qty} × {i.name}{i.size ? ` (${i.size})` : ""} · {eur(i.unitCents * i.qty)}</li>)}</ul>
              {o.shipping && <div className="text-sm text-muted-foreground">Wysyłka: {o.shipping.name}{o.shipping.company ? ` (${o.shipping.company}${o.shipping.taxId ? `, ${o.shipping.taxId}` : ""})` : ""}, {o.shipping.street}, {o.shipping.zip} {o.shipping.city}, {o.shipping.country}{o.shipping.phone ? `, tel. ${o.shipping.phone}` : ""}</div>}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Płatność: {o.payment_status === "paid" ? "opłacone" : o.payment_status === "refunded" ? "zwrot" : "oczekuje"}</span>
                {o.method === "transfer" && o.payment_status !== "paid" && <span>· sprawdź w Revolut wpłatę z tytułem {orderRef(o.id)}</span>}
                {o.stripe_session_id && <span>· Stripe {o.stripe_session_id.slice(0, 18)}…</span>}
                {o.stripe_session_id && o.payment_status !== "paid" && <Button size="sm" variant="outline" onClick={() => verify(o.id)}>Sprawdź płatność</Button>}
                {o.fulfillment && <span className={o.fulfillment.state === "sent" ? "text-emerald-500" : o.fulfillment.state === "sending" ? "" : "text-amber-500"}>· realizacja: {FSTATE[o.fulfillment.state] ?? o.fulfillment.state}</span>}
                {o.payment_status === "paid" && (!o.fulfillment || o.fulfillment.state === "error" || o.fulfillment.state === "manual") && (
                  <Button size="sm" variant="outline" onClick={() => fulfillNow(o.id, !!o.fulfillment)}>{o.fulfillment ? "Ponów realizację" : "Wyślij do realizacji"}</Button>
                )}
                {invoices[o.id]
                  ? <Button size="sm" variant="outline" onClick={() => showInvoice(o)}>Faktura {invoices[o.id].invoice_number}</Button>
                  : o.payment_status === "paid" && <Button size="sm" onClick={() => issue(o)}>Wystaw fakturę</Button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
