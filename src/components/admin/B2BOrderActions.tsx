// Akcje admina dla zlecenia B2B: oferta → opłacone → realizacja (postęp) → gotowe / anuluj.
// Status zapisujemy wprost w bazie (RLS admina), a klient dostaje maila przez /api/b2b (event).
import { useEffect, useState } from "react";
import { Loader2, Send, BadgeCheck, Play, CheckCircle2, XCircle, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { b2bRef } from "@/lib/b2b";

export interface B2BOrderLite {
  id: string;
  status: string | null;
  payment_status: string | null;
  price_eur: number | null;
  deadline: string | null;
  progress_pct: number | null;
  result_url: string | null;
  notes: string | null;
  client_email: string | null;
}

async function notifyClient(orderId: string, event: string): Promise<boolean> {
  const { data: s } = await supabase.auth.getSession();
  try {
    const r = await fetch("/api/b2b", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${s?.session?.access_token ?? ""}` },
      body: JSON.stringify({ action: "notify", orderId, event }),
    });
    const j = await r.json().catch(() => ({}));
    if (!j?.ok) toast.warning(`Zapisane, ale mail nie poszedł: ${j?.error ?? r.status}`);
    return !!j?.ok;
  } catch {
    toast.warning("Zapisane, ale mail nie poszedł (sieć)");
    return false;
  }
}

export function B2BOrderActions({ order, onChanged }: { order: B2BOrderLite; onChanged: () => void }) {
  const [price, setPrice] = useState(order.price_eur?.toString() ?? "");
  const [deadline, setDeadline] = useState(order.deadline ? order.deadline.slice(0, 10) : "");
  const [note, setNote] = useState(order.notes ?? "");
  const [progress, setProgress] = useState(String(order.progress_pct ?? 0));
  const [result, setResult] = useState(order.result_url ?? "");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setPrice(order.price_eur?.toString() ?? ""); setDeadline(order.deadline ? order.deadline.slice(0, 10) : "");
    setNote(order.notes ?? ""); setProgress(String(order.progress_pct ?? 0)); setResult(order.result_url ?? "");
  }, [order.id, order.price_eur, order.deadline, order.notes, order.progress_pct, order.result_url]);

  const run = async (key: string, patch: Record<string, unknown>, event: string | null, okMsg: string) => {
    setBusy(key);
    try {
      const { data, error } = await supabase.from("aurora_business_orders").update(patch as never).eq("id", order.id).select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Baza nie pozwoliła zapisać (uprawnienia)");
      const mailed = event ? await notifyClient(order.id, event) : false;
      toast.success(okMsg + (mailed ? " · klient dostał e-mail" : ""));
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się zapisać");
    } finally {
      setBusy(null);
    }
  };

  const priceNum = Number(price.replace(",", "."));
  const paid = order.payment_status === "paid";
  const done = order.status === "completed" || order.status === "cancelled";
  const B = ({ k, children, ...p }: { k: string; children: React.ReactNode } & React.ComponentProps<typeof Button>) => (
    <Button size="sm" className="gap-1" disabled={!!busy || p.disabled} {...p}>{busy === k ? <Loader2 className="h-3 w-3 animate-spin" /> : null}{children}</Button>
  );

  return (
    <div className="space-y-3 rounded-xl border border-orange-500/30 bg-orange-500/5 p-3">
      <div className="flex items-center justify-between text-xs">
        <b>Obsługa zlecenia</b>
        <span className="font-mono text-muted-foreground">tytuł przelewu: {b2bRef(order.id)}</span>
      </div>
      {!order.client_email && <p className="text-[11px] text-amber-300">Brak e-maila klienta — statusy zapiszą się, ale bez powiadomień.</p>}

      {/* 1. Oferta */}
      <div className="grid gap-2 sm:grid-cols-[120px_150px_1fr]">
        <Input inputMode="decimal" placeholder="Cena €" value={price} onChange={(e) => setPrice(e.target.value)} aria-label="Cena w euro" />
        <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} aria-label="Termin" />
        <Input placeholder="Notatka do oferty (zakres, warunki)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Notatka do oferty" />
      </div>
      <div className="flex flex-wrap gap-2">
        <B k="offer" disabled={!(priceNum > 0) || paid || done}
          onClick={() => run("offer", { price_eur: priceNum, deadline: deadline || null, notes: note || null, status: "offer_sent" }, "offer", "Oferta wysłana")}>
          <Send className="h-3 w-3" /> Wyślij ofertę
        </B>
        <B k="paid" variant="outline" disabled={paid || !order.price_eur || done}
          onClick={() => run("paid", { payment_status: "paid", paid_at: new Date().toISOString(), status: "confirmed" }, "paid", "Oznaczono jako opłacone")}>
          <BadgeCheck className="h-3 w-3" /> Opłacone
        </B>
        <B k="start" variant="outline" disabled={order.status === "in_progress" || done}
          onClick={() => run("start", { status: "in_progress", progress_pct: Math.max(order.progress_pct ?? 0, 10) }, "started", "Realizacja rozpoczęta")}>
          <Play className="h-3 w-3" /> Rozpocznij
        </B>
      </div>

      {/* 2. Postęp i wynik */}
      <div className="grid gap-2 sm:grid-cols-[100px_auto_1fr_auto]">
        <Input inputMode="numeric" value={progress} onChange={(e) => setProgress(e.target.value.replace(/\D/g, "").slice(0, 3))} aria-label="Postęp w procentach" />
        <B k="progress" variant="outline" disabled={done}
          onClick={() => run("progress", { progress_pct: Math.min(100, Number(progress) || 0) }, "progress", "Postęp zapisany")}>
          <Gauge className="h-3 w-3" /> Postęp %
        </B>
        <Input placeholder="Link do wyniku (plik, folder)" value={result} onChange={(e) => setResult(e.target.value)} aria-label="Link do wyniku" />
        <B k="done" disabled={done || !/^https?:\/\//.test(result)}
          onClick={() => run("done", { status: "completed", progress_pct: 100, result_url: result }, "completed", "Zlecenie zakończone")}>
          <CheckCircle2 className="h-3 w-3" /> Gotowe
        </B>
      </div>

      <div className="flex justify-end">
        <B k="cancel" variant="ghost" className="gap-1 text-red-400" disabled={done}
          onClick={() => { if (window.confirm("Anulować zlecenie? Klient dostanie e-mail.")) void run("cancel", { status: "cancelled" }, "cancelled", "Zlecenie anulowane"); }}>
          <XCircle className="h-3 w-3" /> Anuluj
        </B>
      </div>
    </div>
  );
}
