import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HardDrive, Upload, Music, FileAudio, FileVideo, Play, Pause, Search, Loader2, CheckCircle, AlertCircle, X, Film, Download, Trash2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ALLOWED_AUDIO = ["audio/mpeg", "audio/wav", "audio/mp3", "audio/x-wav"];
const ALLOWED_VIDEO = ["video/mp4", "video/webm"];
const ALL_ALLOWED = [...ALLOWED_AUDIO, ...ALLOWED_VIDEO];
const MAX_SIZE = 500 * 1024 * 1024;

interface QueuedFile {
  id: string;
  file: File;
  title: string;
  artist: string;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
}

const parseFileName = (name: string) => {
  const clean = name.replace(/\.[^/.]+$/, "");
  const parts = clean.split(" - ");
  if (parts.length >= 2) return { artist: parts[0].trim(), title: parts.slice(1).join(" - ").trim() };
  return { artist: "", title: clean };
};

const Server = () => {
  const { user } = useAuth();
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "audio" | "video">("all");
  const [showUpload, setShowUpload] = useState(false);

  // Multi-upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<QueuedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const loadTracks = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("tracks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (filter === "audio") {
      query = query.not("audio_url", "is", null);
    } else if (filter === "video") {
      query = query.not("video_url", "is", null);
    } else {
      // Show only tracks that have actual media files
      query = query.or("audio_url.not.is.null,video_url.not.is.null");
    }

    const { data } = await query;
    setTracks((data as Track[]) || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { loadTracks(); }, [loadTracks]);

  const filtered = tracks.filter(t => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q) || (t.genre || "").toLowerCase().includes(q);
  });

  const validateFile = (f: File): string | null => {
    if (!ALL_ALLOWED.includes(f.type)) return "Dozwolone formaty: MP3, WAV, MP4, WebM";
    if (f.size > MAX_SIZE) return "Max rozmiar: 500MB";
    return null;
  };

  const addFilesToQueue = (files: FileList | File[]) => {
    const newItems: QueuedFile[] = [];
    for (const f of Array.from(files)) {
      const err = validateFile(f);
      if (err) { toast.error(`${f.name}: ${err}`); continue; }
      const { artist, title } = parseFileName(f.name);
      newItems.push({
        id: crypto.randomUUID(),
        file: f,
        title,
        artist: artist || "Unknown Artist",
        status: "pending",
        progress: 0,
      });
    }
    if (newItems.length > 0) {
      setUploadQueue(prev => [...prev, ...newItems]);
      setShowUpload(true);
    }
  };

  const removeFromQueue = (id: string) => {
    setUploadQueue(prev => prev.filter(q => q.id !== id));
  };

  const updateQueueItem = (id: string, updates: Partial<QueuedFile>) => {
    setUploadQueue(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const uploadAll = async () => {
    if (!user) { toast.error("Zaloguj się, aby przesyłać pliki"); return; }
    const pending = uploadQueue.filter(q => q.status === "pending");
    if (pending.length === 0) return;

    setIsUploading(true);

    for (const item of pending) {
      updateQueueItem(item.id, { status: "uploading", progress: 10 });
      try {
        const isVideo = ALLOWED_VIDEO.includes(item.file.type);
        const ext = item.file.name.split('.').pop();
        const safeName = item.title.replace(/[^a-zA-Z0-9\-_ ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, '').substring(0, 80);
        const filePath = `shared/${Date.now()}-${safeName}.${ext}`;

        updateQueueItem(item.id, { progress: 30 });
        const { error: uploadError } = await supabase.storage
          .from("music")
          .upload(filePath, item.file, { contentType: item.file.type });
        if (uploadError) throw uploadError;

        updateQueueItem(item.id, { progress: 70 });
        const { data: urlData } = supabase.storage.from("music").getPublicUrl(filePath);

        const { error: insertError } = await supabase.from("tracks").insert({
          title: item.title,
          artist: item.artist,
          duration: 0,
          audio_url: isVideo ? null : urlData.publicUrl,
          video_url: isVideo ? urlData.publicUrl : null,
        });
        if (insertError) throw insertError;

        updateQueueItem(item.id, { status: "done", progress: 100 });
      } catch (err: any) {
        updateQueueItem(item.id, { status: "error", error: err.message || "Błąd", progress: 0 });
      }
    }

    setIsUploading(false);
    const doneCount = uploadQueue.filter(q => q.status === "done" || pending.find(p => p.id === q.id)).length;
    toast.success(`Przesłano ${pending.length} plików na serwer!`);
    loadTracks();
  };

  const clearDone = () => {
    setUploadQueue(prev => prev.filter(q => q.status !== "done"));
  };

  const handleDownload = (track: Track) => {
    const url = track.audio_url || track.video_url;
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${track.artist} - ${track.title}`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatDuration = (s: number) => {
    if (!s) return "--:--";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const totalPending = uploadQueue.filter(q => q.status === "pending").length;
  const totalDone = uploadQueue.filter(q => q.status === "done").length;
  const overallProgress = uploadQueue.length > 0
    ? Math.round(uploadQueue.reduce((sum, q) => sum + q.progress, 0) / uploadQueue.length)
    : 0;

  return (
    <MainLayout>
      <div className="px-6 py-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <HardDrive className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold">Serwer Mediów</h1>
              <p className="text-sm text-muted-foreground">
                Wspólny dysk — pełne piosenki i teledyski dostępne dla wszystkich
              </p>
            </div>
          </div>
          <Button onClick={() => setShowUpload(!showUpload)} className="gap-2">
            <Upload className="h-4 w-4" />
            Wrzuć na serwer
          </Button>
        </div>

        {/* Upload Panel */}
        <AnimatePresence>
          {showUpload && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 overflow-hidden"
            >
              <div className="p-5 rounded-xl border border-border bg-card space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Upload className="h-4 w-4 text-primary" />
                    Masowy upload — przeciągnij wiele plików naraz
                  </h3>
                  <button onClick={() => setShowUpload(false)} className="p-1 rounded hover:bg-secondary">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Drop zone */}
                <div
                  onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); setDragActive(false); addFilesToQueue(e.dataTransfer.files); }}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all",
                    dragActive ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".mp3,.wav,.mp4,.webm"
                    multiple
                    onChange={(e) => { if (e.target.files) addFilesToQueue(e.target.files); e.target.value = ""; }}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-10 w-10 text-muted-foreground" />
                    <p className="font-medium text-sm">Przeciągnij pliki MP3, WAV, MP4, WebM</p>
                    <p className="text-xs text-muted-foreground">Możesz wybrać wiele plików naraz — max 500MB każdy</p>
                  </div>
                </div>

                {/* Queue list */}
                {uploadQueue.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {uploadQueue.map(item => (
                      <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/50 text-sm">
                        {ALLOWED_VIDEO.includes(item.file.type)
                          ? <FileVideo className="h-4 w-4 text-accent flex-shrink-0" />
                          : <FileAudio className="h-4 w-4 text-primary flex-shrink-0" />
                        }
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium text-xs">
                            {item.artist !== "Unknown Artist" ? `${item.artist} — ` : ""}{item.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{formatSize(item.file.size)}</p>
                          {item.status === "uploading" && <Progress value={item.progress} className="h-1 mt-1" />}
                        </div>
                        {item.status === "done" && <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />}
                        {item.status === "error" && (
                          <span className="text-[10px] text-destructive flex-shrink-0">{item.error}</span>
                        )}
                        {item.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />}
                        {item.status === "pending" && (
                          <button onClick={() => removeFromQueue(item.id)} className="p-1 rounded hover:bg-secondary">
                            <Trash2 className="h-3 w-3 text-muted-foreground" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Overall progress */}
                {isUploading && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Przesyłanie {totalDone}/{uploadQueue.length}...</span>
                      <span>{overallProgress}%</span>
                    </div>
                    <Progress value={overallProgress} className="h-2" />
                  </div>
                )}

                {/* Actions */}
                {uploadQueue.length > 0 && (
                  <div className="flex gap-2">
                    <Button
                      onClick={uploadAll}
                      disabled={isUploading || totalPending === 0}
                      className="flex-1 gap-2"
                    >
                      {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {isUploading ? "Przesyłam..." : `Wrzuć ${totalPending} ${totalPending === 1 ? "plik" : "plików"}`}
                    </Button>
                    {totalDone > 0 && (
                      <Button variant="outline" onClick={clearDone} className="gap-1">
                        <CheckCircle className="h-4 w-4" /> Wyczyść gotowe
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search & Filter */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Szukaj na serwerze..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-1 bg-secondary rounded-lg p-1">
            {(["all", "audio", "video"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f === "all" ? "Wszystkie" : f === "audio" ? "🎵 Muzyka" : "🎬 Wideo"}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-4 mb-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Music className="h-4 w-4" /> {filtered.length} plików na serwerze</span>
        </div>

        {/* Track List */}
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <HardDrive className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Serwer jest pusty</p>
            <p className="text-sm">Wrzuć pierwsze pliki klikając "Wrzuć na serwer"</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((track, i) => {
              const isCurrentTrack = currentTrack?.id === track.id;
              const hasVideo = !!track.video_url;
              return (
                <motion.div
                  key={track.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.5) }}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg transition-colors group cursor-pointer",
                    isCurrentTrack ? "bg-primary/10 border border-primary/30" : "hover:bg-secondary/60"
                  )}
                  onClick={() => {
                    if (isCurrentTrack) togglePlay();
                    else playTrack(track);
                  }}
                >
                  {/* Play button */}
                  <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                    {isCurrentTrack && isPlaying ? (
                      <Pause className="h-4 w-4 text-primary" />
                    ) : (
                      <Play className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                    )}
                  </div>

                  {/* Cover / type icon */}
                  <div className={cn(
                    "w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0",
                    hasVideo ? "bg-accent/20" : "bg-primary/10"
                  )}>
                    {track.cover_url ? (
                      <img src={track.cover_url} alt="" className="w-full h-full object-cover rounded-md" />
                    ) : hasVideo ? (
                      <Film className="h-5 w-5 text-accent" />
                    ) : (
                      <Music className="h-5 w-5 text-primary" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className={cn("font-medium text-sm truncate", isCurrentTrack && "text-primary")}>
                      {track.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                  </div>

                  {/* Badge */}
                  {hasVideo && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent/20 text-accent">VIDEO</span>
                  )}

                  {/* Genre */}
                  {track.genre && (
                    <span className="hidden sm:block text-xs text-muted-foreground">{track.genre}</span>
                  )}

                  {/* Duration */}
                  <span className="text-xs text-muted-foreground w-12 text-right">
                    {formatDuration(track.duration)}
                  </span>

                  {/* Download */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDownload(track); }}
                    className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-secondary transition-all"
                    title="Pobierz"
                  >
                    <Download className="h-4 w-4 text-muted-foreground" />
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Server;
