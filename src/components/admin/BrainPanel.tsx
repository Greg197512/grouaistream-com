import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, Activity, Lightbulb, Cpu, RefreshCw, Loader2, CheckCircle2, XCircle, Zap, HeartPulse, AlertTriangle } from "lucide-react";
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
      const { data, error } = await supabase.functions.invoke("grouai-brain", { body: { source: "manual" } });
      if (error) throw error;
      toast.success(`🧠 Mózg przemyślał: ${data?.events_processed || 0} eventów, ${data?.memories_saved || 0} wspomnień, ${data?.decisions_created || 0} decyzji`);
      await loadAll();
    } catch (e: any) {
      toast.error(`Błąd Mózgu: ${e.message || "nieznany"}`);
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
            Centralny system reasoningu — eventy, pamięć, decyzje agentów. Tick co 5 min automatycznie.
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

      <Tabs defaultValue="events" className="w-full">
        <TabsList>
          <TabsTrigger value="events"><Activity className="h-4 w-4 mr-1" /> Puls platformy</TabsTrigger>
          <TabsTrigger value="memory"><Lightbulb className="h-4 w-4 mr-1" /> Pamięć</TabsTrigger>
          <TabsTrigger value="decisions"><Brain className="h-4 w-4 mr-1" /> Decyzje</TabsTrigger>
          <TabsTrigger value="agents"><Cpu className="h-4 w-4 mr-1" /> Agenci</TabsTrigger>
        </TabsList>

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
      </Tabs>
    </div>
  );
};
