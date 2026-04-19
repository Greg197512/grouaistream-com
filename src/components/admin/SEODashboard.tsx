import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Activity,
  Globe,
  FileText,
  Send,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  TrendingUp,
  Search,
  Bot,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { BlogDistributionPanel } from "./BlogDistributionPanel";
import AdOutreachPanel from "./AdOutreachPanel";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

interface LogEntry {
  id: string;
  action_type: string;
  level: string;
  message: string;
  metadata: Record<string, unknown>;
  triggered_by: string;
  created_at: string;
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  description: string;
  view_count: number;
  created_at: string;
  generated_by_ai: boolean;
}

interface DailyActivity {
  day: string;
  total: number;
  success: number;
  errors: number;
}

interface Settings {
  auto_sitemap_enabled: boolean;
  auto_indexnow_enabled: boolean;
  auto_blog_enabled: boolean;
  auto_meta_enabled: boolean;
  blog_frequency_days: number;
  ping_frequency_hours: number;
  last_sitemap_at: string | null;
  last_indexnow_at: string | null;
  last_blog_at: string | null;
}

interface DashboardData {
  total_actions_24h: number;
  total_actions_7d: number;
  errors_24h: number;
  success_24h: number;
  total_blog_posts: number;
  total_blog_views: number;
  total_keywords: number;
  total_indexable_urls: number;
  settings: Settings;
  recent_logs: LogEntry[] | null;
  daily_activity: DailyActivity[] | null;
  recent_blog_posts: BlogPost[] | null;
}

const ACTION_LABELS: Record<string, string> = {
  sitemap_generate: "Sitemap",
  indexnow_ping: "IndexNow Ping",
  blog_generate: "Blog AI",
  orchestrator: "Orchestrator",
};

const formatDate = (s: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" });
};

export const SEODashboard = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);

  const load = async () => {
    const { data: result, error } = await supabase.rpc("get_seo_dashboard_stats");
    if (error) {
      toast.error("Błąd: " + error.message);
      return;
    }
    setData(result as unknown as DashboardData);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("seo-logs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "seo_activity_log" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const triggerAction = async (action: "ping" | "sitemap" | "blog" | "all") => {
    setRunning(action);
    try {
      const { data: result, error } = await supabase.functions.invoke("seo-orchestrator", {
        body: { action, triggered_by: "manual" },
      });
      if (error) throw error;
      toast.success(`Uruchomiono: ${action}`, {
        description: JSON.stringify(result?.results || {}, null, 0).slice(0, 100),
      });
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "błąd";
      toast.error("Nieudane: " + msg);
    } finally {
      setRunning(null);
    }
  };

  const updateSetting = async (key: keyof Settings, value: boolean) => {
    const { error } = await supabase.from("seo_settings").update({ [key]: value }).eq("id", 1);
    if (error) {
      toast.error("Błąd zapisu");
    } else {
      toast.success("Zapisano");
      await load();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data || (data as { error?: string }).error) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Brak dostępu lub błąd ładowania
        </CardContent>
      </Card>
    );
  }

  const successRate =
    data.total_actions_24h > 0
      ? Math.round((data.success_24h / data.total_actions_24h) * 100)
      : 100;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-background to-accent/10 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-full groove-gradient-bg flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-2xl font-bold font-display">SEO Bot</h2>
              <p className="text-sm text-muted-foreground">
                Automatyzacja indeksacji i marketingu — IndexNow + Lovable AI
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-1">
              <Globe className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Indeksowalne URL-e</span>
            </div>
            <div className="text-2xl font-bold">{data.total_indexable_urls.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Akcje 24h</span>
            </div>
            <div className="text-2xl font-bold">{data.total_actions_24h}</div>
            <div className="text-xs text-muted-foreground mt-1">{successRate}% sukces</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Posty AI</span>
            </div>
            <div className="text-2xl font-bold">{data.total_blog_posts}</div>
            <div className="text-xs text-muted-foreground mt-1">{data.total_blog_views} wyświetleń</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-1">
              <Search className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Słowa kluczowe</span>
            </div>
            <div className="text-2xl font-bold">{data.total_keywords}</div>
          </CardContent>
        </Card>
      </div>

      {/* Manual triggers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" /> Ręczne uruchomienie
          </CardTitle>
          <CardDescription>Wymuś natychmiastowe wykonanie akcji</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Button
            variant="outline"
            disabled={!!running}
            onClick={() => triggerAction("ping")}
            className="gap-2"
          >
            {running === "ping" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            IndexNow Ping
          </Button>
          <Button
            variant="outline"
            disabled={!!running}
            onClick={() => triggerAction("sitemap")}
            className="gap-2"
          >
            {running === "sitemap" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Odśwież sitemap
          </Button>
          <Button
            variant="outline"
            disabled={!!running}
            onClick={() => triggerAction("blog")}
            className="gap-2"
          >
            {running === "blog" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Generuj post AI
          </Button>
          <Button
            disabled={!!running}
            onClick={() => triggerAction("all")}
            className="gap-2 groove-gradient-bg text-primary-foreground"
          >
            {running === "all" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <TrendingUp className="h-4 w-4" />
            )}
            Uruchom wszystko
          </Button>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Ustawienia automatyzacji</CardTitle>
          <CardDescription>Codzienny cron uruchamia się o 04:00 UTC</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <Label className="font-medium">Auto-sitemap</Label>
              <p className="text-xs text-muted-foreground">
                Ostatnio: {formatDate(data.settings.last_sitemap_at)}
              </p>
            </div>
            <Switch
              checked={data.settings.auto_sitemap_enabled}
              onCheckedChange={(v) => updateSetting("auto_sitemap_enabled", v)}
            />
          </div>
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <Label className="font-medium">Auto IndexNow ping</Label>
              <p className="text-xs text-muted-foreground">
                Co {data.settings.ping_frequency_hours}h • Ostatnio: {formatDate(data.settings.last_indexnow_at)}
              </p>
            </div>
            <Switch
              checked={data.settings.auto_indexnow_enabled}
              onCheckedChange={(v) => updateSetting("auto_indexnow_enabled", v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Auto-blog AI</Label>
              <p className="text-xs text-muted-foreground">
                Co {data.settings.blog_frequency_days} dni • Ostatnio:{" "}
                {formatDate(data.settings.last_blog_at)}
              </p>
            </div>
            <Switch
              checked={data.settings.auto_blog_enabled}
              onCheckedChange={(v) => updateSetting("auto_blog_enabled", v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Daily chart */}
      {data.daily_activity && data.daily_activity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Aktywność (ostatnie 14 dni)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.daily_activity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    tickFormatter={(d) => new Date(d).toLocaleDateString("pl-PL", { month: "short", day: "numeric" })}
                  />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="success" stackId="a" fill="hsl(var(--primary))" name="Sukces" />
                  <Bar dataKey="errors" stackId="a" fill="hsl(var(--destructive))" name="Błędy" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent posts + logs */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Ostatnie posty AI
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-72">
              <div className="space-y-2">
                {data.recent_blog_posts && data.recent_blog_posts.length > 0 ? (
                  data.recent_blog_posts.map((p) => (
                    <div key={p.id} className="border border-border rounded-lg p-3 hover:bg-accent/5 transition">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <a
                            href={`/blog/${p.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-sm hover:text-primary line-clamp-2"
                          >
                            {p.title}
                          </a>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{p.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px]">{p.view_count} 👁</Badge>
                            {p.generated_by_ai && <Badge className="text-[10px] bg-primary/20 text-primary">AI</Badge>}
                            <span className="text-[10px] text-muted-foreground">{formatDate(p.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Brak postów. Kliknij "Generuj post AI".</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" /> Logi bota (live)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-72">
              <div className="space-y-1.5">
                {data.recent_logs && data.recent_logs.length > 0 ? (
                  data.recent_logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-2 text-xs border-l-2 pl-2 py-1"
                      style={{
                        borderColor:
                          log.level === "error"
                            ? "hsl(var(--destructive))"
                            : log.level === "success"
                            ? "hsl(var(--primary))"
                            : "hsl(var(--muted))",
                      }}
                    >
                      {log.level === "success" ? (
                        <CheckCircle2 className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                      ) : log.level === "error" ? (
                        <XCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                      ) : (
                        <Activity className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[9px] py-0 px-1">
                            {ACTION_LABELS[log.action_type] || log.action_type}
                          </Badge>
                          <Badge variant="outline" className="text-[9px] py-0 px-1">
                            {log.triggered_by}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {formatDate(log.created_at)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-foreground/80 break-words">{log.message}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Brak logów</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Blog distribution: hooks + newsletter */}
      <BlogDistributionPanel />

      {/* Ad outreach bot */}
      <AdOutreachPanel />
    </div>
  );
};
