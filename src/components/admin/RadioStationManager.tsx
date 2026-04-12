import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Mic,
  Megaphone,
  MessageSquare,
  Upload,
} from "lucide-react";
import { uploadToR2 } from "@/lib/r2Upload";
import { useAuth } from "@/contexts/AuthContext";
import { isAllowedMediaFile, MAX_UPLOAD_SIZE_BYTES, MEDIA_FILE_ACCEPT } from "@/lib/mediaFormats";
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
  track_id: string | null;
  position: number;
  item_type: string;
  custom_title: string | null;
  custom_duration: number;
  custom_audio_url: string | null;
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
  const [catalogTracks, setCatalogTracks] = useState<any[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogPage, setCatalogPage] = useState(0);
  const CATALOG_PAGE_SIZE = 50;

  // Custom item form
  const [customTitle, setCustomTitle] = useState("");
  const [customDuration, setCustomDuration] = useState(30);
  const [customAudioUrl, setCustomAudioUrl] = useState("");
  const [customType, setCustomType] = useState<"jingle" | "ad" | "talk">("jingle");

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

  const loadCatalog = async (page = 0) => {
    setCatalogLoading(true);
    const from = page * CATALOG_PAGE_SIZE;
    const to = from + CATALOG_PAGE_SIZE - 1;
    const { data } = await supabase
      .from("tracks")
      .select("id, title, artist, duration, audio_url, cover_url, genre")
      .not("audio_url", "is", null)
      .order("created_at", { ascending: false })
      .range(from, to);
    setCatalogTracks(data || []);
    setCatalogPage(page);
    setCatalogLoading(false);
    setCatalogOpen(true);
  };

  const addTrackToSchedule = async (track: any) => {
    const maxPos = schedule.length > 0 ? Math.max(...schedule.map((s) => s.position)) + 1 : 0;
    const { error } = await supabase.from("radio_schedule").insert({
      track_id: track.id,
      position: maxPos,
      item_type: "track",
    } as any);
    if (error) {
      toast.error("Błąd dodawania: " + error.message);
      return;
    }
    toast.success(`Dodano "${track.title}" do programu`);
    fetchData();
  };

  const addCustomItem = async () => {
    if (!customTitle.trim()) {
      toast.error("Podaj nazwę elementu");
      return;
    }
    const maxPos = schedule.length > 0 ? Math.max(...schedule.map((s) => s.position)) + 1 : 0;
    const { error } = await supabase.from("radio_schedule").insert({
      position: maxPos,
      item_type: customType,
      custom_title: customTitle.trim(),
      custom_duration: customDuration,
      custom_audio_url: customAudioUrl.trim() || null,
      track_id: null,
    } as any);
    if (error) {
      toast.error("Błąd: " + error.message);
      return;
    }
    const typeLabels: Record<string, string> = { jingle: "Jingiel", ad: "Reklamę", talk: "Rozmowę" };
    toast.success(`Dodano ${typeLabels[customType]}: "${customTitle}"`);
    setCustomTitle("");
    setCustomAudioUrl("");
    setCustomDuration(30);
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

  const reorderTrack = async (fromIndex: number, toIndex: number) => {
    const newSchedule = [...schedule];
    const [moved] = newSchedule.splice(fromIndex, 1);
    newSchedule.splice(toIndex, 0, moved);

    // Update all positions
    const updates = newSchedule.map((item, i) =>
      supabase.from("radio_schedule").update({ position: i } as any).eq("id", item.id)
    );
    await Promise.all(updates);
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

      {/* Add Content */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" />
            Dodaj do programu
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="tracks" className="space-y-3">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="tracks" className="gap-1">
                <Music className="h-3 w-3" /> Utwory
              </TabsTrigger>
              <TabsTrigger value="custom" className="gap-1">
                <Mic className="h-3 w-3" /> Jingle / Reklama / Rozmowa
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tracks" className="space-y-3">
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
                <Button onClick={() => loadCatalog(0)} disabled={catalogLoading} variant="outline" className="gap-1 shrink-0">
                  {catalogLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Music className="h-4 w-4" />}
                  Z katalogu
                </Button>
              </div>

              {/* Catalog browser */}
              {catalogOpen && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground font-medium">
                      Katalog utworów (strona {catalogPage + 1})
                    </p>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" disabled={catalogPage === 0} onClick={() => loadCatalog(catalogPage - 1)}>
                        ← Poprzednia
                      </Button>
                      <Button size="sm" variant="ghost" disabled={catalogTracks.length < CATALOG_PAGE_SIZE} onClick={() => loadCatalog(catalogPage + 1)}>
                        Następna →
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setCatalogOpen(false)}>
                        ✕
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="h-64 rounded border border-primary/20 bg-primary/5">
                    <div className="space-y-1 p-2">
                      {catalogTracks.map((track) => (
                        <div
                          key={track.id}
                          className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {track.cover_url && (
                              <img src={track.cover_url} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{track.title}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {track.artist} • {formatDuration(track.duration)} • {track.genre || "—"}
                              </p>
                            </div>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => addTrackToSchedule(track)} className="shrink-0 text-primary hover:text-primary">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {catalogTracks.length === 0 && !catalogLoading && (
                        <p className="text-sm text-muted-foreground text-center py-4">Brak utworów</p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}

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
                        <Button size="sm" variant="ghost" onClick={() => addTrackToSchedule(track)} className="shrink-0">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="custom" className="space-y-4">
              {/* Type selector */}
              <div className="flex gap-2">
                {([
                  { type: "jingle" as const, label: "Jingiel", icon: Music, color: "text-yellow-500" },
                  { type: "ad" as const, label: "Reklama", icon: Megaphone, color: "text-red-400" },
                  { type: "talk" as const, label: "Rozmowa", icon: MessageSquare, color: "text-blue-400" },
                ]).map(({ type, label, icon: Icon, color }) => (
                  <Button
                    key={type}
                    variant={customType === type ? "default" : "outline"}
                    size="sm"
                    className="gap-1 flex-1"
                    onClick={() => setCustomType(type)}
                  >
                    <Icon className={`h-3 w-3 ${customType === type ? "" : color}`} />
                    {label}
                  </Button>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Nazwa</Label>
                  <Input
                    placeholder={customType === "jingle" ? "np. Jingiel stacji" : customType === "ad" ? "np. Reklama - Sponsor" : "np. Wywiad z artystą"}
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Czas trwania (sekundy)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={7200}
                    value={customDuration}
                    onChange={(e) => setCustomDuration(parseInt(e.target.value) || 30)}
                  />
                </div>
              </div>

              <div>
                <Label>URL audio (opcjonalnie)</Label>
                <Input
                  placeholder="https://... link do pliku mp3"
                  value={customAudioUrl}
                  onChange={(e) => setCustomAudioUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Jeśli nie podasz URL, element będzie odliczany jako przerwa (cisza).
                </p>
              </div>

              <Button onClick={addCustomItem} className="w-full gap-2">
                <Plus className="h-4 w-4" />
                Dodaj {customType === "jingle" ? "jingiel" : customType === "ad" ? "reklamę" : "rozmowę"}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Schedule Timeline */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Music className="h-4 w-4" />
            Program radiowy ({schedule.length} elementów)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {schedule.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Brak elementów w programie. Dodaj utwory lub przerwy powyżej.
            </p>
          ) : (
            <RadioTimeline
              schedule={schedule}
              onMove={moveTrack}
              onRemove={removeFromSchedule}
              onReorder={reorderTrack}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};
