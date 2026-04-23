import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, RefreshCw, TrendingDown, TrendingUp, Bell } from "lucide-react";
import { toast } from "sonner";

interface RevenueBreakdown {
  active_pro: number;
  active_ultimate: number;
  subscription_revenue_mtd: number;
  tip_revenue_mtd: number;
  total_revenue_mtd: number;
}

interface BEStatus {
  month: string;
  cost_mtd: number;
  revenue_mtd: number;
  revenue_breakdown: RevenueBreakdown;
  gap: number;
  cost_to_revenue_ratio_pct: number;
  is_profitable: boolean;
  day_of_month: number;
  days_in_month: number;
  days_left: number;
  required_daily_revenue: number;
  pro_subs_to_break_even: number;
  ultimate_subs_to_break_even: number;
}

export const BreakEvenPanel = () => {
  const [status, setStatus] = useState<BEStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_break_even_status");
    if (error) toast.error("Błąd: " + error.message);
    else setStatus(data as unknown as BEStatus);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 120_000);
    return () => clearInterval(t);
  }, [load]);

  const triggerCheck = async () => {
    setChecking(true);
    const { data, error } = await supabase.functions.invoke("break-even-alert");
    if (error) toast.error("Błąd: " + error.message);
    else {
      const r = data as { level?: string };
      toast.success(r?.level ? `🚨 Alert: ${r.level}` : "✅ Sytuacja OK");
      load();
    }
    setChecking(false);
  };

  if (loading || !status) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const monthProgress = (status.day_of_month / status.days_in_month) * 100;
  const profitable = status.is_profitable;

  return (
    <div className="space-y-4">
      {/* Główny wskaźnik */}
      <Card
        className={
          profitable
            ? "border-emerald-500/50 bg-emerald-500/5"
            : "border-red-500/50 bg-red-500/5"
        }
      >
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {profitable ? (
              <TrendingUp className="h-5 w-5 text-emerald-400" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-400" />
            )}
            Break-even — {status.month.slice(0, 7)}
          </CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={load}>
              <RefreshCw className="h-3 w-3 mr-1" />
              Odśwież
            </Button>
            <Button size="sm" onClick={triggerCheck} disabled={checking}>
              {checking ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <Bell className="h-3 w-3 mr-1" />
                  Sprawdź alert
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <div className="text-xs text-muted-foreground">💸 Koszt MTD</div>
              <div className="text-3xl font-bold text-red-300">
                {status.cost_mtd.toFixed(2)}€
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">💰 Przychód MTD</div>
              <div className="text-3xl font-bold text-emerald-300">
                {status.revenue_mtd.toFixed(2)}€
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">
                {profitable ? "📈 Zysk" : "📉 Strata"}
              </div>
              <div
                className={`text-3xl font-bold ${
                  profitable ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {profitable ? "+" : ""}
                {(-status.gap).toFixed(2)}€
              </div>
            </div>
          </div>

          {/* Progress dnia w miesiącu */}
          <div className="space-y-1 mb-4">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                Dzień {status.day_of_month} / {status.days_in_month}
              </span>
              <span>{status.days_left} dni do końca miesiąca</span>
            </div>
            <Progress value={monthProgress} className="h-2" />
          </div>

          {/* Ile potrzeba do break-even */}
          {!profitable && (
            <div className="bg-background/50 border border-border rounded-lg p-4 space-y-2">
              <div className="text-sm font-semibold text-foreground">
                🎯 Aby wyjść na zero do końca miesiąca:
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-primary/10 rounded p-3">
                  <div className="text-muted-foreground text-xs">
                    Nowi subskrybenci Pro
                  </div>
                  <div className="text-2xl font-bold text-primary">
                    {status.pro_subs_to_break_even} × 9,99€
                  </div>
                </div>
                <div className="bg-amber-500/10 rounded p-3">
                  <div className="text-muted-foreground text-xs">
                    LUB Ultimate
                  </div>
                  <div className="text-2xl font-bold text-amber-300">
                    {status.ultimate_subs_to_break_even} × 19,99€
                  </div>
                </div>
              </div>
              {status.days_left > 0 && (
                <div className="text-xs text-muted-foreground pt-2">
                  Średni dzienny przychód do osiągnięcia:{" "}
                  <strong className="text-foreground">
                    {status.required_daily_revenue.toFixed(2)}€/dzień
                  </strong>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Breakdown przychodów */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">📊 Skąd przychód MTD</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="border border-border rounded p-3">
              <div className="text-muted-foreground text-xs">
                Subskrypcje (prorata)
              </div>
              <div className="text-xl font-bold">
                {status.revenue_breakdown.subscription_revenue_mtd.toFixed(2)}€
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Pro: {status.revenue_breakdown.active_pro} · Ultimate:{" "}
                {status.revenue_breakdown.active_ultimate}
              </div>
            </div>
            <div className="border border-border rounded p-3">
              <div className="text-muted-foreground text-xs">Tipy (10% fee)</div>
              <div className="text-xl font-bold">
                {status.revenue_breakdown.tip_revenue_mtd.toFixed(2)}€
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Prowizja platformy
              </div>
            </div>
          </div>

          <div className="mt-4 text-xs text-muted-foreground space-y-1">
            <div>
              <strong className="text-foreground">Ratio kosztów:</strong>{" "}
              {status.cost_to_revenue_ratio_pct}% przychodu
            </div>
            <div>
              <strong className="text-foreground">Progi alertów:</strong> 80%
              ostrzeżenie, 100% strata, 150% kryzys
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
