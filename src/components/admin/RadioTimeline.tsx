import { useState, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
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
}

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Music; color: string; bgColor: string }> = {
  track: { label: "Utwór", icon: Music, color: "text-primary", bgColor: "" },
  jingle: { label: "Jingiel", icon: Mic, color: "text-yellow-500", bgColor: "bg-yellow-500/5" },
  ad: { label: "Reklama", icon: Megaphone, color: "text-red-400", bgColor: "bg-red-500/5" },
  talk: { label: "Rozmowa", icon: MessageSquare, color: "text-blue-400", bgColor: "bg-blue-500/5" },
  announcement: { label: "🎹 Historia muz.", icon: Radio, color: "text-amber-400", bgColor: "bg-amber-500/5" },
};

export const RadioTimeline = ({ schedule, onMove, onRemove, onReorder }: Props) => {
  const [clipboard, setClipboard] = useState<{ item: TrackItem; mode: "cut" | "copy" } | null>(null);
  const [cutItemId, setCutItemId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1 flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Łącznie: {formatTime24h(totalDuration)}</span>
          <span className="text-xs">({schedule.length} el.)</span>
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
      <ScrollArea className="h-[500px] rounded-lg border border-border/50">
        <div className="min-w-full">
          <div className="sticky top-0 z-10 grid grid-cols-[32px_70px_55px_24px_1fr_130px_40px] gap-1 bg-muted/80 backdrop-blur px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border/50">
            <span>#</span>
            <span>Start</span>
            <span>Czas</span>
            <span></span>
            <span>Nazwa</span>
            <span>Opis</span>
            <span></span>
          </div>

          <div className="divide-y divide-border/20">
            {timelineData.map((item) => {
              const itemType = item.item_type || "track";
              const cfg = TYPE_CONFIG[itemType] || TYPE_CONFIG.track;
              const Icon = cfg.icon;

              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => handleDragStart(item.index)}
                  onDragOver={(e) => handleDragOver(e, item.index)}
                  onDrop={() => handleDrop(item.index)}
                  onDragEnd={handleDragEnd}
                  className={`grid grid-cols-[32px_70px_55px_24px_1fr_130px_40px] gap-1 items-center px-2 py-1.5 text-sm transition-all cursor-grab active:cursor-grabbing group
                    ${cutItemId === item.id ? "opacity-40 bg-destructive/10" : `hover:bg-muted/30 ${cfg.bgColor}`}
                    ${dragOverIndex === item.index ? "bg-primary/10 border-l-2 border-primary" : ""}
                    ${dragIndex === item.index ? "opacity-50" : ""}
                  `}
                >
                  <span className="flex items-center gap-0.5">
                    <GripVertical className="h-3 w-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="text-xs text-muted-foreground">{item.index + 1}</span>
                  </span>

                  <span className="text-xs font-mono text-primary/80">{formatTime24h(item.startTime)}</span>

                  <span className="text-xs font-mono text-muted-foreground">{formatDuration(getItemDuration(item))}</span>

                  <Icon className={`h-3.5 w-3.5 ${cfg.color} shrink-0`} />

                  <p className="text-sm font-medium truncate">
                    {item.lang && item.item_type === "announcement" && (
                      <span className="mr-1">{LANG_FLAGS[item.lang] || "🌐"}</span>
                    )}
                    {getItemTitle(item)}
                  </p>

                  <p className="text-xs text-muted-foreground truncate">{getItemSubtitle(item)}</p>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
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
