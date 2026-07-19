import { useCallback, useEffect, useState } from "react";
import { Briefcase, Loader2, RefreshCw, CheckCircle2, CreditCard, Lock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Panel admina: wszystkie zlecenia B2B (z huba) + akcje (potwierdź / potwierdź wpłatę).
const HUB_ORDERS_URL = "https://bmwtydwpevzhbdplilbr.supabase.co/functions/v1/hub-orders";

interface Order {
  order_id: string; email: string; name: string | null; company: string | null;
  segment: string; brief: string; stage: string;
  offer_amount: number | null; invoice_no: string | null; created_at: string;
  files?: string[] | null;
}

const STAGE: Record<string, { label: string; cls: string }> = {
  new: { label: "Nowe", cls: "bg-secondary text-muted-foreground" },
  confirmed: { label: "Potwierdzone", cls: "bg-blue-500/20 text-blue-300" },
  offer_sent: { label: "Oferta wysłana", cls: "bg-amber-500/20 text-amber-300" },
  payment_reported: { label: "Zgłoszona wpłata", cls: "bg-fuchsia-500/20 text-fuchsia-300" },
  paid: { label: "Opłacone / realizacja", cls: "bg-emerald-500/20 text-emerald-300" },
};

export function B2BOrdersPanel() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [pin, setPin] = useState<string>(() => localStorage.getItem("b2b-pricing-pin") || "");

  const load = useCallback(async (thePin?: string) => {
    const p = (thePin ?? pin).trim();
    if (!p) { setLoading(false); return; }
    setLoading(true);
    try {
      const r = await fetch(`${HUB_ORDERS_URL}?pin=${encodeURIComponent(p)}`);
      const d = await r.json();
      if (!d?.ok) throw new Error(d?.error || "błąd");
      setOrders(d.orders);
      localStorage.setItem("b2b-pricing-pin", p);
    } catch (e: any) {
      toast.error("Nie udało się pobrać zleceń: " + (e?.message || ""));
    } finally {
      setLoading(false);
    }
  }, [pin]);

  useEffect(() => { if (pin) void load(); /* eslint-disable-next-line */ }, []);

  const act = async (order: string, action: "confirm_order" | "confirm_payment") => {
    if (!pin.trim()) { toast.error("Podaj PIN admina"); return; }
    setBusy(order + action);
    try {
      const r = await fetch(HUB_ORDERS_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pin.trim(), action, order }),
      });
      const d = await r.json();
      if (!d?.ok) throw new Error(d?.error || `HTTP ${d?.status}`);
      toast.success(action === "confirm_order"
        ? "✅ Zatwierdzono — Aurora wyceniła i wysłała ofertę do klienta"
        : "💳 Wpłata potwierdzona — faktura wysłana, generacja ruszyła");
      await load();
    } catch (e: any) {
      toast.error("Akcja nieudana: " + (e?.message || ""));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          <h3 className="font-display font-semibold text-lg">Zlecenia B2B</h3>
          <Badge variant="secondary">{orders.length}</Badge>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Odśwież
        </Button>
      </div>

      {/* PIN */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative sm:max-w-[240px]">
          <Lock className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input type="password" placeholder="PIN admina" value={pin}
            onChange={(e) => setPin(e.target.value)} className="pl-7" />
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>Wczytaj</Button>
      </div>

      {loading && orders.length === 0 ? (
        <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin inline-block" /></div>
      ) : orders.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Brak zleceń (lub zły PIN). Domyślny PIN ustawiony przy tworzeniu panelu.
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => {
            const st = STAGE[o.stage] || STAGE.new;
            return (
              <div key={o.order_id} className="rounded-xl border border-border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-sm">{o.order_id}</span>
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", st.cls)}>{st.label}</span>
                      {o.offer_amount != null && <span className="text-xs text-primary font-semibold">{o.offer_amount} €</span>}
                      {o.invoice_no && <span className="text-[10px] text-emerald-300 flex items-center gap-0.5"><FileText className="h-3 w-3" />{o.invoice_no}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {o.name || "—"}{o.company ? ` (${o.company})` : ""} · {o.email} · {o.segment}
                    </div>
                    <div className="text-[11px] text-muted-foreground/80 truncate">{o.brief}</div>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(o.stage === "new" || o.stage === "confirmed") && (
                    <Button size="sm" className="h-8 gap-1" disabled={busy === o.order_id + "confirm_order"}
                      onClick={() => void act(o.order_id, "confirm_order")}>
                      {busy === o.order_id + "confirm_order" ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                      Potwierdź i wyceń
                    </Button>
                  )}
                  {o.stage === "payment_reported" && (
                    <Button size="sm" className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-500" disabled={busy === o.order_id + "confirm_payment"}
                      onClick={() => void act(o.order_id, "confirm_payment")}>
                      {busy === o.order_id + "confirm_payment" ? <Loader2 className="h-3 w-3 animate-spin" /> : <CreditCard className="h-3 w-3" />}
                      Potwierdź wpłatę + faktura
                    </Button>
                  )}
                  {o.files && o.files.length > 0 && o.files.map((f, i) => (
                    <a key={i} href={f} target="_blank" rel="noreferrer" className="text-xs text-primary underline flex items-center">plik {i + 1}</a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        „Potwierdź i wyceń" → Aurora liczy cenę (panel „Ceny B2B") i wysyła ofertę PDF klientowi.
        „Potwierdź wpłatę" → faktura PDF do klienta + start generacji. PIN wspólny z panelem cen.
      </p>
    </div>
  );
}
