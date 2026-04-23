import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, X, Flame, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Alert {
  id: string;
  level: "warning" | "critical" | "emergency";
  message: string;
  cost_amount: number;
  revenue_amount: number;
  ratio_pct: number;
  triggered_at: string;
}

export const CostAlertBanner = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("get_active_cost_alerts");
    setAlerts((data as Alert[]) ?? []);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const dismiss = async (id: string) => {
    await supabase.rpc("dismiss_cost_alert", { _id: id });
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {alerts.map(a => {
        const palette =
          a.level === "emergency"
            ? "bg-red-500/15 border-red-500/50 text-red-100"
            : a.level === "critical"
            ? "bg-orange-500/15 border-orange-500/50 text-orange-100"
            : "bg-yellow-500/15 border-yellow-500/50 text-yellow-100";
        const Icon =
          a.level === "emergency" ? Flame : a.level === "critical" ? ShieldAlert : AlertTriangle;
        return (
          <div
            key={a.id}
            className={`border rounded-lg px-4 py-3 flex items-start gap-3 ${palette}`}
          >
            <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-sm">
              <div className="font-semibold">{a.message}</div>
              <div className="text-xs opacity-75 mt-1">
                {new Date(a.triggered_at).toLocaleString("pl-PL")} · ratio{" "}
                {a.ratio_pct}% · gap {(a.cost_amount - a.revenue_amount).toFixed(2)}€
              </div>
            </div>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => dismiss(a.id)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
};
