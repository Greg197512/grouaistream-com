import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Users, Briefcase, Send, RefreshCw, Crown, ShieldCheck, GraduationCap, Sparkles, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";

interface Rank { id: string; code: string; name: string; level: number; max_concurrent_jobs: number; can_delegate: boolean; color_hex: string; description: string | null; }
interface Worker {
  id: string; display_name: string; domain: string; scopes: string[]; status: string;
  is_busy: boolean; current_jobs: number; total_completed: number; total_failed: number;
  workflow_id: string; rank_code: string | null; rank_name: string | null; rank_level: number | null;
  max_concurrent_jobs: number | null; color_hex: string | null; active_jobs: number;
}
interface Job {
  id: string; scope: string; domain: string; status: string; priority: number;
  attempts: number; max_attempts: number; locked_by: string | null; created_at: string;
  finished_at: string | null; error_message: string | null;
}

const DOMAINS = [
  { value: "aurora", label: "Aurora — klienci & nisze" },
  { value: "stream.moderation", label: "GrouAI Stream — moderacja & uploady" },
  { value: "stream.marketing", label: "GrouAI Stream — marketing & SEO" },
  { value: "stream.support", label: "GrouAI Stream — wsparcie" },
];

const rankIcon = (level: number | null) => {
  if (!level) return <Sparkles className="w-3 h-3" />;
  if (level >= 90) return <Crown className="w-3 h-3" />;
  if (level >= 60) return <ShieldCheck className="w-3 h-3" />;
  return <GraduationCap className="w-3 h-3" />;
};

const jobStatusColor = (s: string) => {
  if (s === "done") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  if (s === "running") return "bg-blue-500/20 text-blue-300 border-blue-500/40";
  if (s === "locked") return "bg-amber-500/20 text-amber-300 border-amber-500/40";
  if (s === "failed") return "bg-red-500/20 text-red-300 border-red-500/40";
  return "bg-muted text-muted-foreground border-border";
};

export const AuroraWorkforceDesk = () => {
  const [loading, setLoading] = useState(true);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [workflows, setWorkflows] = useState<{ id: string; workflow_id: string; name: string }[]>([]);

  // Form: dodaj pracownika z istniejącego workflowa
  const [newWorker, setNewWorker] = useState({ workflow_id: "", display_name: "", domain: "aurora", rank_code: "specialist", scopes: "" });
  // Form: zleć zadanie
  const [newJob, setNewJob] = useState({ scope: "stream.moderation.upload", payload: '{"track_id":""}', priority: "100" });

  const load = useCallback(async () => {
    setLoading(true);
    const [r1, r2, r3, r4] = await Promise.all([
      supabase.from("aurora_worker_ranks").select("*").order("level", { ascending: true }),
      supabase.from("aurora_workforce_overview").select("*").order("rank_level", { ascending: false }),
      supabase.from("aurora_workforce_jobs").select("*").order("created_at", { ascending: false }).limit(80),
      supabase.from("aurora_n8n_workflows").select("id, workflow_id, name").eq("enabled", true),
    ]);
    if (r1.data) setRanks(r1.data as any);
    if (r2.data) setWorkers(r2.data as any);
    if (r3.data) setJobs(r3.data as any);
    if (r4.data) setWorkflows(r4.data as any);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addWorker = async () => {
    if (!newWorker.workflow_id || !newWorker.display_name) { toast.error("Wybierz workflow i nazwę"); return; }
    const wf = workflows.find(w => w.workflow_id === newWorker.workflow_id);
    const rank = ranks.find(r => r.code === newWorker.rank_code);
    const scopes = newWorker.scopes.split(",").map(s => s.trim()).filter(Boolean);
    if (scopes.length === 0) scopes.push(`${newWorker.domain}.*`);
    const { error } = await supabase.from("aurora_workers").insert({
      workflow_db_id: wf?.id ?? null,
      workflow_id: newWorker.workflow_id,
      display_name: newWorker.display_name,
      domain: newWorker.domain,
      rank_id: rank?.id ?? null,
      scopes,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success(`Zatrudniono ${newWorker.display_name}`);
    setNewWorker({ workflow_id: "", display_name: "", domain: "aurora", rank_code: "specialist", scopes: "" });
    load();
  };

  const promoteWorker = async (workerId: string, rankId: string) => {
    const { error } = await supabase.from("aurora_workers").update({ rank_id: rankId } as any).eq("id", workerId);
    if (error) toast.error(error.message); else { toast.success("Zaktualizowano rangę"); load(); }
  };

  const toggleStatus = async (w: Worker) => {
    const next = w.status === "active" ? "paused" : "active";
    const { error } = await supabase.from("aurora_workers").update({ status: next } as any).eq("id", w.id);
    if (error) toast.error(error.message); else { toast.success(next === "active" ? "Wznowiono" : "Wstrzymano"); load(); }
  };

  const fireWorker = async (w: Worker) => {
    if (!confirm(`Zwolnić ${w.display_name}?`)) return;
    const { error } = await supabase.from("aurora_workers").update({ status: "fired" } as any).eq("id", w.id);
    if (error) toast.error(error.message); else { toast.success("Zwolniony"); load(); }
  };

  const enqueueJob = async () => {
    let payload: any = {};
    try { payload = JSON.parse(newJob.payload || "{}"); } catch { toast.error("Błędny JSON payload"); return; }
    const { data, error } = await supabase.functions.invoke("aurora-workforce-dispatch", {
      body: { action: "enqueue", scope: newJob.scope, payload, priority: Number(newJob.priority) || 100 },
    });
    if (error || !(data as any)?.ok) { toast.error(error?.message ?? "Nie zlecono"); return; }
    toast.success("Zadanie w kolejce");
    load();
  };

  const dispatchNow = async () => {
    const { data, error } = await supabase.functions.invoke("aurora-workforce-dispatch", {
      body: { action: "dispatch", limit: 10 },
    });
    if (error) { toast.error(error.message); return; }
    const count = (data as any)?.dispatched_count ?? 0;
    toast.success(count > 0 ? `Rozdzielono ${count} zadań` : "Brak pasujących zadań");
    load();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const pendingJobs = jobs.filter(j => j.status === "pending").length;
  const runningJobs = jobs.filter(j => ["locked", "running"].includes(j.status)).length;
  const activeWorkers = workers.filter(w => w.status === "active").length;
  const busyWorkers = workers.filter(w => w.is_busy).length;

  return (
    <div className="space-y-4">
      {/* KPI */}
      <div className="grid md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{activeWorkers}</div><div className="text-xs text-muted-foreground">aktywni pracownicy</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-blue-400">{busyWorkers}</div><div className="text-xs text-muted-foreground">zajęci teraz</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-amber-400">{pendingJobs}</div><div className="text-xs text-muted-foreground">w kolejce</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-emerald-400">{runningJobs}</div><div className="text-xs text-muted-foreground">w trakcie</div></CardContent></Card>
      </div>

      {/* Akcje */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Briefcase className="w-4 h-4" /> Centrum dyspozycji</CardTitle><CardDescription>Aurora zleca i przydziela zadania pracownikom n8n bez kolizji (lock + routing po scope)</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-4 gap-2">
            <div>
              <Label>Scope zadania</Label>
              <Input value={newJob.scope} onChange={e => setNewJob({ ...newJob, scope: e.target.value })} placeholder="np. stream.moderation.upload" />
            </div>
            <div className="md:col-span-2">
              <Label>Payload (JSON)</Label>
              <Input value={newJob.payload} onChange={e => setNewJob({ ...newJob, payload: e.target.value })} />
            </div>
            <div>
              <Label>Priorytet</Label>
              <Input type="number" value={newJob.priority} onChange={e => setNewJob({ ...newJob, priority: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={enqueueJob} className="gap-2"><Send className="w-4 h-4" />Zleć zadanie</Button>
            <Button onClick={dispatchNow} variant="secondary" className="gap-2"><PlayCircle className="w-4 h-4" />Rozdziel teraz</Button>
            <Button onClick={load} variant="outline" className="gap-2"><RefreshCw className="w-4 h-4" />Odśwież</Button>
          </div>
        </CardContent>
      </Card>

      {/* Zatrudnij pracownika */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="w-4 h-4" /> Zatrudnij pracownika z workflowa n8n</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-5 gap-2">
            <div>
              <Label>Workflow n8n</Label>
              <Select value={newWorker.workflow_id} onValueChange={v => setNewWorker({ ...newWorker, workflow_id: v })}>
                <SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger>
                <SelectContent>{workflows.map(w => <SelectItem key={w.workflow_id} value={w.workflow_id}>{w.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Imię/nazwa</Label>
              <Input value={newWorker.display_name} onChange={e => setNewWorker({ ...newWorker, display_name: e.target.value })} placeholder="np. SEO-Senior #1" />
            </div>
            <div>
              <Label>Domena</Label>
              <Select value={newWorker.domain} onValueChange={v => setNewWorker({ ...newWorker, domain: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DOMAINS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ranga</Label>
              <Select value={newWorker.rank_code} onValueChange={v => setNewWorker({ ...newWorker, rank_code: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ranks.map(r => <SelectItem key={r.code} value={r.code}>{r.name} (lvl {r.level})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Scopes (po przecinku)</Label>
              <Input value={newWorker.scopes} onChange={e => setNewWorker({ ...newWorker, scopes: e.target.value })} placeholder="np. stream.moderation.upload, stream.moderation.cover" />
            </div>
          </div>
          <Button onClick={addWorker} className="gap-2"><Sparkles className="w-4 h-4" />Zatrudnij</Button>
          <p className="text-xs text-muted-foreground">Pusta lista scope → pracownik dostaje cały zakres swojej domeny ({newWorker.domain}.*)</p>
        </CardContent>
      </Card>

      {/* Pracownicy */}
      <Card>
        <CardHeader><CardTitle>Pracownicy ({workers.length})</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="h-[420px]">
            <div className="space-y-2">
              {workers.map(w => (
                <div key={w.id} className="border rounded-lg p-3 space-y-2" style={{ borderColor: w.color_hex ?? undefined }}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="gap-1" style={{ borderColor: w.color_hex ?? undefined, color: w.color_hex ?? undefined }}>
                        {rankIcon(w.rank_level)} {w.rank_name ?? "—"}
                      </Badge>
                      <span className="font-semibold">{w.display_name}</span>
                      <Badge variant="secondary" className="text-xs">{w.domain}</Badge>
                      {w.is_busy && <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 text-xs">zajęty {w.current_jobs}/{w.max_concurrent_jobs ?? 1}</Badge>}
                      {w.status !== "active" && <Badge variant="destructive" className="text-xs">{w.status}</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value="" onValueChange={(rankId) => promoteWorker(w.id, rankId)}>
                        <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Awansuj…" /></SelectTrigger>
                        <SelectContent>{ranks.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button size="sm" variant="outline" onClick={() => toggleStatus(w)}>{w.status === "active" ? "Pauza" : "Wznów"}</Button>
                      <Button size="sm" variant="ghost" className="text-red-400" onClick={() => fireWorker(w)}>Zwolnij</Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {w.scopes.map(s => <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>)}
                  </div>
                  <div className="text-xs text-muted-foreground flex gap-3">
                    <span>✓ {w.total_completed}</span>
                    <span>✗ {w.total_failed}</span>
                    <span>aktywne: {w.active_jobs}</span>
                    <span className="font-mono opacity-60">wf: {w.workflow_id}</span>
                  </div>
                </div>
              ))}
              {workers.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Aurora nikogo jeszcze nie zatrudniła. Dodaj pracownika powyżej 👆</p>}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Kolejka zadań */}
      <Card>
        <CardHeader><CardTitle>Kolejka zadań ({jobs.length})</CardTitle><CardDescription>Najnowsze 80 — z lockiem (SKIP LOCKED) bez kolizji</CardDescription></CardHeader>
        <CardContent>
          <ScrollArea className="h-[360px]">
            <div className="space-y-1">
              {jobs.map(j => (
                <div key={j.id} className="text-xs border rounded p-2 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge className={jobStatusColor(j.status)}>{j.status}</Badge>
                    <span className="font-mono">{j.scope}</span>
                    <span className="text-muted-foreground">prio {j.priority}</span>
                    <span className="text-muted-foreground">próby {j.attempts}/{j.max_attempts}</span>
                  </div>
                  <div className="text-muted-foreground">
                    {formatDistanceToNow(new Date(j.created_at), { addSuffix: true, locale: pl })}
                  </div>
                  {j.error_message && <div className="w-full text-red-400 text-[10px]">{j.error_message}</div>}
                </div>
              ))}
              {jobs.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Brak zadań w kolejce</p>}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
