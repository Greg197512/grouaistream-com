import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FolderOpen, Music, Play, Pause, SkipBack, SkipForward, 
  Trash2, ListMusic, X, Plus, Library
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayer, Track } from "@/contexts/PlayerContext";

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
  url: string;
  size: string;
}

const LocalPlayer = () => {
  const { t } = useLanguage();
  const { playTrack, playPlaylist, currentTrack, isPlaying, togglePlay } = usePlayer();
  const [localFiles, setLocalFiles] = useState<LocalFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Convert local file to Track for main player
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
      // Play all local files as playlist starting from clicked index
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
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

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
              <Button onClick={clearAll} variant="ghost" className="gap-2 text-destructive hover:text-destructive ml-auto">
                <Trash2 className="h-4 w-4" /> Wyczyść
              </Button>
            </>
          )}
        </div>

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
            <p className="text-sm text-muted-foreground/70">MP3, WAV, OGG, FLAC, M4A • bez uploadu na serwer</p>
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
                    <span className="text-xs text-muted-foreground/70 px-1.5 py-0.5 rounded bg-secondary/50">LOCAL</span>
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
          Pliki odtwarzane lokalnie przez główny player — DJ, asystent i kolejka je obsługują. Jak Winamp! 🎵
        </p>
      </div>
    </MainLayout>
  );
};

export default LocalPlayer;
