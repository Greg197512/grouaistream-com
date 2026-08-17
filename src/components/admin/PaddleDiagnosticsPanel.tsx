import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";
import { Stethoscope, Loader2, Check, X, CreditCard } from "lucide-react";

/**
 * „Sprawdź Paddle" — dla każdej ceny (kawa + subskrypcje) sprawdza, czy
 * get-paddle-price znajduje ją w aktualnym środowisku (live na produkcji,
 * sandbox na podglądzie). Od ręki widać, której ceny brakuje albo czy pada
 * klucz API — bez zgadywania, czemu checkout się nie otwiera.
 */
const PRICES: { id: string; label: string; hint: string }[] = [
  { id: "grouai_coffee_black", label: "Kawa — Czarna", hint: "1 USD, jednorazowa" },
  { id: "grouai_coffee_latte", label: "Kawa — Latte", hint: "3 USD, jednorazowa" },
  { id: "grouai_coffee_irish", label: "Kawa — Irish", hint: "5 USD, jednorazowa" },
  { id: "grouai_pro_monthly", label: "PRO — miesięcznie", hint: "subskrypcja" },
  { id: "grouai_pro_yearly", label: "PRO — rocznie", hint: "subskrypcja" },
  { id: "grouai_ultimate_monthly", label: "ULTIMATE — miesięcznie", hint: "subskrypcja" },
  { id: "grouai_ultimate_yearly", label: "ULTIMATE — rocznie", hint: "subskrypcja" },
];

type Res = { status: "ok" | "missing" | "error" | "pending"; paddleId?: string; msg?: string };

export function PaddleDiagnosticsPanel() {
  const env = getPaddleEnvironment(); // "live" na produkcji, "sandbox" na podglądzie
  const token = (import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string) || "";
  const tokenPrefix = token ? token.slice(0, 5) : "—";
  const [results, setResults] = useState<Record<string, Res>>({});
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setResults(Object.fromEntries(PRICES.map((p) => [p.id, { status: "pending" as const }])));
    for (const p of PRICES) {
      try {
        const { data, error } = await supabase.functions.invoke("get-paddle-price", {
          body: { priceId: p.id, environment: env },
        });
        if (error) {
          // 404 = brak ceny; inny błąd = klucz API / konfiguracja
          const m = (error as any)?.message || "";
          const missing = /not found|404/i.test(m);
          setResults((r) => ({ ...r, [p.id]: { status: missing ? "missing" : "error", msg: m || "błąd funkcji" } }));
        } else if ((data as any)?.paddleId) {
          setResults((r) => ({ ...r, [p.id]: { status: "ok", paddleId: (data as any).paddleId } }));
        } else if ((data as any)?.error) {
          const m = String((data as any).error);
          const missing = /not found/i.test(m);
          setResults((r) => ({ ...r, [p.id]: { status: missing ? "missing" : "error", msg: m } }));
        } else {
          setResults((r) => ({ ...r, [p.id]: { status: "error", msg: "nieznana odpowiedź" } }));
        }
      } catch (e: any) {
        setResults((r) => ({ ...r, [p.id]: { status: "error", msg: e?.message || "wyjątek" } }));
      }
    }
    setBusy(false);
  };

  const okCount = Object.values(results).filter((r) => r.status === "ok").length;
  const done = Object.keys(results).length > 0 && !busy;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Stethoscope className="h-5 w-5 text-primary" />
        <h3 className="font-display font-semibold text-lg">Sprawdź Paddle — diagnostyka płatności</h3>
      </div>

      {/* Środowisko + token */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
        <div className="rounded-xl border border-border p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Środowisko</div>
          <div className="mt-0.5">
            <Badge className={env === "live" ? "bg-emerald-600" : "bg-amber-500 text-black"}>{env === "live" ? "LIVE (produkcja)" : "SANDBOX (podgląd)"}</Badge>
          </div>
          <div className="text-[10px] text-muted-foreground/70 mt-1">To sprawdzamy tutaj. Live testuj na grouaistream.com.</div>
        </div>
        <div className="rounded-xl border border-border p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Client token</div>
          <div className="mt-0.5 flex items-center gap-1.5">
            {token ? <Check className="h-4 w-4 text-emerald-400" /> : <X className="h-4 w-4 text-rose-400" />}
            <span className="text-sm font-mono">{token ? `${tokenPrefix}…` : "brak!"}</span>
          </div>
          <div className="text-[10px] text-muted-foreground/70 mt-1">{tokenPrefix === "live_" ? "OK (live)" : tokenPrefix === "test_" ? "sandbox" : "nieustawiony"}</div>
        </div>
        <div className="rounded-xl border border-border p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Ceny znalezione</div>
          <div className="font-display text-2xl font-extrabold tabular-nums">{done ? `${okCount}/${PRICES.length}` : "—"}</div>
        </div>
      </div>

      <Button onClick={() => void run()} disabled={busy} className="gap-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        {busy ? "Sprawdzam…" : "Sprawdź Paddle"}
      </Button>

      {Object.keys(results).length > 0 && (
        <div className="rounded-xl border border-border divide-y divide-border/50">
          {PRICES.map((p) => {
            const r = results[p.id] || { status: "pending" as const };
            return (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2">
                {r.status === "ok" ? <Check className="h-4 w-4 text-emerald-400 flex-none" />
                  : r.status === "pending" ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-none" />
                  : <X className="h-4 w-4 text-rose-400 flex-none" />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{p.label} <span className="text-muted-foreground font-normal">· {p.hint}</span></div>
                  <div className="text-[11px] text-muted-foreground font-mono truncate">
                    {p.id}
                    {r.status === "ok" && r.paddleId ? ` → ${r.paddleId}` : ""}
                    {r.status === "missing" ? " → brak ceny z tym external_id w Paddle" : ""}
                    {r.status === "error" && r.msg ? ` → ${r.msg}` : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-border bg-secondary/30 p-3 text-xs text-muted-foreground space-y-1">
        <div className="font-medium text-foreground">Jak czytać wynik:</div>
        <div>✅ <b>zielone</b> = cena istnieje w Paddle → ta płatność się otworzy.</div>
        <div>❌ „brak ceny…" = w Paddle (w tym środowisku) nie ma ceny z tym <b>external_id</b> → utwórz ją w Catalog → Prices i ustaw pole external_id dokładnie tak.</div>
        <div>❌ inny błąd = zwykle brak <b>PADDLE_LIVE_API_KEY</b> (sekret edge function) albo domena nie zatwierdzona w Paddle.</div>
        <div className="pt-1">Uruchom to na <b>grouaistream.com</b>, żeby sprawdzić środowisko LIVE.</div>
      </div>
    </div>
  );
}
