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
import { usePlayer } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export const PlayerBar = () => {
  const { user } = useAuth();
  const {
    currentTrack,
    isPlaying,
    progress,
    volume,
    isMuted,
    isShuffled,
    repeatMode,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    setVolume: setPlayerVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat,
  } = usePlayer();

  const [isLiked, setIsLiked] = useState(false);
  const [showAIInsight, setShowAIInsight] = useState(true);

  // Check if current track is liked
  useEffect(() => {
    const checkLiked = async () => {
      if (!user || !currentTrack) {
        setIsLiked(false);
        return;
      }

      const { data } = await supabase
        .from("liked_songs")
        .select("id")
        .eq("user_id", user.id)
        .eq("track_id", currentTrack.id)
        .single();

      setIsLiked(!!data);
    };

    checkLiked();
  }, [user, currentTrack]);

  const handleLike = async () => {
    if (!user) {
      toast.error("Sign in to like songs");
      return;
    }

    if (!currentTrack) return;

    try {
      if (isLiked) {
        await supabase
          .from("liked_songs")
          .delete()
          .eq("user_id", user.id)
          .eq("track_id", currentTrack.id);
        setIsLiked(false);
        toast.success("Removed from Liked Songs");
      } else {
        await supabase
          .from("liked_songs")
          .insert({ user_id: user.id, track_id: currentTrack.id });
        setIsLiked(true);
        toast.success("Added to Liked Songs");
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      toast.error("Failed to update liked songs");
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const duration = currentTrack?.duration || 0;
  const currentTime = (progress / 100) * duration;

  return (
    <div className="groove-player-bar h-24 px-4 flex items-center gap-4">
      {/* Track Info */}
      <div className="flex items-center gap-3 w-[280px] min-w-[180px]">
        <motion.div 
          className="relative h-14 w-14 rounded-md overflow-hidden bg-secondary flex-shrink-0"
          whileHover={{ scale: 1.05 }}
        >
          {currentTrack?.cover_url ? (
            <img 
              src={currentTrack.cover_url} 
              alt={currentTrack.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <>
              <div className="absolute inset-0 groove-gradient-bg opacity-60" />
              <div className="absolute inset-0 flex items-center justify-center">
                <MonitorSpeaker className="h-6 w-6 text-primary-foreground" />
              </div>
            </>
          )}
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
            {currentTrack?.title || "No track playing"}
          </p>
          <p className="text-xs text-muted-foreground truncate hover:underline cursor-pointer">
            {currentTrack?.artist || "Select a track to play"}
          </p>
        </div>

        <button 
          onClick={handleLike}
          className="flex-shrink-0 p-1.5 hover:scale-110 transition-transform"
          disabled={!currentTrack}
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
            onClick={toggleShuffle}
            className={cn(
              "p-1.5 transition-colors",
              isShuffled ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Shuffle className="h-4 w-4" />
          </button>

          <button 
            onClick={prevTrack}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <SkipBack className="h-5 w-5" />
          </button>

          <motion.button
            onClick={togglePlay}
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

          <button 
            onClick={nextTrack}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <SkipForward className="h-5 w-5" />
          </button>

          <button 
            onClick={toggleRepeat}
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
            onValueChange={([value]) => seek(value)}
            max={100}
            step={0.1}
            className="flex-1 cursor-pointer"
          />
          <span className="w-10">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 w-[280px] min-w-[180px] justify-end">
        {showAIInsight && currentTrack && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/20 border border-accent/30"
          >
            <Sparkles className="h-3 w-3 text-accent" />
            <span className="text-[10px] text-accent font-medium">AI Enhanced</span>
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
            onClick={toggleMute}
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
            onValueChange={([value]) => setPlayerVolume(value)}
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
