import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Rocket, Target, Trash2, RefreshCw, Briefcase, Workflow, PlayCircle, Plus, ExternalLink, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";


interface Niche {
  id: string; niche_name: string; status: string; opportunity_score: number | null;
  search_volume_estimate: number; competition_level: string;
  estimated_monthly_revenue_eur: number; launched_url: string | null; launched_at: string | null;
}
interface Order {
  id: string; service_type: string; brief: string; status: string;
  client_email: string | null; client_company: string | null;
  budget_eur: number; created_at: string; result_url: string | null;
  ai_plan: any; result: any;
}
interface Workflow {
  id: string; workflow_id: string; name: string; service_type: string | null;
  webhook_url: string | null; enabled: boolean; auto_assign: boolean;
  total_runs: number; total_success: number; total_failed: number;
}

const SERVICE_TYPES = [
  { value: "seo_audit", label: "Audyt SEO" },
  { value: "seo_content", label: "Treść SEO" },
  { value: "landing_page", label: "Landing page" },
  { value: "social_post", label: "Posty social" },
  { value: "automation_flow", label: "Automatyzacja n8n" },
  { value: "lead_research", label: "Lead research" },
  { value: "other", label: "Inne" },
];

const statusColor = (s: string) => {
  if (s === "completed") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  if (s === "in_progress") return "bg-blue-500/20 text-blue-300 border-blue-500/40";
  if (s === "failed") return "bg-red-500/20 text-red-300 border-red-500/40";
  if (s === "planned") return "bg-purple-500/20 text-purple-300 border-purple-500/40";
  if (s === "launched") return "bg-orange-500/20 text-orange-300 border-orange-500/40";
  return "bg-muted text-muted-foreground";
};

export default function AdminAurora() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [niches, setNiches] = useState<Niche[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  // New order form
  const [newOrder, setNewOrder] = useState({ service_type: "seo_content", brief: "", client_email: "", client_company: "", budget_eur: 0 });
  // New workflow form
  const [newWf, setNewWf] = useState({ workflow_id: "", name: "", service_type: "seo_content", webhook_url: "", auto_assign: true });

  useEffect(() => { document.title = "Aurora Business Desk — Pulpit autonomicznego biznesu"; }, []);

  useEffect(() => {
    (async () => {
      if (!user) { setIsAdmin(false); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      setIsAdmin(!!data);
    })();
  }, [user]);

  const loadAll = useCallback(async () => {
    const [n, o, w] = await Promise.all([
      supabase.from("aurora_niches" as any).select("id,niche_name,status,opportunity_score,search_volume_estimate,competition_level,estimated_monthly_revenue_eur,launched_url,launched_at").order("opportunity_score", { ascending: false }).limit(100),
      supabase.from("aurora_business_orders" as any).select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("aurora_n8n_workflows" as any).select("*").order("created_at", { ascending: false }),
    ]);
    setNiches((n.data as any) || []);
    setOrders((o.data as any) || []);
    setWorkflows((w.data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadAll();
      const ch = supabase.channel("aurora-desk")
        .on("postgres_changes", { event: "*", schema: "public", table: "aurora_business_orders" }, () => loadAll())
        .on("postgres_changes", { event: "*", schema: "public", table: "aurora_niches" }, () => loadAll())
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    }
  }, [isAdmin, loadAll]);

  if (isAdmin === null) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Ładowanie…</div>;
  if (!isAdmin) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Brak dostępu.</div>;

  const runFn = async (key: string, fn: string, body: any = {}, msg = "OK") => {
    setBusy(key);
    try {
      const { data, error } = await supabase.functions.invoke(fn, { body });
      if (error) throw error;
      toast.success(`${msg}: ${JSON.stringify(data).slice(0, 80)}`);
      await loadAll();
    } catch (e: any) { toast.error(`${fn}: ${e.message}`); }
    finally { setBusy(null); }
  };

  const submitOrder = async () => {
    if (!newOrder.brief || newOrder.brief.length < 10) return toast.error("Brief min 10 znaków");
    setBusy("order");
    try {
      const { error } = await supabase.functions.invoke("aurora-business-intake", { body: { ...newOrder, source: "admin_form" } });
      if (error) throw error;
      toast.success("Zlecenie przyjęte przez Aurorę");
      setNewOrder({ service_type: "seo_content", brief: "", client_email: "", client_company: "", budget_eur: 0 });
      await loadAll();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  const executeOrder = async (id: string) => runFn(`exec-${id}`, "aurora-order-execute", { order_id: id }, "Aurora wykonała");

  const addWorkflow = async () => {
    if (!newWf.workflow_id || !newWf.name) return toast.error("Workflow ID i nazwa wymagane");
    const { error } = await supabase.from("aurora_n8n_workflows" as any).insert(newWf);
    if (error) return toast.error(error.message);
    toast.success("Workflow dodany");
    setNewWf({ workflow_id: "", name: "", service_type: "seo_content", webhook_url: "", auto_assign: true });
    await loadAll();
  };

  const toggleWorkflow = async (id: string, field: "enabled" | "auto_assign", value: boolean) => {
    await supabase.from("aurora_n8n_workflows" as any).update({ [field]: value }).eq("id", id);
    await loadAll();
  };

  const launched = niches.filter(n => n.status === "launched");
  const archived = niches.filter(n => n.status === "archived");
  const ranked = niches.filter(n => n.status === "discovered" || n.status === "approved");

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Aurora Business Desk — Pulpit autonomicznego biznesu</title>
        <meta name="description" content="Aurora Business Desk: ranking nisz, autonomiczne wykonywanie zleceń SEO i automatyzacji n8n." />
      </Helmet>

      <div className="border-b border-border/60 bg-card/40 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}><ArrowLeft className="w-4 h-4 mr-1" /> Admin</Button>
            <div>
              <h1 className="text-xl font-bold">Aurora Business Desk</h1>
              <p className="text-xs text-muted-foreground">Pulpit autonomicznego biznesu — nisze, zlecenia, automatyzacje</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => runFn("scan", "aurora-niche-scanner", {}, "Skan")} disabled={!!busy}>
              {busy === "scan" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />} Skan nisz
            </Button>
            <Button size="sm" variant="outline" onClick={() => runFn("prune", "aurora-niche-pruner", {}, "Czyszczenie")} disabled={!!busy}>
              {busy === "prune" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Pruner
            </Button>
            <Button size="sm" variant="outline" onClick={() => runFn("refresh", "aurora-content-refresher", {}, "Odświeżanie")} disabled={!!busy}>
              {busy === "refresh" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh
            </Button>
            <Button size="sm" onClick={() => runFn("auto", "aurora-autopilot", { trigger: "manual" }, "Autopilot")} disabled={!!busy}>
              {busy === "auto" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />} Autopilot
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <Tabs defaultValue="ranking">
            <TabsList className="grid grid-cols-4 w-full max-w-2xl">
              <TabsTrigger value="ranking">Ranking nisz</TabsTrigger>
              <TabsTrigger value="orders">Zlecenia <Badge className="ml-2" variant="secondary">{orders.filter(o => o.status !== "completed").length}</Badge></TabsTrigger>
              <TabsTrigger value="n8n">n8n <Badge className="ml-2" variant="secondary">{workflows.length}</Badge></TabsTrigger>
              <TabsTrigger value="archived">Archiwum</TabsTrigger>
            </TabsList>

            {/* RANKING NISZ */}
            <TabsContent value="ranking" className="mt-4 space-y-3">
              <div className="grid md:grid-cols-3 gap-3 mb-4">
                <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{ranked.length}</div><div className="text-xs text-muted-foreground">w rankingu</div></CardContent></Card>
                <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{launched.length}</div><div className="text-xs text-muted-foreground">aktywne</div></CardContent></Card>
                <Card><CardContent className="pt-6"><div className="text-2xl font-bold">€{launched.reduce((s, n) => s + (Number(n.estimated_monthly_revenue_eur) || 0), 0).toFixed(0)}</div><div className="text-xs text-muted-foreground">est. miesięczny przychód</div></CardContent></Card>
              </div>

              <ScrollArea className="h-[600px]">
                <div className="space-y-2">
                  {[...ranked, ...launched].map(n => (
                    <Card key={n.id}>
                      <CardContent className="pt-4 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold truncate">{n.niche_name}</span>
                            <Badge className={statusColor(n.status)}>{n.status}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground flex gap-3 flex-wrap">
                            <span>📊 score: <strong className="text-foreground">{Number(n.opportunity_score || 0).toFixed(1)}</strong></span>
                            <span>🔍 vol: {n.search_volume_estimate}</span>
                            <span>⚔️ {n.competition_level}</span>
                            <span>💶 €{n.estimated_monthly_revenue_eur}/mies.</span>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {n.launched_url && <Button size="sm" variant="ghost" asChild><a href={n.launched_url} target="_blank" rel="noopener"><ExternalLink className="w-4 h-4" /></a></Button>}
                          {n.status !== "launched" && <Button size="sm" onClick={() => runFn(`launch-${n.id}`, "aurora-launch-niche", { niche_id: n.id }, "Start")} disabled={!!busy}>{busy === `launch-${n.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Rocket className="w-3 h-3" />}</Button>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {ranked.length + launched.length === 0 && <p className="text-center text-muted-foreground py-10">Brak nisz. Uruchom „Skan nisz".</p>}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* ZLECENIA */}
            <TabsContent value="orders" className="mt-4 space-y-4">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="w-4 h-4" /> Nowe zlecenie</CardTitle><CardDescription>Aurora odbiera, planuje i wykonuje autonomicznie</CardDescription></CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-3">
                  <div>
                    <Label>Typ usługi</Label>
                    <select className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" value={newOrder.service_type} onChange={e => setNewOrder({ ...newOrder, service_type: e.target.value })}>
                      {SERVICE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div><Label>Klient (email)</Label><Input value={newOrder.client_email} onChange={e => setNewOrder({ ...newOrder, client_email: e.target.value })} /></div>
                  <div><Label>Firma</Label><Input value={newOrder.client_company} onChange={e => setNewOrder({ ...newOrder, client_company: e.target.value })} /></div>
                  <div><Label>Budżet (EUR)</Label><Input type="number" value={newOrder.budget_eur} onChange={e => setNewOrder({ ...newOrder, budget_eur: Number(e.target.value) })} /></div>
                  <div className="md:col-span-2"><Label>Brief</Label><Textarea rows={4} value={newOrder.brief} onChange={e => setNewOrder({ ...newOrder, brief: e.target.value })} placeholder="Opisz, co klient potrzebuje…" /></div>
                  <div className="md:col-span-2"><Button onClick={submitOrder} disabled={busy === "order"}>{busy === "order" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Briefcase className="w-4 h-4 mr-2" />} Przyjmij + zaplanuj</Button></div>
                </CardContent>
              </Card>

              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {orders.map(o => (
                    <Card key={o.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={statusColor(o.status)}>{o.status}</Badge>
                              <span className="font-semibold">{SERVICE_TYPES.find(s => s.value === o.service_type)?.label || o.service_type}</span>
                              {o.client_company && <span className="text-xs text-muted-foreground">· {o.client_company}</span>}
                              <span className="text-xs text-muted-foreground">· {formatDistanceToNow(new Date(o.created_at), { locale: pl, addSuffix: true })}</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{o.brief}</p>
                            {o.ai_plan?.steps && (
                              <div className="text-xs mt-2 space-y-0.5">
                                {o.ai_plan.steps.slice(0, 3).map((s: any, i: number) => (
                                  <div key={i} className="text-muted-foreground">→ {s.title}</div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-1 shrink-0">
                            {o.status !== "completed" && o.status !== "in_progress" && (
                              <Button size="sm" onClick={() => executeOrder(o.id)} disabled={!!busy}>
                                {busy === `exec-${o.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <PlayCircle className="w-3 h-3" />} Wykonaj
                              </Button>
                            )}
                            {o.result && <Badge variant="outline" className="text-xs">✓ wynik</Badge>}
                          </div>
                        </div>
                        {o.result && (
                          <details className="mt-2">
                            <summary className="text-xs cursor-pointer text-primary">Pokaż wynik Aurory</summary>
                            <pre className="text-xs mt-2 p-2 bg-muted rounded overflow-auto max-h-60">{JSON.stringify(o.result, null, 2)}</pre>
                          </details>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  {orders.length === 0 && <p className="text-center text-muted-foreground py-10">Brak zleceń. Dodaj pierwsze powyżej lub czekaj na webhook.</p>}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* N8N */}
            <TabsContent value="n8n" className="mt-4 space-y-4">
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader><CardTitle className="flex items-center gap-2"><Workflow className="w-4 h-4" /> Webhook Aurora dla n8n</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-2">Wskaż w n8n HTTP Request → POST na ten endpoint, by przekazać Aurorze nowe zlecenie:</p>
                  <code className="block text-xs p-2 bg-background border border-border rounded break-all">
                    {`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/aurora-business-intake`}
                  </code>
                  <p className="text-xs text-muted-foreground mt-2">Body JSON: {`{ service_type, brief, client_email?, client_company?, budget_eur?, payload?, n8n_workflow_id? }`}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Dodaj workflow n8n</CardTitle><CardDescription>Aurora może wywoływać Twoje workflowy (np. publikacja, mailing, scraping)</CardDescription></CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-3">
                  <div><Label>Workflow ID (z n8n)</Label><Input value={newWf.workflow_id} onChange={e => setNewWf({ ...newWf, workflow_id: e.target.value })} /></div>
                  <div><Label>Nazwa</Label><Input value={newWf.name} onChange={e => setNewWf({ ...newWf, name: e.target.value })} /></div>
                  <div>
                    <Label>Typ usługi</Label>
                    <select className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" value={newWf.service_type} onChange={e => setNewWf({ ...newWf, service_type: e.target.value })}>
                      {SERVICE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div><Label>Webhook URL n8n</Label><Input value={newWf.webhook_url} onChange={e => setNewWf({ ...newWf, webhook_url: e.target.value })} placeholder="https://n8n.../webhook/..." /></div>
                  <div className="flex items-center gap-2"><Switch checked={newWf.auto_assign} onCheckedChange={v => setNewWf({ ...newWf, auto_assign: v })} /><Label>Auto-przekazuj zlecenia</Label></div>
                  <div className="md:col-span-2"><Button onClick={addWorkflow}><Plus className="w-4 h-4 mr-2" /> Dodaj</Button></div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                {workflows.map(w => (
                  <Card key={w.id}>
                    <CardContent className="pt-4 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2"><strong>{w.name}</strong><Badge variant="outline">{w.service_type}</Badge></div>
                        <div className="text-xs text-muted-foreground mt-1 truncate">{w.webhook_url}</div>
                        <div className="text-xs mt-1">Runs: {w.total_runs} · ✓ {w.total_success} · ✗ {w.total_failed}</div>
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <div className="flex items-center gap-2 text-xs"><Switch checked={w.enabled} onCheckedChange={v => toggleWorkflow(w.id, "enabled", v)} /><span>aktywny</span></div>
                        <div className="flex items-center gap-2 text-xs"><Switch checked={w.auto_assign} onCheckedChange={v => toggleWorkflow(w.id, "auto_assign", v)} /><span>auto</span></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {workflows.length === 0 && <p className="text-center text-muted-foreground py-6 text-sm">Brak workflowów n8n. Podłącz pierwszy powyżej.</p>}
              </div>
            </TabsContent>

            {/* ARCHIWUM */}
            <TabsContent value="archived" className="mt-4">
              <ScrollArea className="h-[600px]">
                <div className="space-y-2">
                  {archived.map(n => (
                    <Card key={n.id} className="opacity-60">
                      <CardContent className="pt-4 flex items-center justify-between">
                        <div>
                          <div className="font-semibold">{n.niche_name}</div>
                          <div className="text-xs text-muted-foreground">archived · score {Number(n.opportunity_score || 0).toFixed(1)}</div>
                        </div>
                        <Badge variant="outline">archived</Badge>
                      </CardContent>
                    </Card>
                  ))}
                  {archived.length === 0 && <p className="text-center text-muted-foreground py-10">Archiwum puste.</p>}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
