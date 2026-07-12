import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, ExternalLink, Wallet, Receipt, Loader2, Crown, TrendingUp, AlertTriangle } from "lucide-react";

// Ceny planów (PLN/mies) — do szacunku miesięcznego przychodu z aktywnych subskrypcji.
const PRO_PLN = 19;
const ULT_PLN = 39;
const PADDLE_DASHBOARD = "https://vendor.paddle.com/";

export function PaddleAdminPanel() {
  const [loading, setLoading] = useState(true);
  const [pro, setPro] = useState(0);
  const [ult, setUlt] = useState(0);

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

  const mrr = pro * PRO_PLN + ult * ULT_PLN;

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
              {stat("Pro (× 19 zł)", String(pro), <CreditCard className="h-5 w-5 text-sky-400" />, "text-sky-400")}
              {stat("Ultimate (× 39 zł)", String(ult), <Crown className="h-5 w-5 text-amber-400" />, "text-amber-400")}
              {stat("Szac. przychód / mies.", `${mrr} zł`, <TrendingUp className="h-5 w-5 text-emerald-400" />, "text-emerald-400")}
            </div>
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
