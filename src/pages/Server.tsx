import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  HardDrive, Upload, Music, FileAudio, FileVideo, Play, Pause, Search, 
  Loader2, CheckCircle, AlertCircle, X, Film, Download, Trash2, 
  FolderOpen, Sparkles, Library, ImageIcon, RefreshCw
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { useUnlock } from "@/contexts/UnlockContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ALLOWED_AUDIO = ["audio/mpeg", "audio/wav", "audio/mp3", "audio/x-wav"];
const ALLOWED_VIDEO = ["video/mp4", "video/webm"];
const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALL_ALLOWED = [...ALLOWED_AUDIO, ...ALLOWED_VIDEO];
const MAX_SIZE = 500 * 1024 * 1024;

interface QueuedFile {
  id: string;
  file: File;
  title: string;
  artist: string;
  relativePath?: string;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
  coverFile?: File;
  coverPreview?: string;
}

const parseFileName = (name: string) => {
  const clean = name.replace(/\.[^/.]+$/, "");
  const parts = clean.split(" - ");
  if (parts.length >= 2) return { artist: parts[0].trim(), title: parts.slice(1).join(" - ").trim() };
  return { artist: "", title: clean };
};

const GENRE_COLORS: Record<string, string> = {
  Rock: "bg-red-500/20 text-red-400",
  Pop: "bg-pink-500/20 text-pink-400",
  Punk: "bg-orange-500/20 text-orange-400",
  "Pop-Punk": "bg-amber-500/20 text-amber-400",
  Metal: "bg-zinc-500/20 text-zinc-300",
  Electronic: "bg-cyan-500/20 text-cyan-400",
  "Hip-Hop": "bg-purple-500/20 text-purple-400",
  Rap: "bg-violet-500/20 text-violet-400",
  Jazz: "bg-yellow-500/20 text-yellow-400",
  Classical: "bg-emerald-500/20 text-emerald-400",
  Indie: "bg-teal-500/20 text-teal-400",
  Alternative: "bg-sky-500/20 text-sky-400",
  "R&B": "bg-rose-500/20 text-rose-400",
};

const Server = () => {
  const { user } = useAuth();
  const { playTrack, currentTrack, isPlaying, togglePlay, playPlaylist } = usePlayer();
  const { filterTracks } = useUnlock();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "audio" | "video">("all");
  const [showUpload, setShowUpload] = useState(false);

  // Multi-upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<QueuedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  // AI state
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());
  const [coverGenProgress, setCoverGenProgress] = useState<{ current: number; total: number } | null>(null);

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
      query = query.or("audio_url.not.is.null,video_url.not.is.null");
    }

    const { data } = await query;
    setTracks(filterTracks((data as Track[]) || []));
    setLoading(false);
  }, [filter]);

  useEffect(() => { loadTracks(); }, [loadTracks]);

  const filtered = tracks.filter(t => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q) || (t.genre || "").toLowerCase().includes(q);
  });

  const validateFile = (f: File): string | null => {
    if (!ALL_ALLOWED.includes(f.type)) return "Dozwolone: MP3, WAV, MP4, WebM";
    if (f.size > MAX_SIZE) return "Max: 500MB";
    return null;
  };

  const addFilesToQueue = (files: FileList | File[], relativePaths?: string[]) => {
    const newItems: QueuedFile[] = [];
    const arr = Array.from(files);
    for (let i = 0; i < arr.length; i++) {
      const f = arr[i];
      const err = validateFile(f);
      if (err) { toast.error(`${f.name}: ${err}`); continue; }
      const { artist, title } = parseFileName(f.name);
      newItems.push({
        id: crypto.randomUUID(),
        file: f,
        title,
        artist: artist || "Unknown Artist",
        relativePath: relativePaths?.[i] || (f as any).webkitRelativePath || undefined,
        status: "pending",
        progress: 0,
      });
    }
    if (newItems.length > 0) {
      setUploadQueue(prev => [...prev, ...newItems]);
      setShowUpload(true);
      toast.info(`Dodano ${newItems.length} plików do kolejki`);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const items = e.dataTransfer.items;
    if (items) {
      const files: File[] = [];
      const paths: string[] = [];
      const entries: any[] = [];
      
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.();
        if (entry) entries.push(entry);
      }
      
      if (entries.length > 0 && entries.some(e => e.isDirectory)) {
        // Handle directory drop
        const readDirectory = (dirEntry: any, path: string): Promise<void> => {
          return new Promise((resolve) => {
            const reader = dirEntry.createReader();
            reader.readEntries(async (dirEntries: any[]) => {
              for (const entry of dirEntries) {
                if (entry.isFile) {
                  await new Promise<void>((res) => {
                    entry.file((file: File) => {
                      if (ALL_ALLOWED.includes(file.type)) {
                        files.push(file);
                        paths.push(`${path}/${file.name}`);
                      }
                      res();
                    });
                  });
                } else if (entry.isDirectory) {
                  await readDirectory(entry, `${path}/${entry.name}`);
                }
              }
              resolve();
            });
          });
        };
        
        Promise.all(entries.map(entry => {
          if (entry.isDirectory) return readDirectory(entry, entry.name);
          return new Promise<void>((res) => {
            entry.file((file: File) => {
              if (ALL_ALLOWED.includes(file.type)) {
                files.push(file);
                paths.push(file.name);
              }
              res();
            });
          });
        })).then(() => {
          addFilesToQueue(files as any, paths);
        });
      } else {
        addFilesToQueue(e.dataTransfer.files);
      }
    } else {
      addFilesToQueue(e.dataTransfer.files);
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
    const uploadedIds: string[] = [];

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

        const { data: insertData, error: insertError } = await supabase.from("tracks").insert({
          title: item.title,
          artist: item.artist,
          duration: 0,
          audio_url: isVideo ? null : urlData.publicUrl,
          video_url: isVideo ? urlData.publicUrl : null,
        }).select("id").single();
        if (insertError) throw insertError;
        
        if (insertData) uploadedIds.push(insertData.id);
        updateQueueItem(item.id, { status: "done", progress: 100 });
      } catch (err: any) {
        updateQueueItem(item.id, { status: "error", error: err.message || "Błąd", progress: 0 });
      }
    }

    setIsUploading(false);
    const doneCount = pending.filter(p => uploadQueue.find(q => q.id === p.id)?.status !== "error").length;
    toast.success(`Przesłano ${doneCount} plików na serwer!`);
    loadTracks();

    // Auto-categorize uploaded tracks with AI
    if (uploadedIds.length > 0) {
      categorizeWithAI(uploadedIds);
    }
  };

  const categorizeWithAI = async (trackIds?: string[]) => {
    setIsCategorizing(true);
    toast.loading("🤖 AI kategoryzuje utwory...", { id: "ai-cat" });
    
    try {
      const ids = trackIds || Array.from(selectedTracks);
      const { data, error } = await supabase.functions.invoke("ai-categorize", {
        body: { trackIds: ids },
      });

      if (error) throw error;
      
      toast.success(
        `✨ AI zaktualizowało ${data.categorized}/${data.total} utworów!`, 
        { id: "ai-cat", duration: 3000 }
      );
      loadTracks();
      setSelectedTracks(new Set());

      // Now generate covers one-by-one in background
      generateCoversInBackground(ids);
    } catch (err: any) {
      toast.error(err.message || "Błąd AI", { id: "ai-cat" });
    } finally {
      setIsCategorizing(false);
    }
  };


  const generateCoversInBackground = async (trackIds: string[]) => {
    // Fetch tracks that need covers
    const { data: tracksNeedingCovers } = await supabase
      .from("tracks")
      .select("id, cover_url")
      .in("id", trackIds);

    const needCover = (tracksNeedingCovers || []).filter(
      t => !t.cover_url || t.cover_url.includes("picsum.photos")
    );

    if (needCover.length === 0) return;

    setCoverGenProgress({ current: 0, total: needCover.length });
    toast.loading(`🎨 Generuję okładki AI: 0/${needCover.length}...`, { id: "ai-covers" });

    let done = 0;
    for (const t of needCover) {
      try {
        await supabase.functions.invoke("ai-cover", {
          body: { trackId: t.id },
        });
        done++;
        setCoverGenProgress({ current: done, total: needCover.length });
        toast.loading(`🎨 Generuję okładki AI: ${done}/${needCover.length}...`, { id: "ai-covers" });
        
        // Refresh list periodically
        if (done % 3 === 0 || done === needCover.length) {
          loadTracks();
        }
      } catch (err) {
        console.error("Cover gen failed for", t.id, err);
      }
    }

    setCoverGenProgress(null);
    toast.success(`🎨 Wygenerowano ${done} okładek AI!`, { id: "ai-covers", duration: 4000 });
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

  const toggleTrackSelect = (id: string) => {
    setSelectedTracks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addToLibrary = async (trackIds: string[]) => {
    if (!user) { toast.error("Zaloguj się"); return; }
    
    try {
      let added = 0;
      let skipped = 0;
      
      for (const trackId of trackIds) {
        // Check if already liked
        const { data: existing } = await supabase
          .from("liked_songs")
          .select("id")
          .eq("user_id", user.id)
          .eq("track_id", trackId)
          .maybeSingle();
        
        if (existing) {
          skipped++;
          continue;
        }
        
        const { error } = await supabase.from("liked_songs").insert({
          user_id: user.id,
          track_id: trackId,
        });
        
        if (error) {
          console.error("Error adding track to library:", error);
          continue;
        }
        added++;
      }
      
      if (added > 0) {
        toast.success(`❤️ Dodano ${added} utworów do biblioteki!`);
      }
      if (skipped > 0) {
        toast.info(`${skipped} utworów już było w bibliotece`);
      }
      setSelectedTracks(new Set());
    } catch (err: any) {
      toast.error(err.message || "Błąd dodawania do biblioteki");
    }
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

  const uncategorizedCount = tracks.filter(t => !t.genre || !t.cover_url).length;

  return (
    <MainLayout>
      <div className="px-6 py-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <motion.div 
              className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              <HardDrive className="h-8 w-8 text-primary" />
            </motion.div>
            <div>
              <h1 className="font-display text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Serwer Mediów
              </h1>
              <p className="text-sm text-muted-foreground">
                Wspólny dysk — pełne piosenki i teledyski • AI automatycznie kategoryzuje
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {uncategorizedCount > 0 && (
              <Button
                variant="outline"
                onClick={() => categorizeWithAI()}
                disabled={isCategorizing}
                className="gap-2"
              >
                {isCategorizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                AI Kategoryzuj ({uncategorizedCount})
              </Button>
            )}
            <Button onClick={() => setShowUpload(!showUpload)} className="gap-2">
              <Upload className="h-4 w-4" />
              Wrzuć na serwer
            </Button>
          </div>
        </div>

        {/* Selected tracks actions */}
        {/* Select All bar */}
        <div className="mb-4 flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (selectedTracks.size === filtered.length) {
                setSelectedTracks(new Set());
              } else {
                setSelectedTracks(new Set(filtered.map(t => t.id)));
              }
            }}
            className="gap-1"
          >
            <CheckCircle className="h-3.5 w-3.5" />
            {selectedTracks.size === filtered.length && filtered.length > 0 ? "Odznacz wszystkie" : "Zaznacz wszystkie"}
          </Button>
          {filtered.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {selectedTracks.size}/{filtered.length} zaznaczono
            </span>
          )}
        </div>

        <AnimatePresence>
          {selectedTracks.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-3 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-between flex-wrap gap-2"
            >
              <span className="text-sm font-medium">
                Zaznaczono {selectedTracks.size} utworów
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => addToLibrary(Array.from(selectedTracks))} className="gap-1">
                  <Library className="h-3.5 w-3.5" /> Przenieś do biblioteki
                </Button>
                <Button size="sm" variant="outline" onClick={() => categorizeWithAI(Array.from(selectedTracks))} disabled={isCategorizing} className="gap-1">
                  <Sparkles className="h-3.5 w-3.5" /> AI Kategoryzuj
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  const selTracks = tracks.filter(t => selectedTracks.has(t.id));
                  if (selTracks.length) playPlaylist(selTracks);
                }} className="gap-1">
                  <Play className="h-3.5 w-3.5" /> Odtwórz
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedTracks(new Set())}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                    Upload — pliki lub całe katalogi
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
                  onDrop={handleDrop}
                  className={cn(
                    "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
                    dragActive ? "border-primary bg-primary/10 scale-[1.01]" : "border-border hover:border-primary/50"
                  )}
                >
                  <div className="flex flex-col items-center gap-3">
                    <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                      <Upload className="h-12 w-12 text-muted-foreground" />
                    </motion.div>
                    <div>
                      <p className="font-medium">Przeciągnij pliki lub foldery tutaj</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        MP3, WAV, MP4, WebM — max 500MB każdy
                      </p>
                    </div>
                    <div className="flex flex-col items-center gap-2 mt-2">
                      <div className="flex gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".mp3,.wav,.mp4,.webm"
                          multiple
                          onChange={(e) => { if (e.target.files) addFilesToQueue(e.target.files); e.target.value = ""; }}
                          className="hidden"
                        />
                        <input
                          ref={folderInputRef}
                          type="file"
                          // @ts-ignore
                          webkitdirectory=""
                          // @ts-ignore
                          directory=""
                          multiple
                          onChange={(e) => {
                            if (e.target.files) {
                              const files = Array.from(e.target.files).filter(f => ALL_ALLOWED.includes(f.type));
                              const paths = files.map(f => (f as any).webkitRelativePath || f.name);
                              addFilesToQueue(files as any, paths);
                            }
                            e.target.value = "";
                          }}
                          className="hidden"
                        />
                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} className="gap-1">
                          <Music className="h-4 w-4" /> Wybierz pliki
                        </Button>
                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click(); }} className="gap-1">
                          <FolderOpen className="h-4 w-4" /> + Dodaj katalog
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Klikaj „+ Dodaj katalog" wielokrotnie — pliki z każdego katalogu trafią do kolejki
                      </p>
                    </div>
                  </div>
                </div>

                {/* AI info */}
                <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/10 text-sm">
                  <Sparkles className="h-4 w-4 text-accent flex-shrink-0" />
                  <span>AI automatycznie skategoryzuje utwory (gatunek, nastrój) i wygeneruje okładki po uploadzie</span>
                </div>

                {/* Queue list */}
                {uploadQueue.length > 0 && (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {uploadQueue.map(item => (
                      <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/50 text-sm">
                        {ALLOWED_VIDEO.includes(item.file.type)
                          ? <FileVideo className="h-4 w-4 text-accent flex-shrink-0" />
                          : <FileAudio className="h-4 w-4 text-primary flex-shrink-0" />
                        }
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium text-xs">
                            {item.artist !== "Unknown Artist" ? `${item.artist} — ` : ""}{item.title}
                          </p>
                          <div className="flex gap-2 text-[10px] text-muted-foreground">
                            <span>{formatSize(item.file.size)}</span>
                            {item.relativePath && <span className="truncate">📁 {item.relativePath}</span>}
                          </div>
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
                      {isUploading ? "Przesyłam..." : `Wrzuć ${totalPending} ${totalPending === 1 ? "plik" : "plików"} + AI`}
                    </Button>
                    {totalDone > 0 && (
                      <Button variant="outline" onClick={clearDone} className="gap-1">
                        <CheckCircle className="h-4 w-4" /> Wyczyść
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
        <div className="flex gap-4 mb-6 text-sm text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1"><Music className="h-4 w-4" /> {filtered.length} plików</span>
          {uncategorizedCount > 0 && (
            <span className="flex items-center gap-1 text-amber-400">
              <AlertCircle className="h-4 w-4" /> {uncategorizedCount} bez kategorii
            </span>
          )}
          {isCategorizing && (
            <span className="flex items-center gap-1 text-accent">
              <Loader2 className="h-4 w-4 animate-spin" /> AI kategoryzuje...
            </span>
          )}
          {coverGenProgress && (
            <span className="flex items-center gap-1 text-accent">
              <ImageIcon className="h-4 w-4 animate-pulse" /> Okładki: {coverGenProgress.current}/{coverGenProgress.total}
            </span>
          )}
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
              const isSelected = selectedTracks.has(track.id);
              const genreClass = track.genre ? GENRE_COLORS[track.genre] || "bg-muted text-muted-foreground" : "";

              return (
                <motion.div
                  key={track.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.015, 0.4) }}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg transition-all group cursor-pointer",
                    isCurrentTrack ? "bg-primary/10 border border-primary/30" : "hover:bg-secondary/60",
                    isSelected && "ring-2 ring-primary/50 bg-primary/5"
                  )}
                >
                  {/* Checkbox */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleTrackSelect(track.id); }}
                    className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                      isSelected ? "bg-primary border-primary" : "border-muted-foreground/30 hover:border-primary"
                    )}
                  >
                    {isSelected && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
                  </button>

                  {/* Play button */}
                  <div
                    className="w-8 h-8 flex items-center justify-center flex-shrink-0"
                    onClick={() => {
                      if (isCurrentTrack) togglePlay();
                      else playTrack(track);
                    }}
                  >
                    {isCurrentTrack && isPlaying ? (
                      <Pause className="h-4 w-4 text-primary" />
                    ) : (
                      <Play className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    )}
                  </div>

                  {/* Cover */}
                  <div className={cn(
                    "w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden",
                    hasVideo ? "bg-accent/20" : "bg-primary/10"
                  )}>
                    {track.cover_url ? (
                      <img src={track.cover_url} alt="" className="w-full h-full object-cover" />
                    ) : hasVideo ? (
                      <Film className="h-5 w-5 text-accent" />
                    ) : (
                      <Music className="h-5 w-5 text-primary" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0" onClick={() => {
                    if (isCurrentTrack) togglePlay();
                    else playTrack(track);
                  }}>
                    <p className={cn("font-medium text-sm truncate", isCurrentTrack && "text-primary")}>
                      {track.title}
                    </p>
                    <div className="flex items-center gap-1"><p className="text-xs text-muted-foreground truncate">{track.artist}</p><span className="text-[7px] font-bold text-primary/70 whitespace-nowrap">Grouarock®</span></div>
                  </div>

                  {/* Genre badge */}
                  {track.genre && (
                    <Badge variant="secondary" className={cn("text-[10px] hidden sm:flex", genreClass)}>
                      {track.genre}
                    </Badge>
                  )}

                  {/* Video badge */}
                  {hasVideo && (
                    <Badge variant="secondary" className="text-[10px] bg-accent/20 text-accent">VIDEO</Badge>
                  )}

                  {/* Mood */}
                  {track.mood && (
                    <span className="hidden md:block text-[10px] text-muted-foreground">{track.mood}</span>
                  )}

                  {/* Duration */}
                  <span className="text-xs text-muted-foreground w-12 text-right">
                    {formatDuration(track.duration)}
                  </span>

                  {/* Actions */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); addToLibrary([track.id]); }}
                      className="p-1.5 rounded-md hover:bg-secondary transition-all"
                      title="Dodaj do biblioteki"
                    >
                      <Library className="h-4 w-4 text-muted-foreground hover:text-primary" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownload(track); }}
                      className="p-1.5 rounded-md hover:bg-secondary transition-all"
                      title="Pobierz"
                    >
                      <Download className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
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
