// Drzewo planu — wizualizacja workflow jako interaktywne SVG drzewo
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitBranch, Loader2, ZoomIn, ZoomOut, Maximize2, Bot, CheckCircle2, PlayCircle, Clock, AlertCircle } from "lucide-react";

interface Step {
  id: string; step_index: number; title: string; description: string | null;
  scope: string | null; status: string; progress_pct: number; eta_minutes: number | null;
  assigned_worker_id: string | null; workflow_id: string | null; depends_on: string[] | null;
}
interface Worker { id: string; display_name: string; }

const STATUS_FILL: Record<string, string> = {
  done: "hsl(142 76% 50% / 0.15)",
  running: "hsl(217 91% 60% / 0.2)",
  pending: "hsl(220 9% 46% / 0.1)",
  failed: "hsl(0 84% 60% / 0.15)",
  blocked: "hsl(38 92% 50% / 0.15)",
  skipped: "hsl(280 70% 60% / 0.15)",
};
const STATUS_STROKE: Record<string, string> = {
  done: "hsl(142 76% 50%)",
  running: "hsl(217 91% 60%)",
  pending: "hsl(220 9% 46%)",
  failed: "hsl(0 84% 60%)",
  blocked: "hsl(38 92% 50%)",
  skipped: "hsl(280 70% 60%)",
};

export const WorkflowTreePanel = ({ orderId }: { orderId: string }) => {
  const [steps, setSteps] = useState<Step[]>([]);
  const [workers, setWorkers] = useState<Record<string, Worker>>({});
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);

  const load = async () => {
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

  useEffect(() => {
    const ch = supabase.channel(`tree-${orderId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "aurora_order_plan_steps", filter: `order_id=eq.${orderId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orderId]);

  // Layout: poziomy układ drzewa po step_index z grupowaniem po scope
  const layout = useMemo(() => {
    if (steps.length === 0) return { nodes: [], edges: [], width: 0, height: 0 };
    const nodeW = 200, nodeH = 80, gapX = 60, gapY = 40;

    // Grupowanie po scope (column = scope)
    const scopes = Array.from(new Set(steps.map(s => s.scope ?? "default")));
    const colMap: Record<string, number> = {};
    scopes.forEach((sc, i) => { colMap[sc] = i; });

    // W każdej kolumnie liczę pozycję wertykalną
    const rowInCol: Record<string, number> = {};
    const positions: Record<string, { x: number; y: number; col: number; row: number }> = {};
    steps.forEach(s => {
      const sc = s.scope ?? "default";
      const row = (rowInCol[sc] ?? -1) + 1;
      rowInCol[sc] = row;
      positions[s.id] = {
        col: colMap[sc],
        row,
        x: colMap[sc] * (nodeW + gapX) + 20,
        y: row * (nodeH + gapY) + 60,
      };
    });

    const maxRow = Math.max(...Object.values(rowInCol)) + 1;
    const width = scopes.length * (nodeW + gapX) + 40;
    const height = maxRow * (nodeH + gapY) + 80;

    // Krawędzie: po depends_on, jeśli puste — to po step_index sekwencyjnie w obrębie scope
    const edges: { from: string; to: string }[] = [];
    steps.forEach((s, i) => {
      if (s.depends_on && s.depends_on.length > 0) {
        s.depends_on.forEach(dep => {
          if (positions[dep]) edges.push({ from: dep, to: s.id });
        });
      } else if (i > 0) {
        // Sekwencyjnie po step_index
        edges.push({ from: steps[i - 1].id, to: s.id });
      }
    });

    const nodes = steps.map(s => ({ ...s, ...positions[s.id], scopeLabel: s.scope ?? "default" }));
    return { nodes, edges, width, height, scopes };
  }, [steps]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  if (steps.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><GitBranch className="w-5 h-5" />Drzewo planu — pusto</CardTitle>
          <CardDescription>Wygeneruj najpierw mapę działań w zakładce „Mapa", a tutaj zobaczysz graficzne drzewo wykonania.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const selectedNode = layout.nodes.find(n => n.id === selected);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2"><GitBranch className="w-5 h-5" />Drzewo planu</CardTitle>
            <CardDescription>Graficzny workflow — kolumny = obszary, strzałki = zależności. Kliknij węzeł żeby zobaczyć szczegóły.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setZoom(z => Math.max(0.4, z - 0.15))}><ZoomOut className="w-3 h-3" /></Button>
            <Badge variant="outline" className="text-[10px] font-mono">{Math.round(zoom * 100)}%</Badge>
            <Button size="sm" variant="outline" onClick={() => setZoom(z => Math.min(2, z + 0.15))}><ZoomIn className="w-3 h-3" /></Button>
            <Button size="sm" variant="outline" onClick={() => setZoom(1)}><Maximize2 className="w-3 h-3" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div className="flex gap-3 mb-3 flex-wrap text-[10px]">
          {Object.keys(STATUS_STROKE).map(s => (
            <div key={s} className="flex items-center gap-1">
              <span className="w-3 h-3 rounded" style={{ background: STATUS_FILL[s], border: `1px solid ${STATUS_STROKE[s]}` }} />
              <span className="capitalize text-muted-foreground">{s}</span>
            </div>
          ))}
        </div>

        {/* Tree SVG */}
        <div className="overflow-auto border rounded-lg bg-muted/20" style={{ maxHeight: "65vh" }}>
          <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: layout.width, height: layout.height }}>
            <svg width={layout.width} height={layout.height} className="block">
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--muted-foreground))" />
                </marker>
              </defs>

              {/* Scope column headers */}
              {layout.scopes?.map((sc, i) => (
                <g key={sc}>
                  <rect x={i * 260 + 10} y={10} width={220} height={32} rx={6} fill="hsl(var(--card))" stroke="hsl(var(--border))" />
                  <text x={i * 260 + 120} y={31} textAnchor="middle" fill="hsl(var(--foreground))" style={{ fontSize: 11, fontWeight: 600 }}>
                    {sc}
                  </text>
                </g>
              ))}

              {/* Edges */}
              {layout.edges.map((e, i) => {
                const from = layout.nodes.find(n => n.id === e.from);
                const to = layout.nodes.find(n => n.id === e.to);
                if (!from || !to) return null;
                const x1 = from.x + 100, y1 = from.y + 80;
                const x2 = to.x + 100, y2 = to.y;
                const midY = (y1 + y2) / 2;
                return (
                  <path
                    key={i}
                    d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                    fill="none"
                    stroke="hsl(var(--muted-foreground) / 0.5)"
                    strokeWidth={1.5}
                    markerEnd="url(#arrow)"
                  />
                );
              })}

              {/* Nodes */}
              {layout.nodes.map(n => {
                const isSel = selected === n.id;
                const fill = STATUS_FILL[n.status] ?? STATUS_FILL.pending;
                const stroke = STATUS_STROKE[n.status] ?? STATUS_STROKE.pending;
                const worker = n.assigned_worker_id ? workers[n.assigned_worker_id] : null;
                return (
                  <g key={n.id} transform={`translate(${n.x}, ${n.y})`} className="cursor-pointer" onClick={() => setSelected(n.id)}>
                    <rect
                      width={200} height={80} rx={10}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={isSel ? 2.5 : 1.5}
                      className={n.status === "running" ? "animate-pulse" : ""}
                    />
                    <text x={10} y={20} fill="hsl(var(--muted-foreground))" style={{ fontSize: 9, fontFamily: "monospace" }}>
                      #{n.step_index + 1} • {n.status}
                    </text>
                    <text x={10} y={38} fill="hsl(var(--foreground))" style={{ fontSize: 11, fontWeight: 600 }}>
                      {n.title.length > 28 ? n.title.slice(0, 28) + "…" : n.title}
                    </text>
                    {worker && (
                      <text x={10} y={56} fill="hsl(280 70% 70%)" style={{ fontSize: 9 }}>
                        🤖 {worker.display_name.length > 24 ? worker.display_name.slice(0, 24) + "…" : worker.display_name}
                      </text>
                    )}
                    {/* Progress bar */}
                    <rect x={10} y={66} width={180} height={6} rx={3} fill="hsl(var(--muted))" />
                    <rect x={10} y={66} width={180 * (n.progress_pct / 100)} height={6} rx={3} fill={stroke} />
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Detail panel */}
        {selectedNode && (
          <div className="mt-3 p-4 border rounded-lg bg-card space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-semibold text-sm">Etap #{selectedNode.step_index + 1}: {selectedNode.title}</h4>
                {selectedNode.description && (
                  <p className="text-xs text-muted-foreground mt-1">{selectedNode.description}</p>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>×</Button>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px]">
              <Badge style={{ background: STATUS_FILL[selectedNode.status], color: STATUS_STROKE[selectedNode.status], border: `1px solid ${STATUS_STROKE[selectedNode.status]}` }}>
                {selectedNode.status}
              </Badge>
              {selectedNode.scope && <Badge variant="outline" className="font-mono">{selectedNode.scope}</Badge>}
              <Badge variant="secondary">{selectedNode.progress_pct}% ukończone</Badge>
              {selectedNode.eta_minutes != null && <Badge variant="outline">~{selectedNode.eta_minutes} min</Badge>}
              {selectedNode.assigned_worker_id && workers[selectedNode.assigned_worker_id] && (
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 gap-1">
                  <Bot className="w-3 h-3" />{workers[selectedNode.assigned_worker_id].display_name}
                </Badge>
              )}
              {selectedNode.workflow_id && (
                <Badge variant="outline" className="font-mono">wf: {selectedNode.workflow_id.slice(0, 12)}…</Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
