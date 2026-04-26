// Live Charts — wykresy pracy botów n8n w realtime
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, Legend, RadialBarChart, RadialBar,
} from "recharts";
import { Bot, Activity, Zap, TrendingUp, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface Worker {
  id: string; display_name: string; domain: string; status: string;
  is_busy: boolean; current_jobs: number; total_completed: number; total_failed: number;
}
interface Step {
  id: string; status: string; assigned_worker_id: string | null;
  progress_pct: number; eta_minutes: number | null; scope: string | null;
  started_at: string | null; completed_at: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  done: "hsl(142 76% 50%)",
  running: "hsl(217 91% 60%)",
  pending: "hsl(220 9% 46%)",
  failed: "hsl(0 84% 60%)",
  blocked: "hsl(38 92% 50%)",
  skipped: "hsl(280 70% 60%)",
};

export const BotsLiveCharts = ({ orderId }: { orderId: string }) => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [w, s] = await Promise.all([
      supabase.from("aurora_workers").select("id, display_name, domain, status, is_busy, current_jobs, total_completed, total_failed").order("total_completed", { ascending: false }),
      supabase.from("aurora_order_plan_steps").select("id, status, assigned_worker_id, progress_pct, eta_minutes, scope, started_at, completed_at").eq("order_id", orderId),
    ]);
    setWorkers((w.data ?? []) as Worker[]);
    setSteps((s.data ?? []) as Step[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [orderId]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel(`bots-charts-${orderId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "aurora_order_plan_steps", filter: `order_id=eq.${orderId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "aurora_workers" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orderId]);

  // Auto-refresh co 5s na wypadek brakujących realtime eventów
  useEffect(() => {
    const i = setInterval(load, 5000);
    return () => clearInterval(i);
  }, [orderId]);

  const stats = useMemo(() => {
    const total = steps.length;
    const done = steps.filter(s => s.status === "done").length;
    const running = steps.filter(s => s.status === "running").length;
    const failed = steps.filter(s => s.status === "failed").length;
    const pending = steps.filter(s => s.status === "pending").length;
    const totalEta = steps.filter(s => s.status !== "done").reduce((a, s) => a + (s.eta_minutes ?? 0), 0);
    const avgProgress = total > 0 ? Math.round(steps.reduce((a, s) => a + s.progress_pct, 0) / total) : 0;
    const activeBots = workers.filter(w => w.is_busy).length;
    return { total, done, running, failed, pending, totalEta, avgProgress, activeBots };
  }, [steps, workers]);

  const statusPie = useMemo(() => [
    { name: "Done", value: stats.done, color: STATUS_COLORS.done },
    { name: "Running", value: stats.running, color: STATUS_COLORS.running },
    { name: "Pending", value: stats.pending, color: STATUS_COLORS.pending },
    { name: "Failed", value: stats.failed, color: STATUS_COLORS.failed },
  ].filter(x => x.value > 0), [stats]);

  const workerLoad = useMemo(() => {
    const map: Record<string, { name: string; running: number; done: number; failed: number }> = {};
    workers.forEach(w => {
      map[w.id] = { name: w.display_name.slice(0, 14), running: 0, done: w.total_completed, failed: w.total_failed };
    });
    steps.forEach(s => {
      if (s.assigned_worker_id && map[s.assigned_worker_id]) {
        if (s.status === "running") map[s.assigned_worker_id].running++;
      }
    });
    return Object.values(map).slice(0, 8);
  }, [workers, steps]);

  // Throughput timeline — kroki ukończone w ostatnich godzinach
  const timeline = useMemo(() => {
    const now = Date.now();
    const buckets: { time: string; done: number; ts: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const t = now - i * 60 * 60 * 1000;
      buckets.push({ time: new Date(t).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }), done: 0, ts: t });
    }
    steps.forEach(s => {
      if (!s.completed_at) return;
      const t = new Date(s.completed_at).getTime();
      const idx = buckets.findIndex(b => Math.abs(b.ts - t) < 30 * 60 * 1000);
      if (idx >= 0) buckets[idx].done++;
    });
    return buckets.map(({ time, done }) => ({ time, done }));
  }, [steps]);

  const progressRadial = [{ name: "Progress", value: stats.avgProgress, fill: "hsl(217 91% 60%)" }];

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={<Activity className="w-4 h-4" />} label="Aktywne boty" value={stats.activeBots} sub={`z ${workers.length} łącznie`} color="text-blue-400" />
        <KpiCard icon={<Zap className="w-4 h-4" />} label="W trakcie" value={stats.running} sub="kroki running" color="text-amber-400" />
        <KpiCard icon={<CheckCircle2 className="w-4 h-4" />} label="Ukończone" value={`${stats.done}/${stats.total}`} sub={`${stats.avgProgress}% średnio`} color="text-emerald-400" />
        <KpiCard icon={<TrendingUp className="w-4 h-4" />} label="ETA" value={`${stats.totalEta} min`} sub="pozostało" color="text-purple-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4" />Statusy etapów</CardTitle>
            <CardDescription className="text-xs">Rozkład kroków według stanu wykonania</CardDescription>
          </CardHeader>
          <CardContent>
            {statusPie.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-12">Brak kroków do wyświetlenia</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={statusPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40} paddingAngle={2}>
                    {statusPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Avg progress radial */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4" />Postęp średni</CardTitle>
            <CardDescription className="text-xs">% ukończenia wszystkich kroków zlecenia</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="95%" data={progressRadial} startAngle={90} endAngle={-270}>
                <RadialBar dataKey="value" cornerRadius={10} background={{ fill: "hsl(var(--muted))" } as any} />
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground" style={{ fontSize: 32, fontWeight: 700 }}>
                  {stats.avgProgress}%
                </text>
              </RadialBarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Worker load */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Bot className="w-4 h-4" />Obciążenie botów (top 8)</CardTitle>
            <CardDescription className="text-xs">Aktywne zadania, ukończone i błędy per worker</CardDescription>
          </CardHeader>
          <CardContent>
            {workerLoad.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-12">Brak aktywnych botów</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={workerLoad}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="running" stackId="a" fill={STATUS_COLORS.running} name="W trakcie" />
                  <Bar dataKey="done" stackId="a" fill={STATUS_COLORS.done} name="Ukończone (lifetime)" />
                  <Bar dataKey="failed" stackId="a" fill={STATUS_COLORS.failed} name="Błędy" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Throughput */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4" />Przepustowość — ostatnie 12h</CardTitle>
            <CardDescription className="text-xs">Liczba ukończonych kroków w czasie</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="done" stroke="hsl(217 91% 60%)" strokeWidth={2} dot={{ r: 3 }} name="Ukończone kroki" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-end">
        <Badge variant="outline" className="gap-1 text-[10px]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live • auto-refresh 5s
        </Badge>
      </div>
    </div>
  );
};

const KpiCard = ({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string | number; sub: string; color: string }) => (
  <Card>
    <CardContent className="p-4">
      <div className={`flex items-center gap-2 ${color}`}>{icon}<span className="text-[10px] uppercase tracking-wide">{label}</span></div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </CardContent>
  </Card>
);
