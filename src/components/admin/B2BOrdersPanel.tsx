import { useCallback, useEffect, useMemo, useState } from "react";
import { Briefcase, Loader2, RefreshCw, ExternalLink, FileText, Search, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

// Panel admina: WSZYSTKIE zlecenia B2B z lokalnej bazy (aurora_business_orders)
// + wersje robocze (aurora_intake_drafts). Podgląd pełnych danych i skok do Dashboardu klienta.

interface Order {
  id: string;
  client_name: string | null;
  client_email: string | null;
  client_company: string | null;
  service_type: string | null;
  brief: string | null;
  budget_eur: number | null;
  price_eur: number | null;
  status: string | null;
  payment_status: string | null;
  progress_pct: number | null;
  checkout_url: string | null;
  result_url: string | null;
  paid_at: string | null;
  deadline: string | null;
  created_at: string;
  updated_at: string | null;
  user_id: string | null;
  notes: string | null;
  assigned_to: string | null;
  ai_plan: any;
  result: any;
  payload: any;
  workflow_map: any;
}

interface Draft {
  id: string;
  service_type: string | null;
  brief: string | null;
  budget_eur: number | null;
  status: string | null;
  confidence: number | null;
  created_at: string;
  resulting_order_id: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  received: "bg-secondary text-muted-foreground",
  confirmed: "bg-blue-500/20 text-blue-300",
  offer_sent: "bg-amber-500/20 text-amber-300",
  in_progress: "bg-fuchsia-500/20 text-fuchsia-300",
  completed: "bg-emerald-500/20 text-emerald-300",
  cancelled: "bg-red-500/20 text-red-300",
};
const PAY_STYLE: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-300",
  paid: "bg-emerald-500/20 text-emerald-300",
  refunded: "bg-red-500/20 text-red-300",
};

const fmt = (v?: string | null) => (v ? new Date(v).toLocaleString("pl-PL") : "—");

export function B2BOrdersPanel() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Order | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: ord, error: e1 }, { data: dr, error: e2 }] = await Promise.all([
        supabase.from("aurora_business_orders").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("aurora_intake_drafts").select("id,service_type,brief,budget_eur,status,confidence,created_at,resulting_order_id").order("created_at", { ascending: false }).limit(50),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      setOrders((ord as Order[]) || []);
      setDrafts((dr as Draft[]) || []);
    } catch (e: any) {
      toast.error("Nie udało się pobrać zleceń: " + (e?.message || ""));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // Realtime: nowe zamówienia i zmiany natychmiast w panelu
    const ch = supabase
      .channel("admin-b2b-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "aurora_business_orders" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "aurora_intake_drafts" }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return orders;
    return orders.filter(o =>
      [o.client_name, o.client_email, o.client_company, o.service_type, o.brief, o.status, o.payment_status, o.id]
        .some(v => v && String(v).toLowerCase().includes(s)));
  }, [orders, q]);

  const openDashboard = (id: string) => {
    window.open(`/client-dashboard/${id}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          <h3 className="font-display font-semibold text-lg">Zlecenia B2B</h3>
          <Badge variant="secondary">{orders.length}</Badge>
          {drafts.length > 0 && <Badge variant="outline" className="text-amber-300 border-amber-500/40">wersje robocze: {drafts.length}</Badge>}
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Odśwież
        </Button>
      </div>

      <div className="relative sm:max-w-sm">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input placeholder="Szukaj: nazwa, email, firma, usługa, status…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-7" />
      </div>

      {loading && orders.length === 0 ? (
        <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin inline-block" /></div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Brak zleceń pasujących do zapytania.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => {
            const st = STATUS_STYLE[o.status || ""] || STATUS_STYLE.received;
            const ps = PAY_STYLE[o.payment_status || ""] || PAY_STYLE.pending;
            return (
              <div key={o.id} className="rounded-xl border border-border p-3 space-y-2 hover:border-primary/40 transition-colors">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[11px] text-muted-foreground">{o.id.slice(0, 8)}…</span>
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", st)}>{o.status || "—"}</span>
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", ps)}>{o.payment_status || "—"}</span>
                      {typeof o.progress_pct === "number" && o.progress_pct > 0 && (
                        <span className="text-[10px] text-primary">{o.progress_pct}%</span>
                      )}
                      {(o.price_eur ?? 0) > 0 && <span className="text-xs text-primary font-semibold">{o.price_eur} €</span>}
                      {o.service_type && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{o.service_type}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      <b>{o.client_name || "—"}</b>{o.client_company ? ` (${o.client_company})` : ""} · {o.client_email || "brak e-mail"}
                    </div>
                    <div className="text-[11px] text-muted-foreground/80 line-clamp-2">{o.brief || "—"}</div>
                    <div className="text-[10px] text-muted-foreground/60 mt-0.5">utworzone: {fmt(o.created_at)}{o.paid_at ? ` · opłacone: ${fmt(o.paid_at)}` : ""}</div>
                  </div>
                  <div className="flex gap-1 flex-wrap justify-end">
                    <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setActive(o)}>
                      <Eye className="h-3 w-3" /> Podgląd
                    </Button>
                    <Button size="sm" className="h-8 gap-1" onClick={() => openDashboard(o.id)}>
                      <ExternalLink className="h-3 w-3" /> Dashboard
                    </Button>
                    {o.checkout_url && (
                      <a href={o.checkout_url} target="_blank" rel="noreferrer" className="inline-flex">
                        <Button size="sm" variant="outline" className="h-8 gap-1"><FileText className="h-3 w-3" /> Checkout</Button>
                      </a>
                    )}
                    {o.result_url && (
                      <a href={o.result_url} target="_blank" rel="noreferrer" className="inline-flex">
                        <Button size="sm" variant="outline" className="h-8 gap-1"><FileText className="h-3 w-3" /> Wynik</Button>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {drafts.length > 0 && (
        <div className="pt-4 border-t border-border/60">
          <div className="text-xs font-semibold text-amber-300 mb-2">📝 Wersje robocze (rozmowa z Aurorą, jeszcze nie zamówione)</div>
          <div className="space-y-1.5">
            {drafts.slice(0, 10).map(d => (
              <div key={d.id} className="text-[11px] text-muted-foreground border border-border/40 rounded-lg px-2 py-1.5 flex items-center gap-2 flex-wrap">
                <span className="font-mono">{d.id.slice(0, 6)}</span>
                <span className="text-primary">{d.service_type || "—"}</span>
                {d.budget_eur != null && <span>{d.budget_eur} €</span>}
                <span className="px-1.5 py-0.5 rounded bg-secondary text-[9px]">{d.status || "draft"}</span>
                {d.confidence != null && <span className="text-[9px]">conf {(d.confidence * 100).toFixed(0)}%</span>}
                <span className="truncate flex-1">{d.brief}</span>
                <span className="opacity-60">{fmt(d.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Podgląd zlecenia */}
      <Dialog open={!!active} onOpenChange={(v) => !v && setActive(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <Briefcase className="h-4 w-4 text-primary" />
              Zlecenie {active?.id.slice(0, 8)}…
              {active?.status && <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", STATUS_STYLE[active.status] || STATUS_STYLE.received)}>{active.status}</span>}
              {active?.payment_status && <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", PAY_STYLE[active.payment_status] || PAY_STYLE.pending)}>{active.payment_status}</span>}
            </DialogTitle>
          </DialogHeader>
          {active && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Klient:</span> <b>{active.client_name || "—"}</b></div>
                <div><span className="text-muted-foreground">Firma:</span> {active.client_company || "—"}</div>
                <div><span className="text-muted-foreground">E-mail:</span> {active.client_email || "—"}</div>
                <div><span className="text-muted-foreground">Usługa:</span> {active.service_type || "—"}</div>
                <div><span className="text-muted-foreground">Budżet:</span> {active.budget_eur ?? "—"} €</div>
                <div><span className="text-muted-foreground">Cena:</span> {active.price_eur ?? "—"} €</div>
                <div><span className="text-muted-foreground">Deadline:</span> {fmt(active.deadline)}</div>
                <div><span className="text-muted-foreground">Postęp:</span> {active.progress_pct ?? 0}%</div>
                <div><span className="text-muted-foreground">Utworzone:</span> {fmt(active.created_at)}</div>
                <div><span className="text-muted-foreground">Opłacone:</span> {fmt(active.paid_at)}</div>
                <div><span className="text-muted-foreground">Przypisane:</span> {active.assigned_to || "—"}</div>
                <div><span className="text-muted-foreground">User ID:</span> <span className="font-mono">{active.user_id?.slice(0, 8) || "—"}</span></div>
              </div>

              {active.brief && (
                <div><div className="text-xs text-muted-foreground mb-1">Brief:</div><div className="p-2 rounded bg-secondary/40 text-xs whitespace-pre-wrap">{active.brief}</div></div>
              )}
              {active.notes && (
                <div><div className="text-xs text-muted-foreground mb-1">Notatki:</div><div className="p-2 rounded bg-secondary/40 text-xs whitespace-pre-wrap">{active.notes}</div></div>
              )}
              {active.ai_plan && (
                <details className="text-xs"><summary className="cursor-pointer text-primary">Plan AI</summary>
                  <pre className="p-2 rounded bg-secondary/40 overflow-auto text-[10px]">{JSON.stringify(active.ai_plan, null, 2)}</pre>
                </details>
              )}
              {active.workflow_map && (
                <details className="text-xs"><summary className="cursor-pointer text-primary">Workflow (n8n)</summary>
                  <pre className="p-2 rounded bg-secondary/40 overflow-auto text-[10px]">{JSON.stringify(active.workflow_map, null, 2)}</pre>
                </details>
              )}
              {active.result && (
                <details className="text-xs" open><summary className="cursor-pointer text-primary">Wynik</summary>
                  <pre className="p-2 rounded bg-secondary/40 overflow-auto text-[10px]">{JSON.stringify(active.result, null, 2)}</pre>
                </details>
              )}
              {active.payload && (
                <details className="text-xs"><summary className="cursor-pointer text-primary">Payload</summary>
                  <pre className="p-2 rounded bg-secondary/40 overflow-auto text-[10px]">{JSON.stringify(active.payload, null, 2)}</pre>
                </details>
              )}

              <div className="flex gap-2 flex-wrap pt-2 border-t border-border/60">
                <Button size="sm" className="gap-1" onClick={() => openDashboard(active.id)}>
                  <ExternalLink className="h-3 w-3" /> Otwórz Dashboard klienta
                </Button>
                {active.checkout_url && (
                  <a href={active.checkout_url} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline" className="gap-1"><FileText className="h-3 w-3" /> Checkout Paddle</Button>
                  </a>
                )}
                {active.result_url && (
                  <a href={active.result_url} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline" className="gap-1"><FileText className="h-3 w-3" /> Plik wyniku</Button>
                  </a>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default B2BOrdersPanel;
