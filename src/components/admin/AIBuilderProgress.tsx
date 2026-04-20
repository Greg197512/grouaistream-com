import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, RefreshCw, Bot, HardDrive, Sparkles, Activity,
  CheckCircle2, XCircle, Music, Users, Heart, ListMusic,
  Database, TrendingUp, Clock, BookOpen, Brain
} from "lucide-react";
import { toast } from "sonner";

interface SourceRow {
  key: string;
  label: string;
  count: number;
  hours: number;
  with_genre: number;
  monetized: number;
  percent: number;
}

interface Stats {
  summary: {
    total_tracks: number;
    total_hours: number;
    unique_artists_users: number;
    with_genre: number;
    with_mood: number;
    monetized_tracks: number;
  };
  r2: { tracks: number; size_mb: number; limit_mb: number; percent_used: number };
  sources: SourceRow[];
  top_genres: { genre: string; count: number }[];
  top_moods: { mood: string; count: number }[];
  n8n_bots: Array<{ label: string; source: string; ingests: number; last_used: string | null; active: boolean }>;
  engines: Record<string, { total: number; completed: number }>;
  studio_generations_count: number;
  activity: {
    last_1h: number;
    last_24h: number;
    last_7d: number;
    daily: { day: string; count: number }[];
  };
  ai_catalog: { song_catalog: number; audio_features: number; melody_embeddings: number };
  platform: {
    users: number;
    playlists: number;
    liked_songs: number;
    listening_history: number;
    mood_sessions: number;
    blog_posts: number;
  };
  generated_at: string;
}

const numberFmt = (n: number) => n.toLocaleString("pl-PL");

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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Postęp budowy AI muzycznego — pełny przegląd
          </h3>
          <p className="text-xs text-muted-foreground">
            Aktualizacja: {new Date(stats.generated_at).toLocaleString("pl-PL")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Odśwież
        </Button>
      </div>

      {/* SUMMARY KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={<Music className="h-4 w-4" />} label="Utworów łącznie" value={numberFmt(stats.summary.total_tracks)} accent="primary" />
        <KpiCard icon={<Clock className="h-4 w-4" />} label="Godzin muzyki" value={`${numberFmt(stats.summary.total_hours)} h`} accent="emerald" />
        <KpiCard icon={<Users className="h-4 w-4" />} label="Unikalnych twórców" value={numberFmt(stats.summary.unique_artists_users)} accent="purple" />
        <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Monetyzowanych" value={numberFmt(stats.summary.monetized_tracks)} accent="orange" />
      </div>

      {/* SOURCES — co skąd ściągnięte */}
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            Skąd pochodzi muzyka — podział per źródło
            <Badge variant="secondary" className="ml-auto">{stats.sources.length} źródeł</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.sources.map((s) => (
              <div key={s.key} className="rounded-lg border border-border/50 bg-card/30 p-3">
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                  <span className="text-sm font-medium">{s.label}</span>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold">{numberFmt(s.count)}</span>
                    <span className="text-muted-foreground">({s.percent}%)</span>
                    <span className="text-muted-foreground">• {s.hours}h</span>
                    {s.monetized > 0 && (
                      <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400">
                        💰 {s.monetized}
                      </Badge>
                    )}
                  </div>
                </div>
                <Progress value={s.percent} className="h-1.5" />
              </div>
            ))}
          </div>
          {stats.sources.find(s => s.key === "missing_url") && (
            <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/30 p-2 text-xs text-amber-200">
              ⚠️ Sporo utworów ma <code className="text-amber-300">audio_url = NULL</code> — to metadane z katalogu (np. wskazówki AI), nie pliki audio do streamu.
            </div>
          )}
        </CardContent>
      </Card>

      {/* R2 Storage */}
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-primary" />
            Cloudflare R2 — własny serwer audio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs text-muted-foreground">
                ~{numberFmt(stats.r2.size_mb)} MB / {(stats.r2.limit_mb / 1024).toFixed(0)} GB (Free plan)
              </span>
              <span className="text-2xl font-bold text-primary">{stats.r2.percent_used}%</span>
            </div>
            <Progress value={stats.r2.percent_used} className="h-2" />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <Stat label="Utworów na R2" value={numberFmt(stats.r2.tracks)} />
            <Stat label="Nowe (24h)" value={`+${stats.activity.last_24h}`} accent="emerald" />
            <Stat label="Nowe (7 dni)" value={`+${stats.activity.last_7d}`} accent="primary" />
          </div>
        </CardContent>
      </Card>

      {/* n8n bots */}
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
              <div key={bot.source + bot.label} className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/30 p-2">
                {bot.active
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  : <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{bot.label}</div>
                  <div className="text-[10px] text-muted-foreground">
                    źródło: <code className="text-purple-300">{bot.source}</code>
                    {" • "}
                    {bot.last_used ? `ostatnio: ${new Date(bot.last_used).toLocaleString("pl-PL")}` : "nigdy nie użyty"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold">{numberFmt(bot.ingests)}</div>
                  <div className="text-[10px] text-muted-foreground">ingestów</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg bg-purple-500/10 p-2 text-xs">
            <span className="font-semibold text-purple-300">Łącznie: {numberFmt(totalIngests)} utworów</span>
            <span className="text-muted-foreground"> dostarczonych przez boty n8n</span>
          </div>
        </CardContent>
      </Card>

      {/* TOP genres + moods */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="border-blue-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ListMusic className="h-4 w-4 text-blue-400" />
              Top 10 gatunków
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {stats.top_genres.map((g) => (
              <RankRow key={g.genre} label={g.genre} value={g.count} max={stats.top_genres[0]?.count || 1} />
            ))}
            {stats.top_genres.length === 0 && (
              <p className="text-xs text-muted-foreground py-3 text-center">Brak gatunków w katalogu.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-pink-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Heart className="h-4 w-4 text-pink-400" />
              Top 10 nastrojów
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {stats.top_moods.map((m) => (
              <RankRow key={m.mood} label={m.mood} value={m.count} max={stats.top_moods[0]?.count || 1} />
            ))}
            {stats.top_moods.length === 0 && (
              <p className="text-xs text-muted-foreground py-3 text-center">Brak metadanych nastroju.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Generative engines */}
      <Card className="border-orange-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-orange-400" />
            Silniki generatywne — utwory tworzone w aplikacji
            <Badge variant="secondary" className="ml-auto">+{stats.activity.last_24h} dziś</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
            <Stat label="Generations (legacy)" value={numberFmt(Object.values(stats.engines).reduce((a, b) => a + b.total, 0))} />
            <Stat label="Studio generations" value={numberFmt(stats.studio_generations_count)} />
          </div>
          {Object.keys(stats.engines).length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Brak generacji w tabeli <code>generations</code>. Użytkownicy generują przez Suno/Studio.
            </p>
          ) : (
            Object.entries(stats.engines).map(([engine, s]) => {
              const pct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
              return (
                <div key={engine} className="rounded-lg border border-border/50 bg-card/30 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{engine}</span>
                    <span className="text-xs text-muted-foreground">{s.completed}/{s.total} ({pct}%)</span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* AI Catalog */}
      <Card className="border-cyan-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="h-4 w-4 text-cyan-400" />
            Katalog AI — analiza utworów (samples, features, embeddings)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <Stat label="Song catalog" value={numberFmt(stats.ai_catalog.song_catalog)} accent="cyan" />
            <Stat label="Audio features (BPM, key, mood)" value={numberFmt(stats.ai_catalog.audio_features)} accent="cyan" />
            <Stat label="Melody embeddings (vector)" value={numberFmt(stats.ai_catalog.melody_embeddings)} accent="cyan" />
          </div>
          {stats.ai_catalog.song_catalog === 0 && (
            <p className="text-[11px] text-muted-foreground mt-2 text-center">
              Katalog AI jest pusty — boty n8n / SunoScraper jeszcze nie dosłały samples.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Platform stats */}
      <Card className="border-emerald-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-400" />
            Statystyki platformy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-center text-xs">
            <Stat label="Użytkownicy" value={numberFmt(stats.platform.users)} />
            <Stat label="Playlisty" value={numberFmt(stats.platform.playlists)} />
            <Stat label="Polubionych ❤️" value={numberFmt(stats.platform.liked_songs)} />
            <Stat label="Odsłuch (history)" value={numberFmt(stats.platform.listening_history)} />
            <Stat label="Sesji nastroju" value={numberFmt(stats.platform.mood_sessions)} />
            <Stat label="Postów blog" value={numberFmt(stats.platform.blog_posts)} />
          </div>
        </CardContent>
      </Card>

      {/* Daily activity */}
      <Card className="border-yellow-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-yellow-400" />
            Aktywność dzienna (ostatnie 14 dni)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.activity.daily.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Brak ingestów w ostatnich 14 dniach.</p>
          ) : (
            <div className="space-y-1">
              {stats.activity.daily.map((d) => (
                <RankRow
                  key={d.day}
                  label={new Date(d.day).toLocaleDateString("pl-PL", { weekday: "short", day: "2-digit", month: "2-digit" })}
                  value={d.count}
                  max={Math.max(...stats.activity.daily.map(x => x.count))}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const KpiCard = ({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: "primary" | "emerald" | "purple" | "orange" }) => {
  const accentMap = {
    primary: "text-primary border-primary/30",
    emerald: "text-emerald-400 border-emerald-500/30",
    purple: "text-purple-400 border-purple-500/30",
    orange: "text-orange-400 border-orange-500/30",
  };
  return (
    <div className={`rounded-lg border ${accentMap[accent]} bg-card/30 p-3`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
        <span className={accentMap[accent].split(" ")[0]}>{icon}</span>
        {label}
      </div>
      <div className={`text-xl font-bold ${accentMap[accent].split(" ")[0]}`}>{value}</div>
    </div>
  );
};

const Stat = ({ label, value, accent }: { label: string; value: string; accent?: "emerald" | "primary" | "cyan" }) => {
  const cls = accent === "emerald" ? "text-emerald-400" : accent === "primary" ? "text-primary" : accent === "cyan" ? "text-cyan-400" : "";
  return (
    <div className="rounded-lg bg-muted/30 p-2">
      <div className={`text-base font-bold ${cls}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground leading-tight">{label}</div>
    </div>
  );
};

const RankRow = ({ label, value, max }: { label: string; value: number; max: number }) => {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-32 truncate text-muted-foreground">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted/30 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-primary/60 to-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-14 text-right font-bold">{numberFmt(value)}</span>
    </div>
  );
};
