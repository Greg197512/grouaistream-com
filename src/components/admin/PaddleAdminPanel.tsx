import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, ExternalLink, Wallet, Receipt, Loader2, Crown, TrendingUp, AlertTriangle } from "lucide-react";

// Ceny planów (USD/mies) — do szacunku miesięcznego przychodu z aktywnych subskrypcji.
const PRO_USD = 19;
const ULT_USD = 39;
const PADDLE_DASHBOARD = "https://vendors.paddle.com/";
const HUB_PADDLE = "https://bmwtydwpevzhbdplilbr.supabase.co/functions/v1/paddle-report";

// Kwoty z Paddle są w najniższej jednostce (grosze/centy) → dziel przez 100.
const money = (amt: number, cur: string) => `${(amt / 100).toFixed(2)} ${cur}`;

interface PaddleLive {
  ok: boolean;
  env?: string;
  count?: number;
  totals?: Record<string, number>;
  recent?: { amount: number; currency: string; status: string; date: string }[];
  error?: string;
  message?: string;
}

export function PaddleAdminPanel() {
  const [loading, setLoading] = useState(true);
  const [pro, setPro] = useState(0);
  const [ult, setUlt] = useState(0);
  const [live, setLive] = useState<PaddleLive | null>(null);
  const [liveLoading, setLiveLoading] = useState(true);

  // Realne płatności z Paddle (API) — przez funkcję huba (admin).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLiveLoading(true);
      try {
        const { data: s } = await supabase.auth.getSession();
        const token = s?.session?.access_token;
        if (!token) { if (!cancelled) { setLiveLoading(false); } return; }
        const r = await fetch(HUB_PADDLE, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: "{}",
        });
        const j = (await r.json().catch(() => null)) as PaddleLive | null;
        if (!cancelled) setLive(j);
      } catch {
        if (!cancelled) setLive(null);
      }
      if (!cancelled) setLiveLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // user_subscriptions = lustro płatności Paddle (admin ma dostęp przez RLS).
      const { data } = await supabase
        .from("user_subscriptions")
        .select("plan, status")
        .eq("status", "active");
      let p = 0, u = 0;
      for (const s of (data || []) as { plan: string | null }[]) {
        if (s.plan === "pro") p++;
        else if (s.plan === "ultimate") u++;
      }
      if (!cancelled) { setPro(p); setUlt(u); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const mrr = pro * PRO_USD + ult * ULT_USD;

  const stat = (label: string, value: string, icon: React.ReactNode, accent = "text-primary") => (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold ${accent}`}>{value}</p>
          </div>
          {icon}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-purple-500/5 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" /> Paddle — płatności
          </CardTitle>
          <CardDescription>
            Podsumowanie z aktywnych subskrypcji (lustro Paddle w apce). Realne saldo i wypłaty są na Twoim koncie Paddle.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="grid gap-4 md:grid-cols-4">
              {stat("Aktywne subskrypcje", String(pro + ult), <Crown className="h-5 w-5 text-primary" />)}
              {stat("Pro (× 19 $)", String(pro), <CreditCard className="h-5 w-5 text-sky-400" />, "text-sky-400")}
              {stat("Ultimate (× 39 $)", String(ult), <Crown className="h-5 w-5 text-amber-400" />, "text-amber-400")}
              {stat("Szac. przychód / mies.", `${mrr} $`, <TrendingUp className="h-5 w-5 text-emerald-400" />, "text-emerald-400")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Realne płatności z Paddle (API) */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-5 w-5 text-primary" /> Na żywo z Paddle
            {live?.ok && live.env && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary uppercase">{live.env}</span>
            )}
          </CardTitle>
          <CardDescription>Prawdziwe zakończone transakcje prosto z Paddle API.</CardDescription>
        </CardHeader>
        <CardContent>
          {liveLoading ? (
            <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : live?.ok ? (
            <div className="space-y-3">
              {(!live.totals || Object.keys(live.totals).length === 0) ? (
                <p className="text-sm text-muted-foreground">Brak zakończonych płatności w Paddle (jeszcze). Gdy ktoś zapłaci przez Paddle, pojawi się tu automatycznie.</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {Object.entries(live.totals).map(([cur, amt]) => (
                    <div key={cur} className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2">
                      <p className="text-[11px] text-muted-foreground">Wpłynęło ({cur})</p>
                      <p className="text-xl font-bold text-emerald-400">{money(amt, cur)}</p>
                    </div>
                  ))}
                  <div className="rounded-xl border border-border/50 bg-card/50 px-4 py-2">
                    <p className="text-[11px] text-muted-foreground">Transakcje</p>
                    <p className="text-xl font-bold">{live.count ?? 0}</p>
                  </div>
                </div>
              )}
              {live.recent && live.recent.length > 0 && (
                <div className="mt-2 divide-y divide-border/40 rounded-lg border border-border/40">
                  {live.recent.map((t, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-1.5 text-sm">
                      <span className="text-muted-foreground">{new Date(t.date).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
                      <span className="font-medium">{money(t.amount, t.currency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : live?.error === "no_key" ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100/90">
              Żeby zobaczyć tu realne wpłaty, dodaj <b>klucz API Paddle</b> (Paddle → Developer Tools → Authentication → API keys). Wklej go administratorowi — podłączy dane na żywo.
            </div>
          ) : (
            <p className="text-sm text-red-300">Błąd Paddle: {live?.message || "nie udało się pobrać"}</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-5 w-5 text-primary" /> Twoje pieniądze (dashboard Paddle)
          </CardTitle>
          <CardDescription>
            Cała kasa (subskrypcje + kawa) idzie przez Paddle. Saldo, wpłaty i wypłaty na konto bankowe są w panelu Paddle.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => window.open(PADDLE_DASHBOARD, "_blank", "noopener")} className="gap-2">
              <Wallet className="h-4 w-4" /> Saldo Paddle <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            <Button variant="secondary" onClick={() => window.open(PADDLE_DASHBOARD, "_blank", "noopener")} className="gap-2">
              <Receipt className="h-4 w-4" /> Transakcje <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            <Button variant="secondary" onClick={() => window.open(PADDLE_DASHBOARD, "_blank", "noopener")} className="gap-2">
              <TrendingUp className="h-4 w-4" /> Wypłaty <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-amber-100/90">
              <b>Ważne:</b> Paddle wypłaci Ci pieniądze tylko, gdy masz uzupełnione <b>dane wypłat</b> (konto bankowe + weryfikacja) w ustawieniach Paddle.
              Bez tego kasa czeka na saldzie. Sprawdź: Paddle → Settings → Payout details.
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Panel pokazuje aktywne subskrypcje z bazy apki (szacunek). Dokładne kwoty transakcji i saldo są w Paddle.
            Chcesz je na żywo w tym panelu? Trzeba dodać klucz API Paddle — daj znać.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
