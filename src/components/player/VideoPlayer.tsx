import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Maximize2, Minimize2, Volume2, VolumeX } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { extractYouTubeId } from "./YouTubePlayer";

interface VideoPlayerProps {
  isVisible: boolean;
  onClose: () => void;
}

export const VideoPlayer = ({ isVisible, onClose }: VideoPlayerProps) => {
  const { currentTrack, isPlaying, volume, isMuted, toggleMute, isVideoMode, onYouTubeTimeUpdate, onYouTubeEnded } = usePlayer();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSrcRef = useRef<string | null>(null);
  
  const videoId = currentTrack?.video_url ? extractYouTubeId(currentTrack.video_url) : null;
  
  // Determine native video URL
  const nativeVideoUrl = (() => {
    if (!isVideoMode || videoId) return null;
    const url = currentTrack?.video_url;
    if (!url) return null;
    if (extractYouTubeId(url)) return null;
    return url;
  })();

  // Load source only when URL actually changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !nativeVideoUrl) return;
    
    if (lastSrcRef.current === nativeVideoUrl) return;
    lastSrcRef.current = nativeVideoUrl;
    
    // Reset and load new source
    video.pause();
    video.removeAttribute('src');
    video.load();
    
    // Use source element approach for better codec negotiation
    video.src = nativeVideoUrl;
    video.load();
    
    if (isPlaying) {
      video.play().catch(() => {});
    }
  }, [nativeVideoUrl]);

  // Sync play/pause state
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !nativeVideoUrl) return;
    
    if (isPlaying) {
      if (video.paused && video.readyState >= 2) {
        video.play().catch(() => {});
      }
    } else {
      if (!video.paused) {
        video.pause();
      }
    }
  }, [isPlaying, nativeVideoUrl]);

  // Sync volume
  useEffect(() => {
    if (!videoRef.current || !nativeVideoUrl) return;
    videoRef.current.volume = isMuted ? 0 : volume / 100;
  }, [volume, isMuted, nativeVideoUrl]);

  // Handle seek events
  useEffect(() => {
    if (!nativeVideoUrl) return;
    const handleSeek = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (videoRef.current && detail?.time !== undefined) {
        videoRef.current.currentTime = detail.time;
      }
    };
    window.addEventListener('native-video-seek', handleSeek);
    return () => window.removeEventListener('native-video-seek', handleSeek);
  }, [nativeVideoUrl]);

  // Handle canplay to auto-start
  const handleCanPlay = useCallback(() => {
    if (videoRef.current && isPlaying && videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
    }
  }, [isPlaying]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      onYouTubeTimeUpdate(videoRef.current.currentTime, videoRef.current.duration || 0);
    }
  }, [onYouTubeTimeUpdate]);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      onYouTubeTimeUpdate(0, videoRef.current.duration || 0);
      // Sync volume on load
      videoRef.current.volume = isMuted ? 0 : volume / 100;
    }
  }, [onYouTubeTimeUpdate, isMuted, volume]);

  const handleEnded = useCallback(() => {
    onYouTubeEnded();
  }, [onYouTubeEnded]);

  if (!isVisible || !isVideoMode) return null;
  if (!videoId && !nativeVideoUrl) return null;

  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 100, scale: 0.9 }}
        className={`fixed z-50 ${
          isFullscreen 
            ? "inset-0" 
            : "bottom-28 right-4 w-80 md:w-96 aspect-video"
        }`}
      >
        <div className={`relative w-full h-full bg-black rounded-xl overflow-hidden shadow-2xl border border-border ${
          isFullscreen ? "" : "ring-2 ring-primary/30"
        }`}>
          {/* YouTube iframe */}
          {videoId && (
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=${isPlaying ? 1 : 0}&mute=${isMuted ? 1 : 0}&controls=1&modestbranding=1&rel=0&enablejsapi=1`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          )}

          {/* Native video player — persistent element keyed by track ID */}
          {nativeVideoUrl && (
            <video
              key={currentTrack?.id}
              ref={videoRef}
              className="w-full h-full object-contain"
              controls={false}
              playsInline
              preload="auto"
              disablePictureInPicture
              onContextMenu={e => e.preventDefault()}
              onCanPlay={handleCanPlay}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleEnded}
              onLoadedMetadata={handleLoadedMetadata}
            >
              <source src={`${nativeVideoUrl}#t=0.1`} type="video/mp4" />
            </video>
          )}

          {/* Controls overlay */}
          <div className="absolute top-2 right-2 flex gap-2">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleMute}
              className="p-2 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-sm"
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4 text-white" />
              ) : (
                <Volume2 className="h-4 w-4 text-white" />
              )}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleFullscreen}
              className="p-2 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-sm"
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4 text-white" />
              ) : (
                <Maximize2 className="h-4 w-4 text-white" />
              )}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="p-2 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-sm"
            >
              <X className="h-4 w-4 text-white" />
            </motion.button>
          </div>

          {/* Track info */}
          {!isFullscreen && (
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
              <p className="text-white text-sm font-medium truncate">{currentTrack?.title}</p>
              <p className="text-white/70 text-xs truncate">{currentTrack?.artist}</p>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
