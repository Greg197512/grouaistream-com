// Status zlecenia B2B dla klienta: oś czasu, oferta (cena, termin), płatność kodem QR Revolut,
// „Akceptuję” / „Zapłaciłem” (mail do zespołu przez /api/b2b), link do gotowego wyniku.
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Loader2, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { b2bRef, b2bStepIndex, B2B_STEPS, B2B_STATUS_LABEL } from "@/lib/b2b";
import { cn } from "@/lib/utils";

export interface ClientOrder {
  id: string;
  status: string;
  payment_status: string;
  price_eur: number | null;
  deadline?: string | null;
  result_url?: string | null;
  notes?: string | null;
  progress_pct?: number | null;
}

type PayInfo = { ref: string; amount: number; bank: { revolut: string | null; iban: string | null; holder: string | null; bic: string | null } | null };

async function call(action: string, orderId: string) {
  const { data: s } = await supabase.auth.getSession();
  const r = await fetch("/api/b2b", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${s?.session?.access_token ?? ""}` },
    body: JSON.stringify({ action, orderId }),
  });
  return r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
}

export function B2BOrderStatus({ order, onChanged }: { order: ClientOrder; onChanged: () => void }) {
  const step = b2bStepIndex(order.status, order.payment_status);
  const cancelled = order.status === "cancelled";
  const awaitingPay = !!order.price_eur && order.payment_status !== "paid" && (order.status === "offer_sent" || order.status === "confirmed");
  const [pay, setPay] = useState<PayInfo | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notified, setNotified] = useState(false);

  useEffect(() => {
    setPay(null); setNotified(false);
    if (!awaitingPay) return;
    call("payinfo", order.id).then((j) => { if (j?.ok) setPay(j as PayInfo); });
  }, [order.id, awaitingPay]);

  const act = async (action: "accept" | "paid-notice") => {
    setBusy(action);
    const j = await call(action, order.id);
    setBusy(null);
    if (!j?.ok) { toast.error(j?.error || "Nie udało się"); return; }
    if (action === "accept") toast.success("Oferta zaakceptowana — możesz zapłacić poniżej");
    else { setNotified(true); toast.success("Dziękujemy! Zespół potwierdzi wpłatę e-mailem"); }
    onChanged();
  };

  const eur = (v: number) => v.toLocaleString("pl-PL", { style: "currency", currency: "EUR" });

  return (
    <Card className="border-orange-500/30">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold">Status zlecenia</h2>
          <span className="font-mono text-xs text-muted-foreground">{b2bRef(order.id)}</span>
        </div>

        {cancelled ? (
          <p className="text-sm text-red-300">{B2B_STATUS_LABEL.cancelled}. Masz pytania? Napisz do Aurory albo odpowiedz na e-mail.</p>
        ) : (
          <ol className="grid grid-cols-5 gap-1" aria-label="Etapy zlecenia">
            {B2B_STEPS.map((s, i) => (
              <li key={s.key} className="flex flex-col items-center gap-1 text-center" aria-current={i === step ? "step" : undefined}>
                <span className={cn("grid h-7 w-7 place-items-center rounded-full border text-[11px] font-bold",
                  i < step ? "border-emerald-500 bg-emerald-500 text-white" : i === step ? "border-orange-500 bg-orange-500/20 text-orange-300" : "border-border text-muted-foreground")}>
                  {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className={cn("text-[10px] leading-tight", i === step ? "font-semibold text-foreground" : "text-muted-foreground")}>{s.label}</span>
              </li>
            ))}
          </ol>
        )}

        {order.status === "received" && (
          <p className="text-sm text-muted-foreground">Zespół przygotowuje wycenę — dostaniesz ją e-mailem i zobaczysz tutaj.</p>
        )}

        {order.price_eur != null && order.status !== "received" && !cancelled && (
          <div className="rounded-xl bg-secondary/40 p-3 text-sm">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span>Cena: <b>{eur(order.price_eur)}</b></span>
              {order.deadline && <span>Termin: <b>{new Date(order.deadline).toLocaleDateString("pl-PL")}</b></span>}
              {order.status === "in_progress" && <span>Postęp: <b>{order.progress_pct ?? 0}%</b></span>}
            </div>
            {order.notes && <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{order.notes}</p>}
          </div>
        )}

        {order.status === "offer_sent" && order.payment_status !== "paid" && (
          <Button className="w-full gap-2 sm:w-auto" onClick={() => act("accept")} disabled={!!busy}>
            {busy === "accept" && <Loader2 className="h-4 w-4 animate-spin" />} Akceptuję ofertę
          </Button>
        )}

        {awaitingPay && pay?.bank && (
          <div className="grid gap-4 rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 sm:grid-cols-[auto_1fr]">
            {pay.bank.revolut && (
              <div className="mx-auto rounded-xl bg-white p-2">
                <QRCodeSVG value={pay.bank.revolut} size={168} level="M" marginSize={1} aria-label="Kod QR Revolut" />
              </div>
            )}
            <div className="space-y-2 text-sm">
              <p className="text-lg font-bold">{eur(pay.amount)}</p>
              <p>Tytuł przelewu: <b className="font-mono">{pay.ref}</b></p>
              {pay.bank.revolut && (
                <a href={pay.bank.revolut} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center rounded-full bg-orange-500 px-5 font-semibold text-white">Zapłać w Revolut</a>
              )}
              {pay.bank.iban && <p className="text-xs text-muted-foreground">Albo przelew: {pay.bank.iban}{pay.bank.holder ? ` · ${pay.bank.holder}` : ""}{pay.bank.bic ? ` · BIC ${pay.bank.bic}` : ""}</p>}
              <Button variant="outline" size="sm" onClick={() => act("paid-notice")} disabled={!!busy || notified}>
                {busy === "paid-notice" && <Loader2 className="h-3 w-3 animate-spin" />} {notified ? "Zgłoszone ✓" : "Zapłaciłem"}
              </Button>
            </div>
          </div>
        )}

        {order.status === "completed" && order.result_url && (
          <a href={order.result_url} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full bg-emerald-500 px-5 font-semibold text-white">
            <Download className="h-4 w-4" /> Pobierz wynik
          </a>
        )}
      </CardContent>
    </Card>
  );
}
