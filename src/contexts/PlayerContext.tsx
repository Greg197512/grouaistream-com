import { createContext, useContext, useState, useRef, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { extractYouTubeId } from "@/components/player/YouTubePlayer";
import { useSkipAdaptation } from "@/hooks/useSkipAdaptation";
import { useStreamCounter } from "@/hooks/useStreamCounter";
import { isLikelyAudioUrl, isNativeVideoUrl } from "@/lib/mediaPlayback";
import { getOfflineObjectUrl } from "@/lib/offlineLibrary";
import { proxiedMediaUrl } from "@/lib/mediaProxy";
import { LiveDJEngine, type DJEngineTrack } from "@/utils/liveDJEngine";

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
  playTrack: (track: Track, source?: string) => void;
  playPlaylist: (tracks: Track[], startIndex?: number, source?: string) => void;
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

/**
 * Gdy aktywne (silnik żywego miksowania gra wieloutworową kolejkę — patrz
 * playPlaylist) — audioRef jest ignorowany, a play/pause/seek/volume/next
 * są delegowane do tych handlerów zamiast do zwykłego elementu <audio>.
 */
interface ExternalPlaybackHandlers {
  onPause: () => void;
  onResume: () => void;
  onSeek: (percent: number) => void;
  onSkip: () => void;
  onVolumeChange: (volume: number, muted: boolean) => void;
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
  const prevTrackRef = useRef<() => void>(() => {});
  const userIdRef = useRef<string | null>(null);
  // Token unieważniający zaległe (asynchroniczne) starty audio przy szybkiej zmianie utworu.
  const playRequestRef = useRef(0);
  // Smart Shuffle — ID-ki utworów już wylosowanych w bieżącym cyklu (bez powtórek aż przejdzie cała kolejka).
  const shuffleHistoryRef = useRef<Set<string>>(new Set());
  // Żywy silnik crossfade (beatmatch-lite + EQ carving) — automatycznie przejmuje
  // odtwarzanie dla każdej wieloutworowej kolejki złożonej z samego audio (patrz
  // playPlaylist), żeby przejścia między utworami nie "klikały", tylko płynnie się mixowały.
  const crossfadeEngineRef = useRef<LiveDJEngine | null>(null);
  const externalPlaybackRef = useRef<ExternalPlaybackHandlers | null>(null);

  const teardownCrossfadeEngine = useCallback(() => {
    externalPlaybackRef.current = null;
    if (crossfadeEngineRef.current) {
      crossfadeEngineRef.current.destroy();
      crossfadeEngineRef.current = null;
    }
  }, []);
  
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
  const [streamSource, setStreamSource] = useState<string>("direct");

  const { recordSkip, getSkipAnalysis, triggerAIAdaptation } = useSkipAdaptation();

  // Stream counter — counts a stream after 30s of continuous playback
  useStreamCounter(currentTrack?.id ?? null, isPlaying, userId, streamSource);

  // Keep refs in sync
  useEffect(() => { isVideoModeRef.current = isVideoMode; }, [isVideoMode]);
  // Refy z najświeższym stanem kolejki — używane przez globalne czyszczenie usuniętych utworów.
  const queueRef = useRef<Track[]>([]);
  const queueIndexRef = useRef(0);
  const currentTrackRef = useRef<Track | null>(null);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);

  // Usuń skasowany utwór z odtwarzacza NATYCHMIAST (kolejka + bieżący). Idempotentne.
  const purgeDeletedTrack = useCallback((trackId: string) => {
    if (!trackId) return;
    const q = queueRef.current;
    const idxInQueue = q.findIndex((t) => t.id === trackId);
    const isCurrent = currentTrackRef.current?.id === trackId;
    if (idxInQueue === -1 && !isCurrent) return;

    const newQueue = q.filter((t) => t.id !== trackId);

    if (isCurrent) {
      if (newQueue.length === 0) {
        // Nie ma co grać — zatrzymaj i wyczyść.
        if (audioRef.current) { audioRef.current.pause(); audioRef.current.removeAttribute("src"); }
        setIsPlaying(false);
        setCurrentTrack(null);
        setQueue([]);
        setQueueIndex(0);
        return;
      }
      const newIndex = Math.min(idxInQueue === -1 ? 0 : idxInQueue, newQueue.length - 1);
      setQueue(newQueue);
      setQueueIndex(newIndex);
      setCurrentTrack(newQueue[newIndex]); // przeskocz na następny dostępny
    } else {
      const curIdx = queueIndexRef.current;
      setQueue(newQueue);
      if (idxInQueue !== -1 && idxInQueue < curIdx) setQueueIndex(curIdx - 1);
    }
  }, []);

  // Globalne usuwanie utworu z CAŁEJ aplikacji: Realtime DELETE (u wszystkich) + event lokalny (natychmiast).
  useEffect(() => {
    const onDeleted = (e: Event) => {
      const id = (e as CustomEvent).detail?.trackId as string | undefined;
      if (id) purgeDeletedTrack(id);
    };
    window.addEventListener("grouai:track-deleted", onDeleted as EventListener);

    const ch = supabase
      .channel("tracks-deletions")
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "tracks" }, (payload) => {
        const id = (payload.old as { id?: string })?.id;
        if (id) purgeDeletedTrack(id);
      })
      .subscribe();

    return () => {
      window.removeEventListener("grouai:track-deleted", onDeleted as EventListener);
      supabase.removeChannel(ch);
    };
  }, [purgeDeletedTrack]);

  // Get user ID from Supabase auth directly to avoid circular dependency
  // Use ref to avoid re-triggering playback when auth state changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      userIdRef.current = uid;
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      userIdRef.current = uid;
    });

    return () => subscription.unsubscribe();
  }, []);

  // Initialize audio element ONCE — use refs to avoid stale closures
  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume / 100;
    audio.preload = "auto";
    audio.setAttribute("data-player", "main");
    // Kluczowe dla telefonów: gra w tle po wygaszeniu ekranu (iOS/Android).
    audio.setAttribute("playsinline", "");
    (audio as any).playsInline = true;
    audio.setAttribute("x-webkit-airplay", "allow");
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
    externalPlaybackRef.current?.onVolumeChange(volume, isMuted);
  }, [volume, isMuted]);

  // Zgaś silnik crossfade przy odmontowaniu providera.
  useEffect(() => teardownCrossfadeEngine, [teardownCrossfadeEngine]);

  // === MediaSession — sterowanie z ekranu blokady + granie w tle na telefonie ===
  // Bez tego mobilne przeglądarki usypiają audio po wygaszeniu ekranu.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    try {
      ms.setActionHandler("play", () => {
        audioRef.current?.play().then(() => setIsPlaying(true)).catch(() => {});
      });
      ms.setActionHandler("pause", () => { audioRef.current?.pause(); setIsPlaying(false); });
      ms.setActionHandler("nexttrack", () => nextTrackRef.current(true));
      ms.setActionHandler("previoustrack", () => prevTrackRef.current());
      ms.setActionHandler("stop", () => { audioRef.current?.pause(); setIsPlaying(false); });
    } catch { /* część akcji może nie być wspierana */ }
  }, []);

  // Metadata (tytuł/artysta/okładka na ekranie blokady) + stan odtwarzania.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    if (currentTrack && typeof MediaMetadata !== "undefined") {
      try {
        const art = currentTrack.cover_url || undefined;
        ms.metadata = new MediaMetadata({
          title: currentTrack.title || "GrouAI Stream",
          artist: currentTrack.artist || "GrouAI",
          album: currentTrack.album || "GrouaRadio",
          artwork: art ? [96, 128, 192, 256, 384, 512].map((s) => ({ src: art, sizes: `${s}x${s}`, type: "image/jpeg" })) : [],
        });
      } catch { /* */ }
    }
    try { ms.playbackState = isPlaying ? "playing" : "paused"; } catch { /* */ }
  }, [currentTrack, isPlaying]);

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
    
    let nextIndex: number;

    if (isShuffled && queue.length > 1) {
      // SMART SHUFFLE: nie powtarzaj utworu, aż przejdzie cała kolejka; unikaj tego samego artysty pod rząd.
      const history = shuffleHistoryRef.current;
      if (currentTrack) history.add(currentTrack.id);

      const allIdx = queue.map((_, i) => i);
      let candidates = allIdx.filter((i) => queue[i].id !== currentTrack?.id && !history.has(queue[i].id));

      if (candidates.length === 0) {
        // Cały cykl odtworzony.
        if (repeatMode !== 'all') { setIsPlaying(false); return; }
        history.clear();
        if (currentTrack) history.add(currentTrack.id);
        candidates = allIdx.filter((i) => queue[i].id !== currentTrack?.id);
      }

      // Miękkie: preferuj innego artystę niż aktualny (jak się da).
      const diffArtist = candidates.filter((i) => (queue[i].artist || "") !== (currentTrack?.artist || ""));
      const pool = diffArtist.length > 0 ? diffArtist : candidates;
      nextIndex = pool[Math.floor(Math.random() * pool.length)];
      history.add(queue[nextIndex].id);
    } else {
      nextIndex = queueIndex + 1;
      if (nextIndex >= queue.length) {
        if (repeatMode === 'all') {
          nextIndex = 0;
        } else {
          setIsPlaying(false);
          return;
        }
      }
    }

    setQueueIndex(nextIndex);
    setCurrentTrack(queue[nextIndex]);
  }, [queue, queueIndex, repeatMode, isShuffled, currentTrack, currentTime, duration, recordSkip, getSkipAnalysis, triggerAIAdaptation]);

  // Keep ref in sync so audio error/ended handlers use latest function
  useEffect(() => { nextTrackRef.current = nextTrackInternal; }, [nextTrackInternal]);

  const isPlayableUrl = (value?: string | null) => Boolean(value && /^(https?|blob|data):/i.test(value));
  const isRemoteUrl = (value?: string | null) => Boolean(value && /^https?:\/\//i.test(value));
  const isLocalBrowserUrl = (value?: string | null) => Boolean(value && /^(blob|data):/i.test(value));

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

  const getNativeVideoUrl = (track: Track): string | null => {
    // Check video_url first
    if (track.video_url && isPlayableUrl(track.video_url) && !extractYouTubeId(track.video_url)) {
      // If it has a video extension OR is not a YouTube link, treat as native video
      if (isNativeVideoUrl(track.video_url)) return track.video_url;
      // If video_url is set but no YouTube ID and no known audio extension, assume it's a video
        if (!isLikelyAudioUrl(track.video_url)) {
        return track.video_url;
      }
    }
    // Also check audio_url — some video files get stored there
    if (track.audio_url && isPlayableUrl(track.audio_url) && isNativeVideoUrl(track.audio_url)) {
      return track.audio_url;
    }
    return null;
  };

  const getPlayableAudioUrl = (track: Track): string | null => {
    const candidates = [track.audio_url, track.video_url];

    for (const candidate of candidates) {
      if (!candidate || !isPlayableUrl(candidate) || isBlockedStreamUrl(candidate)) continue;
      if (isRemoteUrl(candidate) && extractYouTubeId(candidate)) continue;
      return candidate;
    }

    return null;
  };

  const hasPlayableSource = (track: Track) =>
    Boolean(getPlayableYouTubeId(track) || getNativeVideoUrl(track) || getPlayableAudioUrl(track));

  // Play current track when it changes
  useEffect(() => {
    if (!currentTrack) return;

    // Żywy silnik crossfade sam odtwarza audio na własnych deckach (patrz
    // playPlaylist) — nie dotykamy głównego audioRef, tylko logujemy historię.
    if (externalPlaybackRef.current) {
      const uid = userIdRef.current;
      if (uid) {
        supabase.from('listening_history').insert({
          user_id: uid,
          track_id: currentTrack.id,
        }).then(({ error }) => {
          if (error) console.error("Failed to log listening history:", error);
        });
      }
      return;
    }

    // Każde uruchomienie efektu unieważnia zaległe async-starty audio (offline lookup).
    const playToken = ++playRequestRef.current;

    const videoId = getPlayableYouTubeId(currentTrack);
    const nativeVideoUrl = getNativeVideoUrl(currentTrack);

    if (videoId) {
      isVideoModeRef.current = true;
      setIsVideoMode(true);
      setYoutubeVideoId(videoId);
      setIsPlaying(true);
      setDuration(currentTrack.duration || 0);

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
      }
    } else if (nativeVideoUrl) {
      // Native video file (MP4/WEBM/MKV/AVI/MOV/FLV/WMV etc.) — use isVideoMode
      // CRITICAL: Update ref synchronously BEFORE clearing audio src,
      // because setting src="" fires a synchronous error event in the browser.
      isVideoModeRef.current = true;
      setIsVideoMode(true);
      setYoutubeVideoId(null);
      setIsPlaying(true);
      setDuration(currentTrack.duration || 0);

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
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
        const audioElement = audioRef.current;

        const startAudio = (srcUrl: string, isLocalSource: boolean) => {
          audioElement.pause();
          audioElement.removeAttribute("src");
          audioElement.load();
          // NIE wymuszaj crossOrigin="anonymous". Wizualizer (audioTap) i tak
          // pomija źródła cross-origin, więc CORS nic tu nie daje, a wymuszenie
          // go BLOKUJE odtwarzanie plików z R2/hosta bez nagłówków CORS
          // (świeżo wgrane utwory „nie działały"). Zwykłe (opaque) media grają zawsze.
          audioElement.crossOrigin = null;
          // Media z R2 puść przez /api/media (poprawny Content-Type + zakresy).
          const finalUrl = isLocalSource ? srcUrl : (proxiedMediaUrl(srcUrl) || srcUrl);
          console.log("[Player] Setting audio src:", finalUrl.startsWith("blob:") ? "blob (offline)" : finalUrl);
          audioElement.src = finalUrl;
          audioElement.load();

          const playPromise = audioElement.play();
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

              if (isLocalSource) {
                setIsPlaying(false);
                toast.error("Telefon zablokował ten plik lokalny. Spróbuj ponownie nacisnąć Play lub wybierz inny format MP3/M4A.");
                return;
              }

              toast.error("Nie udało się odtworzyć utworu. Przechodzę do następnego...");
              nextTrackInternal();
            });
          }
        };

        // Najpierw kopia offline (IndexedDB) — gra bez internetu; inaczej normalne źródło sieciowe.
        getOfflineObjectUrl(currentTrack.id)
          .then((offlineUrl) => {
            if (playRequestRef.current !== playToken) return; // utwór zmienił się w międzyczasie
            if (offlineUrl) startAudio(offlineUrl, true);
            else startAudio(audioUrl, isLocalBrowserUrl(audioUrl));
          })
          .catch(() => {
            if (playRequestRef.current !== playToken) return;
            startAudio(audioUrl, isLocalBrowserUrl(audioUrl));
          });
      } else {
        console.error("[Player] audioRef.current is null!");
      }
    }

    // Log listening history using ref (no re-trigger on auth change)
    const uid = userIdRef.current;
    if (uid) {
      supabase.from('listening_history').insert({
        user_id: uid,
        track_id: currentTrack.id,
      }).then(({ error }) => {
        if (error) console.error("Failed to log listening history:", error);
      });
    }
  }, [currentTrack]); // Removed userId — use ref to avoid restarting playback on auth change

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

  // Kolejkę da się żywo miksować tylko gdy WSZYSTKIE utwory to zwykłe audio
  // (bez wideo/YouTube — te idą normalną ścieżką, silnik ich nie obsługuje).
  const isCrossfadeEligible = (tracks: Track[]) =>
    tracks.length > 1 && tracks.every((t) => !getPlayableYouTubeId(t) && !getNativeVideoUrl(t) && !!getPlayableAudioUrl(t));

  const playTrack = (track: Track, source: string = "direct") => {
    if (!hasPlayableSource(track)) {
      toast.error("Ten utwór nie ma dostępnego źródła audio/video");
      return;
    }

    teardownCrossfadeEngine();
    setStreamSource(source);
    setCurrentTrack(track);
    setQueue([track]);
    setQueueIndex(0);
  };

  const playPlaylist = (tracks: Track[], startIndex = 0, source: string = "playlist") => {
    const playableTracks = tracks.filter(hasPlayableSource);
    if (playableTracks.length === 0) {
      toast.error("Brak odtwarzalnych utworów w tej liście");
      return;
    }

    const requestedTrack = tracks[startIndex];
    const playableStartIndex = requestedTrack
      ? playableTracks.findIndex((track) => track.id === requestedTrack.id)
      : 0;
    const resolvedIndex = playableStartIndex >= 0 ? playableStartIndex : 0;

    setStreamSource(source);
    shuffleHistoryRef.current = new Set(); // nowa lista → świeży cykl smart shuffle
    setQueue(playableTracks);
    teardownCrossfadeEngine();

    if (isCrossfadeEligible(playableTracks)) {
      // Żywy crossfade: silnik sam gra i zgłasza zmiany utworu/postępu z powrotem tutaj.
      const engine = new LiveDJEngine();
      crossfadeEngineRef.current = engine;
      engine.setVolume(volume, isMuted);
      engine.onTrackChange = (track, index) => {
        setQueueIndex(index);
        setCurrentTrack(track as unknown as Track);
        setIsPlaying(true);
      };
      engine.onTimeUpdate = (ct, dur) => {
        setCurrentTime(ct);
        setDuration(dur);
        if (dur > 0) setProgress((ct / dur) * 100);
      };
      engine.onSessionEnded = () => {
        if (repeatMode === "all") {
          void engine.start(playableTracks as unknown as DJEngineTrack[], 0);
        } else {
          setIsPlaying(false);
        }
      };
      // Awaryjnie: gdy plik nie ma CORS (np. świeży upload z R2), crossfade nie
      // zagra. Porzucamy silnik i gramy listę zwykłym <audio> (bez CORS działa
      // ZAWSZE) — użytkownik słyszy muzykę, tylko bez płynnego miksowania.
      engine.onLoadError = () => {
        teardownCrossfadeEngine();
        const fallbackTrack = playableTracks[resolvedIndex];
        // null → utwór wymusza ponowne uruchomienie efektu odtwarzania nawet, gdy
        // silnik zdążył ustawić ten sam currentTrack (inaczej ten sam ref = brak
        // re-runu i cisza). Krótki null jest niesłyszalny — i tak nic nie grało.
        setCurrentTrack(null);
        setTimeout(() => {
          if (externalPlaybackRef.current) return; // ktoś w międzyczasie odpalił inny silnik
          setQueueIndex(resolvedIndex);
          setCurrentTrack(fallbackTrack);
        }, 0);
      };
      externalPlaybackRef.current = {
        onPause: () => engine.pause(),
        onResume: () => { void engine.resume(); },
        onSeek: (pct) => engine.seek(pct),
        onSkip: () => { void engine.skipToNext(); },
        onVolumeChange: (vol, muted) => engine.setVolume(vol, muted),
      };
      setQueueIndex(resolvedIndex);
      void engine.start(playableTracks as unknown as DJEngineTrack[], resolvedIndex);
    } else {
      setQueueIndex(resolvedIndex);
      setCurrentTrack(playableTracks[resolvedIndex]);
    }
  };

  const togglePlay = () => {
    if (externalPlaybackRef.current) {
      if (isPlaying) { externalPlaybackRef.current.onPause(); setIsPlaying(false); }
      else { externalPlaybackRef.current.onResume(); setIsPlaying(true); }
      return;
    }
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
    if (externalPlaybackRef.current) { externalPlaybackRef.current.onPause(); setIsPlaying(false); return; }
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

    if (externalPlaybackRef.current) { externalPlaybackRef.current.onResume(); setIsPlaying(true); return; }

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
      window.dispatchEvent(new CustomEvent('native-video-seek', { detail: { time: 0 } }));
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
    // Skip limiting for free users — check localStorage for plan
    // (avoiding circular context dependency with SubscriptionContext)
    const planData = localStorage.getItem("grooveai-skip-count");
    const today = new Date().toDateString();
    const skipStore = planData ? JSON.parse(planData) : { date: today, count: 0 };

    if (skipStore.date !== today) {
      skipStore.date = today;
      skipStore.count = 0;
    }

    // Check subscription plan from supabase cache
    const cachedPlan = localStorage.getItem("grooveai-current-plan") || "free";
    
    if (cachedPlan === "free") {
      const MAX_FREE_SKIPS = 6;
      if (skipStore.count >= MAX_FREE_SKIPS) {
        toast.error("Osiągnąłeś limit pomijania na darmowym planie. Ulepsz do Pro!");
        return;
      }
      skipStore.count += 1;
      localStorage.setItem("grooveai-skip-count", JSON.stringify(skipStore));
      
      if (skipStore.count >= MAX_FREE_SKIPS - 1) {
        toast.warning(`Pozostało ${MAX_FREE_SKIPS - skipStore.count} pominięć na dziś`);
      }
    }

    if (externalPlaybackRef.current) { externalPlaybackRef.current.onSkip(); return; }
    nextTrackInternal(true); // User-initiated skip
  };

  const onSkipTriggered = useCallback(() => {
    setSkipAnalysis(getSkipAnalysis());
  }, [getSkipAnalysis]);

  const prevTrack = () => {
    // Żywy crossfade nie umie "cofać" utworu — najbliższy odpowiednik: od nowa bieżący.
    if (externalPlaybackRef.current) { externalPlaybackRef.current.onSeek(0); return; }

    // If more than 3 seconds in, restart current track
    if (currentTime > 3) {
      if (isVideoMode) {
        setProgress(0);
        setCurrentTime(0);
        window.dispatchEvent(new CustomEvent('native-video-seek', { detail: { time: 0 } }));
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
  prevTrackRef.current = prevTrack; // dla MediaSession (poprzedni utwór z ekranu blokady)

  const seek = (position: number) => {
    if (!currentTrack) return;

    if (externalPlaybackRef.current) { externalPlaybackRef.current.onSeek(position); setProgress(position); return; }

    const targetDuration = duration || currentTrack.duration;
    const time = (position / 100) * targetDuration;
    
    if (isVideoMode) {
      setProgress(position);
      setCurrentTime(time);
      // Dispatch seek event for native video player
      window.dispatchEvent(new CustomEvent('native-video-seek', { detail: { time } }));
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
    setIsShuffled((prev) => {
      const next = !prev;
      // Włączamy shuffle → świeży cykl (bez powtórek); w historii tylko bieżący utwór.
      shuffleHistoryRef.current = new Set(currentTrack ? [currentTrack.id] : []);
      return next;
    });
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

  // Shared: load language-specific track into player.
  // Szuka utworu po tytule niezależnie od hostingu audio (R2 / Vercel / Lovable —
  // wszystkie dają zwykły publiczny URL w kolumnie audio_url). Najpierw próbuje
  // dokładnego dopasowania tytułu, potem częściowego (na wypadek drobnych różnic
  // w zapisie), i zawsze wybiera rekord z prawdziwym linkiem http. BEZ losowego
  // fallbacku — jeśli danego utworu nie ma, nic się nie odpala.
  const loadLangTrack = useCallback((lang: string) => {
    const langTrackMap: Record<string, string> = {
      pl: 'GrouAIStream — Neonowe Serce',
      en: 'GrouAIStream — Neon Nights',
      nl: 'GrouAIStream — Amsterdam Pulse',
      ua: 'GrouAIStream — Kyiv Signal',
    };
    const trackTitle = langTrackMap[lang] || langTrackMap.en;

    const startTrack = (track: Track) => {
      setCurrentTrack(track);
      setQueue([track]);
      setQueueIndex(0);
      setTimeout(() => {
        if (audioRef.current) audioRef.current.play().catch(() => {});
      }, 120);
    };

    const pickPlayable = (rows: Track[] | null): Track | null => {
      if (!rows || rows.length === 0) return null;
      return (
        rows.find((r) => (r.audio_url ?? "").startsWith("http")) ||
        rows.find((r) => !!r.audio_url) ||
        rows.find((r) => !!r.video_url) ||
        null
      );
    };

    (async () => {
      // 1) Exact title.
      const exact = await supabase
        .from('tracks')
        .select('*')
        .eq('title', trackTitle)
        .not('audio_url', 'is', null)
        .limit(5);
      let track = pickPlayable(exact.data as Track[] | null);

      // 2) Partial title.
      if (!track) {
        const partial = await supabase
          .from('tracks')
          .select('*')
          .ilike('title', `%${trackTitle.split(' ')[0]}%`)
          .not('audio_url', 'is', null)
          .limit(5);
        track = pickPlayable(partial.data as Track[] | null);
      }

      // 3) Safety fallback — always play SOMETHING at start.
      if (!track) {
        const any = await supabase
          .from('tracks')
          .select('*')
          .not('audio_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(10);
        track = pickPlayable(any.data as Track[] | null);
      }

      if (track) startTrack(track);
    })();
  }, []);

  // Auto-play językowego utworu przy wejściu do aplikacji. Używa odpornego
  // loadLangTrack (dokładny → częściowy tytuł, wybór rekordu z linkiem http),
  // BEZ losowego fallbacku — więc odpala WYŁĄCZNIE właściwą piosenkę danego
  // języka (PL: Holenderski Club Peak, EN: Neon Floor Directions,
  // NL: Amsterdam Drop Call, UA: Kyiv Club Signal), nigdy przypadkowego utworu.
  const hasAutoPlayed = useRef(false);
  useEffect(() => {
    if (hasAutoPlayed.current || currentTrack) return;
    hasAutoPlayed.current = true;
    const lang = localStorage.getItem("grooveai-language") || "en";
    loadLangTrack(lang);
  }, [loadLangTrack]);

  // Auto-play specific track when language changes — ta sama odporna logika
  // co przy starcie (jedno źródło prawdy: loadLangTrack).
  useEffect(() => {
    const handleLanguageChange = (e: Event) => {
      const lang = (e as CustomEvent).detail?.language;
      if (!lang) return;
      loadLangTrack(lang);
    };

    window.addEventListener("grooveai-language-change", handleLanguageChange);
    return () => window.removeEventListener("grooveai-language-change", handleLanguageChange);
  }, [loadLangTrack]);

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
