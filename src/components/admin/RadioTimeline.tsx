import { useState, useMemo, useRef } from "react";
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

interface Props {
  schedule: TrackItem[];
  onMove: (index: number, direction: "up" | "down") => void;
  onRemove: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

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

  // Calculate cumulative start times for each track
  const timelineData = useMemo(() => {
    let cumulative = 0;
    return schedule.map((item, index) => {
      const startTime = cumulative;
      const duration = item.track?.duration || 180;
      cumulative += duration;
      return {
        ...item,
        startTime,
        endTime: cumulative,
        index,
      };
    });
  }, [schedule]);

  const totalDuration = schedule.reduce((sum, s) => sum + (s.track?.duration || 0), 0);

  const handleCut = (item: TrackItem) => {
    setClipboard({ item, mode: "cut" });
    setCutItemId(item.id);
    toast.info(`✂️ Wycięto "${item.track?.title}"`);
  };

  const handleCopy = (item: TrackItem) => {
    setClipboard({ item, mode: "copy" });
    setCutItemId(null);
    toast.info(`📋 Skopiowano "${item.track?.title}"`);
  };

  const handlePaste = (targetIndex: number) => {
    if (!clipboard) {
      toast.error("Schowek jest pusty");
      return;
    }

    const sourceIndex = schedule.findIndex((s) => s.id === clipboard.item.id);
    if (sourceIndex === -1 && clipboard.mode === "cut") {
      toast.error("Element nie istnieje");
      setClipboard(null);
      setCutItemId(null);
      return;
    }

    if (clipboard.mode === "cut") {
      onReorder(sourceIndex, targetIndex);
      setCutItemId(null);
      toast.success(`📌 Wklejono "${clipboard.item.track?.title}" na pozycję ${targetIndex + 1}`);
    } else {
      // Copy mode - just notify, actual duplication would need DB insert
      toast.info(`Kopiowanie utworów wymaga dodania nowego wpisu`);
    }

    setClipboard(null);
  };

  // Drag handlers
  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (index: number) => {
    if (dragIndex !== null && dragIndex !== index) {
      onReorder(dragIndex, index);
      toast.success("Zmieniono kolejność");
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Łącznie: {formatTime24h(totalDuration)}</span>
          <span className="text-xs">({schedule.length} utworów)</span>
        </div>
        {clipboard && (
          <Badge variant="secondary" className="gap-1 text-xs">
            {clipboard.mode === "cut" ? <Scissors className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {clipboard.item.track?.title?.slice(0, 20)}...
          </Badge>
        )}
      </div>

      {/* Timeline Table */}
      <ScrollArea className="h-[500px] rounded-lg border border-border/50">
        <div className="min-w-full">
          {/* Table Header */}
          <div className="sticky top-0 z-10 grid grid-cols-[40px_80px_80px_1fr_160px_60px_40px] gap-1 bg-muted/80 backdrop-blur px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border/50">
            <span>#</span>
            <span>Start</span>
            <span>Czas</span>
            <span>Utwór</span>
            <span>Artysta</span>
            <span>Gatunek</span>
            <span></span>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-border/20">
            {timelineData.map((item) => (
              <div
                key={item.id}
                draggable
                onDragStart={() => handleDragStart(item.index)}
                onDragOver={(e) => handleDragOver(e, item.index)}
                onDrop={() => handleDrop(item.index)}
                onDragEnd={handleDragEnd}
                className={`grid grid-cols-[40px_80px_80px_1fr_160px_60px_40px] gap-1 items-center px-2 py-1.5 text-sm transition-all cursor-grab active:cursor-grabbing group
                  ${cutItemId === item.id ? "opacity-40 bg-destructive/10" : "hover:bg-muted/30"}
                  ${dragOverIndex === item.index ? "bg-primary/10 border-l-2 border-primary" : ""}
                  ${dragIndex === item.index ? "opacity-50" : ""}
                `}
              >
                {/* Position */}
                <span className="flex items-center gap-0.5">
                  <GripVertical className="h-3 w-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="text-xs text-muted-foreground">{item.index + 1}</span>
                </span>

                {/* Start Time */}
                <span className="text-xs font-mono text-primary/80">
                  {formatTime24h(item.startTime)}
                </span>

                {/* Duration */}
                <span className="text-xs font-mono text-muted-foreground">
                  {formatDuration(item.track?.duration || 0)}
                </span>

                {/* Title */}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{item.track?.title || "Nieznany"}</p>
                </div>

                {/* Artist */}
                <p className="text-xs text-muted-foreground truncate">{item.track?.artist || "—"}</p>

                {/* Genre */}
                <span className="text-[10px] text-muted-foreground/60 truncate">
                  {item.track?.genre || "—"}
                </span>

                {/* Context Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
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
                    <DropdownMenuItem
                      onClick={() => onMove(item.index, "up")}
                      disabled={item.index === 0}
                      className="gap-2"
                    >
                      <ArrowUp className="h-4 w-4" /> Przesuń w górę
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onMove(item.index, "down")}
                      disabled={item.index === schedule.length - 1}
                      className="gap-2"
                    >
                      <ArrowDown className="h-4 w-4" /> Przesuń w dół
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onRemove(item.id)}
                      className="gap-2 text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" /> Usuń z programu
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
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
          {/* Fill based on total duration vs 24h */}
          <div
            className="h-full groove-gradient-bg transition-all duration-500"
            style={{ width: `${Math.min((totalDuration / 86400) * 100, 100)}%` }}
          />
          {/* Hour markers */}
          {[6, 12, 18].map((h) => (
            <div
              key={h}
              className="absolute top-0 bottom-0 w-px bg-foreground/10"
              style={{ left: `${(h / 24) * 100}%` }}
            />
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
