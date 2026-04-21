import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, Play, RefreshCw, Calendar, Volume2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";

interface Announcement {
  id: string;
  kind: string;
  script: string;
  audio_url: string;
  scheduled_for: string;
  created_at: string;
  played_count: number;
  post_title: string | null;
  post_slug: string | null;
  voice_id: string | null;
}

type FilterKind = "all" | "music_story_radio" | "blog";

export const RadioAnnouncementsLog = () => {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKind>("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("radio_announcements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      toast.error("Nie udało się pobrać zapowiedzi");
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("radio_announcements_log")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "radio_announcements" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const triggerNow = async (fn: "daily-blog-audio-announce" | "music-stories-generate" | "music-story-radio-announce") => {
    setTriggering(true);
    try {
      const { data, error } = await supabase.functions.invoke(fn, {
        body: { trigger: "manual-admin" },
      });
      if (error) throw error;
      toast.success("Wygenerowano", {
        description: data?.title || data?.artist || "Sprawdź listę poniżej",
      });
      await load();
    } catch (e: any) {
      toast.error("Błąd generowania", { description: e?.message });
    } finally {
      setTriggering(false);
    }
  };

  const playAudio = (item: Announcement) => {
    if (playingId === item.id) {
      setPlayingId(null);
      return;
    }
    setPlayingId(item.id);
    const audio = new Audio(item.audio_url);
    audio.play().catch(() => {
      toast.error("Nie udało się odtworzyć");
      setPlayingId(null);
    });
    audio.onended = () => setPlayingId(null);
  };

  const kindColor = (kind: string) => {
    if (kind === "blog" || kind === "blog_daily") return "text-primary border-primary/30 bg-primary/5";
    if (kind === "news") return "text-blue-400 border-blue-400/30 bg-blue-400/5";
    if (kind === "music_story_radio") return "text-amber-400 border-amber-400/40 bg-amber-400/5";
    return "text-muted-foreground border-border";
  };

  const kindLabel = (kind: string) => {
    if (kind === "music_story_radio") return "🎹 historia muz.";
    if (kind === "blog_daily" || kind === "blog") return "📝 blog";
    return kind;
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mic className="h-4 w-4 text-primary" />
            Zapowiedzi w radiu
            <Badge variant="outline" className="text-[10px] ml-1">
              blog: 08/14 · historie: 17/23
            </Badge>
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-1">
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              Odśwież
            </Button>
            <Button size="sm" variant="outline" onClick={() => triggerNow("daily-blog-audio-announce")} disabled={triggering} className="gap-1">
              <Volume2 className="h-3 w-3" />
              Blog audio
            </Button>
            <Button size="sm" variant="outline" onClick={() => triggerNow("music-stories-generate")} disabled={triggering} className="gap-1">
              <Mic className="h-3 w-3" />
              Nowa historia
            </Button>
            <Button size="sm" onClick={() => triggerNow("music-story-radio-announce")} disabled={triggering} className="gap-1">
              <Volume2 className={`h-3 w-3 ${triggering ? "animate-pulse" : ""}`} />
              {triggering ? "Generuję..." : "Historia → radio"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading && items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Ładowanie…</p>
        ) : items.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <p className="text-sm text-muted-foreground">Jeszcze nic nie wygenerowano.</p>
            <p className="text-xs text-muted-foreground">
              Codziennie o 08:00 i 14:00 (Europe/Warsaw) AI nagrywa zapowiedź najnowszego posta.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[420px]">
            <div className="space-y-2 pr-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-border/50 p-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="outline" className={`text-[10px] ${kindColor(item.kind)}`}>
                          {item.kind}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDistanceToNow(new Date(item.created_at), {
                            addSuffix: true,
                            locale: pl,
                          })}
                        </span>
                        {item.played_count > 0 && (
                          <Badge variant="secondary" className="text-[10px]">
                            ▶ {item.played_count}×
                          </Badge>
                        )}
                      </div>
                      {item.post_title && (
                        <p className="text-sm font-medium truncate">{item.post_title}</p>
                      )}
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {item.script}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant={playingId === item.id ? "default" : "outline"}
                        className="h-8 w-8"
                        onClick={() => playAudio(item)}
                      >
                        <Play className={`h-3.5 w-3.5 ${playingId === item.id ? "animate-pulse" : ""}`} />
                      </Button>
                      {item.post_slug && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          asChild
                        >
                          <a
                            href={`/blog/${item.post_slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
