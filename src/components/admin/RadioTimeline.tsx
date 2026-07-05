import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadToR2 } from "@/lib/r2Upload";
import {
  MoreVertical,
  Scissors,
  ClipboardPaste,
  Trash2,
  ArrowUp,
  ArrowDown,
  Copy,
  GripVertical,
  Clock,
  Music,
  Mic,
  Megaphone,
  MessageSquare,
  Radio,
  Plus,
  Loader2,
  Search,
  ImagePlus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TrackItem {
  id: string;
  track_id: string | null;
  position: number;
  item_type: string;
  custom_title: string | null;
  custom_duration: number;
  custom_audio_url: string | null;
  lang?: string | null;
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

const LANG_FLAGS: Record<string, string> = { pl: "🇵🇱", en: "🇬🇧", nl: "🇳🇱", ua: "🇺🇦" };

interface Props {
  schedule: TrackItem[];
  onMove: (index: number, direction: "up" | "down") => void;
  onRemove: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  currentScheduleId?: string | null;
  onAddAfter?: (index: number, files: FileList) => Promise<void> | void;
  onCoverUpdated?: () => void;
}

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Music; color: string; bgColor: string }> = {
  track: { label: "Utwór", icon: Music, color: "text-primary", bgColor: "" },
  jingle: { label: "Jingiel", icon: Mic, color: "text-yellow-500", bgColor: "bg-yellow-500/5" },
  ad: { label: "Reklama", icon: Megaphone, color: "text-red-400", bgColor: "bg-red-500/5" },
  talk: { label: "Rozmowa", icon: MessageSquare, color: "text-blue-400", bgColor: "bg-blue-500/5" },
  announcement: { label: "🎹 Historia muz.", icon: Radio, color: "text-amber-400", bgColor: "bg-amber-500/5" },
};

export const RadioTimeline = ({ schedule, onMove, onRemove, onReorder, currentScheduleId, onAddAfter, onCoverUpdated }: Props) => {
  const [clipboard, setClipboard] = useState<{ item: TrackItem; mode: "cut" | "copy" } | null>(null);
  const [cutItemId, setCutItemId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [uploadingRowIndex, setUploadingRowIndex] = useState<number | null>(null);
  const [filter, setFilter] = useState("");
  const [coverUploadingTrackId, setCoverUploadingTrackId] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const rowFileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingInsertIndexRef = useRef<number | null>(null);
  const coverFileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingCoverTrackIdRef = useRef<string | null>(null);

  // ── Okładka utworu: klik na miniaturę → wgraj grafikę → tracks.cover_url ──
  const triggerCoverUpload = (trackId: string) => {
    pendingCoverTrackIdRef.current = trackId;
    coverFileInputRef.current?.click();
  };

  const handleCoverFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const trackId = pendingCoverTrackIdRef.current;
    e.target.value = "";
    pendingCoverTrackIdRef.current = null;
    if (!file || !trackId) return;
    if (!file.type.startsWith("image/")) {
      toast.error("To nie jest plik graficzny (użyj JPG/PNG/WebP)");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Grafika za duża (max 8 MB)");
      return;
    }
    setCoverUploadingTrackId(trackId);
    try {
      const { publicUrl } = await uploadToR2({ file, folder: "covers" });
      const { error } = await supabase
        .from("tracks")
        .update({ cover_url: publicUrl } as any)
        .eq("id", trackId);
      if (error) throw error;
      toast.success("🖼️ Okładka ustawiona!");
      onCoverUpdated?.();
    } catch (err: any) {
      toast.error("Błąd okładki: " + (err?.message || "nieznany"));
    } finally {
      setCoverUploadingTrackId(null);
    }
  };

  useEffect(() => {
    if (!currentScheduleId) return;
    rowRefs.current[currentScheduleId]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [currentScheduleId]);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatTime24h = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600) % 24;
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const getItemDuration = (item: TrackItem) => {
    if (item.item_type === "track") return item.track?.duration || 180;
    return item.custom_duration || 30;
  };

  const getItemTitle = (item: TrackItem) => {
    if (item.item_type === "track") return item.track?.title || "Nieznany";
    return item.custom_title || TYPE_CONFIG[item.item_type]?.label || "Element";
  };

  const getItemSubtitle = (item: TrackItem) => {
    if (item.item_type === "track") return item.track?.artist || "—";
    return TYPE_CONFIG[item.item_type]?.label || item.item_type;
  };

  const timelineData = useMemo(() => {
    let cumulative = 0;
    return schedule.map((item, index) => {
      const startTime = cumulative;
      const duration = getItemDuration(item);
      cumulative += duration;
      return { ...item, startTime, endTime: cumulative, index };
    });
  }, [schedule]);

  // Filtr: szybkie wyszukiwanie w programie (tytuł / artysta / typ)
  const visibleData = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return timelineData;
    return timelineData.filter((item) => {
      const title = (item.item_type === "track" ? item.track?.title : item.custom_title) || "";
      const artist = item.track?.artist || "";
      const type = TYPE_CONFIG[item.item_type]?.label || item.item_type;
      return `${title} ${artist} ${type}`.toLowerCase().includes(q);
    });
  }, [timelineData, filter]);

  const totalDuration = schedule.reduce((sum, s) => sum + getItemDuration(s), 0);

  const handleCut = (item: TrackItem) => {
    setClipboard({ item, mode: "cut" });
    setCutItemId(item.id);
    toast.info(`✂️ Wycięto "${getItemTitle(item)}"`);
  };

  const handleCopy = (item: TrackItem) => {
    setClipboard({ item, mode: "copy" });
    setCutItemId(null);
    toast.info(`📋 Skopiowano "${getItemTitle(item)}"`);
  };

  const handlePaste = (targetIndex: number) => {
    if (!clipboard) { toast.error("Schowek jest pusty"); return; }
    const sourceIndex = schedule.findIndex((s) => s.id === clipboard.item.id);
    if (sourceIndex === -1 && clipboard.mode === "cut") {
      setClipboard(null); setCutItemId(null); return;
    }
    if (clipboard.mode === "cut") {
      onReorder(sourceIndex, targetIndex);
      setCutItemId(null);
      toast.success(`📌 Wklejono na pozycję ${targetIndex + 1}`);
    }
    setClipboard(null);
  };

  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => { e.preventDefault(); setDragOverIndex(index); };
  const handleDrop = (index: number) => {
    if (dragIndex !== null && dragIndex !== index) {
      onReorder(dragIndex, index);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };
  const handleDragEnd = () => { setDragIndex(null); setDragOverIndex(null); };

  const handleRowFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    const idx = pendingInsertIndexRef.current;
    e.target.value = "";
    if (!files || files.length === 0 || idx === null || !onAddAfter) return;
    setUploadingRowIndex(idx);
    try {
      await onAddAfter(idx, files);
    } finally {
      setUploadingRowIndex(null);
      pendingInsertIndexRef.current = null;
    }
  };

  const triggerRowUpload = (index: number) => {
    pendingInsertIndexRef.current = index;
    rowFileInputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      <input
        ref={rowFileInputRef}
        type="file"
        accept="audio/*,video/*"
        multiple
        className="hidden"
        onChange={handleRowFileChange}
      />
      <input
        ref={coverFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCoverFileChange}
      />
      {/* Header */}
      <div className="flex items-center justify-between px-1 flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>
            Łącznie: {totalDuration >= 86400 ? `${Math.floor(totalDuration / 86400)}d ` : ""}
            {formatTime24h(totalDuration)}
          </span>
          <span className="text-xs">({schedule.length} el.)</span>
        </div>
        <div className="relative flex-1 min-w-[180px] max-w-[300px]">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filtruj program..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
          {filter && (
            <button
              onClick={() => setFilter("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
            >
              ✕
            </button>
          )}
        </div>
        <div className="flex gap-1">
          {["track", "announcement", "jingle", "ad", "talk"].map((type) => {
            const count = schedule.filter((s) => (s.item_type || "track") === type).length;
            if (count === 0) return null;
            const cfg = TYPE_CONFIG[type];
            return (
              <Badge key={type} variant="outline" className={`text-[10px] gap-0.5 ${cfg.color}`}>
                {count} {cfg.label}
              </Badge>
            );
          })}
        </div>
        {clipboard && (
          <Badge variant="secondary" className="gap-1 text-xs">
            {clipboard.mode === "cut" ? <Scissors className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {getItemTitle(clipboard.item).slice(0, 20)}...
          </Badge>
        )}
      </div>

      {/* Timeline Table */}
      <ScrollArea className="h-[500px] rounded-lg border border-border bg-white text-black">
        <div className="min-w-full">
          <div className="sticky top-0 z-10 grid grid-cols-[32px_70px_55px_40px_1fr_130px_32px_40px] gap-1 bg-gray-100 px-2 py-2 text-xs font-semibold text-black border-b border-gray-300">
            <span>#</span>
            <span>Start</span>
            <span>Czas</span>
            <span title="Okładka — kliknij, by wgrać grafikę">🖼️</span>
            <span>Nazwa</span>
            <span>Opis</span>
            <span></span>
            <span></span>
          </div>

          <div className="divide-y divide-gray-200">
            {visibleData.map((item) => {
              const itemType = item.item_type || "track";
              const cfg = TYPE_CONFIG[itemType] || TYPE_CONFIG.track;
              const Icon = cfg.icon;
              const isCurrent = currentScheduleId === item.id;

              return (
                <div
                  key={item.id}
                  ref={(node) => { rowRefs.current[item.id] = node; }}
                  draggable
                  onDragStart={() => handleDragStart(item.index)}
                  onDragOver={(e) => handleDragOver(e, item.index)}
                  onDrop={() => handleDrop(item.index)}
                  onDragEnd={handleDragEnd}
                  className={`grid grid-cols-[32px_70px_55px_40px_1fr_130px_32px_40px] gap-1 items-center px-2 py-1.5 text-sm transition-all cursor-grab active:cursor-grabbing group text-black
                    ${isCurrent ? "bg-orange-400 !text-black ring-2 ring-inset ring-orange-600 shadow-[0_0_20px_rgba(249,115,22,0.6)] relative z-[1]" : cutItemId === item.id ? "opacity-40 bg-red-100" : "hover:bg-gray-100"}
                    ${dragOverIndex === item.index ? "bg-orange-100 border-l-2 border-orange-500" : ""}
                    ${dragIndex === item.index ? "opacity-50" : ""}
                  `}
                >
                  <span className="flex items-center gap-0.5">
                    <GripVertical className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="text-xs text-gray-600">{item.index + 1}</span>
                  </span>

                  <span className={`text-xs font-mono rounded px-1 py-0.5 ${isCurrent ? "bg-black text-orange-300 font-black shadow-sm" : "text-gray-700"}`}>{formatTime24h(item.startTime)}</span>

                  <span className={`text-xs font-mono ${isCurrent ? "text-black" : "text-gray-600"}`}>{formatDuration(getItemDuration(item))}</span>

                  {itemType === "track" && item.track ? (
                    <button
                      type="button"
                      title={item.track.cover_url ? "Kliknij, by zmienić okładkę" : "Kliknij, by wgrać okładkę"}
                      onClick={(e) => { e.stopPropagation(); triggerCoverUpload(item.track!.id); }}
                      disabled={coverUploadingTrackId !== null}
                      className="relative h-8 w-8 shrink-0 rounded overflow-hidden border border-gray-300 bg-gray-50 hover:ring-2 hover:ring-orange-400 transition-all"
                    >
                      {coverUploadingTrackId === item.track.id ? (
                        <span className="flex h-full w-full items-center justify-center">
                          <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                        </span>
                      ) : item.track.cover_url ? (
                        <img src={item.track.cover_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center">
                          <ImagePlus className="h-4 w-4 text-gray-400" />
                        </span>
                      )}
                    </button>
                  ) : (
                    <Icon className={`h-3.5 w-3.5 shrink-0 justify-self-center ${isCurrent ? "text-black" : cfg.color}`} />
                  )}

                  <p className={`text-sm truncate flex items-center gap-1.5 ${isCurrent ? "font-bold text-black" : "font-medium text-black"}`}>
                    {item.lang && item.item_type === "announcement" && (
                      <span className="mr-1">{LANG_FLAGS[item.lang] || "🌐"}</span>
                    )}
                    {getItemTitle(item)}
                    {isCurrent && (
                      <span className="shrink-0 text-[9px] font-bold px-1 py-0.5 rounded bg-black text-orange-300 animate-pulse">
                        ON AIR
                      </span>
                    )}
                  </p>

                  <p className={`text-xs truncate ${isCurrent ? "text-black" : "text-gray-600"}`}>{getItemSubtitle(item)}</p>

                  {onAddAfter ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Dodaj utwór z dysku po tej pozycji"
                      disabled={uploadingRowIndex !== null}
                      onClick={(e) => { e.stopPropagation(); triggerRowUpload(item.index); }}
                      className={`h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity ${isCurrent ? "text-black hover:bg-orange-300" : "text-emerald-600 hover:bg-emerald-100"}`}
                    >
                      {uploadingRowIndex === item.index
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Plus className="h-4 w-4" />}
                    </Button>
                  ) : <span />}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className={`h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity ${isCurrent ? "text-black hover:bg-orange-300" : "text-black hover:bg-gray-200"}`}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => handleCut(item)} className="gap-2">
                        <Scissors className="h-4 w-4" /> Wytnij
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleCopy(item)} className="gap-2">
                        <Copy className="h-4 w-4" /> Kopiuj
                      </DropdownMenuItem>
                      {clipboard && (
                        <DropdownMenuItem onClick={() => handlePaste(item.index)} className="gap-2">
                          <ClipboardPaste className="h-4 w-4" /> Wklej tutaj
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onMove(item.index, "up")} disabled={item.index === 0} className="gap-2">
                        <ArrowUp className="h-4 w-4" /> Przesuń w górę
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onMove(item.index, "down")} disabled={item.index === schedule.length - 1} className="gap-2">
                        <ArrowDown className="h-4 w-4" /> Przesuń w dół
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onRemove(item.id)} className="gap-2 text-destructive focus:text-destructive">
                        <Trash2 className="h-4 w-4" /> Usuń
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
            {visibleData.length === 0 && filter && (
              <p className="text-sm text-gray-500 text-center py-8">
                Brak wyników dla „{filter}"
              </p>
            )}
          </div>
        </div>
      </ScrollArea>


      {/* 24h Progress Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
          <span>00:00</span>
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>24:00</span>
        </div>
        <div className="h-3 w-full rounded-full bg-muted/50 overflow-hidden relative">
          <div
            className="h-full groove-gradient-bg transition-all duration-500"
            style={{ width: `${Math.min((totalDuration / 86400) * 100, 100)}%` }}
          />
          {[6, 12, 18].map((h) => (
            <div key={h} className="absolute top-0 bottom-0 w-px bg-foreground/10" style={{ left: `${(h / 24) * 100}%` }} />
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground text-center">
          Wypełnienie: {((totalDuration / 86400) * 100).toFixed(1)}% z 24h
          {totalDuration < 86400 && ` • Brakuje: ${formatTime24h(86400 - totalDuration)}`}
        </p>
      </div>
    </div>
  );
};
