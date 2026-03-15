import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FolderOpen, Music, Play, Pause, SkipBack, SkipForward, 
  Shuffle, Repeat, Trash2, ListMusic, Volume2, X, Plus
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface LocalTrack {
  id: string;
  name: string;
  file: File;
  url: string;
  duration: number;
  size: string;
}

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

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

const LocalPlayer = () => {
  const { t } = useLanguage();
  const [tracks, setTracks] = useState<LocalTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [shuffled, setShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const currentTrack = currentIndex >= 0 ? tracks[currentIndex] : null;
  const parsed = currentTrack ? parseName(currentTrack.name) : null;

  const addFiles = useCallback((files: FileList | File[]) => {
    const audioFiles = Array.from(files).filter(f =>
      /\.(mp3|wav|ogg|flac|m4a|aac|wma|opus|webm)$/i.test(f.name)
    );
    const newTracks: LocalTrack[] = audioFiles.map(f => ({
      id: crypto.randomUUID(),
      name: f.name,
      file: f,
      url: URL.createObjectURL(f),
      duration: 0,
      size: formatSize(f.size),
    }));
    setTracks(prev => [...prev, ...newTracks]);
  }, []);

  const playIndex = useCallback((idx: number) => {
    if (idx < 0 || idx >= tracks.length) return;
    setCurrentIndex(idx);
    setIsPlaying(true);
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.src = tracks[idx].url;
        audioRef.current.play().catch(() => {});
      }
    }, 50);
  }, [tracks]);

  const togglePlay = () => {
    if (!audioRef.current || currentIndex < 0) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play().catch(() => {});
  };

  const next = useCallback(() => {
    if (tracks.length === 0) return;
    if (shuffled) {
      playIndex(Math.floor(Math.random() * tracks.length));
    } else {
      const nxt = currentIndex + 1;
      if (nxt < tracks.length) playIndex(nxt);
      else if (repeatMode === "all") playIndex(0);
    }
  }, [tracks, currentIndex, shuffled, repeatMode, playIndex]);

  const prev = () => {
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    if (currentIndex > 0) playIndex(currentIndex - 1);
  };

  const onEnded = () => {
    if (repeatMode === "one") {
      audioRef.current!.currentTime = 0;
      audioRef.current!.play();
      return;
    }
    next();
  };

  const removeTrack = (idx: number) => {
    const t = tracks[idx];
    URL.revokeObjectURL(t.url);
    const updated = tracks.filter((_, i) => i !== idx);
    setTracks(updated);
    if (idx === currentIndex) {
      setCurrentIndex(-1);
      setIsPlaying(false);
    } else if (idx < currentIndex) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const clearAll = () => {
    tracks.forEach(t => URL.revokeObjectURL(t.url));
    setTracks([]);
    setCurrentIndex(-1);
    setIsPlaying(false);
  };

  // Drop zone
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  return (
    <MainLayout>
      <audio
        ref={audioRef}
        onTimeUpdate={() => {
          if (!audioRef.current) return;
          setCurTime(audioRef.current.currentTime);
          setDuration(audioRef.current.duration || 0);
          setProgress(audioRef.current.duration ? (audioRef.current.currentTime / audioRef.current.duration) * 100 : 0);
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={onEnded}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            audioRef.current.volume = volume / 100;
            setDuration(audioRef.current.duration);
            // Update track duration
            if (currentIndex >= 0) {
              setTracks(prev => prev.map((t, i) => i === currentIndex ? { ...t, duration: audioRef.current!.duration } : t));
            }
          }
        }}
      />
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
            <p className="text-sm text-muted-foreground">Odtwarzaj muzykę z dysku — bez uploadu</p>
          </div>
        </motion.div>

        {/* Now Playing */}
        <AnimatePresence>
          {currentTrack && parsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden"
            >
              <div className="p-5">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
                    {isPlaying ? (
                      <div className="flex gap-0.5 items-end h-6">
                        {[1,2,3,4].map(i => (
                          <motion.div key={i} className="w-1 bg-primary rounded-full"
                            animate={{ height: [6, 20, 6] }}
                            transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }} />
                        ))}
                      </div>
                    ) : (
                      <Music className="h-7 w-7 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-lg truncate">{parsed.title}</p>
                    <p className="text-sm text-muted-foreground truncate">{parsed.artist}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{currentTrack.size}</span>
                </div>

                {/* Progress */}
                <Slider
                  value={[progress]}
                  onValueChange={([v]) => {
                    if (audioRef.current && duration) {
                      audioRef.current.currentTime = (v / 100) * duration;
                    }
                  }}
                  max={100} step={0.1} className="mb-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-4 mt-3">
                  <button onClick={() => setShuffled(!shuffled)}
                    className={cn("p-2 rounded-full transition-colors", shuffled ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
                    <Shuffle className="h-5 w-5" />
                  </button>
                  <button onClick={prev} className="p-2 hover:scale-110 transition-transform">
                    <SkipBack className="h-6 w-6" />
                  </button>
                  <button onClick={togglePlay}
                    className="h-14 w-14 rounded-full groove-gradient-bg flex items-center justify-center groove-glow hover:scale-105 transition-transform">
                    {isPlaying ? <Pause className="h-6 w-6 text-primary-foreground fill-current" /> : <Play className="h-6 w-6 text-primary-foreground fill-current ml-0.5" />}
                  </button>
                  <button onClick={next} className="p-2 hover:scale-110 transition-transform">
                    <SkipForward className="h-6 w-6" />
                  </button>
                  <button onClick={() => setRepeatMode(repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off")}
                    className={cn("relative p-2 rounded-full transition-colors", repeatMode !== "off" ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
                    <Repeat className="h-5 w-5" />
                    {repeatMode === "one" && <span className="absolute -top-0.5 -right-0.5 text-[9px] font-bold">1</span>}
                  </button>
                </div>

                {/* Volume */}
                <div className="flex items-center gap-2 mt-3 max-w-[200px] mx-auto">
                  <Volume2 className="h-4 w-4 text-muted-foreground" />
                  <Slider value={[volume]} onValueChange={([v]) => { setVolume(v); if (audioRef.current) audioRef.current.volume = v / 100; }} max={100} step={1} className="flex-1" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="gap-2 border-primary/30 text-primary hover:bg-primary/10">
            <Plus className="h-4 w-4" /> Dodaj pliki
          </Button>
          <Button onClick={() => folderInputRef.current?.click()} variant="outline" className="gap-2 border-primary/30 text-primary hover:bg-primary/10">
            <FolderOpen className="h-4 w-4" /> Dodaj katalog
          </Button>
          {tracks.length > 0 && (
            <Button onClick={clearAll} variant="ghost" className="gap-2 text-destructive hover:text-destructive ml-auto">
              <Trash2 className="h-4 w-4" /> Wyczyść
            </Button>
          )}
        </div>

        {/* Track list or drop zone */}
        {tracks.length === 0 ? (
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
          </motion.div>
        ) : (
          <ScrollArea className="h-[calc(100vh-500px)] min-h-[200px]"
            onDrop={onDrop} onDragOver={e => e.preventDefault()}>
            <div className="space-y-1">
              {tracks.map((track, idx) => {
                const p = parseName(track.name);
                const active = idx === currentIndex;
                return (
                  <motion.div
                    key={track.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    onClick={() => playIndex(idx)}
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
                    <span className="text-xs text-muted-foreground">{track.duration ? formatTime(track.duration) : track.size}</span>
                    <button
                      onClick={e => { e.stopPropagation(); removeTrack(idx); }}
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
          Pliki odtwarzane lokalnie — nic nie jest wysyłane na serwer. Jak Winamp! 🎵
        </p>
      </div>
    </MainLayout>
  );
};

export default LocalPlayer;
