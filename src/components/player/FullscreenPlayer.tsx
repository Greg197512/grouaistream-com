import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  X,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Volume2,
  VolumeX,
  Heart,
  ListMusic,
  Share2
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { usePlayer } from "@/contexts/PlayerContext";
import { cn } from "@/lib/utils";
import { HQCover } from "@/components/ui/HQCover";
import { ShareTrackModal } from "@/components/modals/ShareTrackModal";

interface FullscreenPlayerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FullscreenPlayer = ({ isOpen, onClose }: FullscreenPlayerProps) => {
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
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat,
    currentTime,
    duration,
  } = usePlayer();

  const [showShareModal, setShowShareModal] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const displayDuration = duration || currentTrack?.duration || 0;

  return (
    <>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-background"
        >
          {/* Background artwork blur */}
          {currentTrack?.cover_url && (
            <div
              className="absolute inset-0 bg-cover bg-center opacity-20 blur-3xl"
              style={{ backgroundImage: `url(${currentTrack.cover_url})` }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full bg-secondary/50 hover:bg-secondary transition-colors z-10"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Content */}
          <div className="relative h-full flex flex-col items-center justify-center px-8 max-w-3xl mx-auto">
            {/* Artwork — circular cover in glowing rotating ring */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="relative w-72 h-72 md:w-80 md:h-80 mb-8 flex items-center justify-center"
            >
              {/* Rotating neon ring */}
              <motion.div
                aria-hidden
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    "conic-gradient(from 0deg, hsl(331 100% 62%), hsl(268 100% 66%), hsl(189 100% 60%), hsl(331 100% 62%))",
                  filter: "blur(1px)",
                }}
                animate={isPlaying ? { rotate: 360 } : { rotate: 0 }}
                transition={{ repeat: Infinity, duration: 14, ease: "linear" }}
              />
              {/* Dark gap + outer glow */}
              <div
                className="absolute rounded-full"
                style={{
                  inset: "9px",
                  background: "hsl(0 0% 4%)",
                  boxShadow: "0 0 70px -12px hsl(268 100% 66% / 0.65)",
                }}
              />
              {/* Cover circle (breathes while playing) */}
              <motion.div
                className="absolute rounded-full overflow-hidden"
                style={{ inset: "18px" }}
                animate={isPlaying ? { scale: [1, 1.02, 1] } : { scale: 1 }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              >
                {currentTrack ? (
                  <HQCover
                    src={currentTrack.cover_url}
                    alt={currentTrack.title}
                    genre={currentTrack.genre}
                    artist={currentTrack.artist}
                    className="w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full groove-gradient-bg animate-gradient" />
                )}
              </motion.div>

              {/* Playing animation */}
              {isPlaying && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <motion.div
                      key={i}
                      className="w-1 bg-white rounded-full"
                      animate={{ height: [8, 24, 8] }}
                      transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }}
                    />
                  ))}
                </div>
              )}
            </motion.div>

            {/* Track info */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-center mb-8"
            >
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                {currentTrack?.title || "No track playing"}
              </h1>
              <div className="flex items-center justify-center gap-2">
                <p className="text-lg text-muted-foreground">
                  {currentTrack?.artist || "Select a track"}
                </p>
                {currentTrack && <span className="text-xs font-bold text-primary/70">Grouarock®</span>}
              </div>
            </motion.div>

            {/* Progress */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="w-full max-w-xl mb-8"
            >
              <Slider
                value={[progress]}
                onValueChange={([value]) => seek(value)}
                max={100}
                step={0.1}
                className="cursor-pointer"
              />
              <div className="flex justify-between mt-2 text-sm text-muted-foreground">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(displayDuration)}</span>
              </div>
            </motion.div>

            {/* Controls */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex items-center gap-6 mb-8"
            >
              <button 
                onClick={toggleShuffle}
                className={cn(
                  "p-3 transition-colors",
                  isShuffled ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Shuffle className="h-6 w-6" />
              </button>

              <button 
                onClick={prevTrack}
                className="p-3 text-foreground hover:scale-110 transition-transform"
              >
                <SkipBack className="h-8 w-8" />
              </button>

              <motion.button
                onClick={togglePlay}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="flex h-20 w-20 items-center justify-center rounded-full groove-gradient-bg groove-glow"
              >
                {isPlaying ? (
                  <Pause className="h-10 w-10 text-primary-foreground fill-current" />
                ) : (
                  <Play className="h-10 w-10 text-primary-foreground fill-current ml-1" />
                )}
              </motion.button>

              <button 
                onClick={nextTrack}
                className="p-3 text-foreground hover:scale-110 transition-transform"
              >
                <SkipForward className="h-8 w-8" />
              </button>

              <button 
                onClick={toggleRepeat}
                className={cn(
                  "relative p-3 transition-colors",
                  repeatMode !== 'off' ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Repeat className="h-6 w-6" />
                {repeatMode === 'one' && (
                  <span className="absolute top-1 right-1 text-[10px] font-bold">1</span>
                )}
              </button>
            </motion.div>

            {/* Bottom controls */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex items-center gap-6"
            >
              <button className="p-2 text-muted-foreground hover:text-foreground transition-colors">
                <Heart className="h-6 w-6" />
              </button>
              
              <div className="flex items-center gap-2 w-32">
                <button 
                  onClick={toggleMute}
                  className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </button>
                <Slider
                  value={[isMuted ? 0 : volume]}
                  onValueChange={([value]) => setVolume(value)}
                  max={100}
                  step={1}
                  className="w-24 cursor-pointer"
                />
              </div>

              <button
                onClick={() => setShowShareModal(true)}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Share2 className="h-6 w-6" />
              </button>

              <button className="p-2 text-muted-foreground hover:text-foreground transition-colors">
                <ListMusic className="h-6 w-6" />
              </button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    <ShareTrackModal
      isOpen={showShareModal}
      onClose={() => setShowShareModal(false)}
      track={currentTrack}
    />
    </>
  );
};
