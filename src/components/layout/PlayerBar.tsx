import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Volume2,
  VolumeX,
  Heart,
  Maximize2,
  ListMusic,
  Mic2,
  MonitorSpeaker,
  Sparkles
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverUrl: string;
}

const mockTrack: Track = {
  id: "1",
  title: "Midnight Dreams",
  artist: "Aurora Beats",
  album: "Neon Horizons",
  duration: 234,
  coverUrl: ""
};

export const PlayerBar = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(33);
  const [volume, setVolume] = useState(70);
  const [isMuted, setIsMuted] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [showAIInsight, setShowAIInsight] = useState(true);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentTime = (progress / 100) * mockTrack.duration;

  return (
    <div className="groove-player-bar h-24 px-4 flex items-center gap-4">
      {/* Track Info */}
      <div className="flex items-center gap-3 w-[280px] min-w-[180px]">
        <motion.div 
          className="relative h-14 w-14 rounded-md overflow-hidden bg-secondary flex-shrink-0"
          whileHover={{ scale: 1.05 }}
        >
          <div className="absolute inset-0 groove-gradient-bg opacity-60" />
          <div className="absolute inset-0 flex items-center justify-center">
            <MonitorSpeaker className="h-6 w-6 text-primary-foreground" />
          </div>
          {isPlaying && (
            <motion.div 
              className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {[1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  className="w-0.5 bg-primary-foreground rounded-full"
                  animate={{ height: [4, 12, 4] }}
                  transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                />
              ))}
            </motion.div>
          )}
        </motion.div>
        
        <div className="min-w-0">
          <p className="font-medium text-sm truncate hover:underline cursor-pointer">
            {mockTrack.title}
          </p>
          <p className="text-xs text-muted-foreground truncate hover:underline cursor-pointer">
            {mockTrack.artist}
          </p>
        </div>

        <button 
          onClick={() => setIsLiked(!isLiked)}
          className="flex-shrink-0 p-1.5 hover:scale-110 transition-transform"
        >
          <Heart className={cn(
            "h-4 w-4 transition-colors",
            isLiked ? "fill-primary text-primary" : "text-muted-foreground hover:text-foreground"
          )} />
        </button>
      </div>

      {/* Player Controls */}
      <div className="flex-1 flex flex-col items-center gap-2 max-w-[722px]">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsShuffled(!isShuffled)}
            className={cn(
              "p-1.5 transition-colors",
              isShuffled ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Shuffle className="h-4 w-4" />
          </button>

          <button className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <SkipBack className="h-5 w-5" />
          </button>

          <motion.button
            onClick={() => setIsPlaying(!isPlaying)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background hover:scale-105 transition-transform"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4 fill-current" />
            ) : (
              <Play className="h-4 w-4 fill-current ml-0.5" />
            )}
          </motion.button>

          <button className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <SkipForward className="h-5 w-5" />
          </button>

          <button 
            onClick={() => setRepeatMode(repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off')}
            className={cn(
              "relative p-1.5 transition-colors",
              repeatMode !== 'off' ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Repeat className="h-4 w-4" />
            {repeatMode === 'one' && (
              <span className="absolute -top-1 -right-1 text-[8px] font-bold">1</span>
            )}
          </button>
        </div>

        <div className="w-full flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-10 text-right">{formatTime(currentTime)}</span>
          <Slider
            value={[progress]}
            onValueChange={([value]) => setProgress(value)}
            max={100}
            step={0.1}
            className="flex-1 cursor-pointer"
          />
          <span className="w-10">{formatTime(mockTrack.duration)}</span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 w-[280px] min-w-[180px] justify-end">
        {showAIInsight && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/20 border border-accent/30"
          >
            <Sparkles className="h-3 w-3 text-accent" />
            <span className="text-[10px] text-accent font-medium">Mood: Relaxed</span>
          </motion.div>
        )}

        <button className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
          <Mic2 className="h-4 w-4" />
        </button>

        <button className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
          <ListMusic className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-1.5 w-32">
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>
          <Slider
            value={[isMuted ? 0 : volume]}
            onValueChange={([value]) => {
              setVolume(value);
              if (value > 0) setIsMuted(false);
            }}
            max={100}
            step={1}
            className="w-24 cursor-pointer"
          />
        </div>

        <button className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
