import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, Bot, HardDrive, Sparkles, Activity, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

interface Stats {
  r2: { total_tracks: number; r2_tracks: number; size_mb: number; limit_mb: number; percent_used: number };
  n8n_bots: Array<{ label: string; source: string; ingests: number; last_used: string | null; active: boolean }>;
  engines: Record<string, { total: number; completed: number }>;
  activity_24h: { new_tracks: number; new_generations: number };
  generated_at: string;
}

const ENGINE_LABEL: Record<string, string> = {
  musicgen: "MusicGen (instrumental)",
  suno: "Suno (pełne utwory)",
  elevenlabs: "ElevenLabs (wokal)",
};

export const AIBuilderProgress = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-builder-stats");
      if (error) throw error;
      setStats(data as Stats);
    } catch (e: any) {
      toast.error(e?.message || "Nie udało się pobrać statystyk");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading && !stats) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (!stats) return null;

  const totalIngests = stats.n8n_bots.reduce((s, b) => s + b.ingests, 0);
  const activeBots = stats.n8n_bots.filter(b => b.active).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Postęp budowy AI muzycznego
          </h3>
          <p className="text-xs text-muted-foreground">
            Ostatnia aktualizacja: {new Date(stats.generated_at).toLocaleTimeString("pl-PL")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Odśwież
        </Button>
      </div>

      {/* R2 Storage */}
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-primary" />
            Cloudflare R2 — przestrzeń serwera
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs text-muted-foreground">
                {stats.r2.size_mb.toLocaleString("pl-PL")} MB / {(stats.r2.limit_mb / 1024).toFixed(0)} GB
              </span>
              <span className="text-2xl font-bold text-primary">{stats.r2.percent_used}%</span>
            </div>
            <Progress value={stats.r2.percent_used} className="h-2" />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-muted/30 p-2">
              <div className="text-lg font-bold">{stats.r2.r2_tracks}</div>
              <div className="text-[10px] text-muted-foreground">utworów na R2</div>
            </div>
            <div className="rounded-lg bg-muted/30 p-2">
              <div className="text-lg font-bold">{stats.r2.total_tracks}</div>
              <div className="text-[10px] text-muted-foreground">utworów łącznie</div>
            </div>
            <div className="rounded-lg bg-muted/30 p-2">
              <div className="text-lg font-bold text-emerald-400">+{stats.activity_24h.new_tracks}</div>
              <div className="text-[10px] text-muted-foreground">w ostatnich 24h</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* n8n Bots */}
      <Card className="border-purple-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bot className="h-4 w-4 text-purple-400" />
            n8n Boty — automatyczny ingest muzyki
            <Badge variant="secondary" className="ml-auto">{activeBots}/{stats.n8n_bots.length} aktywnych</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.n8n_bots.map((bot) => (
              <div key={bot.source} className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/30 p-2">
                {bot.active
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  : <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{bot.label}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {bot.last_used ? `ostatnio: ${new Date(bot.last_used).toLocaleString("pl-PL")}` : "nigdy nie użyty"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold">{bot.ingests}</div>
                  <div className="text-[10px] text-muted-foreground">ingestów</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg bg-purple-500/10 p-2 text-xs">
            <span className="font-semibold text-purple-300">Łącznie: {totalIngests} utworów</span>
            <span className="text-muted-foreground"> dostarczonych przez boty n8n</span>
          </div>
        </CardContent>
      </Card>

      {/* Generative engines */}
      <Card className="border-orange-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-orange-400" />
            Silniki generatywne — utwory tworzone w aplikacji
            <Badge variant="secondary" className="ml-auto">+{stats.activity_24h.new_generations} dziś</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Object.keys(stats.engines).length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Brak generacji. Użyj GrouAI Studio aby zacząć tworzyć utwory.
            </p>
          ) : (
            Object.entries(stats.engines).map(([engine, s]) => {
              const pct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
              return (
                <div key={engine} className="rounded-lg border border-border/50 bg-card/30 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{ENGINE_LABEL[engine] || engine}</span>
                    <span className="text-xs text-muted-foreground">{s.completed}/{s.total} ({pct}%)</span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
};
