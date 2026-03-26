import { useState, useRef, useEffect } from "react";
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
  
  const videoId = currentTrack?.video_url ? extractYouTubeId(currentTrack.video_url) : null;
  const isNativeVideo = isVideoMode && !videoId && currentTrack?.video_url && !extractYouTubeId(currentTrack.video_url);

  // Sync native video playback state
  useEffect(() => {
    if (!videoRef.current || !isNativeVideo) return;
    if (isPlaying) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying, isNativeVideo]);

  // Sync volume
  useEffect(() => {
    if (!videoRef.current || !isNativeVideo) return;
    videoRef.current.volume = isMuted ? 0 : volume / 100;
  }, [volume, isMuted, isNativeVideo]);

  // Load native video source
  useEffect(() => {
    if (!videoRef.current || !isNativeVideo || !currentTrack?.video_url) return;
    videoRef.current.src = currentTrack.video_url;
    videoRef.current.load();
    if (isPlaying) videoRef.current.play().catch(() => {});
  }, [currentTrack?.video_url, isNativeVideo]);

  // Listen for seek events
  useEffect(() => {
    if (!isNativeVideo) return;
    const handleSeek = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (videoRef.current && detail?.time !== undefined) {
        videoRef.current.currentTime = detail.time;
      }
    };
    window.addEventListener('native-video-seek', handleSeek);
    return () => window.removeEventListener('native-video-seek', handleSeek);
  }, [isNativeVideo]);

  if (!isVisible || !isVideoMode) return null;
  if (!videoId && !isNativeVideo) return null;

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

          {/* Native video player (all formats) */}
          {isNativeVideo && (
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              controls={false}
              playsInline
              crossOrigin="anonymous"
              onTimeUpdate={() => {
                if (videoRef.current) {
                  onYouTubeTimeUpdate(videoRef.current.currentTime, videoRef.current.duration || 0);
                }
              }}
              onEnded={() => onYouTubeEnded()}
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  onYouTubeTimeUpdate(0, videoRef.current.duration || 0);
                }
              }}
            />
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
