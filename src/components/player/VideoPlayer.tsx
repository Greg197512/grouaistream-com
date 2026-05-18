import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Maximize2, Minimize2, Volume2, VolumeX } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { extractYouTubeId } from "./YouTubePlayer";
import { isLikelyAudioUrl, isNativeVideoUrl } from "@/lib/mediaPlayback";

interface VideoPlayerProps {
  isVisible: boolean;
  onClose: () => void;
}

// Send a command to the YouTube iframe via postMessage
const ytCmd = (iframe: HTMLIFrameElement | null, func: string, args: unknown[] = []) => {
  iframe?.contentWindow?.postMessage(
    JSON.stringify({ event: "command", func, args }),
    "*"
  );
};

export const VideoPlayer = ({ isVisible, onClose }: VideoPlayerProps) => {
  const { currentTrack, isPlaying, volume, isMuted, toggleMute, isVideoMode, onYouTubeTimeUpdate, onYouTubeEnded } = usePlayer();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);

  // YouTube refs
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const ytReadyRef = useRef(false);
  const isPlayingRef = useRef(isPlaying);
  const isMutedRef = useRef(isMuted);
  const volumeRef = useRef(volume);

  // Native video refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSrcRef = useRef<string | null>(null);
  const lastProgressSyncRef = useRef(0);

  const videoId = currentTrack?.video_url ? extractYouTubeId(currentTrack.video_url) : null;

  // Keep refs in sync for use inside message handler closure
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);

  const nativeVideoUrl = (() => {
    if (!isVideoMode || videoId) return null;
    const candidates = [currentTrack?.video_url, currentTrack?.audio_url];
    for (const url of candidates) {
      if (!url || extractYouTubeId(url)) continue;
      if (isNativeVideoUrl(url)) return url;
      if (url === currentTrack?.video_url && !isLikelyAudioUrl(url)) return url;
    }
    return null;
  })();

  // Reset YT ready flag when video changes
  useEffect(() => {
    ytReadyRef.current = false;
  }, [videoId]);

  // Listen for YouTube IFrame API messages
  useEffect(() => {
    if (!videoId) return;
    const handleMessage = (e: MessageEvent) => {
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;

        if (data?.event === "onReady") {
          ytReadyRef.current = true;
          // Apply current play/mute state once player is ready
          if (isPlayingRef.current) ytCmd(iframeRef.current, "playVideo");
          else ytCmd(iframeRef.current, "pauseVideo");
          if (isMutedRef.current) ytCmd(iframeRef.current, "mute");
          else {
            ytCmd(iframeRef.current, "unMute");
            ytCmd(iframeRef.current, "setVolume", [volumeRef.current]);
          }
        }

        // Time progress via infoDelivery events
        if (data?.event === "infoDelivery" && data?.info?.currentTime !== undefined) {
          onYouTubeTimeUpdate(data.info.currentTime, data.info.duration || 0);
        }

        // Track ended (playerState 0 = ENDED)
        if (data?.info?.playerState === 0) {
          onYouTubeEnded();
        }
      } catch {}
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [videoId, onYouTubeTimeUpdate, onYouTubeEnded]);

  // Sync play/pause via postMessage — NO src rebuild, NO iframe reload
  useEffect(() => {
    if (!videoId || !ytReadyRef.current) return;
    ytCmd(iframeRef.current, isPlaying ? "playVideo" : "pauseVideo");
  }, [isPlaying, videoId]);

  // Sync mute/volume via postMessage
  useEffect(() => {
    if (!videoId || !ytReadyRef.current) return;
    if (isMuted) {
      ytCmd(iframeRef.current, "mute");
    } else {
      ytCmd(iframeRef.current, "unMute");
      ytCmd(iframeRef.current, "setVolume", [volume]);
    }
  }, [isMuted, volume, videoId]);

  // ── Native video effects (unchanged) ────────────────────────────────────────

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !nativeVideoUrl) return;
    if (lastSrcRef.current === nativeVideoUrl) return;
    lastSrcRef.current = nativeVideoUrl;
    setIsBuffering(true);
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.src = nativeVideoUrl;
    video.load();
    if (isPlaying) video.play().catch(() => {});
  }, [nativeVideoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !nativeVideoUrl) return;
    if (isPlaying) { if (video.paused && video.readyState >= 2) video.play().catch(() => {}); }
    else { if (!video.paused) video.pause(); }
  }, [isPlaying, nativeVideoUrl]);

  useEffect(() => {
    if (!videoRef.current || !nativeVideoUrl) return;
    videoRef.current.volume = isMuted ? 0 : volume / 100;
  }, [volume, isMuted, nativeVideoUrl]);

  useEffect(() => {
    if (!nativeVideoUrl) return;
    const handleSeek = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (videoRef.current && detail?.time !== undefined) videoRef.current.currentTime = detail.time;
    };
    window.addEventListener("native-video-seek", handleSeek);
    return () => window.removeEventListener("native-video-seek", handleSeek);
  }, [nativeVideoUrl]);

  const syncProgress = useCallback((force = false) => {
    if (!videoRef.current) return;
    const now = performance.now();
    if (!force && now - lastProgressSyncRef.current < 250) return;
    lastProgressSyncRef.current = now;
    onYouTubeTimeUpdate(videoRef.current.currentTime, videoRef.current.duration || 0);
  }, [onYouTubeTimeUpdate]);

  const handleCanPlay = useCallback(() => {
    setIsBuffering(false);
    if (videoRef.current && isPlaying && videoRef.current.paused) videoRef.current.play().catch(() => {});
  }, [isPlaying]);

  const handleTimeUpdate = useCallback(() => { syncProgress(); }, [syncProgress]);
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      syncProgress(true);
      videoRef.current.volume = isMuted ? 0 : volume / 100;
    }
  }, [syncProgress, isMuted, volume]);
  const handleEnded = useCallback(() => { onYouTubeEnded(); }, [onYouTubeEnded]);

  if (!isVisible || !isVideoMode) return null;
  if (!videoId && !nativeVideoUrl) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 80, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 80, scale: 0.92 }}
        transition={{ type: "spring", damping: 28, stiffness: 220 }}
        className={`fixed z-50 ${
          isFullscreen ? "inset-0" : "bottom-28 right-4 w-80 md:w-96 aspect-video"
        }`}
      >
        <div className={`relative w-full h-full bg-black rounded-xl overflow-hidden shadow-2xl border border-border ${
          isFullscreen ? "" : "ring-2 ring-primary/30"
        }`}>

          {/* ── YouTube: stable src + key={videoId} prevents reload on play state change ── */}
          {videoId && (
            <iframe
              key={videoId}
              ref={iframeRef}
              src={`https://www.youtube.com/embed/${videoId}?autoplay=0&controls=1&modestbranding=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
              title={currentTrack?.title || "Video"}
            />
          )}

          {/* ── Native video ── */}
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
              onPlaying={() => setIsBuffering(false)}
              onWaiting={() => setIsBuffering(true)}
              onStalled={() => setIsBuffering(true)}
              onSeeking={() => setIsBuffering(true)}
              onSeeked={() => { setIsBuffering(false); syncProgress(true); }}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleEnded}
              onLoadedMetadata={handleLoadedMetadata}
            />
          )}

          {nativeVideoUrl && isBuffering && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/30 backdrop-blur-[2px] pointer-events-none">
              <div className="rounded-full border border-border bg-card/80 px-3 py-1 text-xs text-foreground shadow-lg">
                Buforowanie wideo...
              </div>
            </div>
          )}

          {/* Controls overlay */}
          <div className="absolute top-2 right-2 flex gap-2">
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={toggleMute}
              className="p-2 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-sm">
              {isMuted ? <VolumeX className="h-4 w-4 text-white" /> : <Volume2 className="h-4 w-4 text-white" />}
            </motion.button>
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setIsFullscreen(v => !v)}
              className="p-2 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-sm">
              {isFullscreen ? <Minimize2 className="h-4 w-4 text-white" /> : <Maximize2 className="h-4 w-4 text-white" />}
            </motion.button>
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={onClose}
              className="p-2 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-sm">
              <X className="h-4 w-4 text-white" />
            </motion.button>
          </div>

          {!isFullscreen && (
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
              <p className="text-white text-sm font-medium truncate">{currentTrack?.title}</p>
              <p className="text-white/70 text-xs truncate">{currentTrack?.artist}</p>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
