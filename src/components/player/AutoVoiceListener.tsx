import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAI } from "@/contexts/AIContext";
import { usePlayer } from "@/contexts/PlayerContext";
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

/**
 * Floating mic indicator that auto-starts after login.
 * Always listens in the background, processes Polish voice commands via AI.
 */
export const AutoVoiceListener = () => {
  const { user } = useAuth();
  const { processVoiceCommand, isAIEnabled, isProcessing } = useAI();
  const { playPlaylist, togglePlay, nextTrack, prevTrack, setVolume } = usePlayer();
  const [isListening, setIsListening] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");
  const [showIndicator, setShowIndicator] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const restartTimeoutRef = useRef<number | null>(null);
  const [autoListenEnabled, setAutoListenEnabled] = useState(false);

  // Load preference
  useEffect(() => {
    const stored = localStorage.getItem("auto-voice-listen");
    if (stored === "true") setAutoListenEnabled(true);
  }, []);

  // Auto-enable after first login
  useEffect(() => {
    if (user && !localStorage.getItem("auto-voice-listen")) {
      localStorage.setItem("auto-voice-listen", "true");
      setAutoListenEnabled(true);
    }
  }, [user]);

  const processCommand = useCallback(async (command: string) => {
    const lower = command.toLowerCase().trim();
    if (lower.length < 3) return;

    setLastTranscript(command);
    setShowIndicator(true);

    // Check for basic Polish commands first
    if (lower.includes("pauza") || lower.includes("stop") || lower.includes("zatrzymaj")) {
      togglePlay();
      toast.success("⏸️ Pauza");
      return;
    }
    if (lower.includes("następn") || lower.includes("dalej") || lower.includes("skip")) {
      nextTrack();
      toast.success("⏭️ Następny utwór");
      return;
    }
    if (lower.includes("poprzedni") || lower.includes("cofnij") || lower.includes("wstecz")) {
      prevTrack();
      toast.success("⏮️ Poprzedni utwór");
      return;
    }
    if (lower.includes("głośniej") || lower.includes("louder")) {
      setVolume(85);
      toast.success("🔊 Głośniej");
      return;
    }
    if (lower.includes("ciszej") || lower.includes("cicho")) {
      setVolume(25);
      toast.success("🔉 Ciszej");
      return;
    }
    if (lower.includes("wycisz") || lower.includes("mute")) {
      setVolume(0);
      toast.success("🔇 Wyciszono");
      return;
    }

    // AI-powered command for complex requests like "daj mi 6 utworów do pobudzenia"
    if (isAIEnabled) {
      try {
        toast.loading(`🎙️ AI analizuje: "${command}"...`, { id: "voice-cmd" });
        const result = await processVoiceCommand(command);
        
        if (result.action === "play" && result.tracks && result.tracks.length > 0) {
          playPlaylist(result.tracks, 0);
          toast.success(`🎵 Odtwarzam ${result.tracks.length} utworów — ${result.genre || ""} (${result.mood || ""})`, { id: "voice-cmd", duration: 4000 });
        } else if (result.action === "pause") {
          togglePlay();
          toast.success("⏸️ Pauza", { id: "voice-cmd" });
        }
      } catch {
        toast.error("Nie udało się przetworzyć komendy", { id: "voice-cmd" });
      }
    }
  }, [isAIEnabled, processVoiceCommand, playPlaylist, togglePlay, nextTrack, prevTrack, setVolume]);

  const startListening = useCallback(() => {
    if (!autoListenEnabled || !user) return;
    
    const SpeechAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechAPI) return;

    try {
      const rec = new SpeechAPI() as SpeechRecognitionInstance;
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = "pl-PL";

      rec.onresult = (event: SpeechRecognitionEvent) => {
        const last = event.results[event.results.length - 1];
        if (last.isFinal) {
          const text = last[0].transcript;
          processCommand(text);
        }
      };

      rec.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setAutoListenEnabled(false);
          localStorage.setItem("auto-voice-listen", "false");
          return;
        }
        // Restart on other errors
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
        // Auto-restart after a brief pause
        if (autoListenEnabled) {
          restartTimeoutRef.current = window.setTimeout(() => {
            startListening();
          }, 1000);
        }
      };

      rec.start();
      recognitionRef.current = rec;
      setIsListening(true);
    } catch (e) {
      console.error("Voice recognition init failed:", e);
    }
  }, [autoListenEnabled, user, processCommand]);

  // Start listening when user is logged in and auto-listen is enabled
  useEffect(() => {
    if (user && autoListenEnabled) {
      startListening();
    }
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
    };
  }, [user, autoListenEnabled, startListening]);

  // Hide indicator after delay
  useEffect(() => {
    if (showIndicator) {
      const t = setTimeout(() => setShowIndicator(false), 4000);
      return () => clearTimeout(t);
    }
  }, [showIndicator, lastTranscript]);

  const toggleAutoListen = () => {
    const next = !autoListenEnabled;
    setAutoListenEnabled(next);
    localStorage.setItem("auto-voice-listen", String(next));
    if (next) {
      startListening();
      toast.success("🎙️ Mikrofon AI włączony — mów do aplikacji!");
    } else {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
      setIsListening(false);
      toast.info("🔇 Mikrofon AI wyłączony");
    }
  };

  if (!user) return null;

  return (
    <>
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
              <span className="text-xs font-semibold text-accent">AI Słyszę</span>
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
