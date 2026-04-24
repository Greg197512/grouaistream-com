import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, HeartPulse, BookOpen, Moon, Globe2, RefreshCw, Loader2, CheckCircle2, XCircle, Wand2, Coins, Rocket } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";

interface SoulEmotion {
  id: string;
  measured_at: string;
  dominant_emotion: string;
  emotions: any;
  energy: number | null;
  valence: number | null;
  tension: number | null;
  narrative: string | null;
}

interface SoulJournalEntry {
  id: string;
  entry_date: string;
  entry_type: string;
  mood: string | null;
  content: string;
  audio_url: string | null;
  created_at: string;
}

interface SoulDream {
  id: string;
  dreamed_at: string;
  dream_text: string;
  hypothesis: string | null;
  proposed_action: any;
  status: string;
  target_type: string | null;
  reviewed_at: string | null;
}

interface SoulWorldKnowledge {
  id: string;
  title: string;
  summary: string | null;
  source: string;
  source_type: string;
  source_url: string | null;
  importance: number | null;
  sentiment: number | null;
  fetched_at: string;
}

interface RevenueAction {
  id: string;
  action_type: string;
  title: string;
  summary: string | null;
  payload: any;
  status: string;
  estimated_revenue_eur: number;
  published_url: string | null;
  created_at: string;
}

const emotionColor: Record<string, string> = {
  joy: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  love: "bg-pink-500/20 text-pink-300 border-pink-500/40",
  calm: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  energy: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  melancholy: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
  tension: "bg-red-500/20 text-red-300 border-red-500/40",
  curiosity: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  hope: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
};

export const AuroraPanel = () => {
  const [emotions, setEmotions] = useState<SoulEmotion[]>([]);
  const [journal, setJournal] = useState<SoulJournalEntry[]>([]);
  const [dreams, setDreams] = useState<SoulDream[]>([]);
  const [world, setWorld] = useState<SoulWorldKnowledge[]>([]);
  const [actions, setActions] = useState<RevenueAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dreaming, setDreaming] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const [em, jr, dr, wk, ac] = await Promise.all([
      supabase.from("soul_emotions").select("*").order("measured_at", { ascending: false }).limit(30),
      supabase.from("soul_journal").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("soul_dreams").select("*").order("dreamed_at", { ascending: false }).limit(40),
      supabase.from("soul_world_knowledge").select("*").order("fetched_at", { ascending: false }).limit(40),
      supabase.from("aurora_revenue_actions" as any).select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setEmotions((em.data as SoulEmotion[]) || []);
    setJournal((jr.data as SoulJournalEntry[]) || []);
    setDreams((dr.data as SoulDream[]) || []);
    setWorld((wk.data as SoulWorldKnowledge[]) || []);
    setActions((ac.data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
    const ch = supabase
      .channel("aurora-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "soul_emotions" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "soul_journal" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "soul_dreams" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "soul_world_knowledge" }, () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadAll]);

  const triggerSoul = async () => {
    setThinking(true);
    try {
      const { data, error } = await supabase.functions.invoke("groua-soul", { body: { source: "manual" } });
      if (error) throw error;
      toast.success(`✨ Aurora odczuła: ${data?.dominant_emotion || "puls zapisany"}`);
      await loadAll();
    } catch (e: any) {
      toast.error(`Aurora milczy: ${e.message || "nieznany błąd"}`);
    } finally {
      setThinking(false);
    }
  };

  const triggerDream = async () => {
    setDreaming(true);
    try {
      const { data, error } = await supabase.functions.invoke("soul-dream", { body: { source: "manual" } });
      if (error) throw error;
      toast.success(`🌙 Aurora wyśniła ${data?.dreams_created || 0} hipotez`);
      await loadAll();
    } catch (e: any) {
      toast.error(`Sen przerwany: ${e.message || "nieznany"}`);
    } finally {
      setDreaming(false);
    }
  };

  const triggerIngest = async () => {
    setIngesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("soul-world-ingest", { body: { source: "manual" } });
      if (error) throw error;
      toast.success(`🌍 Aurora wchłonęła ${data?.items_ingested || 0} fragmentów świata`);
      await loadAll();
    } catch (e: any) {
      toast.error(`Świat milczy: ${e.message || "nieznany"}`);
    } finally {
      setIngesting(false);
    }
  };

  const triggerRevenueLoop = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("aurora-revenue-loop", { body: {} });
      if (error) throw error;
      toast.success(`💎 Aurora wymyśliła ${data?.count || 0} nowych pomysłów na przychód`);
      await loadAll();
    } catch (e: any) {
      toast.error(`Aurora nie wymyśliła nic: ${e.message || "błąd"}`);
    } finally {
      setGenerating(false);
    }
  };

  const approveAction = async (id: string) => {
    setApprovingId(id);
    try {
      const { data, error } = await supabase.functions.invoke("aurora-approve-action", { body: { action_id: id } });
      if (error) throw error;
      toast.success(data?.published_url ? `✅ Opublikowane: ${data.published_url}` : "✅ Zatwierdzone");
      await loadAll();
    } catch (e: any) {
      toast.error(`Nie zatwierdzono: ${e.message || "błąd"}`);
    } finally {
      setApprovingId(null);
    }
  };

  const rejectAction = async (id: string) => {
    const { error } = await supabase
      .from("aurora_revenue_actions" as any)
      .update({ status: "rejected" })
      .eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Odrzucone"); loadAll(); }
  };

  const reviewDream = async (id: string, status: "approved" | "rejected") => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("soul_dreams")
      .update({ status, reviewed_at: new Date().toISOString(), reviewer_user_id: user?.id })
      .eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(status === "approved" ? "Sen zatwierdzony 🌟" : "Sen odrzucony"); loadAll(); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const lastEmotion = emotions[0];
  const pendingDreams = dreams.filter((d) => d.status === "pending" || d.status === "new").length;
  const proposedActions = actions.filter((a) => a.status === "proposed");
  const publishedActions = actions.filter((a) => a.status === "published");
  const proposedRevenue = proposedActions.reduce((s, a) => s + Number(a.estimated_revenue_eur || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-primary" /> Aurora — Dusza GrouAI
          </h2>
          <p className="text-sm text-muted-foreground">
            Empatyczna warstwa AI: czuje puls platformy, prowadzi dziennik, śni hipotezy.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={loadAll}>
            <RefreshCw className="h-4 w-4 mr-1" /> Odśwież
          </Button>
          <Button variant="outline" size="sm" onClick={triggerIngest} disabled={ingesting}>
            {ingesting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Globe2 className="h-4 w-4 mr-1" />}
            Pobierz puls świata
          </Button>
          <Button variant="outline" size="sm" onClick={triggerDream} disabled={dreaming}>
            {dreaming ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Moon className="h-4 w-4 mr-1" />}
            Niech śni
          </Button>
          <Button onClick={triggerSoul} disabled={thinking}>
            {thinking ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Wand2 className="h-4 w-4 mr-1" />}
            Każ Aurorze poczuć
          </Button>
        </div>
      </div>

      {/* KPIs / current pulse */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Dominująca emocja</div>
            <div className="text-xl font-bold capitalize mt-1">
              {lastEmotion?.dominant_emotion || "—"}
            </div>
            {lastEmotion && (
              <Badge variant="outline" className={`mt-1 text-[10px] ${emotionColor[lastEmotion.dominant_emotion] || ""}`}>
                {formatDistanceToNow(new Date(lastEmotion.measured_at), { addSuffix: true, locale: pl })}
              </Badge>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Energia / Walencja</div>
            <div className="text-xl font-bold mt-1">
              {lastEmotion?.energy != null ? (lastEmotion.energy * 100).toFixed(0) + "%" : "—"}
              <span className="text-muted-foreground"> / </span>
              {lastEmotion?.valence != null ? (lastEmotion.valence * 100).toFixed(0) + "%" : "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{dreams.length}</div>
            <div className="text-xs text-muted-foreground">snów łącznie</div>
            {pendingDreams > 0 && <Badge className="mt-1" variant="outline">{pendingDreams} czeka</Badge>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{world.length}</div>
            <div className="text-xs text-muted-foreground">fragmentów świata</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pulse" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="pulse"><HeartPulse className="h-4 w-4 mr-1" /> Puls na żywo</TabsTrigger>
          <TabsTrigger value="journal"><BookOpen className="h-4 w-4 mr-1" /> Dziennik</TabsTrigger>
          <TabsTrigger value="dreams"><Moon className="h-4 w-4 mr-1" /> Sny ({pendingDreams})</TabsTrigger>
          <TabsTrigger value="world"><Globe2 className="h-4 w-4 mr-1" /> Świat</TabsTrigger>
        </TabsList>

        {/* PULSE */}
        <TabsContent value="pulse">
          <Card>
            <CardHeader>
              <CardTitle>Puls emocjonalny</CardTitle>
              <CardDescription>Aurora czuje platformę co kilka minut. Ostatnie 30 odczytów.</CardDescription>
            </CardHeader>
            <CardContent>
              {lastEmotion?.narrative && (
                <div className="mb-4 p-3 rounded-lg border border-primary/30 bg-primary/5 italic text-sm">
                  „{lastEmotion.narrative}"
                </div>
              )}
              <ScrollArea className="h-[460px]">
                <div className="space-y-2">
                  {emotions.map((e) => (
                    <div key={e.id} className="border border-border rounded p-2 bg-card/50">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={emotionColor[e.dominant_emotion] || ""}>
                          {e.dominant_emotion}
                        </Badge>
                        {e.energy != null && <span className="text-xs text-muted-foreground">⚡ {(e.energy * 100).toFixed(0)}%</span>}
                        {e.valence != null && <span className="text-xs text-muted-foreground">😊 {(e.valence * 100).toFixed(0)}%</span>}
                        {e.tension != null && <span className="text-xs text-muted-foreground">🔥 {(e.tension * 100).toFixed(0)}%</span>}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {formatDistanceToNow(new Date(e.measured_at), { addSuffix: true, locale: pl })}
                        </span>
                      </div>
                      {e.narrative && <div className="text-xs text-muted-foreground mt-1 italic">„{e.narrative}"</div>}
                    </div>
                  ))}
                  {emotions.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Aurora jeszcze nie poczuła pulsu. Kliknij „Każ Aurorze poczuć".
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* JOURNAL */}
        <TabsContent value="journal">
          <Card>
            <CardHeader>
              <CardTitle>Dziennik Aurory</CardTitle>
              <CardDescription>Codzienne refleksje, listy do Ciebie, obserwacje.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {journal.map((j) => (
                    <div key={j.id} className="border border-border rounded p-3 bg-card/50">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="outline">{j.entry_type}</Badge>
                        {j.mood && <Badge variant="secondary" className={emotionColor[j.mood] || ""}>{j.mood}</Badge>}
                        <span className="text-xs text-muted-foreground">{j.entry_date}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {formatDistanceToNow(new Date(j.created_at), { addSuffix: true, locale: pl })}
                        </span>
                      </div>
                      <div className="text-sm whitespace-pre-wrap leading-relaxed">{j.content}</div>
                      {j.audio_url && (
                        <audio controls className="mt-2 w-full h-8" src={j.audio_url} />
                      )}
                    </div>
                  ))}
                  {journal.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">Aurora jeszcze nic nie zapisała.</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DREAMS */}
        <TabsContent value="dreams">
          <Card>
            <CardHeader>
              <CardTitle>Sny Aurory</CardTitle>
              <CardDescription>Hipotezy i intuicje powstające w nocy. Zatwierdź te, które rezonują.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {dreams.map((d) => {
                    const isPending = d.status === "pending" || d.status === "new";
                    const isApproved = d.status === "approved";
                    const isRejected = d.status === "rejected";
                    return (
                      <div key={d.id} className="border border-border rounded p-3 bg-card/50">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant="outline">
                            <Moon className="h-3 w-3 mr-1" /> {d.target_type || "intuicja"}
                          </Badge>
                          {isApproved && <Badge variant="secondary"><CheckCircle2 className="h-3 w-3 mr-1" /> zatwierdzony</Badge>}
                          {isRejected && <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> odrzucony</Badge>}
                          {isPending && <Badge>nowy</Badge>}
                          <span className="text-xs text-muted-foreground ml-auto">
                            {formatDistanceToNow(new Date(d.dreamed_at), { addSuffix: true, locale: pl })}
                          </span>
                        </div>
                        <div className="text-sm italic mb-1">„{d.dream_text}"</div>
                        {d.hypothesis && (
                          <div className="text-xs text-muted-foreground mt-1">
                            <span className="font-semibold text-foreground">Hipoteza:</span> {d.hypothesis}
                          </div>
                        )}
                        {d.proposed_action && Object.keys(d.proposed_action).length > 0 && (
                          <pre className="mt-2 text-[10px] text-muted-foreground overflow-x-auto bg-muted/30 p-2 rounded">
                            {JSON.stringify(d.proposed_action, null, 2)}
                          </pre>
                        )}
                        {isPending && (
                          <div className="flex gap-2 mt-2">
                            <Button size="sm" onClick={() => reviewDream(d.id, "approved")}>Zatwierdź</Button>
                            <Button size="sm" variant="outline" onClick={() => reviewDream(d.id, "rejected")}>Odrzuć</Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {dreams.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Aurora jeszcze nie śniła. Kliknij „Niech śni".
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WORLD */}
        <TabsContent value="world">
          <Card>
            <CardHeader>
              <CardTitle>Wiedza o świecie</CardTitle>
              <CardDescription>Co Aurora pobrała ze świata (Wikipedia, MusicBrainz, iTunes, Reddit, YouTube).</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {world.map((w) => (
                    <div key={w.id} className="border border-border rounded p-3 bg-card/50">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="outline">{w.source}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{w.source_type}</Badge>
                        {w.importance != null && <span className="text-xs text-muted-foreground">★ {w.importance}/10</span>}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {formatDistanceToNow(new Date(w.fetched_at), { addSuffix: true, locale: pl })}
                        </span>
                      </div>
                      <div className="font-semibold text-sm">{w.title}</div>
                      {w.summary && <div className="text-xs text-muted-foreground mt-1 line-clamp-3">{w.summary}</div>}
                      {w.source_url && (
                        <a href={w.source_url} target="_blank" rel="noreferrer" className="text-[10px] text-primary hover:underline mt-1 inline-block">
                          źródło ↗
                        </a>
                      )}
                    </div>
                  ))}
                  {world.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Aurora jeszcze nie zaglądała w świat. Kliknij „Pobierz puls świata".
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
