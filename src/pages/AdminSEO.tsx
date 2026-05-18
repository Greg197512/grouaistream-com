import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bot, RefreshCw, Globe, Rss, FileText, Zap, CheckCircle,
  XCircle, Clock, Eye, TrendingUp, Settings, Play
} from "lucide-react";

interface SeoLog {
  id: string;
  action_type: string;
  level: string;
  message: string;
  created_at: string;
  triggered_by: string;
}

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  category: string;
  view_count: number;
  is_published: boolean;
  cover_url: string | null;
  title_en: string | null;
  created_at: string;
}

interface SeoSettings {
  auto_blog_enabled: boolean;
  auto_sitemap_enabled: boolean;
  auto_indexnow_enabled: boolean;
  blog_frequency_days: number;
  ping_frequency_hours: number;
  last_blog_at: string | null;
  last_sitemap_at: string | null;
  last_indexnow_at: string | null;
}

const levelColor = (level: string) => {
  if (level === "success") return "text-green-400";
  if (level === "error") return "text-red-400";
  return "text-yellow-400";
};

const levelIcon = (level: string) => {
  if (level === "success") return <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />;
  if (level === "error") return <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />;
  return <Clock className="w-3.5 h-3.5 text-yellow-400 shrink-0" />;
};

export default function AdminSEO() {
  const [logs, setLogs] = useState<SeoLog[]>([]);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [settings, setSettings] = useState<SeoSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const [logsRes, postsRes, settingsRes] = await Promise.all([
      supabase
        .from("seo_activity_log")
        .select("id, action_type, level, message, created_at, triggered_by")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("seo_blog_posts")
        .select("id, slug, title, category, view_count, is_published, cover_url, title_en, created_at")
        .order("created_at", { ascending: false })
        .limit(40),
      supabase
        .from("seo_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle(),
    ]);

    if (logsRes.data) setLogs(logsRes.data as SeoLog[]);
    if (postsRes.data) setPosts(postsRes.data as BlogPost[]);
    if (settingsRes.data) setSettings(settingsRes.data as unknown as SeoSettings);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const invoke = async (action: string, label: string, body: Record<string, unknown> = {}) => {
    setRunning(action);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("seo-bot", {
        body: { action, triggered_by: "manual", ...body },
      });
      if (error) throw error;
      setLastResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setLastResult(`Błąd: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunning(null);
      await fetchData();
    }
  };

  const invokeOrchestrator = async (action: string) => {
    setRunning(`orch_${action}`);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("seo-orchestrator", {
        body: { action, triggered_by: "manual" },
      });
      if (error) throw error;
      setLastResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setLastResult(`Błąd: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunning(null);
      await fetchData();
    }
  };

  const toggleSetting = async (key: keyof SeoSettings, value: boolean) => {
    await supabase.from("seo_settings").update({ [key]: value }).eq("id", 1);
    setSettings((prev) => prev ? { ...prev, [key]: value } : prev);
  };

  const isRunning = (key: string) => running === key;

  return (
    <MainLayout>
      <div className="px-4 sm:px-6 py-8 max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground">SEO Bot Dashboard</h1>
              <p className="text-sm text-muted-foreground">grouaistream.com — zarządzanie SEO</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Odśwież
          </Button>
        </header>

        {/* Bot Control */}
        <section>
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">Bot Control</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { key: "full", label: "Pełny cykl", icon: <Zap className="w-4 h-4" />, color: "from-primary to-accent" },
              { key: "generate", label: "Generuj post", icon: <FileText className="w-4 h-4" />, color: "from-blue-600 to-cyan-500" },
              { key: "translate", label: "Tłumacz posty", icon: <Globe className="w-4 h-4" />, color: "from-purple-600 to-violet-500" },
              { key: "distribute", label: "Dystrybucja", icon: <Rss className="w-4 h-4" />, color: "from-orange-600 to-amber-500" },
              { key: "report", label: "Wyślij raport", icon: <TrendingUp className="w-4 h-4" />, color: "from-green-600 to-emerald-500" },
            ].map(({ key, label, icon, color }) => (
              <button
                key={key}
                onClick={() => invoke(key, label)}
                disabled={running !== null}
                className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border border-border/50 bg-card/60 hover:border-primary/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed group`}
              >
                {isRunning(key) ? (
                  <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                ) : (
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center text-white`}>
                    {icon}
                  </div>
                )}
                <span className="text-xs font-semibold text-foreground text-center leading-tight">{label}</span>
              </button>
            ))}
          </div>

          {/* Quick orchestrator actions */}
          <div className="flex flex-wrap gap-2 mt-3">
            <Button size="sm" variant="outline" onClick={() => invokeOrchestrator("sitemap")} disabled={running !== null}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRunning("orch_sitemap") ? "animate-spin" : ""}`} />
              Sitemap
            </Button>
            <Button size="sm" variant="outline" onClick={() => invokeOrchestrator("ping")} disabled={running !== null}>
              <Play className={`w-3.5 h-3.5 mr-1.5 ${isRunning("orch_ping") ? "animate-spin" : ""}`} />
              IndexNow Ping
            </Button>
            <Button size="sm" variant="outline" onClick={() => invoke("generate", "Generuj 3 posty", { count: 3 })} disabled={running !== null}>
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              Generuj 3 posty
            </Button>
          </div>

          {/* Last result */}
          {lastResult && (
            <div className="mt-3 p-3 rounded-xl bg-muted/40 border border-border text-xs font-mono text-muted-foreground max-h-40 overflow-auto">
              <pre className="whitespace-pre-wrap">{lastResult}</pre>
            </div>
          )}
        </section>

        {/* Settings */}
        <section>
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
            <Settings className="w-4 h-4" /> Automatyzacja
          </h2>
          {loading ? (
            <Skeleton className="h-24 rounded-xl" />
          ) : settings ? (
            <Card className="p-4 bg-card/40 border-border">
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { key: "auto_blog_enabled" as const, label: "Auto Blog", desc: `Co ${settings.blog_frequency_days || 7} dni`, last: settings.last_blog_at },
                  { key: "auto_sitemap_enabled" as const, label: "Auto Sitemap", desc: "Co 20h", last: settings.last_sitemap_at },
                  { key: "auto_indexnow_enabled" as const, label: "Auto IndexNow", desc: `Co ${settings.ping_frequency_hours || 12}h`, last: settings.last_indexnow_at },
                ].map(({ key, label, desc, last }) => (
                  <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{label}</p>
                      <p className="text-[11px] text-muted-foreground">{desc}</p>
                      {last && (
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                          Ostatnio: {new Date(last).toLocaleString("pl-PL")}
                        </p>
                      )}
                    </div>
                    <Switch
                      checked={!!settings[key]}
                      onCheckedChange={(v) => toggleSetting(key, v)}
                    />
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">Brak danych ustawień (tabela seo_settings)</p>
          )}
        </section>

        {/* Blog Posts */}
        <section>
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4" /> Posty blogowe ({posts.length})
          </h2>
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-muted-foreground uppercase">Tytuł</th>
                    <th className="text-left px-3 py-2.5 text-xs font-bold text-muted-foreground uppercase">Kat.</th>
                    <th className="text-center px-3 py-2.5 text-xs font-bold text-muted-foreground uppercase">
                      <Eye className="w-3.5 h-3.5 inline" />
                    </th>
                    <th className="text-center px-3 py-2.5 text-xs font-bold text-muted-foreground uppercase">Cover</th>
                    <th className="text-center px-3 py-2.5 text-xs font-bold text-muted-foreground uppercase">EN</th>
                    <th className="text-left px-3 py-2.5 text-xs font-bold text-muted-foreground uppercase">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td colSpan={6} className="px-4 py-2.5"><Skeleton className="h-4 w-full" /></td>
                      </tr>
                    ))
                  ) : posts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">
                        Brak postów. Kliknij "Generuj post" aby stworzyć pierwszy.
                      </td>
                    </tr>
                  ) : (
                    posts.map((post) => (
                      <tr key={post.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5">
                          <a
                            href={`/blog/${post.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-foreground hover:text-primary transition-colors font-medium line-clamp-1 max-w-xs block"
                          >
                            {post.title}
                          </a>
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant="secondary" className="text-[10px]">{post.category}</Badge>
                        </td>
                        <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground text-xs">
                          {post.view_count}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {post.cover_url ? (
                            <CheckCircle className="w-3.5 h-3.5 text-green-400 mx-auto" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-red-400/50 mx-auto" />
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {post.title_en ? (
                            <CheckCircle className="w-3.5 h-3.5 text-green-400 mx-auto" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-red-400/50 mx-auto" />
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(post.created_at).toLocaleDateString("pl-PL")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Activity Log */}
        <section>
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Log aktywności
          </h2>
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="divide-y divide-border/30 max-h-96 overflow-y-auto">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <div key={i} className="px-4 py-3"><Skeleton className="h-4 w-3/4" /></div>
                ))
              ) : logs.length === 0 ? (
                <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                  Brak logów. Aktywność pojawi się po uruchomieniu bota.
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/10 transition-colors">
                    {levelIcon(log.level)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground/60">{log.action_type}</span>
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0">{log.triggered_by}</Badge>
                      </div>
                      <p className={`text-xs mt-0.5 ${levelColor(log.level)}`}>{log.message}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground/40 whitespace-nowrap shrink-0">
                      {new Date(log.created_at).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

      </div>
    </MainLayout>
  );
}
