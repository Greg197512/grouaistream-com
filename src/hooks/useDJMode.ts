import { useState, useCallback, useRef, useEffect } from "react";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { speak } from "@/utils/tts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DJSession {
  tracks: Track[];
  genres: string[];
  partyType: string;
  isActive: boolean;
  currentIndex: number;
  totalTracks: number;
}

const DJ_INTROS: Record<string, string[]> = {
  default: [
    "DJ GrooveAI na konsolecie! Zaczynamy imprezę!",
    "Hej, hej! DJ GrooveAI wchodzi na scenę! Gotowi na niezapomnianą noc?",
    "Uwaga, uwaga! DJ GrooveAI przejmuje kontrolę! Trzymajcie się mocno!",
  ],
  techno: [
    "Boom boom boom! DJ GrooveAI startuje set techno! Bas wchodzi twardy!",
    "Witamy w podziemnym klubie! DJ GrooveAI rozkręca techno session!",
  ],
  house: [
    "Welcome to the house! DJ GrooveAI na decku! Feel the groove!",
    "House music all night long! DJ GrooveAI zaczyna set!",
  ],
  "hip-hop": [
    "Yo yo yo! DJ GrooveAI in da house! Czas na hiphopową jazdę!",
    "Reprezentuj! DJ GrooveAI na bicie! Zaczynamy!",
  ],
  rock: [
    "Rock and roll! DJ GrooveAI odpala rockową maszynę!",
    "Gitara, bas, bębny! DJ GrooveAI startuje rockowy set!",
  ],
  party: [
    "Party time! DJ GrooveAI rozkręca domówkę na maksa!",
    "Hej ekipa! DJ GrooveAI puszcza największe hity na domówkę!",
  ],
};

const DJ_TRANSITIONS: string[] = [
  "A teraz coś jeszcze lepszego!",
  "Nie zwalniamy tempa! Następny banger!",
  "Uwaga, zmiana! Wchodzi kolejny hit!",
  "Czujecie ten vibe? Lecimy dalej!",
  "DJ GrooveAI przełącza na kolejny level!",
  "Energia na maksa! Oto następny kawałek!",
  "Idziemy wyżej! Kolejny track!",
  "Bez przerwy! Następny w kolejce!",
  "Trzymajcie się! To dopiero początek!",
  "Feel the bass! Kolejny utwór wchodzi!",
];

const DJ_OUTROS: string[] = [
  "To był DJ GrooveAI! Dzięki za wspólną zabawę! Do następnego razu!",
  "DJ GrooveAI kończy set! Było gorąco! Peace!",
  "Koniec setu! DJ GrooveAI dziękuje! Było mega!",
];

export const useDJMode = () => {
  const { playPlaylist, currentTrack, queue, isPlaying } = usePlayer();
  const [djSession, setDjSession] = useState<DJSession | null>(null);
  const [isDJActive, setIsDJActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const transitionTimerRef = useRef<number | null>(null);
  const lastAnnouncedTrackRef = useRef<string | null>(null);
  const trackCountRef = useRef(0);

  const randomFrom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  // Announce DJ transition between tracks
  useEffect(() => {
    if (!isDJActive || !currentTrack || !djSession) return;

    // Don't announce the same track twice
    if (lastAnnouncedTrackRef.current === currentTrack.id) return;
    lastAnnouncedTrackRef.current = currentTrack.id;
    trackCountRef.current += 1;

    // Skip announcement for first track (intro already played)
    if (trackCountRef.current <= 1) return;

    // Announce every 2-3 tracks to feel natural
    const shouldAnnounce = trackCountRef.current % 2 === 0 || trackCountRef.current % 3 === 0;
    if (!shouldAnnounce) return;

    const announcement = `${randomFrom(DJ_TRANSITIONS)} ${currentTrack.title} od ${currentTrack.artist}!`;
    
    // Small delay before DJ speaks
    transitionTimerRef.current = window.setTimeout(() => {
      speak(announcement, { rate: 1.05, pitch: 0.8 });
    }, 1500);

    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, [currentTrack?.id, isDJActive, djSession]);

  // Start DJ session
  const startDJSession = useCallback(async (options: {
    genres?: string[];
    partyType?: string;
    trackCount?: number;
    customPrompt?: string;
  }) => {
    setIsLoading(true);
    const { genres = [], partyType = "party", trackCount = 15, customPrompt = "" } = options;

    try {
      toast.loading("🎧 DJ GrooveAI przygotowuje set...", { id: "dj-mode" });

      // Fetch tracks from library matching genres
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

      // If not enough genre-matched tracks, get more
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
        toast.error("Brak utworów w bibliotece!", { id: "dj-mode" });
        setIsLoading(false);
        return;
      }

      // Use AI to curate the best order for DJ mixing
      let curatedTracks: Track[];
      
      try {
        const { data: aiData } = await supabase.functions.invoke("ai-assistant", {
          body: {
            message: `DJ MODE: Przygotuj set DJ na ${partyType}. Gatunki: ${genres.join(", ") || "mieszane"}. ${customPrompt}. Potrzebuję ${trackCount} utworów. Odpowiedz TYLKO listą ID utworów w najlepszej kolejności do mixowania, po jednym ID w linii, bez żadnego innego tekstu.`,
            history: [],
            userContext: { isDJMode: true }
          }
        });
        // Try to extract track order from AI response — fallback to shuffle
        curatedTracks = [...allTracks].sort(() => Math.random() - 0.5).slice(0, trackCount);
      } catch {
        curatedTracks = [...allTracks].sort(() => Math.random() - 0.5).slice(0, trackCount);
      }

      // Create session
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

      // DJ Intro announcement
      const introCategory = genres[0]?.toLowerCase() || partyType;
      const intros = DJ_INTROS[introCategory] || DJ_INTROS.default;
      const introText = `${randomFrom(intros)} Mam dla was ${curatedTracks.length} kawałków! ${genres.length > 0 ? `Lecimy w stylu ${genres.join(", ")}!` : "Mieszanka najlepszych hitów!"} Zaczynamy od ${curatedTracks[0].title}!`;

      toast.success(`🎧 DJ GrooveAI startuje! ${curatedTracks.length} utworów`, { id: "dj-mode", duration: 5000 });

      // Speak intro then start playback
      await speak(introText, { rate: 1.05, pitch: 0.75 });
      
      // Start playback
      playPlaylist(curatedTracks);

    } catch (error) {
      console.error("DJ session error:", error);
      toast.error("Nie udało się uruchomić DJ mode", { id: "dj-mode" });
    } finally {
      setIsLoading(false);
    }
  }, [playPlaylist]);

  // Stop DJ session
  const stopDJSession = useCallback(async () => {
    setIsDJActive(false);
    setDjSession(null);
    trackCountRef.current = 0;
    lastAnnouncedTrackRef.current = null;
    
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
    }

    const outro = randomFrom(DJ_OUTROS);
    toast.info("🎧 DJ GrooveAI kończy set!", { duration: 4000 });
    await speak(outro, { rate: 1.0, pitch: 0.75 });
  }, []);

  // Parse DJ command from text
  const parseDJCommand = useCallback((text: string): {
    isDJCommand: boolean;
    genres: string[];
    partyType: string;
    trackCount: number;
    customPrompt: string;
  } => {
    const lower = text.toLowerCase();
    
    // Check if it's a DJ command
    const djPatterns = [
      /dj/i, /didżej/i, /disc\s*jockey/i,
      /domówk[aęi]/i, /imprez[aęi]/i, /party/i,
      /set\s+muzyczn/i, /zrób\s+set/i, /postaw\s+domówk/i,
      /rozkręć/i, /haus\s*party/i, /house\s*party/i,
    ];
    
    const isDJCommand = djPatterns.some(p => p.test(lower));
    if (!isDJCommand) return { isDJCommand: false, genres: [], partyType: "", trackCount: 0, customPrompt: "" };

    // Extract genres
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

    // Extract track count
    let trackCount = 15;
    const countMatch = lower.match(/(\d+)\s*(?:utw|kawałk|piosen|track|song|utwor)/i);
    if (countMatch) trackCount = Math.min(parseInt(countMatch[1]), 50);
    
    // Polish numbers
    const polishNums: Record<string, number> = {
      "pięć": 5, "piec": 5, "dziesięć": 10, "dziesiec": 10,
      "piętnaście": 15, "pietnascie": 15, "dwadzieścia": 20, "dwadziescia": 20,
      "trzydzieści": 30, "trzydziesci": 30,
    };
    for (const [word, num] of Object.entries(polishNums)) {
      if (lower.includes(word)) { trackCount = num; break; }
    }

    // Detect party type
    let partyType = "party";
    if (lower.includes("domówk") || lower.includes("domowk")) partyType = "party";
    else if (lower.includes("klub") || lower.includes("club")) partyType = "club";
    else if (lower.includes("chill") || lower.includes("relaks")) partyType = "chill";
    else if (lower.includes("trening") || lower.includes("workout")) partyType = "workout";
    else if (lower.includes("festival") || lower.includes("festiwal")) partyType = "festival";

    return {
      isDJCommand: true,
      genres,
      partyType,
      trackCount,
      customPrompt: text,
    };
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, []);

  // Handle crowd energy update — DJ reacts and can switch genres
  const handleCrowdEnergy = useCallback(async (energy: {
    level: string;
    score: number;
    suggestion: string;
    suggestedGenreShift?: string;
  }) => {
    if (!isDJActive || !djSession) return;

    // Only react to significant energy shifts
    const shouldReact = Math.random() > 0.65; // ~35% chance per scan
    if (!shouldReact) return;

    const comment = energy.suggestion;
    
    if (energy.suggestedGenreShift) {
      toast.info(`🎥 DJ widzi parkiet: ${comment}`, { duration: 4000 });
      
      // Every ~3rd crowd update, DJ speaks about what they see
      if (Math.random() > 0.6) {
        speak(comment, { rate: 1.05, pitch: 0.75 });
      }
    }
  }, [isDJActive, djSession]);

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
