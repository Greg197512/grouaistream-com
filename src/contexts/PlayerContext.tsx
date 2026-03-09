import { createContext, useContext, useState, useRef, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { extractYouTubeId } from "@/components/player/YouTubePlayer";
import { useSkipAdaptation } from "@/hooks/useSkipAdaptation";

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  duration: number;
  audio_url: string | null;
  video_url?: string | null;
  cover_url: string | null;
  genre: string | null;
  mood: string | null;
}

interface PlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  volume: number;
  isMuted: boolean;
  isShuffled: boolean;
  repeatMode: 'off' | 'all' | 'one';
  queue: Track[];
  playTrack: (track: Track) => void;
  playPlaylist: (tracks: Track[], startIndex?: number) => void;
  togglePlay: () => void;
  pausePlayback: () => void;
  resumePlayback: () => void;
  restartCurrentTrack: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seek: (position: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  addToQueue: (track: Track) => void;
  currentTime: number;
  duration: number;
  isVideoMode: boolean;
  youtubeVideoId: string | null;
  onYouTubeTimeUpdate: (time: number, dur: number) => void;
  onYouTubeEnded: () => void;
  skipAnalysis: { avoidGenres: string[]; avoidMoods: string[]; recentSkipCount: number; consecutiveSkips: number };
  onSkipTriggered: () => void;
  audioElement: HTMLAudioElement | null;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }
  return context;
};

export const PlayerProvider = ({ children }: { children: ReactNode }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackStartTime = useRef<number>(0);
  const isVideoModeRef = useRef(false);
  const nextTrackRef = useRef<(isUserSkip?: boolean) => void>(() => {});
  
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolumeState] = useState(70);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [isVideoMode, setIsVideoMode] = useState(false);
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);
  const [skipAnalysis, setSkipAnalysis] = useState({ avoidGenres: [] as string[], avoidMoods: [] as string[], recentSkipCount: 0, consecutiveSkips: 0 });

  const { recordSkip, getSkipAnalysis, triggerAIAdaptation } = useSkipAdaptation();

  // Keep refs in sync
  useEffect(() => { isVideoModeRef.current = isVideoMode; }, [isVideoMode]);

  // Get user ID from Supabase auth directly to avoid circular dependency
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Initialize audio element ONCE — use refs to avoid stale closures
  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume / 100;
    audio.preload = "auto";
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      if (audio.duration && !isVideoModeRef.current) {
        setProgress((audio.currentTime / audio.duration) * 100);
        setCurrentTime(audio.currentTime);
        setDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      nextTrackRef.current();
    };

    const handleError = () => {
      // Always check the CURRENT video mode via ref, not stale closure
      if (!isVideoModeRef.current && audio.src && audio.src !== window.location.href) {
        console.error("Audio playback error for:", audio.src);
        toast.error("Nie udało się odtworzyć — przechodzę dalej...");
        setTimeout(() => nextTrackRef.current(), 500);
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.pause();
    };
  }, []); // ONCE — no dependencies

  // Update volume when changed
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100;
    }
  }, [volume, isMuted]);

  const nextTrackInternal = useCallback(async (isUserSkip = false) => {
    if (queue.length === 0) return;

    // Track skip behavior for AI adaptation
    if (isUserSkip && currentTrack) {
      const playDuration = currentTime;
      const trackDuration = duration || currentTrack.duration || 180;
      
      const { wasSkipped, shouldAdapt, consecutiveSkips: skips } = await recordSkip(
        currentTrack,
        playDuration,
        trackDuration
      );

      if (wasSkipped) {
        setSkipAnalysis(getSkipAnalysis());
        
        if (shouldAdapt) {
          toast.info(`🤖 AI adapting to your preferences...`, { duration: 2000 });
          triggerAIAdaptation();
        } else if (skips && skips >= 2) {
          toast.info(`Skip ${skips}/3 - AI will adapt soon`, { duration: 1500 });
        }
      }
    }
    
    let nextIndex = queueIndex + 1;
    if (nextIndex >= queue.length) {
      if (repeatMode === 'all') {
        nextIndex = 0;
      } else {
        setIsPlaying(false);
        return;
      }
    }
    
    if (isShuffled) {
      nextIndex = Math.floor(Math.random() * queue.length);
    }
    
    setQueueIndex(nextIndex);
    setCurrentTrack(queue[nextIndex]);
  }, [queue, queueIndex, repeatMode, isShuffled, currentTrack, currentTime, duration, recordSkip, getSkipAnalysis, triggerAIAdaptation]);

  // Keep ref in sync so audio error/ended handlers use latest function
  useEffect(() => { nextTrackRef.current = nextTrackInternal; }, [nextTrackInternal]);

  const isHttpUrl = (value?: string | null) => Boolean(value && /^https?:\/\//i.test(value));

  const isAutoplayBlockedError = (error: unknown) => {
    if (!error) return false;
    if (error instanceof DOMException) return error.name === "NotAllowedError";
    if (error instanceof Error) return error.name === "NotAllowedError";
    return false;
  };

  const isBlockedStreamUrl = (value: string) =>
    value.includes("open.spotify.com") || value.startsWith("spotify:");

  const getPlayableYouTubeId = (track: Track): string | null =>
    track.video_url ? extractYouTubeId(track.video_url) : null;

  const getPlayableAudioUrl = (track: Track): string | null => {
    const candidates = [track.audio_url, track.video_url];

    for (const candidate of candidates) {
      if (!candidate || !isHttpUrl(candidate) || isBlockedStreamUrl(candidate)) continue;
      if (extractYouTubeId(candidate)) continue;
      return candidate;
    }

    return null;
  };

  const hasPlayableSource = (track: Track) =>
    Boolean(getPlayableYouTubeId(track) || getPlayableAudioUrl(track));

  // Play current track when it changes
  useEffect(() => {
    if (!currentTrack) return;

    const videoId = getPlayableYouTubeId(currentTrack);

    if (videoId) {
      setIsVideoMode(true);
      setYoutubeVideoId(videoId);
      setIsPlaying(true);
      setDuration(currentTrack.duration || 0);

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    } else {
      const audioUrl = getPlayableAudioUrl(currentTrack);

      if (!audioUrl) {
        toast.error("Ten utwór nie ma działającego źródła audio/video");
        nextTrackInternal();
        return;
      }

      setIsVideoMode(false);
      setYoutubeVideoId(null);

      if (audioRef.current) {
        console.log("[Player] Setting audio src:", audioUrl);
        audioRef.current.src = audioUrl;
        const playPromise = audioRef.current.play();
        console.log("[Player] play() called, promise:", !!playPromise);
        if (playPromise) {
          playPromise.then(() => {
            console.log("[Player] play() success");
            setIsPlaying(true);
          }).catch((error) => {
            console.error("[Player] play() error:", error.name, error.message);
            if (isAutoplayBlockedError(error)) {
              setIsPlaying(false);
              toast.info("Na telefonie naciśnij Play, aby rozpocząć odtwarzanie");
              return;
            }

            toast.error("Nie udało się odtworzyć utworu. Przechodzę do następnego...");
            nextTrackInternal();
          });
        }
      } else {
        console.error("[Player] audioRef.current is null!");
      }
    }

    if (userId) {
      supabase.from('listening_history').insert({
        user_id: userId,
        track_id: currentTrack.id,
      }).then(({ error }) => {
        if (error) console.error("Failed to log listening history:", error);
      });
    }
  }, [currentTrack, userId]);

  // YouTube time update handler
  const onYouTubeTimeUpdate = useCallback((time: number, dur: number) => {
    if (isVideoMode) {
      setCurrentTime(time);
      setDuration(dur);
      if (dur > 0) {
        setProgress((time / dur) * 100);
      }
    }
  }, [isVideoMode]);

  // YouTube ended handler
  const onYouTubeEnded = useCallback(() => {
    if (repeatMode === 'one') {
      // Will be handled by YouTube player
    } else {
      nextTrackInternal();
    }
  }, [repeatMode, nextTrackInternal]);

  const playTrack = (track: Track) => {
    if (!hasPlayableSource(track)) {
      toast.error("Ten utwór nie ma dostępnego źródła audio/video");
      return;
    }

    setCurrentTrack(track);
    setQueue([track]);
    setQueueIndex(0);
  };

  const playPlaylist = (tracks: Track[], startIndex = 0) => {
    const playableTracks = tracks.filter(hasPlayableSource);
    if (playableTracks.length === 0) {
      toast.error("Brak odtwarzalnych utworów w tej liście");
      return;
    }

    const requestedTrack = tracks[startIndex];
    const playableStartIndex = requestedTrack
      ? playableTracks.findIndex((track) => track.id === requestedTrack.id)
      : 0;

    setQueue(playableTracks);
    setQueueIndex(playableStartIndex >= 0 ? playableStartIndex : 0);
    setCurrentTrack(playableTracks[playableStartIndex >= 0 ? playableStartIndex : 0]);
  };

  const togglePlay = () => {
    if (isVideoMode) {
      setIsPlaying(!isPlaying);
    } else if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch((error) => {
            if (isAutoplayBlockedError(error)) {
              toast.info("Dotknij Play ponownie, aby odblokować odtwarzanie na telefonie");
              setIsPlaying(false);
              return;
            }
            console.error(error);
          });
      }
    }
  };

  const pausePlayback = () => {
    if (isVideoMode) {
      setIsPlaying(false);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
  };

  const resumePlayback = () => {
    if (!currentTrack) return;

    if (isVideoMode) {
      setIsPlaying(true);
      return;
    }

    if (audioRef.current) {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch((error) => {
          if (isAutoplayBlockedError(error)) {
            toast.info("Dotknij Play, aby wznowić odtwarzanie");
            setIsPlaying(false);
            return;
          }
          console.error(error);
        });
    }
  };

  const restartCurrentTrack = () => {
    if (!currentTrack) return;

    if (isVideoMode) {
      setProgress(0);
      setCurrentTime(0);
      setIsPlaying(true);
      return;
    }

    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setProgress(0);
      setCurrentTime(0);

      if (audioRef.current.paused) {
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch((error) => {
            if (isAutoplayBlockedError(error)) {
              setIsPlaying(false);
              return;
            }
            console.error(error);
          });
      } else {
        setIsPlaying(true);
      }
    }
  };

  const nextTrack = () => {
    nextTrackInternal(true); // User-initiated skip
  };

  const onSkipTriggered = useCallback(() => {
    setSkipAnalysis(getSkipAnalysis());
  }, [getSkipAnalysis]);

  const prevTrack = () => {
    // If more than 3 seconds in, restart current track
    if (currentTime > 3) {
      if (isVideoMode) {
        setProgress(0);
        setCurrentTime(0);
      } else if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }
      return;
    }
    
    let prevIndex = queueIndex - 1;
    if (prevIndex < 0) {
      prevIndex = repeatMode === 'all' ? queue.length - 1 : 0;
    }
    
    setQueueIndex(prevIndex);
    setCurrentTrack(queue[prevIndex]);
  };

  const seek = (position: number) => {
    if (!currentTrack) return;
    
    const targetDuration = duration || currentTrack.duration;
    const time = (position / 100) * targetDuration;
    
    if (isVideoMode) {
      setProgress(position);
      setCurrentTime(time);
      // YouTube seek will be handled by the component
    } else if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(position);
    }
  };

  const setVolume = (vol: number) => {
    setVolumeState(vol);
    if (vol > 0) setIsMuted(false);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const toggleShuffle = () => {
    setIsShuffled(!isShuffled);
  };

  const toggleRepeat = () => {
    const modes: ('off' | 'all' | 'one')[] = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf(repeatMode);
    setRepeatMode(modes[(currentIndex + 1) % modes.length]);
  };

  const addToQueue = (track: Track) => {
    setQueue(prev => [...prev, track]);
    toast.success(`Added "${track.title}" to queue`);
  };

  // Auto-play "Drop Chant Stream" on app start
  const hasAutoPlayed = useRef(false);
  useEffect(() => {
    if (hasAutoPlayed.current || currentTrack) return;
    hasAutoPlayed.current = true;
    
    supabase
      .from('tracks')
      .select('*')
      .ilike('title', '%Drop Chant Stream%')
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const track = data[0] as Track;
          if (track.audio_url || track.video_url) {
            setCurrentTrack(track);
            setQueue([track]);
            setQueueIndex(0);
          }
        }
      });
  }, []);

  // Auto-play specific track when language changes
  useEffect(() => {
    const handleLanguageChange = (e: Event) => {
      const lang = (e as CustomEvent).detail?.language;
      if (!lang) return;

      // Map language to a specific track
      const langTrackMap: Record<string, string> = {
        pl: '%Holenderski Club Peak%',
        en: '%Drop Chant Stream%',
        nl: '%Drop Chant Stream%',
        ua: '%Kyiv Club Signal%',
      };

      const pattern = langTrackMap[lang];
      if (!pattern) return;

      supabase
        .from('tracks')
        .select('*')
        .ilike('title', pattern)
        .limit(1)
        .then(({ data }) => {
          if (data && data.length > 0) {
            const track = data[0] as Track;
            if (track.audio_url || track.video_url) {
              setCurrentTrack(track);
              setQueue([track]);
              setQueueIndex(0);
            }
          }
        });
    };

    window.addEventListener("grooveai-language-change", handleLanguageChange);
    return () => window.removeEventListener("grooveai-language-change", handleLanguageChange);
  }, []);

  // Reset track start time when track changes
  useEffect(() => {
    trackStartTime.current = Date.now();
  }, [currentTrack?.id]);

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        progress,
        volume,
        isMuted,
        isShuffled,
        repeatMode,
        queue,
        playTrack,
        playPlaylist,
        togglePlay,
        pausePlayback,
        resumePlayback,
        restartCurrentTrack,
        nextTrack,
        prevTrack,
        seek,
        setVolume,
        toggleMute,
        toggleShuffle,
        toggleRepeat,
        addToQueue,
        currentTime,
        duration,
        isVideoMode,
        youtubeVideoId,
        onYouTubeTimeUpdate,
        onYouTubeEnded,
        skipAnalysis,
        onSkipTriggered,
        audioElement: audioRef.current,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};
