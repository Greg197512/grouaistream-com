import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAI } from "@/contexts/AIContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAssistantConfig } from "@/hooks/useAssistantConfig";
import { AssistantNamingModal } from "@/components/modals/AssistantNamingModal";
import { speak } from "@/utils/tts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

const SILENCE_TIMEOUT_MS = 30_000;

// Navigation map: Polish keywords → routes
const NAV_MAP: Record<string, string> = {
  "stron": "/",
  "główn": "/",
  "home": "/",
  "szukaj": "/search",
  "wyszuk": "/search",
  "search": "/search",
  "bibliotek": "/library",
  "library": "/library",
  "polubionych": "/liked",
  "polubion": "/liked",
  "liked": "/liked",
  "serwer": "/server",
  "server": "/server",
  "medi": "/server",
  "film": "/movies",
  "movie": "/movies",
  "radio": "/radio",
  "ustawien": "/settings",
  "settings": "/settings",
  "nastro": "/mood-history",
  "mood": "/mood-history",
  "playlist": "/playlist-manager",
  "admin": "/admin",
};

export const AutoVoiceListener = () => {
  const { user } = useAuth();
  const { processVoiceCommand, isAIEnabled, isProcessing } = useAI();
  const { playPlaylist, togglePlay, nextTrack, prevTrack, setVolume } = usePlayer();
  const navigate = useNavigate();
  const { assistantName, needsNaming, saveAssistantName } = useAssistantConfig();

  const [isListening, setIsListening] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");
  const [showIndicator, setShowIndicator] = useState(false);
  const [autoListenEnabled, setAutoListenEnabled] = useState(false);
  const [showNamingModal, setShowNamingModal] = useState(false);
  const [greeted, setGreeted] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const restartTimeoutRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number | null>(null);

  // Load preference
  useEffect(() => {
    const stored = localStorage.getItem("auto-voice-listen");
    if (stored === "true") setAutoListenEnabled(true);
  }, []);

  // Show naming modal on first login
  useEffect(() => {
    if (user && needsNaming) {
      setShowNamingModal(true);
    }
  }, [user, needsNaming]);

  // Reset silence timer on any speech
  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = window.setTimeout(() => {
      // Auto-stop after 30s of silence
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
      setIsListening(false);
      setAutoListenEnabled(false);
      localStorage.setItem("auto-voice-listen", "false");
      toast.info("🎙️ Mikrofon wyłączony po 30s ciszy");
    }, SILENCE_TIMEOUT_MS);
  }, []);

  // Handle navigation command
  const tryNavigate = useCallback((lower: string): boolean => {
    // "otwórz/włącz/pokaż [page]"
    for (const [keyword, route] of Object.entries(NAV_MAP)) {
      if (lower.includes(keyword)) {
        navigate(route);
        const pageNames: Record<string, string> = {
          "/": "Strona główna", "/search": "Szukaj", "/library": "Biblioteka",
          "/liked": "Polubione utwory", "/server": "Serwer mediów", "/movies": "Filmy",
          "/radio": "Radio", "/settings": "Ustawienia", "/mood-history": "Historia nastroju",
          "/playlist-manager": "Playlisty", "/admin": "Admin"
        };
        const pageName = pageNames[route] || route;
        toast.success(`📂 Otwieram: ${pageName}`);
        speak(`Otwieram ${pageName}`);
        return true;
      }
    }
    return false;
  }, [navigate]);

  // Search and play tracks by title/artist
  const searchAndPlay = useCallback(async (query: string, count?: number) => {
    try {
      toast.loading(`🔍 Szukam: "${query}"...`, { id: "voice-search" });
      const { data: tracks } = await supabase
        .from("tracks")
        .select("*")
        .or(`title.ilike.%${query}%,artist.ilike.%${query}%`)
        .limit(count || 10);

      if (tracks && tracks.length > 0) {
        const toPlay = count ? tracks.slice(0, count) : tracks;
        playPlaylist(toPlay, 0);
        toast.success(`🎵 Odtwarzam ${toPlay.length} ${toPlay.length === 1 ? 'utwór' : 'utworów'}: ${toPlay[0].title}`, { id: "voice-search", duration: 4000 });
        speak(`Odtwarzam ${toPlay[0].title} ${toPlay[0].artist}`);
      } else {
        toast.error(`Nie znaleziono: "${query}"`, { id: "voice-search" });
        speak(`Nie znalazłam utworu ${query}`);
      }
    } catch {
      toast.error("Błąd wyszukiwania", { id: "voice-search" });
    }
  }, [playPlaylist]);

  const processCommand = useCallback(async (command: string) => {
    const lower = command.toLowerCase().trim();
    if (lower.length < 3) return;

    setLastTranscript(command);
    setShowIndicator(true);
    resetSilenceTimer();

    // Check if user called assistant by name
    if (assistantName && lower.includes(assistantName.toLowerCase())) {
      speak(`Cześć! Fajnie że znów jesteśmy tu razem. Co proponujesz na dzisiaj? Jaki utwór?`);
      toast.success(`🎤 ${assistantName}: Słucham Cię!`);
      return;
    }

    // Basic player commands (PL)
    if (lower.includes("pauza") || lower.includes("stop") || lower.includes("zatrzymaj")) {
      togglePlay();
      speak("Pauza");
      return;
    }
    if (lower.includes("graj") && !lower.includes("następ") && !lower.includes("odtwarz") && lower.split(" ").length <= 2) {
      togglePlay();
      speak("Odtwarzam");
      return;
    }
    if (lower.includes("następn") || lower.includes("dalej") || lower.includes("skip")) {
      nextTrack();
      speak("Następny utwór");
      return;
    }
    if (lower.includes("poprzedni") || lower.includes("cofnij") || lower.includes("wstecz")) {
      prevTrack();
      speak("Poprzedni utwór");
      return;
    }
    if (lower.includes("głośniej") || lower.includes("louder")) {
      setVolume(85);
      speak("Głośniej");
      return;
    }
    if (lower.includes("ciszej") || lower.includes("cicho")) {
      setVolume(25);
      speak("Ciszej");
      return;
    }
    if (lower.includes("wycisz") || lower.includes("mute")) {
      setVolume(0);
      speak("Wyciszono");
      return;
    }

    // Navigation commands: "otwórz/włącz/pokaż [page]"
    if (lower.includes("otwórz") || lower.includes("włącz") || lower.includes("pokaż") || lower.includes("przejdź") || lower.includes("idź")) {
      if (tryNavigate(lower)) return;
    }

    // Direct navigation (just page name)
    if (tryNavigate(lower)) return;

    // Search & play specific track: "włącz [title]" / "puść [title]" / "zagraj [title]"
    const playMatch = lower.match(/(?:włącz|puść|zagraj|odtwórz|graj|play)\s+(.+)/i);
    if (playMatch) {
      const query = playMatch[1].replace(/w\s+playerze/i, "").trim();
      // Check for count: "wybierz 4 utwory metallica"
      const countMatch = query.match(/(\d+)\s*(?:utw|piosen|track|song)/i);
      const count = countMatch ? parseInt(countMatch[1]) : undefined;
      const cleanQuery = query.replace(/\d+\s*(?:utw|piosen|track|song)\w*/i, "").trim();
      await searchAndPlay(cleanQuery || query, count);
      return;
    }

    // "wybierz X utworów Y"
    const selectMatch = lower.match(/wybierz\s+(\d+)\s+(?:utw|piosen)\w*\s+(.+)/i);
    if (selectMatch) {
      const count = parseInt(selectMatch[1]);
      const query = selectMatch[2].replace(/i\s+włącz.*/i, "").replace(/w\s+playerze/i, "").trim();
      await searchAndPlay(query, count);
      return;
    }

    // AI-powered command for complex requests
    if (isAIEnabled) {
      try {
        toast.loading(`🎙️ AI analizuje: "${command}"...`, { id: "voice-cmd" });
        const result = await processVoiceCommand(command);
        
        if (result.action === "play" && result.tracks && result.tracks.length > 0) {
          playPlaylist(result.tracks, 0);
          toast.success(`🎵 Odtwarzam ${result.tracks.length} utworów — ${result.genre || ""} (${result.mood || ""})`, { id: "voice-cmd", duration: 4000 });
          speak(`Odtwarzam ${result.tracks.length} utworów ${result.genre || ""}`);
        } else if (result.action === "pause") {
          togglePlay();
          speak("Pauza");
          toast.success("⏸️ Pauza", { id: "voice-cmd" });
        }
      } catch {
        toast.error("Nie udało się przetworzyć komendy", { id: "voice-cmd" });
      }
    }
  }, [isAIEnabled, processVoiceCommand, playPlaylist, togglePlay, nextTrack, prevTrack, setVolume, tryNavigate, searchAndPlay, resetSilenceTimer, assistantName]);

  const startListening = useCallback(() => {
    if (!user) return;
    
    const SpeechAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechAPI) {
      toast.error("Twoja przeglądarka nie wspiera rozpoznawania mowy");
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }

    try {
      const rec = new SpeechAPI() as SpeechRecognitionInstance;
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = "pl-PL";

      rec.onresult = (event: SpeechRecognitionEvent) => {
        const last = event.results[event.results.length - 1];
        if (last.isFinal) {
          processCommand(last[0].transcript);
        }
      };

      rec.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setAutoListenEnabled(false);
          localStorage.setItem("auto-voice-listen", "false");
          setIsListening(false);
          toast.error("🎙️ Brak dostępu do mikrofonu");
          return;
        }
        if (event.error === "aborted") return;
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
        if (autoListenEnabled) {
          restartTimeoutRef.current = window.setTimeout(() => {
            if (autoListenEnabled && recognitionRef.current) {
              try {
                rec.start();
                setIsListening(true);
              } catch (e) {
                console.warn("Mic restart failed:", e);
              }
            }
          }, 1500);
        }
      };

      rec.start();
      recognitionRef.current = rec;
      setIsListening(true);
      resetSilenceTimer();
    } catch (e) {
      console.error("Voice recognition init failed:", e);
      toast.error("Nie udało się uruchomić mikrofonu");
    }
  }, [user, processCommand, autoListenEnabled, resetSilenceTimer]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (recognitionRef.current) { try { recognitionRef.current.abort(); } catch {} }
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, []);

  // Hide indicator after delay
  useEffect(() => {
    if (showIndicator) {
      const t = setTimeout(() => setShowIndicator(false), 4000);
      return () => clearTimeout(t);
    }
  }, [showIndicator, lastTranscript]);

  const handleNameSubmit = useCallback(async (name: string) => {
    setShowNamingModal(false);
    await saveAssistantName(name);
    
    // Greeting with TTS
    setTimeout(() => {
      speak(`Cześć! Miło mi że mnie tak nazwałeś — ${name}. Jestem Twoim asystentem muzycznym. Powiedz moje imię kiedy będziesz mnie potrzebować!`);
      toast.success(`🎤 ${name} aktywowany!`, { duration: 5000 });
    }, 500);

    // Auto-enable mic after naming
    setAutoListenEnabled(true);
    localStorage.setItem("auto-voice-listen", "true");
    setTimeout(() => startListening(), 1000);
  }, [saveAssistantName, startListening]);

  const toggleAutoListen = () => {
    const next = !autoListenEnabled;
    setAutoListenEnabled(next);
    localStorage.setItem("auto-voice-listen", String(next));
    if (next) {
      startListening();
      const nameMsg = assistantName ? ` Jestem ${assistantName}.` : "";
      speak(`Mikrofon włączony.${nameMsg} Słucham.`);
      toast.success("🎙️ Mikrofon AI włączony — mów do aplikacji!");
    } else {
      if (recognitionRef.current) { try { recognitionRef.current.abort(); } catch {} }
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      setIsListening(false);
      toast.info("🔇 Mikrofon AI wyłączony");
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Naming modal */}
      <AssistantNamingModal open={showNamingModal} onSubmit={handleNameSubmit} />

      {/* Floating mic button */}
      <motion.button
        onClick={toggleAutoListen}
        className={cn(
          "fixed bottom-24 right-4 z-40 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-colors",
          isListening ? "bg-primary groove-glow" : "bg-secondary/80 hover:bg-secondary"
        )}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        title={autoListenEnabled ? "Wyłącz nasłuchiwanie" : "Włącz nasłuchiwanie głosowe AI"}
      >
        {isListening ? (
          <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
            <Mic className="h-5 w-5 text-primary-foreground" />
          </motion.div>
        ) : (
          <MicOff className="h-5 w-5 text-muted-foreground" />
        )}
        {/* Assistant name badge */}
        {assistantName && (
          <span className="absolute -top-1 -right-1 text-[8px] bg-accent text-accent-foreground rounded-full px-1.5 py-0.5 font-bold">
            {assistantName.slice(0, 3)}
          </span>
        )}
      </motion.button>

      {/* Voice feedback popup */}
      <AnimatePresence>
        {showIndicator && lastTranscript && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-40 right-4 z-40 max-w-xs bg-card border border-border rounded-xl p-3 shadow-xl"
          >
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-accent" />
              <span className="text-xs font-semibold text-accent">
                {assistantName || "AI"} słyszy
              </span>
            </div>
            <p className="text-sm text-foreground">"{lastTranscript}"</p>
            {isProcessing && (
              <p className="text-xs text-muted-foreground mt-1 animate-pulse">Przetwarzam...</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
