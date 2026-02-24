import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HardDrive, Upload, Music, FileAudio, FileVideo, Play, Pause, Search, Loader2, CheckCircle, AlertCircle, X, Film, Download } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ALLOWED_AUDIO = ["audio/mpeg", "audio/wav", "audio/mp3", "audio/x-wav"];
const ALLOWED_VIDEO = ["video/mp4", "video/webm"];
const MAX_SIZE = 500 * 1024 * 1024; // 500MB for full songs/videos

const Server = () => {
  const { user } = useAuth();
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "audio" | "video">("all");
  const [showUpload, setShowUpload] = useState(false);
  
  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [genre, setGenre] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (![...ALLOWED_AUDIO, ...ALLOWED_VIDEO].includes(f.type)) return "Dozwolone formaty: MP3, WAV, MP4, WebM";
    if (f.size > MAX_SIZE) return "Max rozmiar: 500MB";
    return null;
  };

  const handleFileSelect = (f: File) => {
    setError(null);
    const err = validateFile(f);
    if (err) { setError(err); return; }
    setFile(f);
    const name = f.name.replace(/\.[^/.]+$/, "");
    const parts = name.split(" - ");
    if (parts.length >= 2) { setArtist(parts[0].trim()); setTitle(parts.slice(1).join(" - ").trim()); }
    else setTitle(name);
  };

  const handleUpload = async () => {
    if (!user) { toast.error("Zaloguj się, aby przesyłać pliki"); return; }
    if (!file || !title.trim()) { toast.error("Wybierz plik i wpisz tytuł"); return; }

    setUploading(true);
    setUploadProgress(0);
    try {
      const isVideo = ALLOWED_VIDEO.includes(file.type);
      const ext = file.name.split('.').pop();
      const safeName = title.replace(/[^a-zA-Z0-9\-_ ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, '').substring(0, 80);
      const filePath = `shared/${Date.now()}-${safeName}.${ext}`;

      setUploadProgress(10);
      const { error: uploadError } = await supabase.storage
        .from("music")
        .upload(filePath, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      setUploadProgress(60);

      const { data: urlData } = supabase.storage.from("music").getPublicUrl(filePath);
      setUploadProgress(80);

      const { error: insertError } = await supabase.from("tracks").insert({
        title: title.trim(),
        artist: artist.trim() || "Unknown Artist",
        genre: genre || null,
        duration: 0,
        audio_url: isVideo ? null : urlData.publicUrl,
        video_url: isVideo ? urlData.publicUrl : null,
        cover_url: null,
        mood: null,
      });
      if (insertError) throw insertError;
      setUploadProgress(100);

      toast.success(`"${title}" przesłany na serwer!`);
      setFile(null); setTitle(""); setArtist(""); setGenre(""); setError(null); setShowUpload(false);
      loadTracks();
    } catch (err: any) {
      toast.error(err.message || "Błąd przesyłania");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
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
                    Wrzuć plik na wspólny serwer
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
                  onDrop={(e) => { e.preventDefault(); setDragActive(false); if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]); }}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all",
                    dragActive ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
                    file && "border-green-500 bg-green-500/10"
                  )}
                >
                  <input ref={fileInputRef} type="file" accept=".mp3,.wav,.mp4,.webm" onChange={(e) => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]); }} className="hidden" />
                  {file ? (
                    <div className="flex items-center justify-center gap-3">
                      {ALLOWED_VIDEO.includes(file.type) ? <FileVideo className="h-8 w-8 text-primary" /> : <FileAudio className="h-8 w-8 text-primary" />}
                      <div className="text-left">
                        <p className="font-medium text-sm">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
                      </div>
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Music className="h-10 w-10 text-muted-foreground" />
                      <p className="font-medium text-sm">Przeciągnij plik MP3, WAV, MP4 lub WebM</p>
                      <p className="text-xs text-muted-foreground">Max 500MB — pełne piosenki i teledyski</p>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4" /> {error}
                  </div>
                )}

                {file && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Tytuł *</Label>
                      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tytuł utworu" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Artysta</Label>
                      <Input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Nazwa artysty" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Gatunek</Label>
                      <Select value={genre} onValueChange={setGenre}>
                        <SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger>
                        <SelectContent>
                          {["Rock", "Pop", "Punk", "Metal", "Electronic", "Hip-Hop", "Jazz", "Classical", "Reggae", "R&B", "Country", "Folk", "Other"].map(g => (
                            <SelectItem key={g} value={g}>{g}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {uploading && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Przesyłanie na serwer...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                )}

                {file && (
                  <Button onClick={handleUpload} disabled={uploading || !title.trim()} className="w-full gap-2">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploading ? "Przesyłam..." : "Wrzuć na serwer"}
                  </Button>
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
