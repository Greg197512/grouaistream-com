import { createContext, useContext, useState, useRef, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { extractYouTubeId } from "@/components/player/YouTubePlayer";

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

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.volume = volume / 100;

    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      if (audio.duration && !isVideoMode) {
        setProgress((audio.currentTime / audio.duration) * 100);
        setCurrentTime(audio.currentTime);
        setDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      if (repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play();
      } else {
        nextTrackInternal();
      }
    };

    const handleError = (e: Event) => {
      console.error("Audio error:", e);
      // Don't show error for YouTube tracks
      if (!isVideoMode) {
        toast.error("Failed to play track. Trying next...");
        setTimeout(() => nextTrackInternal(), 1000);
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
  }, [isVideoMode]);

  // Update volume when changed
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100;
    }
  }, [volume, isMuted]);

  const nextTrackInternal = useCallback(() => {
    if (queue.length === 0) return;
    
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
  }, [queue, queueIndex, repeatMode, isShuffled]);

  // Play current track when it changes
  useEffect(() => {
    if (!currentTrack) return;

    // Check if track has YouTube video
    const videoId = currentTrack.video_url ? extractYouTubeId(currentTrack.video_url) : null;
    
    if (videoId) {
      // YouTube mode
      setIsVideoMode(true);
      setYoutubeVideoId(videoId);
      setIsPlaying(true);
      setDuration(currentTrack.duration || 0);
      
      // Pause audio if playing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    } else if (currentTrack.audio_url) {
      // Audio mode
      setIsVideoMode(false);
      setYoutubeVideoId(null);
      
      if (audioRef.current) {
        audioRef.current.src = currentTrack.audio_url;
        audioRef.current.play().catch(console.error);
        setIsPlaying(true);
      }
    } else {
      toast.error("No audio available for this track");
      return;
    }
    
    // Log to listening history
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
    setCurrentTrack(track);
    setQueue([track]);
    setQueueIndex(0);
  };

  const playPlaylist = (tracks: Track[], startIndex = 0) => {
    if (tracks.length === 0) return;
    setQueue(tracks);
    setQueueIndex(startIndex);
    setCurrentTrack(tracks[startIndex]);
  };

  const togglePlay = () => {
    if (isVideoMode) {
      // YouTube playback is controlled via state change
      setIsPlaying(!isPlaying);
    } else if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(console.error);
      }
      setIsPlaying(!isPlaying);
    }
  };

  const nextTrack = () => {
    nextTrackInternal();
  };

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
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};
