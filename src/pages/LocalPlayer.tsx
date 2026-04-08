import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FolderOpen, Music, Play, Pause, SkipBack, SkipForward, 
  Trash2, ListMusic, X, Plus, Library, Upload, Loader2, CheckCircle
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { uploadToR2 } from "@/lib/r2Upload";
import { toast } from "sonner";

const formatSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const parseName = (filename: string) => {
  const name = filename.replace(/\.(mp3|wav|ogg|flac|m4a|aac|wma|opus|webm)$/i, "");
  const parts = name.split(/\s*-\s*/);
  if (parts.length >= 2) return { artist: parts[0].trim(), title: parts.slice(1).join(" - ").trim() };
  return { artist: "Nieznany", title: name.trim() };
};

interface LocalFile {
  id: string;
  name: string;
  file: File;
  url: string;
  size: string;
}

const LocalPlayer = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playTrack, playPlaylist, currentTrack, isPlaying, togglePlay } = usePlayer();
  const [localFiles, setLocalFiles] = useState<LocalFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; fileName: string; percent: number }>({
    current: 0,
    total: 0,
    fileName: "",
    percent: 0,
  });
  const [uploadedIds, setUploadedIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const fileToTrack = useCallback((file: LocalFile): Track => {
    const parsed = parseName(file.name);
    return {
      id: `local-${file.id}`,
      title: parsed.title,
      artist: parsed.artist,
      album: null,
      duration: 0,
      audio_url: file.url,
      video_url: null,
      cover_url: null,
      genre: "Local",
      mood: null,
    };
  }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    const audioFiles = Array.from(files).filter(f =>
      /\.(mp3|wav|ogg|flac|m4a|aac|wma|opus|webm)$/i.test(f.name)
    );
    const newFiles: LocalFile[] = audioFiles.map(f => ({
      id: crypto.randomUUID(),
      name: f.name,
      file: f,
      url: URL.createObjectURL(f),
      size: formatSize(f.size),
    }));
    setLocalFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handlePlayTrack = (file: LocalFile, index: number) => {
    const track = fileToTrack(file);
    if (currentTrack?.id === track.id) {
      togglePlay();
    } else {
      const allTracks = localFiles.map(fileToTrack);
      playPlaylist(allTracks, index);
    }
  };

  const handlePlayAll = () => {
    if (localFiles.length === 0) return;
    const allTracks = localFiles.map(fileToTrack);
    playPlaylist(allTracks, 0);
  };

  const removeFile = (idx: number) => {
    const f = localFiles[idx];
    URL.revokeObjectURL(f.url);
    setLocalFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const clearAll = () => {
    localFiles.forEach(f => URL.revokeObjectURL(f.url));
    setLocalFiles([]);
    setUploadedIds(new Set());
  };

  const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const audio = new Audio();
      let settled = false;

      const cleanup = () => {
        audio.onloadedmetadata = null;
        audio.ondurationchange = null;
        audio.onerror = null;
        audio.removeAttribute("src");
        audio.load();
        URL.revokeObjectURL(url);
      };

      const finish = (duration: number) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        cleanup();
        resolve(duration);
      };

      const resolveDuration = () => {
        const duration = Math.round(audio.duration);
        if (Number.isFinite(duration) && duration > 0) {
          finish(duration);
        }
      };

      const timeoutId = window.setTimeout(() => finish(180), 5000);

      audio.preload = "metadata";
      audio.onloadedmetadata = resolveDuration;
      audio.ondurationchange = resolveDuration;
      audio.onerror = () => finish(180);
      audio.src = url;
    });
  };

  const uploadAllToServer = async () => {
    if (!user) { toast.error("Musisz być zalogowany, aby przesłać pliki na serwer"); return; }
    
    const filesToUpload = localFiles.filter(f => !uploadedIds.has(f.id));
    if (filesToUpload.length === 0) { toast.info("Wszystkie pliki już przesłane!"); return; }

    setUploading(true);
    let successCount = 0;
    const newUploaded = new Set(uploadedIds);
    const displayName = user.user_metadata?.display_name || user.email?.split("@")[0] || "Artist";

    for (let i = 0; i < filesToUpload.length; i++) {
      const localFile = filesToUpload[i];
      const parsed = parseName(localFile.name);
      setUploadProgress({ current: i + 1, total: filesToUpload.length, fileName: parsed.title, percent: 0 });

      try {
        const duration = await getAudioDuration(localFile.file);
        const { publicUrl } = await uploadToR2({
          file: localFile.file,
          folder: "tracks",
          onProgress: (percent) => {
            setUploadProgress({
              current: i + 1,
              total: filesToUpload.length,
              fileName: parsed.title,
              percent,
            });
          },
        });

        const { error } = await supabase.from("tracks").insert({
          title: parsed.title,
          artist: parsed.artist !== "Nieznany" ? parsed.artist : displayName,
          album: null,
          duration,
          audio_url: publicUrl,
          genre: "Other",
          mood: null,
          user_id: user.id,
        });

        if (error) throw error;
        successCount++;
        newUploaded.add(localFile.id);
        setUploadProgress({ current: i + 1, total: filesToUpload.length, fileName: parsed.title, percent: 100 });
      } catch (err: any) {
        console.error(`[Upload] Failed: ${localFile.name}`, err);
        toast.error(`Błąd: ${parsed.title} — ${err.message}`);
      }
    }

    setUploadedIds(newUploaded);
    setUploading(false);
    setUploadProgress({ current: 0, total: 0, fileName: "", percent: 0 });

    if (successCount > 0) {
      toast.success(`✅ Przesłano ${successCount}/${filesToUpload.length} plików na serwer!`);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const notUploadedCount = localFiles.filter(f => !uploadedIds.has(f.id)).length;

  return (
    <MainLayout>
      <input ref={fileInputRef} type="file" accept="audio/*" multiple className="hidden" onChange={e => e.target.files && addFiles(e.target.files)} />
      <input ref={folderInputRef} type="file" accept="audio/*" multiple className="hidden" {...{ webkitdirectory: "", directory: "" } as any} onChange={e => e.target.files && addFiles(e.target.files)} />

      <div className="px-4 md:px-6 py-6 max-w-5xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
            <Music className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-display">Lokalny Player</h1>
            <p className="text-sm text-muted-foreground">Odtwarzaj muzykę z dysku — DJ i asystent obsługują te utwory</p>
          </div>
        </motion.div>

        {/* Add buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="gap-2 border-primary/30 text-primary hover:bg-primary/10">
            <Plus className="h-4 w-4" /> Dodaj pliki
          </Button>
          <Button onClick={() => folderInputRef.current?.click()} variant="outline" className="gap-2 border-primary/30 text-primary hover:bg-primary/10">
            <FolderOpen className="h-4 w-4" /> Dodaj katalog
          </Button>
          {localFiles.length > 0 && (
            <>
              <Button onClick={handlePlayAll} className="gap-2 groove-gradient-bg text-primary-foreground hover:opacity-90">
                <Play className="h-4 w-4 fill-current" /> Odtwórz wszystko ({localFiles.length})
              </Button>
              {notUploadedCount > 0 && (
                <Button
                  onClick={uploadAllToServer}
                  disabled={uploading || !user}
                  variant="outline"
                  className="gap-2 border-[#FF6B00]/40 text-[#FF9500] hover:bg-[#FF6B00]/10 hover:text-[#FF6B00]"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading
                    ? `Przesyłam ${uploadProgress.current}/${uploadProgress.total} • ${uploadProgress.percent}%`
                    : `Prześlij na serwer (${notUploadedCount})`
                  }
                </Button>
              )}
              <Button onClick={clearAll} variant="ghost" className="gap-2 text-destructive hover:text-destructive ml-auto">
                <Trash2 className="h-4 w-4" /> Wyczyść
              </Button>
            </>
          )}
        </div>

        {/* Upload progress bar */}
        {uploading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4 p-3 rounded-xl border border-[#FF6B00]/20 bg-[#1a1a2e]/60">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="h-4 w-4 animate-spin text-[#FF9500]" />
              <span className="text-sm text-gray-300">
                Przesyłam: <strong>{uploadProgress.fileName}</strong> ({uploadProgress.current}/{uploadProgress.total}) — {uploadProgress.percent}%
              </span>
            </div>
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, #FF6B00, #FF9500)" }}
                animate={{ width: `${uploadProgress.percent}%` }}
              />
            </div>
          </motion.div>
        )}

        {/* Track list or drop zone */}
        {localFiles.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onDrop={onDrop}
            onDragOver={e => e.preventDefault()}
            className="border-2 border-dashed border-border/50 rounded-2xl p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <ListMusic className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-lg font-medium text-muted-foreground mb-2">Przeciągnij pliki muzyczne tutaj</p>
            <p className="text-sm text-muted-foreground/70">MP3, WAV, OGG, FLAC, M4A • odtwarzaj lokalnie lub prześlij na serwer</p>
            <p className="text-xs text-muted-foreground/50 mt-4">Utwory będą odtwarzane przez główny player — DJ i asystent głosowy je widzą!</p>
          </motion.div>
        ) : (
          <ScrollArea className="h-[calc(100vh-340px)] min-h-[200px]"
            onDrop={onDrop} onDragOver={e => e.preventDefault()}>
            <div className="space-y-1">
              {localFiles.map((file, idx) => {
                const p = parseName(file.name);
                const trackId = `local-${file.id}`;
                const active = currentTrack?.id === trackId;
                const isUploaded = uploadedIds.has(file.id);
                return (
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    onClick={() => handlePlayTrack(file, idx)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors group",
                      active ? "bg-primary/10 border border-primary/20" : "hover:bg-secondary/50"
                    )}
                  >
                    <span className="w-8 text-center text-sm text-muted-foreground">
                      {active && isPlaying ? (
                        <div className="flex gap-0.5 items-end h-4 justify-center">
                          {[1,2,3].map(i => (
                            <motion.div key={i} className="w-0.5 bg-primary rounded-full"
                              animate={{ height: [3, 12, 3] }}
                              transition={{ repeat: Infinity, duration: 0.4, delay: i * 0.1 }} />
                          ))}
                        </div>
                      ) : (
                        idx + 1
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm truncate", active && "text-primary font-medium")}>{p.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.artist}</p>
                    </div>
                    {isUploaded ? (
                      <span className="text-xs text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> SERWER
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/70 px-1.5 py-0.5 rounded bg-secondary/50">LOCAL</span>
                    )}
                    <span className="text-xs text-muted-foreground">{file.size}</span>
                    <button
                      onClick={e => { e.stopPropagation(); removeFile(idx); }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        <p className="text-xs text-muted-foreground/50 mt-4 text-center">
          Pliki odtwarzane lokalnie przez główny player — DJ, asystent i kolejka je obsługują. Kliknij „Prześlij na serwer" aby zachować na stałe 🎵
        </p>
      </div>
    </MainLayout>
  );
};

export default LocalPlayer;
