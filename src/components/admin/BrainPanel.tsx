import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, Activity, Lightbulb, Cpu, RefreshCw, Loader2, CheckCircle2, XCircle, Zap, HeartPulse, AlertTriangle, Sparkles, Infinity as InfinityIcon, Shield, Database, Megaphone, Radio, Music, Code } from "lucide-react";
import { AuroraPanel } from "./AuroraPanel";
import { SingularityPanel } from "@/components/dashboard/SingularityPanel";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";

interface AgentEvent {
  id: string;
  created_at: string;
  event_type: string;
  source: string;
  actor_user_id: string | null;
  target_type: string | null;
  payload: any;
  processed_by_brain: boolean;
  priority: number;
}

interface BrainMemory {
  id: string;
  created_at: string;
  memory_type: string;
  title: string;
  summary: string | null;
  importance: number;
  expires_at: string | null;
}

interface AgentDecision {
  id: string;
  created_at: string;
  agent_name: string;
  decision_type: string;
  reasoning: string | null;
  action_taken: any;
  executed: boolean;
  rejected: boolean;
}

interface AgentRegistry {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  cron_schedule: string | null;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
  success_count: number;
  error_count: number;
}

const memoryTypeColor: Record<string, string> = {
  trend: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  decision: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  user_insight: "bg-green-500/20 text-green-300 border-green-500/40",
  platform_insight: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  anomaly: "bg-red-500/20 text-red-300 border-red-500/40",
  external_signal: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
};

export const BrainPanel = () => {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [memory, setMemory] = useState<BrainMemory[]>([]);
  const [decisions, setDecisions] = useState<AgentDecision[]>([]);
  const [agents, setAgents] = useState<AgentRegistry[]>([]);
  const [loading, setLoading] = useState(true);
  const [thinking, setThinking] = useState(false);

  const loadAll = useCallback(async () => {
    const [ev, mem, dec, ag] = await Promise.all([
      supabase.from("agent_events").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("brain_memory").select("*").order("created_at", { ascending: false }).limit(30),
      supabase.from("agent_decisions").select("*").order("created_at", { ascending: false }).limit(30),
      supabase.from("agent_registry").select("*").order("name"),
    ]);
    setEvents((ev.data as AgentEvent[]) || []);
    setMemory((mem.data as BrainMemory[]) || []);
    setDecisions((dec.data as AgentDecision[]) || []);
    setAgents((ag.data as AgentRegistry[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();

    const evChannel = supabase
      .channel("brain-events-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "agent_events" }, () => loadAll())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "brain_memory" }, () => loadAll())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "agent_decisions" }, () => loadAll())
      .subscribe();

    return () => { supabase.removeChannel(evChannel); };
  }, [loadAll]);

  const triggerBrain = async () => {
    setThinking(true);
    try {
      // Nowy, DARMOWY mózg działa w bazie (pg_cron + Pollinations). Ten przycisk
      // wywołuje ręczny tick; wnioski pojawią się w zakładce „Pamięć" po ~1 min.
      const { error } = await supabase.rpc("brain_run_now");
      if (error) throw error;
      toast.success("🧠 Mózg dostał sygnał — analizuje świeże zdarzenia. Wnioski pojawią się w zakładce Pamięć w ~1 min.");
      setTimeout(loadAll, 9000);
    } catch (e: any) {
      toast.error(`Błąd Mózgu: ${e.message || "nieznany"}. (Mózg i tak myśli automatycznie co 10 min.)`);
    } finally {
      setThinking(false);
    }
  };

  const toggleAgent = async (agent: AgentRegistry) => {
    const { error } = await supabase
      .from("agent_registry")
      .update({ enabled: !agent.enabled })
      .eq("id", agent.id);
    if (error) toast.error(error.message);
    else {
      toast.success(`${agent.name} ${!agent.enabled ? "włączony" : "wyłączony"}`);
      loadAll();
    }
  };

  const executeDecision = async (id: string) => {
    const { error } = await supabase
      .from("agent_decisions")
      .update({ executed: true, executed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Decyzja zatwierdzona ✓"); loadAll(); }
  };

  const rejectDecision = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("agent_decisions")
      .update({ rejected: true, rejected_at: new Date().toISOString(), rejected_by: user?.id })
      .eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Decyzja odrzucona"); loadAll(); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const unprocessed = events.filter((e) => !e.processed_by_brain).length;
  const pendingDecisions = decisions.filter((d) => !d.executed && !d.rejected).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-7 w-7 text-primary" /> Mózg GrouAI
          </h2>
          <p className="text-sm text-muted-foreground">
            Centralny system reasoningu — eventy, pamięć, decyzje agentów. Tick co 10 min automatycznie.
            <span className="ml-2 inline-flex items-center gap-1 text-emerald-400 font-medium">● silnik: darmowy (Pollinations)</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadAll}>
            <RefreshCw className="h-4 w-4 mr-1" /> Odśwież
          </Button>
          <Button onClick={triggerBrain} disabled={thinking}>
            {thinking ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />}
            Każ Mózgowi przemyśleć
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-6">
          <div className="text-2xl font-bold">{events.length}</div>
          <div className="text-xs text-muted-foreground">eventów (ostatnie 50)</div>
          {unprocessed > 0 && <Badge className="mt-1" variant="outline">{unprocessed} czeka</Badge>}
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="text-2xl font-bold">{memory.length}</div>
          <div className="text-xs text-muted-foreground">wspomnień Mózgu</div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="text-2xl font-bold">{decisions.length}</div>
          <div className="text-xs text-muted-foreground">decyzji</div>
          {pendingDecisions > 0 && <Badge className="mt-1" variant="outline">{pendingDecisions} pending</Badge>}
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="text-2xl font-bold">{agents.filter((a) => a.enabled).length}/{agents.length}</div>
          <div className="text-xs text-muted-foreground">aktywnych agentów</div>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="os" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="os"><Brain className="h-4 w-4 mr-1" /> Przegląd OS</TabsTrigger>
          <TabsTrigger value="events"><Activity className="h-4 w-4 mr-1" /> Puls platformy</TabsTrigger>
          <TabsTrigger value="memory"><Lightbulb className="h-4 w-4 mr-1" /> Pamięć</TabsTrigger>
          <TabsTrigger value="decisions"><Brain className="h-4 w-4 mr-1" /> Decyzje</TabsTrigger>
          <TabsTrigger value="agents"><Cpu className="h-4 w-4 mr-1" /> Agenci</TabsTrigger>
          <TabsTrigger value="health"><HeartPulse className="h-4 w-4 mr-1" /> Zdrowie</TabsTrigger>
          <TabsTrigger value="aurora"><Sparkles className="h-4 w-4 mr-1" /> Aurora</TabsTrigger>
          <TabsTrigger value="singularity"><InfinityIcon className="h-4 w-4 mr-1" /> Osobliwość</TabsTrigger>
        </TabsList>

        <TabsContent value="os">
          <OSOverview agents={agents} memory={memory} decisions={decisions} events={events} />
        </TabsContent>

        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Live feed eventów</CardTitle>
              <CardDescription>Każde zdarzenie z platformy. Realtime przez Supabase.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {events.map((e) => (
                    <div key={e.id} className="text-xs border border-border rounded p-2 bg-card/50">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={e.processed_by_brain ? "secondary" : "default"}>
                          {e.event_type}
                        </Badge>
                        <span className="text-muted-foreground">{e.source}</span>
                        <span className="text-muted-foreground">P{e.priority}</span>
                        <span className="text-muted-foreground ml-auto">
                          {formatDistanceToNow(new Date(e.created_at), { addSuffix: true, locale: pl })}
                        </span>
                      </div>
                      {e.payload && Object.keys(e.payload).length > 0 && (
                        <pre className="mt-1 text-[10px] text-muted-foreground overflow-x-auto">
                          {JSON.stringify(e.payload, null, 0).slice(0, 200)}
                        </pre>
                      )}
                    </div>
                  ))}
                  {events.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">Brak eventów. Mózg czeka na pierwszy puls.</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="memory">
          <Card>
            <CardHeader>
              <CardTitle>Co Mózg zapamiętał</CardTitle>
              <CardDescription>Długoterminowa pamięć z embeddingami. Im wyższe importance, tym częściej Mózg z tego korzysta.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {memory.map((m) => (
                    <div key={m.id} className="border border-border rounded p-3 bg-card/50">
                      <div className="flex items-start gap-2 flex-wrap mb-1">
                        <Badge variant="outline" className={memoryTypeColor[m.memory_type] || ""}>{m.memory_type}</Badge>
                        <Badge variant="secondary">★ {m.importance}/10</Badge>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: pl })}
                        </span>
                      </div>
                      <div className="font-semibold text-sm">{m.title}</div>
                      {m.summary && <div className="text-xs text-muted-foreground mt-1">{m.summary}</div>}
                      {m.expires_at && (
                        <div className="text-[10px] text-muted-foreground mt-1">
                          wygasa: {new Date(m.expires_at).toLocaleDateString("pl")}
                        </div>
                      )}
                    </div>
                  ))}
                  {memory.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">Mózg jeszcze niczego nie zapamiętał.</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="decisions">
          <Card>
            <CardHeader>
              <CardTitle>Decyzje agentów</CardTitle>
              <CardDescription>Zatwierdź lub odrzuć propozycje Mózgu.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {decisions.map((d) => (
                    <div key={d.id} className="border border-border rounded p-3 bg-card/50">
                      <div className="flex items-start gap-2 flex-wrap mb-1">
                        <Badge>{d.agent_name}</Badge>
                        <Badge variant="outline">{d.decision_type}</Badge>
                        {d.executed && <Badge variant="secondary"><CheckCircle2 className="h-3 w-3 mr-1" /> wykonane</Badge>}
                        {d.rejected && <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> odrzucone</Badge>}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {formatDistanceToNow(new Date(d.created_at), { addSuffix: true, locale: pl })}
                        </span>
                      </div>
                      {d.reasoning && <div className="text-sm mt-1">{d.reasoning}</div>}
                      {d.action_taken && Object.keys(d.action_taken).length > 0 && (
                        <pre className="mt-1 text-[10px] text-muted-foreground overflow-x-auto bg-muted/30 p-2 rounded">
                          {JSON.stringify(d.action_taken, null, 2)}
                        </pre>
                      )}
                      {!d.executed && !d.rejected && (
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" onClick={() => executeDecision(d.id)}>Wykonaj</Button>
                          <Button size="sm" variant="outline" onClick={() => rejectDecision(d.id)}>Odrzuć</Button>
                        </div>
                      )}
                    </div>
                  ))}
                  {decisions.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">Brak decyzji do podjęcia.</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents">
          <Card>
            <CardHeader>
              <CardTitle>Rejestr agentów</CardTitle>
              <CardDescription>Włącz/wyłącz każdego agenta. Status pokazuje ostatni run.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {agents.map((a) => (
                  <div key={a.id} className="flex items-center justify-between border border-border rounded p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{a.name}</span>
                        {a.cron_schedule && <Badge variant="outline" className="text-[10px]">cron: {a.cron_schedule}</Badge>}
                        {a.last_status === "ok" && <Badge variant="secondary" className="text-[10px]">✓ {a.success_count}</Badge>}
                        {a.last_status === "error" && <Badge variant="destructive" className="text-[10px]">✗ {a.error_count}</Badge>}
                      </div>
                      {a.description && <div className="text-xs text-muted-foreground mt-1">{a.description}</div>}
                      {a.last_run_at && (
                        <div className="text-[10px] text-muted-foreground mt-1">
                          ostatnio: {formatDistanceToNow(new Date(a.last_run_at), { addSuffix: true, locale: pl })}
                          {a.last_error && <span className="text-destructive ml-2">— {a.last_error.slice(0, 80)}</span>}
                        </div>
                      )}
                    </div>
                    <Button variant={a.enabled ? "default" : "outline"} size="sm" onClick={() => toggleAgent(a)}>
                      {a.enabled ? "ON" : "OFF"}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="health">
          <HealthSnapshotCard events={events} />
        </TabsContent>
        <TabsContent value="aurora">
          <AuroraPanel />
        </TabsContent>
        <TabsContent value="singularity">
          <SingularityPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ─── Przegląd OS (piramida agentów) ─────────────────────────────────
const agentMeta = (name: string): { role: string; icon: React.ElementType } => {
  if (name === "grouai-brain") return { role: "Orchestrator", icon: Brain };
  if (name.includes("security")) return { role: "Security", icon: Shield };
  if (name.includes("data") || name.includes("revenue") || name.includes("scout")) return { role: "Data", icon: Database };
  if (name.includes("marketing") || name.includes("blog") || name.includes("social")) return { role: "Marketing", icon: Megaphone };
  if (name.includes("health") || name.includes("monitor")) return { role: "Health", icon: HeartPulse };
  if (name.includes("radio") || name.includes("music") || name.includes("story")) return { role: "Media", icon: Radio };
  if (name.includes("dev") || name.includes("build") || name.includes("test")) return { role: "Dev", icon: Code };
  return { role: "Agent", icon: Cpu };
};

const statusDot = (a: AgentRegistry) => {
  if (!a.enabled) return "bg-muted-foreground/40";
  if (a.last_status === "error") return "bg-red-500";
  if (a.last_status === "ok" || a.last_status === "sent") return "bg-emerald-500";
  if (a.last_status === "alerts" || a.last_status === "idle") return "bg-amber-500";
  return "bg-sky-500";
};

const OSOverview = ({ agents, memory, decisions, events }: {
  agents: AgentRegistry[]; memory: BrainMemory[]; decisions: AgentDecision[]; events: AgentEvent[];
}) => {
  const brain = agents.find((a) => a.name === "grouai-brain");
  const others = agents.filter((a) => a.name !== "grouai-brain");
  const brainFresh = brain?.last_run_at && (Date.now() - new Date(brain.last_run_at).getTime()) < 20 * 60 * 1000;
  const topInsights = [...memory].sort((a, b) => b.importance - a.importance).slice(0, 4);

  const AgentChip = ({ a }: { a: AgentRegistry }) => {
    const { role, icon: Icon } = agentMeta(a.name);
    return (
      <div className="rounded-xl border border-border bg-card/60 p-3 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${statusDot(a)} ${a.enabled && a.last_status !== "error" ? "animate-pulse" : ""}`} />
          <Icon className="h-4 w-4 text-primary shrink-0" />
          <span className="font-semibold text-sm truncate">{a.name}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className="text-[9px]">{role}</Badge>
          {a.cron_schedule && <span className="text-[9px] text-muted-foreground font-mono">{a.cron_schedule}</span>}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {a.last_run_at ? `ost. ${formatDistanceToNow(new Date(a.last_run_at), { addSuffix: true, locale: pl })}` : "jeszcze nie uruchomiony"}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Orchestrator */}
      <Card className="border-primary/40 bg-gradient-to-br from-primary/10 to-transparent">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center">
                <Brain className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="font-bold text-lg leading-tight">GrouaAI OS — Orchestrator</div>
                <div className="text-xs text-muted-foreground">Mózg deleguje agentów, pisze pamięć. Tick co 10 min.</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${brainFresh ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" : "text-amber-400 border-amber-500/40 bg-amber-500/10"}`}>
                <span className={`h-2 w-2 rounded-full ${brainFresh ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                {brainFresh ? "żywy" : "uśpiony"}
              </span>
              <span className="text-[10px] text-emerald-400 font-medium">silnik: darmowy</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Wyspecjalizowani agenci */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
          Wyspecjalizowani agenci ({others.filter((a) => a.enabled).length}/{others.length} aktywnych)
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {others.map((a) => <AgentChip key={a.id} a={a} />)}
        </div>
      </div>

      {/* Pamięć / wiedza */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4 text-primary" /> Pamięć i wiedza</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><div className="text-xl font-bold">{memory.length}</div><div className="text-[10px] text-muted-foreground">wspomnień</div></div>
              <div><div className="text-xl font-bold">{decisions.length}</div><div className="text-[10px] text-muted-foreground">decyzji</div></div>
              <div><div className="text-xl font-bold">{events.filter((e) => e.processed_by_brain).length}</div><div className="text-[10px] text-muted-foreground">przetworzonych</div></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Lightbulb className="h-4 w-4 text-primary" /> Najświeższe wnioski mózgu</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {topInsights.map((m) => (
                <div key={m.id} className="text-xs flex items-start gap-2">
                  <Badge variant="secondary" className="text-[9px] shrink-0">★{m.importance}</Badge>
                  <span className="truncate">{m.title}</span>
                </div>
              ))}
              {topInsights.length === 0 && <p className="text-xs text-muted-foreground">Mózg jeszcze nic nie zapisał.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// ─── Health snapshot panel ──────────────────────────────────────────
const HealthSnapshotCard = ({ events }: { events: AgentEvent[] }) => {
  const lastSnapshot = events.find((e) => e.event_type === "health.snapshot");
  const recentAlerts = events
    .filter((e) => e.event_type.startsWith("alert."))
    .slice(0, 10);
  const lastRevenue = events.find((e) => e.event_type === "revenue.report");

  if (!lastSnapshot) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Zdrowie systemu</CardTitle>
          <CardDescription>Health-monitor jeszcze nie wystartował (cron co 5 min).</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Czekam na pierwszy heartbeat...</p>
        </CardContent>
      </Card>
    );
  }

  const snap = lastSnapshot.payload || {};
  const pings: Array<{ fn: string; ok: boolean; status: number; ms: number }> = snap.pings || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-primary" /> Ostatni heartbeat
          </CardTitle>
          <CardDescription>
            {formatDistanceToNow(new Date(lastSnapshot.created_at), { addSuffix: true, locale: pl })} • cykl {snap.duration_ms}ms
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="border border-border rounded p-2">
              <div className="text-xs text-muted-foreground">Down</div>
              <div className={`text-xl font-bold ${snap.down_count > 0 ? "text-destructive" : ""}`}>{snap.down_count ?? 0}</div>
            </div>
            <div className="border border-border rounded p-2">
              <div className="text-xs text-muted-foreground">Slow</div>
              <div className={`text-xl font-bold ${snap.slow_count > 0 ? "text-orange-400" : ""}`}>{snap.slow_count ?? 0}</div>
            </div>
            <div className="border border-border rounded p-2">
              <div className="text-xs text-muted-foreground">Email fail %</div>
              <div className="text-xl font-bold">
                {snap.email?.failure_rate != null
                  ? `${(snap.email.failure_rate * 100).toFixed(1)}%`
                  : "—"}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {snap.email?.failed_1h ?? 0}/{snap.email?.total_1h ?? 0} (1h)
              </div>
            </div>
            <div className="border border-border rounded p-2">
              <div className="text-xs text-muted-foreground">Payouty &gt;7d</div>
              <div className={`text-xl font-bold ${(snap.overdue_payouts ?? 0) > 0 ? "text-destructive" : ""}`}>
                {snap.overdue_payouts ?? 0}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {pings.map((p) => (
              <div
                key={p.fn}
                className={`text-xs border rounded p-2 ${
                  !p.ok ? "border-destructive/50 bg-destructive/10" : p.ms > 3000 ? "border-orange-500/50 bg-orange-500/10" : "border-border bg-card/50"
                }`}
              >
                <div className="font-mono truncate">{p.fn}</div>
                <div className="text-muted-foreground flex items-center gap-1">
                  {p.ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  {p.status} • {p.ms}ms
                </div>
              </div>
            ))}
          </div>

          {snap.stale_agents?.length > 0 && (
            <div className="mt-3 p-2 border border-orange-500/40 bg-orange-500/10 rounded text-xs">
              <span className="font-semibold text-orange-300">Stale agents:</span> {snap.stale_agents.join(", ")}
            </div>
          )}
        </CardContent>
      </Card>

      {recentAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-400" /> Ostatnie alarmy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentAlerts.map((a) => (
                <div key={a.id} className="text-xs border border-orange-500/30 bg-orange-500/5 rounded p-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="destructive">{a.event_type}</Badge>
                    <span className="text-muted-foreground ml-auto">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: pl })}
                    </span>
                  </div>
                  {a.payload && (
                    <pre className="mt-1 text-[10px] overflow-x-auto">{JSON.stringify(a.payload, null, 0).slice(0, 300)}</pre>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {lastRevenue && (
        <Card>
          <CardHeader>
            <CardTitle>Ostatni raport finansowy</CardTitle>
            <CardDescription>
              {formatDistanceToNow(new Date(lastRevenue.created_at), { addSuffix: true, locale: pl })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="text-[10px] overflow-x-auto bg-muted/30 p-2 rounded">
              {JSON.stringify(lastRevenue.payload?.snapshot ?? lastRevenue.payload, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
