import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Loader2, Sparkles } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAI } from "@/contexts/AIContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface VoiceCommandHandlerProps {
  isOpen: boolean;
  onClose: () => void;
}

// Extend Window interface for SpeechRecognition
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
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
}

interface SpeechRecognitionConstructor {
  new(): SpeechRecognitionInstance;
}

declare global {
  interface Window {
    webkitSpeechRecognition: SpeechRecognitionConstructor;
    SpeechRecognition: SpeechRecognitionConstructor;
  }
}

export const VoiceCommandHandler = ({ isOpen, onClose }: VoiceCommandHandlerProps) => {
  const { playPlaylist, togglePlay, nextTrack, prevTrack, setVolume } = usePlayer();
  const { processVoiceCommand, isProcessing: aiProcessing, currentMood, isAIEnabled } = useAI();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [processing, setProcessing] = useState(false);
  const [detectedMood, setDetectedMood] = useState<string | null>(null);
  const [recognition, setRecognition] = useState<SpeechRecognitionInstance | null>(null);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognitionAPI) {
        const recognitionInstance = new SpeechRecognitionAPI();
        recognitionInstance.continuous = false;
        recognitionInstance.interimResults = true;
        recognitionInstance.lang = "en-US";

        recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
          const current = event.resultIndex;
          const transcriptText = event.results[current][0].transcript;
          setTranscript(transcriptText);
          
          if (event.results[current].isFinal) {
            processCommand(transcriptText.toLowerCase());
          }
        };

        recognitionInstance.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error("Speech recognition error:", event.error);
          setIsListening(false);
          if (event.error !== "no-speech") {
            toast.error(`Voice recognition error: ${event.error}`);
          }
        };

        recognitionInstance.onend = () => {
          setIsListening(false);
        };

        setRecognition(recognitionInstance);
      }
    }
  }, []);

  // Analyze mood from text (simple keyword analysis)
  const analyzeMood = (text: string): string => {
    const moodKeywords: Record<string, string[]> = {
      happy: ["happy", "excited", "joy", "great", "awesome", "amazing", "good", "cheerful", "upbeat"],
      sad: ["sad", "down", "melancholy", "depressed", "lonely", "blue", "gloomy"],
      energetic: ["energetic", "pumped", "workout", "energy", "hyped", "motivated", "power"],
      calm: ["calm", "peaceful", "relaxed", "chill", "serene", "tranquil", "mellow"],
      angry: ["angry", "frustrated", "mad", "rage", "intense", "aggressive"],
      romantic: ["romantic", "love", "passion", "tender", "sweet", "intimate"]
    };

    for (const [mood, keywords] of Object.entries(moodKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return mood;
      }
    }
    return "neutral";
  };

  // Map mood to genre
  const moodToGenre = (mood: string): string => {
    const mapping: Record<string, string> = {
      happy: "Pop",
      sad: "Pop", // Ballads
      energetic: "Rock",
      calm: "Pop", // Acoustic
      angry: "Punk",
      romantic: "Pop",
      neutral: "Rock"
    };
    return mapping[mood] || "Rock";
  };

  const processCommand = useCallback(async (command: string) => {
    setProcessing(true);
    
    try {
      if (isAIEnabled) {
        // Use AI-powered command processing
        const result = await processVoiceCommand(command);
        setDetectedMood(result.mood || null);

        if (result.action === "play" && result.tracks && result.tracks.length > 0) {
          playPlaylist(result.tracks, 0);
          toast.success(`🎵 Playing ${result.genre} based on your mood: ${result.mood}`, { duration: 3000 });
        } else if (result.action === "pause") {
          togglePlay();
          toast.success("Paused playback");
        } else if (result.action === "next") {
          nextTrack();
          toast.success("Playing next track");
        } else if (result.action === "previous") {
          prevTrack();
          toast.success("Playing previous track");
        } else if (result.action === "volume") {
          if (command.includes("up") || command.includes("louder")) {
            setVolume(80);
            toast.success("Volume increased");
          } else if (command.includes("down") || command.includes("quiet")) {
            setVolume(30);
            toast.success("Volume decreased");
          } else if (command.includes("mute")) {
            setVolume(0);
            toast.success("Volume muted");
          } else if (command.includes("max")) {
            setVolume(100);
            toast.success("Volume maximized");
          }
        }
      } else {
        // Fallback to basic command processing
        if (command.includes("play")) {
          togglePlay();
        } else if (command.includes("pause") || command.includes("stop")) {
          togglePlay();
        } else if (command.includes("next") || command.includes("skip")) {
          nextTrack();
        } else if (command.includes("previous") || command.includes("back")) {
          prevTrack();
        }
        toast.info("AI is disabled. Using basic commands only.");
      }
    } catch (error) {
      console.error("Command processing error:", error);
      toast.error("Failed to process command");
    } finally {
      setProcessing(false);
      setTimeout(() => onClose(), 1500);
    }
  }, [isAIEnabled, processVoiceCommand, playPlaylist, togglePlay, nextTrack, prevTrack, setVolume, onClose]);

  // playGenre is now handled by useAI.processVoiceCommand

  const toggleListening = () => {
    if (!recognition) {
      toast.error("Voice recognition not supported in your browser");
      return;
    }

    if (isListening) {
      recognition.stop();
    } else {
      setTranscript("");
      setDetectedMood(null);
      recognition.start();
      setIsListening(true);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-background/90 backdrop-blur-md z-50 flex items-center justify-center"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-card border border-border rounded-2xl p-8 max-w-md w-full mx-4 text-center"
          >
            <h2 className="text-2xl font-bold mb-2">Voice Commands</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Say commands like "play rock", "next", "pause", or describe your mood
            </p>

            {/* Microphone Button */}
            <motion.button
              onClick={toggleListening}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 transition-colors",
                isListening 
                  ? "bg-primary groove-glow" 
                  : "bg-secondary hover:bg-secondary/80"
              )}
            >
              {processing ? (
                <Loader2 className="h-10 w-10 animate-spin text-primary-foreground" />
              ) : isListening ? (
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  <Mic className="h-10 w-10 text-primary-foreground" />
                </motion.div>
              ) : (
                <MicOff className="h-10 w-10 text-muted-foreground" />
              )}
            </motion.button>

            {/* Status */}
            <div className="h-20">
              {isListening && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2"
                >
                  <div className="flex justify-center gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1 bg-primary rounded-full"
                        animate={{ height: [8, 24, 8] }}
                        transition={{ 
                          repeat: Infinity, 
                          duration: 0.5,
                          delay: i * 0.1 
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-primary font-medium">Listening...</p>
                </motion.div>
              )}
              
              {transcript && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2"
                >
                  <p className="text-foreground">"{transcript}"</p>
                  {detectedMood && (
                    <p className="text-sm text-accent">
                      Detected mood: <span className="font-semibold capitalize">{detectedMood}</span>
                    </p>
                  )}
                </motion.div>
              )}

              {!isListening && !transcript && (
                <p className="text-muted-foreground text-sm">
                  Tap the microphone to start
                </p>
              )}
            </div>

            {/* Example Commands */}
            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                Try saying
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {["Play rock", "I feel happy", "Next song", "Volume up"].map((cmd) => (
                  <span
                    key={cmd}
                    className="px-3 py-1 rounded-full bg-secondary text-xs text-muted-foreground"
                  >
                    {cmd}
                  </span>
                ))}
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="mt-6 px-6 py-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors text-sm"
            >
              Close
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
