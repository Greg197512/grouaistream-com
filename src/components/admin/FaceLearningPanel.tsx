import { useCallback, useEffect, useMemo, useState } from "react";
import { Brain, RefreshCw, Loader2, Eye, Activity, Users, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Panel admina: co silnik "wie" z detekcji twarzy (tabela face_detections).
// Admin ma dostęp do wszystkich rekordów przez RLS.

interface DetRow {
  id: string;
  user_id: string;
  created_at: string;
  dominant_emotion: string;
  confidence: number | null;
  emotions: Record<string, number> | null;
  eye_state: string | null;
  gaze: string | null;
  micro_expressions: string[] | null;
  valence: number | null;
  arousal: number | null;
  engagement: number | null;
  frames_count: number | null;
  model: string | null;
  playing_track_id: string | null;
}

const EMO_META: Record<string, { label: string; emoji: string; cls: string }> = {
  happy: { label: "Radość", emoji: "😊", cls: "from-yellow-400 to-orange-500" },
  sad: { label: "Smutek", emoji: "😢", cls: "from-blue-400 to-indigo-500" },
  angry: { label: "Złość", emoji: "😤", cls: "from-red-500 to-orange-600" },
  surprised: { label: "Zaskoczenie", emoji: "😮", cls: "from-pink-400 to-rose-500" },
  neutral: { label: "Neutralny", emoji: "😌", cls: "from-cyan-400 to-blue-500" },
  fearful: { label: "Lęk", emoji: "😰", cls: "from-purple-400 to-pink-500" },
  disgusted: { label: "Niesmak", emoji: "😒", cls: "from-green-500 to-teal-500" },
};

export function FaceLearningPanel() {
  const [rows, setRows] = useState<DetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("face_detections")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) {
        // Tabela jeszcze nie wdrożona na produkcji
        if (/relation|does not exist|schema cache/i.test(error.message)) {
          setTableMissing(true);
          setRows([]);
          return;
        }
        throw error;
      }
      setTableMissing(false);
      setRows((data ?? []) as DetRow[]);
    } catch (e: any) {
      toast.error("Nie udało się pobrać detekcji: " + (e?.message || "błąd"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => {
    const total = rows.length;
    const users = new Set(rows.map((r) => r.user_id)).size;
    const emo: Record<string, number> = {};
    let vSum = 0, vN = 0, aSum = 0, aN = 0, eSum = 0, eN = 0;
    const eyes: Record<string, number> = {};
    const gaze: Record<string, number> = {};
    const microCount: Record<string, number> = {};
    // Emocja → jak często dane oczy/utwór; oraz reakcja na utwory
    const trackEmotion: Record<string, Record<string, number>> = {};

    for (const r of rows) {
      emo[r.dominant_emotion] = (emo[r.dominant_emotion] || 0) + 1;
      if (typeof r.valence === "number") { vSum += r.valence; vN++; }
      if (typeof r.arousal === "number") { aSum += r.arousal; aN++; }
      if (typeof r.engagement === "number") { eSum += r.engagement; eN++; }
      if (r.eye_state) eyes[r.eye_state] = (eyes[r.eye_state] || 0) + 1;
      if (r.gaze) gaze[r.gaze] = (gaze[r.gaze] || 0) + 1;
      for (const m of r.micro_expressions ?? []) microCount[m] = (microCount[m] || 0) + 1;
      if (r.playing_track_id) {
        trackEmotion[r.playing_track_id] = trackEmotion[r.playing_track_id] || {};
        trackEmotion[r.playing_track_id][r.dominant_emotion] =
          (trackEmotion[r.playing_track_id][r.dominant_emotion] || 0) + 1;
      }
    }

    const emoSorted = Object.entries(emo).sort((a, b) => b[1] - a[1]);
    const topMicro = Object.entries(microCount).sort((a, b) => b[1] - a[1]).slice(0, 8);

    return {
      total, users,
      emoSorted,
      avgValence: vN ? vSum / vN : null,
      avgArousal: aN ? aSum / aN : null,
      avgEngagement: eN ? eSum / eN : null,
      eyes, gaze, topMicro,
    };
  }, [rows]);

  const pct = (n: number) => stats.total ? Math.round((n / stats.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="font-display font-semibold text-lg">Uczenie z detekcji twarzy</h3>
          <Badge variant="secondary">{stats.total} skanów</Badge>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Odśwież
        </Button>
      </div>

      {tableMissing ? (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-6 text-sm text-yellow-200/90">
          Tabela <code>face_detections</code> nie jest jeszcze wdrożona na produkcji.
          Uruchom migrację (<code>supabase db push</code>) — panel zapełni się danymi,
          gdy użytkownicy zaczną używać detekcji twarzy.
        </div>
      ) : loading && rows.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline-block" /></div>
      ) : stats.total === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Brak detekcji do analizy.</div>
      ) : (
        <>
          {/* Kafelki podsumowania */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile icon={<Camera className="h-4 w-4" />} label="Detekcje" value={String(stats.total)} />
            <StatTile icon={<Users className="h-4 w-4" />} label="Użytkownicy" value={String(stats.users)} />
            <StatTile icon={<Activity className="h-4 w-4" />} label="Śr. pobudzenie"
              value={stats.avgArousal != null ? `${Math.round(stats.avgArousal * 100)}%` : "—"} />
            <StatTile icon={<Eye className="h-4 w-4" />} label="Śr. zaangażowanie"
              value={stats.avgEngagement != null ? `${Math.round(stats.avgEngagement * 100)}%` : "—"} />
          </div>

          {/* Valence bar */}
          {stats.avgValence != null && (
            <div className="rounded-xl border border-border bg-secondary/30 p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span>Średni nastrój (valence)</span>
                <span className="font-mono">{stats.avgValence >= 0 ? "+" : ""}{stats.avgValence.toFixed(2)}</span>
              </div>
              <div className="h-2 rounded-full bg-gradient-to-r from-blue-500 via-zinc-500 to-yellow-400 relative">
                <div className="absolute top-1/2 -translate-y-1/2 h-4 w-1 bg-white rounded"
                  style={{ left: `${Math.round(((stats.avgValence + 1) / 2) * 100)}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>negatywny</span><span>pozytywny</span>
              </div>
            </div>
          )}

          {/* Rozkład emocji */}
          <div className="rounded-xl border border-border p-4">
            <h4 className="text-sm font-medium mb-3">Rozkład emocji</h4>
            <div className="space-y-2">
              {stats.emoSorted.map(([emo, count]) => {
                const meta = EMO_META[emo] || { label: emo, emoji: "•", cls: "from-zinc-500 to-zinc-600" };
                return (
                  <div key={emo} className="flex items-center gap-3">
                    <span className="text-lg w-6">{meta.emoji}</span>
                    <span className="text-xs w-24 shrink-0">{meta.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                      <div className={`h-full bg-gradient-to-r ${meta.cls}`} style={{ width: `${pct(count)}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-14 text-right">{count} • {pct(count)}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Oczy / wzrok / mikroekspresje */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <MiniDist title="Stan oczu" data={stats.eyes} />
            <MiniDist title="Kierunek wzroku" data={stats.gaze} />
            <div className="rounded-xl border border-border p-4">
              <h4 className="text-sm font-medium mb-2">Top mikroekspresje</h4>
              <div className="flex flex-wrap gap-1.5">
                {stats.topMicro.length === 0 ? (
                  <span className="text-xs text-muted-foreground">brak danych</span>
                ) : stats.topMicro.map(([m, c]) => (
                  <Badge key={m} variant="secondary" className="text-[10px]">{m} · {c}</Badge>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">{icon}{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

function MiniDist({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, c]) => s + c, 0);
  return (
    <div className="rounded-xl border border-border p-4">
      <h4 className="text-sm font-medium mb-2">{title}</h4>
      {entries.length === 0 ? (
        <span className="text-xs text-muted-foreground">brak danych</span>
      ) : (
        <div className="space-y-1.5">
          {entries.map(([k, c]) => (
            <div key={k} className="flex items-center gap-2">
              <span className="text-xs w-16 shrink-0">{k}</span>
              <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${total ? Math.round((c / total) * 100) : 0}%` }} />
              </div>
              <span className="text-[10px] text-muted-foreground w-8 text-right">{c}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
