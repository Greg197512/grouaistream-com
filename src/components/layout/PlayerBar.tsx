import { motion, useDragControls, PanInfo } from "framer-motion";
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
  Share2,
  GripHorizontal,
  ScanFace,
  Smile,
  Camera
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
import { QueueSidebar } from "@/components/player/QueueSidebar";
import { VoiceCommandHandler } from "@/components/player/VoiceCommandHandler";
import { FullscreenPlayer } from "@/components/player/FullscreenPlayer";
import { QuickMoodDetector } from "@/components/mood/QuickMoodDetector";

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
  
  // Drag state for movable player
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragControls = useDragControls();
  const constraintsRef = useRef<HTMLDivElement>(null);
  
  // New state for modals/sidebars
  const [showQueue, setShowQueue] = useState(false);
  const [showVoiceCommand, setShowVoiceCommand] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [showMoodDetector, setShowMoodDetector] = useState(false);

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

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);
    setPosition(prev => ({
      x: prev.x + info.offset.x,
      y: prev.y + info.offset.y
    }));
  };

  const displayDuration = duration || currentTrack?.duration || 0;
  const displayCurrentTime = currentTime;

  return (
    <>
      {/* Drag constraints container (full viewport) */}
      <div 
        ref={constraintsRef} 
        className="fixed inset-0 pointer-events-none z-40"
      />
      
      {/* Draggable Glass Player */}
      <motion.div
        drag
        dragControls={dragControls}
        dragMomentum={false}
        dragElastic={0.1}
        dragConstraints={constraintsRef}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        initial={{ x: 0, y: 0 }}
        animate={{ x: position.x, y: position.y }}
        whileDrag={{ scale: 1.02, cursor: "grabbing" }}
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50",
          "h-24 px-4 flex items-center gap-3",
          // Glass transparency effect
          "bg-background/20 backdrop-blur-[40px] backdrop-saturate-[200%]",
          "border-t border-white/10",
          "shadow-[0_-10px_40px_rgba(0,0,0,0.3)]",
          isDragging && "cursor-grabbing"
        )}
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.4), rgba(0,0,0,0.2))",
          WebkitBackdropFilter: "blur(40px) saturate(200%)",
        }}
      >
        {/* Drag Handle */}
        <motion.div
          onPointerDown={(e) => dragControls.start(e)}
          className="absolute top-0 left-1/2 -translate-x-1/2 px-8 py-1 cursor-grab active:cursor-grabbing touch-none"
          whileHover={{ opacity: 1 }}
          initial={{ opacity: 0.3 }}
        >
          <GripHorizontal className="h-4 w-4 text-white/40" />
        </motion.div>

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
        <div className="flex items-center gap-3 w-[240px] min-w-[160px]">
          <motion.div 
            className="relative h-12 w-12 rounded-lg overflow-hidden bg-white/10 flex-shrink-0 backdrop-blur-sm"
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
                  <MonitorSpeaker className="h-5 w-5 text-white/70" />
                </div>
              </>
            )}
            {isPlaying && (
              <motion.div 
                className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {[1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    className="w-0.5 bg-white rounded-full"
                    animate={{ height: [3, 10, 3] }}
                    transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                  />
                ))}
              </motion.div>
            )}
            {/* YouTube indicator */}
            {isVideoMode && (
              <div className="absolute top-0.5 right-0.5 p-0.5 rounded bg-red-600/80">
                <Youtube className="h-2 w-2 text-white" />
              </div>
            )}
          </motion.div>
          
          <div className="min-w-0">
            <p className="font-medium text-xs truncate text-white/90 hover:text-white cursor-pointer">
              {currentTrack?.title || "No track playing"}
            </p>
            <p className="text-[10px] text-white/50 truncate hover:text-white/70 cursor-pointer">
              {currentTrack?.artist || "Select a track"}
            </p>
          </div>

          <button 
            onClick={handleLike}
            className="flex-shrink-0 p-1 hover:scale-110 transition-transform"
            disabled={!currentTrack}
          >
            <Heart className={cn(
              "h-3.5 w-3.5 transition-colors",
              isLiked ? "fill-primary text-primary" : "text-white/40 hover:text-white/70"
            )} />
          </button>

          {/* Face Recognition / Mood Detection Button */}
          <motion.div className="relative flex-shrink-0">
            {/* Glow ring */}
            <motion.div
              className="absolute -inset-1 rounded-full bg-gradient-to-t from-primary via-accent to-primary opacity-60 blur-md"
              animate={{ opacity: [0.4, 0.8, 0.4], scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            {/* Sparkle particles going up */}
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 rounded-full bg-accent"
                style={{ left: `${20 + i * 15}%`, bottom: '50%' }}
                animate={{
                  y: [-2, -18, -28],
                  x: [0, (i % 2 === 0 ? 4 : -4), (i % 2 === 0 ? 6 : -6)],
                  opacity: [0.9, 0.6, 0],
                  scale: [1, 0.7, 0.3],
                }}
                transition={{
                  duration: 1.2 + i * 0.2,
                  repeat: Infinity,
                  delay: i * 0.3,
                  ease: "easeOut",
                }}
              />
            ))}
            <motion.button
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowMoodDetector(true)}
              className="relative z-10 flex items-center justify-center h-9 w-9 rounded-full bg-gradient-to-br from-primary to-accent border border-white/30 shadow-[0_0_12px_rgba(var(--primary),0.5)] overflow-hidden"
              title="Rozpoznawanie nastroju (Kamera)"
            >
              {/* Face layout: eyes top, camera nose center, smile bottom */}
              <div className="flex flex-col items-center gap-0 leading-none">
                {/* Eyes */}
                <div className="flex gap-1.5 -mb-0.5">
                  <div className="w-1 h-1 rounded-full bg-white" />
                  <div className="w-1 h-1 rounded-full bg-white" />
                </div>
                {/* Nose - camera */}
                <Camera className="h-2.5 w-2.5 text-white/90" />
                {/* Smile */}
                <div className="w-3.5 h-1.5 border-b-[1.5px] border-white rounded-b-full -mt-0.5" />
              </div>
            </motion.button>
          </motion.div>
        </div>

        {/* Player Controls */}
        <div className="flex-1 flex flex-col items-center gap-1.5 max-w-[600px]">
          <div className="flex items-center gap-3">
            <button 
              onClick={toggleShuffle}
              className={cn(
                "p-1 transition-colors",
                isShuffled ? "text-primary" : "text-white/40 hover:text-white/70"
              )}
            >
              <Shuffle className="h-3.5 w-3.5" />
            </button>

            <button 
              onClick={prevTrack}
              className="p-1 text-white/50 hover:text-white transition-colors"
            >
              <SkipBack className="h-4 w-4" />
            </button>

            <motion.button
              onClick={togglePlay}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-background hover:bg-white transition-colors"
            >
              {isPlaying ? (
                <Pause className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
              )}
            </motion.button>

            <button 
              onClick={nextTrack}
              className="p-1 text-white/50 hover:text-white transition-colors"
            >
              <SkipForward className="h-4 w-4" />
            </button>

            <button 
              onClick={toggleRepeat}
              className={cn(
                "relative p-1 transition-colors",
                repeatMode !== 'off' ? "text-primary" : "text-white/40 hover:text-white/70"
              )}
            >
              <Repeat className="h-3.5 w-3.5" />
              {repeatMode === 'one' && (
                <span className="absolute -top-1 -right-1 text-[7px] font-bold text-primary">1</span>
              )}
            </button>
          </div>

          <div className="w-full flex items-center gap-2 text-[10px] text-white/40">
            <span className="w-8 text-right">{formatTime(displayCurrentTime)}</span>
            <Slider
              value={[progress]}
              onValueChange={([value]) => handleSeek(value)}
              max={100}
              step={0.1}
              className="flex-1 cursor-pointer"
            />
            <span className="w-8">{formatTime(displayDuration)}</span>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 w-[240px] min-w-[160px] justify-end">
          {showAIInsight && currentTrack && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/10 border border-white/10"
            >
              <Sparkles className="h-2.5 w-2.5 text-accent" />
              <span className="text-[9px] text-white/60 font-medium">
                {isVideoMode ? 'YouTube' : 'AI'}
              </span>
            </motion.div>
          )}

          {/* Download button */}
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleDownload}
            className="p-1 text-white/40 hover:text-white/70 transition-colors"
            title="Pobierz"
            disabled={!currentTrack}
          >
            <Download className="h-3.5 w-3.5" />
          </motion.button>

          {/* Share button */}
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleShare}
            className="p-1 text-white/40 hover:text-white/70 transition-colors"
            title="Share"
            disabled={!currentTrack}
          >
            <Share2 className="h-3.5 w-3.5" />
          </motion.button>

          {/* Video toggle button */}
          {isVideoMode && (
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => window.toggleVideoPlayer?.()}
              className="p-1 text-primary hover:text-primary/80 transition-colors"
              title="Show Video"
            >
              <Video className="h-3.5 w-3.5" />
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

          {/* Voice Commands (Mic) */}
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowVoiceCommand(true)}
            className="p-1 text-white/40 hover:text-white/70 transition-colors"
            title="Voice Commands"
          >
            <Mic2 className="h-3.5 w-3.5" />
          </motion.button>

          {/* Queue */}
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowQueue(true)}
            className={cn(
              "p-1 transition-colors",
              showQueue ? "text-primary" : "text-white/40 hover:text-white/70"
            )}
            title="Queue"
          >
            <ListMusic className="h-3.5 w-3.5" />
          </motion.button>

          <div className="flex items-center gap-1 w-24">
            <button 
              onClick={toggleMute}
              className="p-1 text-white/40 hover:text-white/70 transition-colors"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-3.5 w-3.5" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
            </button>
            <Slider
              value={[isMuted ? 0 : volume]}
              onValueChange={([value]) => setPlayerVolume(value)}
              max={100}
              step={1}
              className="w-20 cursor-pointer"
            />
          </div>

          {/* Fullscreen */}
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowFullscreen(true)}
            className="p-1 text-white/40 hover:text-white/70 transition-colors"
            title="Fullscreen"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </motion.button>
        </div>
      </motion.div>

      {/* Queue Sidebar */}
      <QueueSidebar isOpen={showQueue} onClose={() => setShowQueue(false)} />

      {/* Voice Command Modal */}
      <VoiceCommandHandler isOpen={showVoiceCommand} onClose={() => setShowVoiceCommand(false)} />

      {/* Fullscreen Player */}
      <FullscreenPlayer isOpen={showFullscreen} onClose={() => setShowFullscreen(false)} />

      {/* Mood Detector Modal */}
      <QuickMoodDetector isOpen={showMoodDetector} onClose={() => setShowMoodDetector(false)} />

    </>
  );
};
