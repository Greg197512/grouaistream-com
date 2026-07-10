import { useState, useCallback, useRef, useEffect } from "react";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { speak } from "@/utils/tts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getDJTexts, getDJLangFromAppLang, getDJTTSLang, DJLanguage, shortenTitle, shortenArtist } from "@/utils/djTexts";
import { playRandomTransitionEffect, playDJEffect, playDropCombo } from "@/utils/djMixer";

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

  // DJ speaks — LOUD, FAST, PUNCHY, HARD, Rotterdam energy
  const djSpeak = useCallback(async (text: string, opts?: { rate?: number; pitch?: number }) => {
    const lang = getAppLang();
    const ttsLang = getDJTTSLang(lang);
    // Play a subtle effect before DJ speaks for mix feel
    const preEffect = Math.random();
    if (preEffect > 0.6) playDJEffect("stab");
    else if (preEffect > 0.3) playDJEffect("laser");
    
    await new Promise(r => setTimeout(r, 150));
    return speak(text, { rate: opts?.rate ?? 1.25, pitch: opts?.pitch ?? 1.1, lang: ttsLang, mode: "dj" });
  }, []);

  // Announce DJ transition between tracks with hard techno effects
  useEffect(() => {
    if (!isDJActive || !currentTrack || !djSession) return;
    if (lastAnnouncedTrackRef.current === currentTrack.id) return;
    lastAnnouncedTrackRef.current = currentTrack.id;
    trackCountRef.current += 1;

    // Skip announcement for first track (intro already played)
    if (trackCountRef.current <= 1) return;

    // Announce every 2nd track, with occasional 3rd track bonus
    const shouldAnnounce = trackCountRef.current % 2 === 0 || (trackCountRef.current % 3 === 0 && Math.random() > 0.5);
    if (!shouldAnnounce) return;

    const lang = getAppLang();
    const texts = getDJTexts(lang);
    const transition = randomFrom(texts.transitions);
    const shortTitle = shortenTitle(currentTrack.title);
    const trackInfo = texts.trackAnnounce(shortTitle, shortenArtist(currentTrack.artist));

    transitionTimerRef.current = window.setTimeout(async () => {
      // Hard techno effects BEFORE speech
      const effectRoll = Math.random();
      if (effectRoll > 0.7) {
        playDJEffect("industrial_kick");
        setTimeout(() => playDJEffect("stab"), 100);
      } else if (effectRoll > 0.45) {
        playRandomTransitionEffect();
      } else if (effectRoll > 0.25) {
        playDJEffect("scratch");
      } else {
        playDJEffect("riser");
      }
      
      // Build SHORT announcement: hype + transition (skip full track info sometimes)
      let fullAnnouncement = transition;
      if (Math.random() > 0.5) {
        fullAnnouncement = `${randomFrom(texts.hypeLines)} ${transition}`;
      }
      // Add drop line occasionally
      if (Math.random() > 0.75 && texts.dropLines) {
        fullAnnouncement += ` ${randomFrom(texts.dropLines)}`;
      }
      // Only add track name sometimes (real DJs don't announce every track)
      if (Math.random() > 0.4) {
        fullAnnouncement += ` ${trackInfo}`;
      }
      
      // Speak with hard energy after effect
      await new Promise(r => setTimeout(r, 250));
      await djSpeak(fullAnnouncement);
      
      // Post-speech effect for mix continuity
      if (Math.random() > 0.5) {
        setTimeout(() => playDJEffect(Math.random() > 0.5 ? "impact" : "industrial_kick"), 200);
      }
    }, 600);

    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, [currentTrack?.id, isDJActive, djSession, djSpeak]);

  // Start DJ session — Rotterdam peak-time style
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
      toast.loading("🎧 DJ GrouAI — Rotterdam Peak-Time...", { id: "dj-mode" });

      // DJ ma dostęp do CAŁEJ biblioteki (limit 1000 pokrywa cały katalog).
      // 1) Najpierw utwory z wybranego gatunku (jeśli podano).
      // 2) Potem dobiera resztę z całej biblioteki, żeby set nigdy się nie urwał.
      let genreTracks: any[] = [];
      if (genres.length > 0) {
        const genreFilters = genres.map(g => `genre.ilike.%${g}%`).join(",");
        const { data } = await supabase
          .from("tracks")
          .select("*")
          .not("audio_url", "is", null)
          .or(genreFilters)
          .limit(1000);
        genreTracks = data || [];
      }

      // Cała biblioteka (do mieszania i dobierania)
      const { data: libraryData } = await supabase
        .from("tracks")
        .select("*")
        .not("audio_url", "is", null)
        .limit(1000);
      const library = libraryData || [];

      if (library.length === 0) {
        toast.error("Brak utworów w bibliotece!", { id: "dj-mode" });
        setIsLoading(false);
        return;
      }

      const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

      // Set: najpierw shuffle utworów z gatunku, potem shuffle reszty biblioteki.
      // Gdy "mieszana" (brak gatunku) — cała biblioteka losowo.
      const genreIds = new Set(genreTracks.map(t => t.id));
      const restOfLibrary = library.filter(t => !genreIds.has(t.id));
      const ordered = genres.length > 0
        ? [...shuffle(genreTracks), ...shuffle(restOfLibrary)]
        : shuffle(library);

      // Pełny set (min. trackCount, ale zostaw zapas do ciągłego grania)
      const curatedTracks: Track[] = ordered.slice(0, Math.max(trackCount, 40)) as Track[];

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

      // Build intro — Rotterdam hard techno style
      const introCategory = genres[0]?.toLowerCase() || partyType;
      const intros = texts.intros[introCategory] || texts.intros.techno || texts.intros.default;
      const genreText = genres.length > 0 ? genres.join(", ") : "Hard Techno";
      const firstTrackShort = shortenTitle(curatedTracks[0].title);
      const introText = `${randomFrom(intros)} ${texts.setStart(curatedTracks.length, genreText)} ${firstTrackShort}! LECIMY!`;

      toast.success(`🎧 DJ GrouAI — ${curatedTracks.length} tracks — Rotterdam Peak-Time!`, { id: "dj-mode", duration: 5000 });

      // Epic sequence: dark_riser → buildup → speak intro → DROP COMBO → START
      playDJEffect("dark_riser");
      
      await new Promise(r => setTimeout(r, 1800));
      playDJEffect("buildup");
      
      await new Promise(r => setTimeout(r, 1500));
      await djSpeak(introText);
      
      // Maximum impact drop combo
      playDropCombo();
      setTimeout(() => playDJEffect("horn"), 300);
      
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
    toast.info("🎧 DJ GrouAI — Set Complete!", { duration: 4000 });
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
      /feestje/i, /draai/i,
      /вечірк[аіу]/i, /діджей/i,
      /peak\s*time/i, /peak\s*hour/i, /rotterdam/i, /hard\s*techno/i,
      /parkiet\s*do\s*czerwoności/i, /rozbaw\s*do\s*czerwoności/i,
      /high\s*energy\s*domówka/i, /jazda/i, /dawaj\s*set/i,
    ];
    
    const genreMap: Record<string, string> = {
      "techno": "Electronic", "hard techno": "Electronic", "house": "House", "haus": "House",
      "hip-hop": "Hip-Hop", "hip hop": "Hip-Hop", "hiphop": "Hip-Hop",
      "rap": "Rap", "rock": "Rock", "punk": "Punk", "metal": "Metal",
      "pop": "Pop", "jazz": "Jazz", "blues": "Blues", "disco": "Disco",
      "dance": "Dance", "edm": "Electronic", "trance": "Trance",
      "reggae": "Reggae", "r&b": "R&B", "rnb": "R&B", "funk": "Funk",
      "electronic": "Electronic", "indie": "Indie", "classical": "Classical",
      "ambient": "Ambient", "dens": "Dance", "electro": "Electronic",
      "rotterdam": "Electronic", "driving house": "House", "elektronika": "Electronic",
      "klasyczn": "Classical", "klasyka": "Classical", "country": "Country",
    };

    const genres: string[] = [];
    for (const [keyword, genre] of Object.entries(genreMap)) {
      if (lower.includes(keyword) && !genres.includes(genre)) {
        genres.push(genre);
      }
    }

    // Default to Electronic for peak-time/Rotterdam requests
    if (genres.length === 0 && (lower.includes("peak") || lower.includes("rotterdam") || lower.includes("hard"))) {
      genres.push("Electronic");
    }

    // "mieszana / miks / wszystko / losowo" → DJ gra ze wszystkich gatunków
    const mixedWords = ["mieszan", "miks", "mixed", "wszystk", "losow", "random", "różn", "rozn", "alles", "різне", "все"];
    const wantsMixed = mixedWords.some(w => lower.includes(w));

    // Słowa-akcje: pozwalają uruchomić DJ-a samym gatunkiem, bez słowa "dj/set".
    // "puść disco", "zagraj rock", "graj pop", "muzyka jazz", "włącz mieszaną"…
    const actionWords = [
      "puść", "pusc", "zagraj", "graj", "leć", "lec", "dawaj", "włącz", "wlacz",
      "nastaw", "ustaw", "chcę", "chce", "poproszę", "poprosze", "muzyk", "muzyka",
      "play", "put on", "gimme", "give me", "music",
      "speel", "zet op", "muziek",
      "включи", "постав", "музик", "давай",
    ];
    const hasAction = actionWords.some(w => lower.includes(w));

    // Komenda DJ, jeśli: klasyczny wzorzec DJ, LUB (akcja + gatunek),
    // LUB (akcja + "mieszana"), LUB samo wskazanie gatunku muzycznego.
    const isDJCommand =
      djPatterns.some(p => p.test(lower)) ||
      (hasAction && (genres.length > 0 || wantsMixed)) ||
      genres.length > 0;

    if (!isDJCommand) return { isDJCommand: false, genres: [], partyType: "", trackCount: 0, customPrompt: "" };

    let trackCount = 15;
    const countMatch = lower.match(/(\d+)\s*(?:utw|kawałk|piosen|track|song|utwor|nummer|трек|пісн)/i);
    if (countMatch) trackCount = Math.min(parseInt(countMatch[1]), 50);
    
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
    else if (lower.includes("klub") || lower.includes("club") || lower.includes("darkroom")) partyType = "club";
    else if (lower.includes("chill") || lower.includes("relaks") || lower.includes("relax")) partyType = "chill";
    else if (lower.includes("trening") || lower.includes("workout")) partyType = "workout";
    else if (lower.includes("festival") || lower.includes("festiwal") || lower.includes("фестиваль")) partyType = "festival";
    else if (lower.includes("peak") || lower.includes("rotterdam")) partyType = "club";

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

    const shouldReact = Math.random() > 0.6;
    if (!shouldReact) return;

    const lang = getAppLang();
    const texts = getDJTexts(lang);
    const reactions = texts.crowdReactions[energy.level] || texts.crowdReactions.medium;
    const comment = randomFrom(reactions);

    toast.info(`🎧 ${comment}`, { duration: 4000 });
    
    if (energy.level === "peak") {
      playDJEffect("industrial_kick");
      setTimeout(() => djSpeak(comment), 200);
    } else if (Math.random() > 0.5) {
      playDJEffect("stab");
      setTimeout(() => djSpeak(comment), 200);
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
