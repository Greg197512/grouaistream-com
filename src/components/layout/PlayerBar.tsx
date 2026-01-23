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
  Sparkles,
  Youtube,
  Video,
  Download,
  Share2
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";
import { YouTubePlayer, YouTubePlayerRef } from "@/components/player/YouTubePlayer";
import { TrackOptionsMenu } from "@/components/menus/TrackOptionsMenu";

// Video visibility state - shared via window for simplicity
declare global {
  interface Window {
    toggleVideoPlayer?: () => void;
  }
}

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
    currentTime,
    duration,
    isVideoMode,
    youtubeVideoId,
    onYouTubeTimeUpdate,
    onYouTubeEnded,
  } = usePlayer();

  const [isLiked, setIsLiked] = useState(false);
  const [showAIInsight, setShowAIInsight] = useState(true);
  const youtubePlayerRef = useRef<YouTubePlayerRef>(null);
  const [seekPosition, setSeekPosition] = useState<number | null>(null);

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
        .maybeSingle();

      setIsLiked(!!data);
    };

    checkLiked();
  }, [user, currentTrack]);

  // Handle seeking for YouTube
  useEffect(() => {
    if (seekPosition !== null && youtubePlayerRef.current && isVideoMode) {
      const targetDuration = duration || currentTrack?.duration || 0;
      const time = (seekPosition / 100) * targetDuration;
      youtubePlayerRef.current.seekTo(time);
      setSeekPosition(null);
    }
  }, [seekPosition, isVideoMode, duration, currentTrack]);

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

  const handleDownload = () => {
    if (!currentTrack) return;
    
    const url = currentTrack.video_url || currentTrack.audio_url;
    if (!url) {
      toast.error("Download not available for this track");
      return;
    }

    // GDPR consent popup
    const confirmed = window.confirm(
      "Download consent: By downloading, you confirm you have the right to download this content for personal use. Continue?"
    );

    if (confirmed) {
      window.open(url, "_blank");
      toast.success("Opening download link...");
    }
  };

  const handleShare = async () => {
    if (!currentTrack) return;
    
    const text = `🎵 Listening to "${currentTrack.title}" by ${currentTrack.artist} on GrooveAI Stream!`;
    const url = currentTrack.video_url || window.location.origin;
    
    try {
      if (navigator.share) {
        await navigator.share({ title: currentTrack.title, text, url });
      } else {
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
          "_blank"
        );
      }
    } catch (error) {
      // User cancelled or error
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (value: number) => {
    seek(value);
    if (isVideoMode) {
      setSeekPosition(value);
    }
  };

  const displayDuration = duration || currentTrack?.duration || 0;
  const displayCurrentTime = currentTime;

  return (
    <div className="groove-player-bar h-28 px-6 flex items-center gap-4 relative">
      {/* Hidden YouTube Player */}
      {isVideoMode && youtubeVideoId && (
        <YouTubePlayer
          ref={youtubePlayerRef}
          videoId={youtubeVideoId}
          isPlaying={isPlaying}
          volume={volume}
          isMuted={isMuted}
          onTimeUpdate={onYouTubeTimeUpdate}
          onEnded={onYouTubeEnded}
        />
      )}

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
          {/* YouTube indicator */}
          {isVideoMode && (
            <div className="absolute top-1 right-1 p-0.5 rounded bg-red-600">
              <Youtube className="h-2.5 w-2.5 text-white" />
            </div>
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
          <span className="w-10 text-right">{formatTime(displayCurrentTime)}</span>
          <Slider
            value={[progress]}
            onValueChange={([value]) => handleSeek(value)}
            max={100}
            step={0.1}
            className="flex-1 cursor-pointer"
          />
          <span className="w-10">{formatTime(displayDuration)}</span>
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
            <span className="text-[10px] text-accent font-medium">
              {isVideoMode ? 'YouTube' : 'AI Enhanced'}
            </span>
          </motion.div>
        )}

        {/* Download button */}
        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleDownload}
          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          title="Pobierz Utwór"
          disabled={!currentTrack}
        >
          <Download className="h-4 w-4" />
        </motion.button>

        {/* Share button */}
        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleShare}
          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          title="Share"
          disabled={!currentTrack}
        >
          <Share2 className="h-4 w-4" />
        </motion.button>

        {/* Video toggle button */}
        {isVideoMode && (
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.toggleVideoPlayer?.()}
            className="p-1.5 text-primary hover:text-primary/80 transition-colors"
            title="Show Video"
          >
            <Video className="h-4 w-4" />
          </motion.button>
        )}

        {/* Track options menu */}
        {currentTrack && (
          <TrackOptionsMenu
            trackId={currentTrack.id}
            trackTitle={currentTrack.title}
            trackArtist={currentTrack.artist}
            trackUrl={currentTrack.video_url || currentTrack.audio_url}
            size="sm"
          />
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
