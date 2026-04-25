// Mapa działań zlecenia — wizualizacja workflow z postępem każdego etapu
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, Clock, AlertCircle, PlayCircle, Sparkles, Bot, GitBranch } from "lucide-react";

interface Step {
  id: string; step_index: number; title: string; description: string | null;
  scope: string | null; status: string; progress_pct: number; eta_minutes: number | null;
  assigned_worker_id: string | null; workflow_id: string | null; error_message: string | null;
  started_at: string | null; completed_at: string | null;
}
interface Worker { id: string; display_name: string; }

const statusIcon = (s: string) => {
  if (s === "done") return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  if (s === "running") return <PlayCircle className="w-4 h-4 text-blue-400 animate-pulse" />;
  if (s === "failed") return <AlertCircle className="w-4 h-4 text-red-400" />;
  if (s === "blocked") return <AlertCircle className="w-4 h-4 text-amber-400" />;
  return <Clock className="w-4 h-4 text-muted-foreground" />;
};
const statusColor = (s: string) => {
  if (s === "done") return "border-emerald-500/40 bg-emerald-500/5";
  if (s === "running") return "border-blue-500/50 bg-blue-500/5 ring-1 ring-blue-500/30";
  if (s === "failed") return "border-red-500/40 bg-red-500/5";
  if (s === "blocked") return "border-amber-500/40 bg-amber-500/5";
  return "border-border";
};

export const OrderWorkflowMap = ({
  orderId, onGeneratePlan, generating
}: { orderId: string; onGeneratePlan: () => void; generating: boolean; }) => {
  const [steps, setSteps] = useState<Step[]>([]);
  const [workers, setWorkers] = useState<Record<string, Worker>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("aurora_order_plan_steps")
      .select("*").eq("order_id", orderId).order("step_index", { ascending: true });
    setSteps((data ?? []) as Step[]);
    const wIds = Array.from(new Set((data ?? []).map((s: any) => s.assigned_worker_id).filter(Boolean)));
    if (wIds.length > 0) {
      const { data: ws } = await supabase.from("aurora_workers").select("id, display_name").in("id", wIds as string[]);
      const map: Record<string, Worker> = {};
      (ws ?? []).forEach((w: any) => { map[w.id] = w; });
      setWorkers(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [orderId]);

  // Realtime updates
  useEffect(() => {
    const ch = supabase.channel(`plan-${orderId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "aurora_order_plan_steps", filter: `order_id=eq.${orderId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orderId]);

  const totalProgress = steps.length > 0
    ? Math.round(steps.reduce((sum, s) => sum + (s.progress_pct ?? 0), 0) / steps.length)
    : 0;
  const doneCount = steps.filter(s => s.status === "done").length;

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  if (steps.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><GitBranch className="w-5 h-5" />Mapa działań — pusta</CardTitle>
          <CardDescription>Aurora jeszcze nie wygenerowała planu dla tego zlecenia. Kliknij poniżej żeby ona stworzyła mapę i przydzieliła pracowników n8n.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onGeneratePlan} disabled={generating} size="lg" className="gap-2">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? "Aurora myśli…" : "Wygeneruj mapę działań"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2"><GitBranch className="w-5 h-5" />Mapa działań</CardTitle>
            <CardDescription>{doneCount} z {steps.length} etapów ukończonych — {totalProgress}%</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">live update</Badge>
        </div>
        <Progress value={totalProgress} className="h-2 mt-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {steps.map((s, i) => (
            <div key={s.id} className={`relative rounded-lg border p-4 transition-all ${statusColor(s.status)}`}>
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="absolute left-6 top-full h-3 w-px bg-border z-0" />
              )}
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  <div className="w-8 h-8 rounded-full bg-background border flex items-center justify-center">
                    {statusIcon(s.status)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">Etap {i + 1}</span>
                    <Badge variant="secondary" className="text-[10px]">{s.status}</Badge>
                    {s.scope && <Badge variant="outline" className="text-[10px] font-mono">{s.scope}</Badge>}
                    {s.eta_minutes && <span className="text-[10px] text-muted-foreground">~{s.eta_minutes} min</span>}
                  </div>
                  <h4 className="font-semibold mt-1">{s.title}</h4>
                  {s.description && <p className="text-sm text-muted-foreground mt-1">{s.description}</p>}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {s.assigned_worker_id && workers[s.assigned_worker_id] && (
                      <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px] gap-1">
                        <Bot className="w-3 h-3" />{workers[s.assigned_worker_id].display_name}
                      </Badge>
                    )}
                    {s.workflow_id && (
                      <span className="text-[10px] font-mono text-muted-foreground opacity-70">wf: {s.workflow_id.slice(0, 8)}…</span>
                    )}
                  </div>
                  {s.progress_pct > 0 && s.status !== "done" && (
                    <Progress value={s.progress_pct} className="h-1 mt-2" />
                  )}
                  {s.error_message && (
                    <div className="text-xs text-red-400 mt-2 bg-red-500/5 border border-red-500/20 rounded p-2">
                      ⚠ {s.error_message}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
