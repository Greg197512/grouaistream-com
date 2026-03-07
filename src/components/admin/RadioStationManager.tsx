import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Radio,
  Plus,
  Play,
  Square,
  Clock,
  Music,
  Link2,
  Search,
  Loader2,
  Copy,
} from "lucide-react";
import { RadioTimeline } from "./RadioTimeline";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RadioConfig {
  id: string;
  is_active: boolean;
  mode: string;
  start_time: string | null;
  end_time: string | null;
  started_at: string | null;
  station_name: string;
}

interface ScheduleTrack {
  id: string;
  track_id: string;
  position: number;
  track?: {
    id: string;
    title: string;
    artist: string;
    duration: number;
    audio_url: string | null;
    cover_url: string | null;
    genre: string | null;
  };
}

export const RadioStationManager = () => {
  const [config, setConfig] = useState<RadioConfig | null>(null);
  const [schedule, setSchedule] = useState<ScheduleTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const radioUrl = `${window.location.origin}/radio-live`;

  const fetchData = useCallback(async () => {
    const [configRes, scheduleRes] = await Promise.all([
      supabase.from("radio_config").select("*").limit(1).single(),
      supabase
        .from("radio_schedule")
        .select("*, track:tracks(*)")
        .order("position", { ascending: true }),
    ]);

    if (configRes.data) setConfig(configRes.data as any);
    if (scheduleRes.data) setSchedule(scheduleRes.data as any);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateConfig = async (updates: Partial<RadioConfig>) => {
    if (!config) return;
    const { error } = await supabase
      .from("radio_config")
      .update({ ...updates, updated_at: new Date().toISOString() } as any)
      .eq("id", config.id);
    if (error) {
      toast.error("Błąd: " + error.message);
      return;
    }
    setConfig((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  const toggleStation = async () => {
    if (!config) return;
    const newActive = !config.is_active;
    await updateConfig({
      is_active: newActive,
      started_at: newActive ? new Date().toISOString() : null,
    });
    toast.success(newActive ? "🔴 Stacja uruchomiona!" : "⬛ Stacja zatrzymana");
  };

  const searchTracks = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    const { data } = await supabase
      .from("tracks")
      .select("id, title, artist, duration, audio_url, cover_url, genre")
      .or(`title.ilike.%${searchQuery}%,artist.ilike.%${searchQuery}%`)
      .limit(20);
    setSearchResults(data || []);
    setSearching(false);
  };

  const addTrackToSchedule = async (track: any) => {
    const maxPos = schedule.length > 0 ? Math.max(...schedule.map((s) => s.position)) + 1 : 0;
    const { error } = await supabase.from("radio_schedule").insert({
      track_id: track.id,
      position: maxPos,
    } as any);
    if (error) {
      toast.error("Błąd dodawania: " + error.message);
      return;
    }
    toast.success(`Dodano "${track.title}" do programu`);
    fetchData();
  };

  const removeFromSchedule = async (id: string) => {
    await supabase.from("radio_schedule").delete().eq("id", id);
    toast.success("Usunięto z programu");
    fetchData();
  };

  const moveTrack = async (index: number, direction: "up" | "down") => {
    const newSchedule = [...schedule];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newSchedule.length) return;

    const tempPos = newSchedule[index].position;
    newSchedule[index].position = newSchedule[swapIndex].position;
    newSchedule[swapIndex].position = tempPos;

    await Promise.all([
      supabase.from("radio_schedule").update({ position: newSchedule[index].position } as any).eq("id", newSchedule[index].id),
      supabase.from("radio_schedule").update({ position: newSchedule[swapIndex].position } as any).eq("id", newSchedule[swapIndex].id),
    ]);
    fetchData();
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const totalDuration = schedule.reduce((sum, s) => sum + (s.track?.duration || 0), 0);

  const copyLink = () => {
    navigator.clipboard.writeText(radioUrl);
    toast.success("Link skopiowany!");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Station Config */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            Rozgłośnia Radiowa
          </CardTitle>
          <CardDescription>Zarządzaj swoją stacją radiową online</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status + Controls */}
          <div className="flex flex-wrap items-center gap-4">
            <Button
              onClick={toggleStation}
              variant={config?.is_active ? "destructive" : "default"}
              className="gap-2"
            >
              {config?.is_active ? (
                <>
                  <Square className="h-4 w-4" /> Zatrzymaj stację
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" /> Uruchom stację
                </>
              )}
            </Button>

            {config?.is_active && (
              <Badge variant="destructive" className="animate-pulse gap-1">
                <span className="h-2 w-2 rounded-full bg-current" />
                NA ŻYWO
              </Badge>
            )}

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Łączny czas: {formatDuration(totalDuration)} ({schedule.length} utworów)
            </div>
          </div>

          {/* Mode */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Nazwa stacji</Label>
              <Input
                value={config?.station_name || ""}
                onChange={(e) => updateConfig({ station_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Tryb</Label>
              <Select
                value={config?.mode || "24h"}
                onValueChange={(v) => updateConfig({ mode: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">24H non-stop</SelectItem>
                  <SelectItem value="scheduled">Zaplanowany</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {config?.mode === "scheduled" && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label>Start</Label>
                  <Input
                    type="time"
                    value={config?.start_time || ""}
                    onChange={(e) => updateConfig({ start_time: e.target.value })}
                  />
                </div>
                <div className="flex-1">
                  <Label>Stop</Label>
                  <Input
                    type="time"
                    value={config?.end_time || ""}
                    onChange={(e) => updateConfig({ end_time: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Share Link */}
          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 p-3">
            <Link2 className="h-4 w-4 text-primary shrink-0" />
            <code className="flex-1 text-xs text-muted-foreground truncate">{radioUrl}</code>
            <Button size="sm" variant="outline" className="gap-1 shrink-0" onClick={copyLink}>
              <Copy className="h-3 w-3" /> Kopiuj
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Add Tracks */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" />
            Dodaj utwory do programu
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Szukaj utworu lub artysty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchTracks()}
            />
            <Button onClick={searchTracks} disabled={searching} className="gap-1 shrink-0">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Szukaj
            </Button>
          </div>

          {searchResults.length > 0 && (
            <ScrollArea className="h-48 rounded border border-border/30">
              <div className="space-y-1 p-2">
                {searchResults.map((track) => (
                  <div
                    key={track.id}
                    className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{track.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {track.artist} • {formatDuration(track.duration)} • {track.genre || "—"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => addTrackToSchedule(track)}
                      className="shrink-0"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Schedule / Queue */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Music className="h-4 w-4" />
            Program radiowy ({schedule.length} utworów)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {schedule.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Brak utworów w programie. Dodaj utwory powyżej.
            </p>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-1">
                {schedule.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-muted/30 transition-colors group"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    <span className="text-xs text-muted-foreground w-6 text-right shrink-0">
                      {index + 1}.
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {item.track?.title || "Nieznany"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.track?.artist || "—"} • {formatDuration(item.track?.duration || 0)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => moveTrack(index, "up")}
                        disabled={index === 0}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => moveTrack(index, "down")}
                        disabled={index === schedule.length - 1}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeFromSchedule(item.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
