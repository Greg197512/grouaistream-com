import { useState, useCallback, useRef, useEffect } from "react";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { speak } from "@/utils/tts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getDJTexts, getDJLangFromAppLang, getDJTTSLang, DJLanguage } from "@/utils/djTexts";
import { playRandomTransitionEffect, playDJEffect } from "@/utils/djMixer";

interface DJSession {
  tracks: Track[];
  genres: string[];
  partyType: string;
  isActive: boolean;
  currentIndex: number;
  totalTracks: number;
}

/** Get current app language from localStorage */
const getAppLang = (): DJLanguage => {
  const saved = localStorage.getItem("grooveai-language");
  return getDJLangFromAppLang(saved || "en");
};

const randomFrom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const useDJMode = () => {
  const { playPlaylist, currentTrack, queue, isPlaying, audioElement } = usePlayer();
  const [djSession, setDjSession] = useState<DJSession | null>(null);
  const [isDJActive, setIsDJActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const transitionTimerRef = useRef<number | null>(null);
  const lastAnnouncedTrackRef = useRef<string | null>(null);
  const trackCountRef = useRef(0);

  // DJ speaks with the correct language
  const djSpeak = useCallback((text: string, opts?: { rate?: number; pitch?: number }) => {
    const lang = getAppLang();
    const ttsLang = getDJTTSLang(lang);
    return speak(text, { rate: opts?.rate ?? 1.05, pitch: opts?.pitch ?? 0.75, lang: ttsLang });
  }, []);

  // Announce DJ transition between tracks with sound effects
  useEffect(() => {
    if (!isDJActive || !currentTrack || !djSession) return;
    if (lastAnnouncedTrackRef.current === currentTrack.id) return;
    lastAnnouncedTrackRef.current = currentTrack.id;
    trackCountRef.current += 1;

    // Skip announcement for first track (intro already played)
    if (trackCountRef.current <= 1) return;

    // Announce every 2-3 tracks
    const shouldAnnounce = trackCountRef.current % 2 === 0 || trackCountRef.current % 3 === 0;
    if (!shouldAnnounce) return;

    const lang = getAppLang();
    const texts = getDJTexts(lang);
    const transition = randomFrom(texts.transitions);
    const trackInfo = texts.trackAnnounce(currentTrack.title, currentTrack.artist);
    const announcement = `${transition} ${trackInfo}`;

    // Play a DJ sound effect then speak
    transitionTimerRef.current = window.setTimeout(() => {
      // Random chance for different effects
      const effectRoll = Math.random();
      if (effectRoll > 0.6) {
        playRandomTransitionEffect();
      } else if (effectRoll > 0.3) {
        playDJEffect("scratch");
      }
      
      // Small delay after effect, then speak
      setTimeout(() => {
        djSpeak(announcement);
      }, 500);
    }, 1000);

    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, [currentTrack?.id, isDJActive, djSession, djSpeak]);

  // Start DJ session
  const startDJSession = useCallback(async (options: {
    genres?: string[];
    partyType?: string;
    trackCount?: number;
    customPrompt?: string;
  }) => {
    setIsLoading(true);
    const { genres = [], partyType = "party", trackCount = 15, customPrompt = "" } = options;
    const lang = getAppLang();
    const texts = getDJTexts(lang);

    try {
      toast.loading("🎧 DJ GrooveAI...", { id: "dj-mode" });

      // Fetch tracks matching genres
      let allTracks: any[] = [];
      
      if (genres.length > 0) {
        const genreFilters = genres.map(g => `genre.ilike.%${g}%`).join(",");
        const { data } = await supabase
          .from("tracks")
          .select("*")
          .not("audio_url", "is", null)
          .or(genreFilters)
          .limit(200);
        allTracks = data || [];
      }

      // Fill with more tracks if needed
      if (allTracks.length < trackCount) {
        const existingIds = allTracks.map(t => t.id);
        const { data: moreTracks } = await supabase
          .from("tracks")
          .select("*")
          .not("audio_url", "is", null)
          .limit(200);
        
        const additional = (moreTracks || []).filter(t => !existingIds.includes(t.id));
        allTracks = [...allTracks, ...additional];
      }

      if (allTracks.length === 0) {
        toast.error("No tracks available!", { id: "dj-mode" });
        setIsLoading(false);
        return;
      }

      // Shuffle and pick tracks
      const curatedTracks: Track[] = [...allTracks]
        .sort(() => Math.random() - 0.5)
        .slice(0, trackCount);

      const session: DJSession = {
        tracks: curatedTracks,
        genres,
        partyType,
        isActive: true,
        currentIndex: 0,
        totalTracks: curatedTracks.length,
      };

      setDjSession(session);
      setIsDJActive(true);
      trackCountRef.current = 0;
      lastAnnouncedTrackRef.current = null;

      // Build intro
      const introCategory = genres[0]?.toLowerCase() || partyType;
      const intros = texts.intros[introCategory] || texts.intros.default;
      const genreText = genres.length > 0 ? genres.join(", ") : "";
      const introText = `${randomFrom(intros)} ${texts.setStart(curatedTracks.length, genreText)} ${texts.trackAnnounce(curatedTracks[0].title, curatedTracks[0].artist)}`;

      toast.success(`🎧 DJ GrooveAI! ${curatedTracks.length} tracks`, { id: "dj-mode", duration: 5000 });

      // Play buildup effect, then speak intro, then start playback
      playDJEffect("buildup");
      
      await new Promise(r => setTimeout(r, 1500));
      await djSpeak(introText);
      
      // Start playback with a horn effect
      playDJEffect("horn");
      playPlaylist(curatedTracks);

    } catch (error) {
      console.error("DJ session error:", error);
      toast.error("DJ mode failed", { id: "dj-mode" });
    } finally {
      setIsLoading(false);
    }
  }, [playPlaylist, djSpeak]);

  // Stop DJ session
  const stopDJSession = useCallback(async () => {
    setIsDJActive(false);
    setDjSession(null);
    trackCountRef.current = 0;
    lastAnnouncedTrackRef.current = null;
    
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
    }

    const lang = getAppLang();
    const texts = getDJTexts(lang);
    const outro = randomFrom(texts.outros);
    
    playDJEffect("siren");
    toast.info("🎧 DJ GrooveAI - Set Complete!", { duration: 4000 });
    await djSpeak(outro);
  }, [djSpeak]);

  // Parse DJ command from text
  const parseDJCommand = useCallback((text: string): {
    isDJCommand: boolean;
    genres: string[];
    partyType: string;
    trackCount: number;
    customPrompt: string;
  } => {
    const lower = text.toLowerCase();
    
    const djPatterns = [
      /dj/i, /didżej/i, /disc\s*jockey/i,
      /domówk[aęi]/i, /imprez[aęi]/i, /party/i,
      /set\s+muzyczn/i, /zrób\s+set/i, /postaw\s+domówk/i,
      /rozkręć/i, /haus\s*party/i, /house\s*party/i,
      /feestje/i, /draai/i, // Dutch
      /вечірк[аіу]/i, /діджей/i, // Ukrainian
    ];
    
    const isDJCommand = djPatterns.some(p => p.test(lower));
    if (!isDJCommand) return { isDJCommand: false, genres: [], partyType: "", trackCount: 0, customPrompt: "" };

    const genreMap: Record<string, string> = {
      "techno": "Electronic", "house": "House", "haus": "House",
      "hip-hop": "Hip-Hop", "hip hop": "Hip-Hop", "hiphop": "Hip-Hop",
      "rap": "Rap", "rock": "Rock", "punk": "Punk", "metal": "Metal",
      "pop": "Pop", "jazz": "Jazz", "blues": "Blues", "disco": "Disco",
      "dance": "Dance", "edm": "Electronic", "trance": "Trance",
      "reggae": "Reggae", "r&b": "R&B", "rnb": "R&B", "funk": "Funk",
      "electronic": "Electronic", "indie": "Indie", "classical": "Classical",
      "ambient": "Ambient", "dens": "Dance", "electro": "Electronic",
    };

    const genres: string[] = [];
    for (const [keyword, genre] of Object.entries(genreMap)) {
      if (lower.includes(keyword) && !genres.includes(genre)) {
        genres.push(genre);
      }
    }

    let trackCount = 15;
    const countMatch = lower.match(/(\d+)\s*(?:utw|kawałk|piosen|track|song|utwor|nummer|трек|пісн)/i);
    if (countMatch) trackCount = Math.min(parseInt(countMatch[1]), 50);
    
    // Multi-language numbers
    const numberWords: Record<string, number> = {
      "pięć": 5, "piec": 5, "five": 5, "vijf": 5, "п'ять": 5,
      "dziesięć": 10, "dziesiec": 10, "ten": 10, "tien": 10, "десять": 10,
      "piętnaście": 15, "pietnascie": 15, "fifteen": 15, "vijftien": 15, "п'ятнадцять": 15,
      "dwadzieścia": 20, "dwadziescia": 20, "twenty": 20, "twintig": 20, "двадцять": 20,
      "trzydzieści": 30, "trzydziesci": 30, "thirty": 30, "dertig": 30, "тридцять": 30,
    };
    for (const [word, num] of Object.entries(numberWords)) {
      if (lower.includes(word)) { trackCount = num; break; }
    }

    let partyType = "party";
    if (lower.includes("domówk") || lower.includes("domowk") || lower.includes("feestje")) partyType = "party";
    else if (lower.includes("klub") || lower.includes("club")) partyType = "club";
    else if (lower.includes("chill") || lower.includes("relaks") || lower.includes("relax")) partyType = "chill";
    else if (lower.includes("trening") || lower.includes("workout")) partyType = "workout";
    else if (lower.includes("festival") || lower.includes("festiwal") || lower.includes("фестиваль")) partyType = "festival";

    return {
      isDJCommand: true,
      genres,
      partyType,
      trackCount,
      customPrompt: text,
    };
  }, []);

  // Handle crowd energy update
  const handleCrowdEnergy = useCallback(async (energy: {
    level: string;
    score: number;
    suggestion: string;
    suggestedGenreShift?: string;
  }) => {
    if (!isDJActive || !djSession) return;

    const shouldReact = Math.random() > 0.65;
    if (!shouldReact) return;

    const lang = getAppLang();
    const texts = getDJTexts(lang);
    const reactions = texts.crowdReactions[energy.level] || texts.crowdReactions.medium;
    const comment = randomFrom(reactions);

    if (energy.suggestedGenreShift) {
      toast.info(`🎥 ${comment}`, { duration: 4000 });
      
      if (Math.random() > 0.6) {
        playDJEffect("scratch");
        setTimeout(() => djSpeak(comment), 300);
      }
    }
  }, [isDJActive, djSession, djSpeak]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, []);

  return {
    isDJActive,
    isLoading,
    djSession,
    startDJSession,
    stopDJSession,
    parseDJCommand,
    handleCrowdEnergy,
  };
};
