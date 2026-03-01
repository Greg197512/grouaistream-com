import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Sparkles, Music } from "lucide-react";
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

const NAV_MAP: Record<string, string> = {
  "stron": "/", "główn": "/", "home": "/",
  "szukaj": "/search", "wyszuk": "/search", "search": "/search",
  "bibliotek": "/library", "library": "/library",
  "polubionych": "/liked", "polubion": "/liked", "liked": "/liked",
  "serwer": "/server", "server": "/server", "medi": "/server",
  "film": "/movies", "movie": "/movies",
  "radio": "/radio",
  "ustawien": "/settings", "settings": "/settings",
  "nastro": "/mood-history", "mood": "/mood-history",
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
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const restartTimeoutRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("auto-voice-listen");
    if (stored === "true") setAutoListenEnabled(true);
  }, []);

  useEffect(() => {
    if (user && needsNaming) {
      setShowNamingModal(true);
    }
  }, [user, needsNaming]);

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = window.setTimeout(() => {
      if (recognitionRef.current) { try { recognitionRef.current.abort(); } catch {} }
      setIsListening(false);
      setAutoListenEnabled(false);
      localStorage.setItem("auto-voice-listen", "false");
      toast.info("🎙️ Mikrofon wyłączony po 30s ciszy");
    }, SILENCE_TIMEOUT_MS);
  }, []);

  const fetchAISuggestions = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.functions.invoke("ai-suggest-tracks", {
        body: { user_id: user.id }
      });
      if (error) throw error;
      if (data?.suggestions?.length > 0) {
        setAiSuggestions(data.suggestions);
        setShowSuggestions(true);
        const names = data.suggestions.slice(0, 3).map((s: any) => s.title).join(", ");
        speak(`Proponuję na dziś: ${names}. Powiedz puść, żeby odtworzyć.`);
      } else {
        speak("Nie mam jeszcze dość danych o Twoich preferencjach. Posłuchaj trochę muzyki, a nauczę się Twoich gustów!");
      }
    } catch (e) {
      console.error("AI suggestions error:", e);
      speak("Przepraszam, nie udało mi się przygotować propozycji.");
    }
  }, [user]);

  const shutdownMic = useCallback(() => {
    if (recognitionRef.current) { try { recognitionRef.current.abort(); } catch {} }
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    setIsListening(false);
    setAutoListenEnabled(false);
    localStorage.setItem("auto-voice-listen", "false");
    speak("Wyłączam się. Do zobaczenia!");
    toast.info("🔇 Asystent wyłączony");
    setShowSuggestions(false);
  }, []);

  const tryNavigate = useCallback((lower: string): boolean => {
    for (const [keyword, route] of Object.entries(NAV_MAP)) {
      if (lower.includes(keyword)) {
        navigate(route);
        const pageNames: Record<string, string> = {
          "/": "Strona główna", "/search": "Szukaj", "/library": "Biblioteka",
          "/liked": "Polubione utwory", "/server": "Serwer mediów", "/movies": "Filmy",
          "/radio": "Radio", "/settings": "Ustawienia", "/mood-history": "Historia nastroju",
          "/playlist-manager": "Playlisty", "/admin": "Admin"
        };
        toast.success(`📂 Otwieram: ${pageNames[route] || route}`);
        speak(`Otwieram ${pageNames[route] || route}`);
        return true;
      }
    }
    return false;
  }, [navigate]);

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
        toast.success(`🎵 Odtwarzam ${toPlay.length} utworów: ${toPlay[0].title}`, { id: "voice-search", duration: 4000 });
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

    // Shutdown commands
    if (lower.includes("wyłącz się") || lower.includes("wyłącz") && lower.includes("asystent") || lower.includes("zamknij się")) {
      shutdownMic();
      return;
    }

    // Check if user called assistant by name -> AI suggestions
    if (assistantName && lower.includes(assistantName.toLowerCase())) {
      speak(`Cześć! Fajnie że znów jesteśmy tu razem. Sprawdzam co mam dla Ciebie na dziś...`);
      toast.success(`🎤 ${assistantName}: Analizuję Twoje preferencje...`);
      await fetchAISuggestions();
      return;
    }

    // Play suggested tracks
    if (showSuggestions && aiSuggestions.length > 0 && (lower.includes("puść") || lower.includes("graj") || lower.includes("odtwórz") || lower.includes("tak"))) {
      const tracks = aiSuggestions.map((s: any) => ({
        id: s.id, title: s.title, artist: s.artist,
        album: null, audio_url: null, cover_url: null,
        genre: s.genre, mood: s.mood, duration: 180,
      }));
      playPlaylist(tracks, 0);
      speak(`Odtwarzam moje propozycje dla Ciebie!`);
      setShowSuggestions(false);
      return;
    }

    // Player commands
    if (lower.includes("pauza") || lower.includes("stop") || lower.includes("zatrzymaj")) { togglePlay(); speak("Pauza"); return; }
    if (lower.includes("graj") && !lower.includes("następ") && !lower.includes("odtwarz") && lower.split(" ").length <= 2) { togglePlay(); speak("Odtwarzam"); return; }
    if (lower.includes("następn") || lower.includes("dalej") || lower.includes("skip")) { nextTrack(); speak("Następny utwór"); return; }
    if (lower.includes("poprzedni") || lower.includes("cofnij") || lower.includes("wstecz")) { prevTrack(); speak("Poprzedni utwór"); return; }
    if (lower.includes("głośniej") || lower.includes("louder")) { setVolume(85); speak("Głośniej"); return; }
    if (lower.includes("ciszej") || lower.includes("cicho")) { setVolume(25); speak("Ciszej"); return; }
    if (lower.includes("wycisz") || lower.includes("mute")) { setVolume(0); speak("Wyciszono"); return; }

    // Navigation
    if (lower.includes("otwórz") || lower.includes("włącz") || lower.includes("pokaż") || lower.includes("przejdź") || lower.includes("idź")) {
      if (tryNavigate(lower)) return;
    }
    if (tryNavigate(lower)) return;

    // Search & play
    const playMatch = lower.match(/(?:włącz|puść|zagraj|odtwórz|graj|play)\s+(.+)/i);
    if (playMatch) {
      const query = playMatch[1].replace(/w\s+playerze/i, "").trim();
      const countMatch = query.match(/(\d+)\s*(?:utw|piosen|track|song)/i);
      const count = countMatch ? parseInt(countMatch[1]) : undefined;
      const cleanQuery = query.replace(/\d+\s*(?:utw|piosen|track|song)\w*/i, "").trim();
      await searchAndPlay(cleanQuery || query, count);
      return;
    }

    const selectMatch = lower.match(/wybierz\s+(\d+)\s+(?:utw|piosen)\w*\s+(.+)/i);
    if (selectMatch) {
      const count = parseInt(selectMatch[1]);
      const query = selectMatch[2].replace(/i\s+włącz.*/i, "").replace(/w\s+playerze/i, "").trim();
      await searchAndPlay(query, count);
      return;
    }

    // AI fallback
    if (isAIEnabled) {
      try {
        toast.loading(`🎙️ AI analizuje...`, { id: "voice-cmd" });
        const result = await processVoiceCommand(command);
        if (result.action === "play" && result.tracks?.length) {
          playPlaylist(result.tracks, 0);
          toast.success(`🎵 Odtwarzam ${result.tracks.length} utworów`, { id: "voice-cmd", duration: 4000 });
          speak(`Odtwarzam ${result.tracks.length} utworów`);
        } else if (result.action === "pause") {
          togglePlay(); speak("Pauza");
          toast.success("⏸️ Pauza", { id: "voice-cmd" });
        }
      } catch {
        toast.error("Nie udało się przetworzyć komendy", { id: "voice-cmd" });
      }
    }
  }, [isAIEnabled, processVoiceCommand, playPlaylist, togglePlay, nextTrack, prevTrack, setVolume, tryNavigate, searchAndPlay, resetSilenceTimer, assistantName, fetchAISuggestions, shutdownMic, showSuggestions, aiSuggestions]);

  const startListening = useCallback(() => {
    if (!user) return;
    const SpeechAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechAPI) { toast.error("Brak wsparcia mowy w przeglądarce"); return; }
    if (recognitionRef.current) { try { recognitionRef.current.abort(); } catch {} recognitionRef.current = null; }

    try {
      const rec = new SpeechAPI() as SpeechRecognitionInstance;
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = "pl-PL";
      rec.onresult = (event: SpeechRecognitionEvent) => {
        const last = event.results[event.results.length - 1];
        if (last.isFinal) processCommand(last[0].transcript);
      };
      rec.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setAutoListenEnabled(false); localStorage.setItem("auto-voice-listen", "false");
          setIsListening(false); toast.error("🎙️ Brak dostępu do mikrofonu"); return;
        }
        if (event.error === "aborted") return;
        setIsListening(false);
      };
      rec.onend = () => {
        setIsListening(false);
        if (autoListenEnabled) {
          restartTimeoutRef.current = window.setTimeout(() => {
            if (autoListenEnabled && recognitionRef.current) {
              try { rec.start(); setIsListening(true); } catch {}
            }
          }, 1500);
        }
      };
      rec.start();
      recognitionRef.current = rec;
      setIsListening(true);
      resetSilenceTimer();
    } catch {
      toast.error("Nie udało się uruchomić mikrofonu");
    }
  }, [user, processCommand, autoListenEnabled, resetSilenceTimer]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) { try { recognitionRef.current.abort(); } catch {} }
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (showIndicator) {
      const t = setTimeout(() => setShowIndicator(false), 4000);
      return () => clearTimeout(t);
    }
  }, [showIndicator, lastTranscript]);

  const handleNameSubmit = useCallback(async (name: string) => {
    setShowNamingModal(false);
    await saveAssistantName(name);
    setTimeout(() => {
      speak(`Cześć! Miło mi że mnie tak nazwałeś — ${name}. Jestem Twoim asystentem muzycznym. Powiedz moje imię kiedy będziesz mnie potrzebować!`);
      toast.success(`🎤 ${name} aktywowany!`, { duration: 5000 });
    }, 500);
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
      speak(`Mikrofon włączony.${assistantName ? ` Jestem ${assistantName}.` : ""} Słucham.`);
      toast.success("🎙️ Mikrofon AI włączony");
    } else {
      shutdownMic();
    }
  };

  const playSuggestion = async (track: any) => {
    playPlaylist([{ id: track.id, title: track.title, artist: track.artist, album: null, audio_url: null, cover_url: null, genre: track.genre, mood: track.mood, duration: 180 }], 0);
    speak(`Odtwarzam ${track.title}`);
    setShowSuggestions(false);
  };

  if (!user) return null;

  return (
    <>
      <AssistantNamingModal open={showNamingModal} onSubmit={handleNameSubmit} />

      {/* Iridescent mic button */}
      <motion.button
        onClick={toggleAutoListen}
        className={cn(
          "fixed bottom-24 right-4 z-40 w-11 h-11 rounded-full flex items-center justify-center transition-all",
          isListening ? "shadow-[0_0_20px_hsl(var(--primary)/0.5)]" : ""
        )}
        style={{
          background: isListening
            ? 'linear-gradient(135deg, hsl(var(--primary) / 0.7), hsl(var(--accent) / 0.5), hsl(var(--primary) / 0.6))'
            : 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(30px) saturate(200%)',
          WebkitBackdropFilter: 'blur(30px) saturate(200%)',
          border: isListening ? '1px solid hsl(var(--primary) / 0.4)' : '1px solid rgba(255,255,255,0.1)',
        }}
        whileHover={{ scale: 1.12 }}
        whileTap={{ scale: 0.88 }}
        title={autoListenEnabled ? "Wyłącz" : "Włącz asystenta głosowego"}
      >
        {isListening ? (
          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}>
            <Mic className="h-4 w-4 text-primary-foreground" />
          </motion.div>
        ) : (
          <MicOff className="h-4 w-4 text-muted-foreground/70" />
        )}
        {/* Shimmer ring when listening */}
        {isListening && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ border: '1px solid hsl(var(--primary) / 0.3)' }}
              animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
            />
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ border: '1px solid hsl(var(--accent) / 0.2)' }}
              animate={{ scale: [1, 2], opacity: [0.4, 0] }}
              transition={{ repeat: Infinity, duration: 2.5, ease: "easeOut", delay: 0.3 }}
            />
          </>
        )}
        {assistantName && (
          <span className="absolute -top-1 -right-1 text-[7px] rounded-full px-1 py-0.5 font-bold"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--primary) / 0.6), hsl(var(--accent) / 0.4))',
              color: 'hsl(var(--primary-foreground))',
              backdropFilter: 'blur(10px)',
            }}
          >
            {assistantName.slice(0, 3)}
          </span>
        )}
      </motion.button>

      {/* AI Suggestions Panel */}
      <AnimatePresence>
        {showSuggestions && aiSuggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-40 right-4 z-50 w-[280px] rounded-2xl p-3 space-y-2"
            style={{
              background: 'rgba(0,0,0,0.3)',
              backdropFilter: 'blur(40px) saturate(200%)',
              WebkitBackdropFilter: 'blur(40px) saturate(200%)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-semibold text-foreground/80">
                {assistantName || "AI"} proponuje na dziś
              </span>
            </div>
            {aiSuggestions.map((s: any, i: number) => (
              <motion.button
                key={s.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => playSuggestion(s)}
                className="w-full flex items-center gap-2 p-2 rounded-xl transition-colors text-left"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
                whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.08)' }}
              >
                <Music className="h-3 w-3 text-primary/70 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-medium text-foreground/90 truncate">{s.title}</p>
                  <p className="text-[9px] text-muted-foreground/60 truncate">{s.artist} · {s.reason}</p>
                </div>
              </motion.button>
            ))}
            <motion.button
              onClick={() => {
                const tracks = aiSuggestions.map((s: any) => ({ id: s.id, title: s.title, artist: s.artist, album: null, audio_url: null, cover_url: null, genre: s.genre, mood: s.mood, duration: 180 }));
                playPlaylist(tracks, 0);
                speak("Odtwarzam wszystkie propozycje!");
                setShowSuggestions(false);
              }}
              className="w-full py-1.5 rounded-xl text-[10px] font-semibold text-primary-foreground"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--primary) / 0.5), hsl(var(--accent) / 0.3))',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              ▶ Puść wszystkie
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice feedback popup */}
      <AnimatePresence>
        {showIndicator && lastTranscript && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-40 right-4 z-40 max-w-[240px] rounded-xl p-2.5"
            style={{
              background: 'rgba(0,0,0,0.25)',
              backdropFilter: 'blur(30px)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <Sparkles className="h-3 w-3 text-primary/70" />
              <span className="text-[9px] font-semibold text-primary/80">{assistantName || "AI"}</span>
            </div>
            <p className="text-[10px] text-foreground/80">"{lastTranscript}"</p>
            {isProcessing && <p className="text-[9px] text-muted-foreground/60 mt-0.5 animate-pulse">Przetwarzam...</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
