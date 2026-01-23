import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { supabase } from "@/integrations/supabase/client";
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
      // Analyze emotional tone
      const mood = analyzeMood(command);
      setDetectedMood(mood);

      // Command patterns
      if (command.includes("play") || command.includes("start")) {
        // Genre commands
        if (command.includes("rock")) {
          await playGenre("Rock");
        } else if (command.includes("punk")) {
          await playGenre("Punk");
        } else if (command.includes("pop")) {
          await playGenre("Pop");
        } else {
          // Play based on detected mood
          const genre = moodToGenre(mood);
          await playGenre(genre);
          toast.success(`Playing ${genre} based on your mood: ${mood}`);
        }
      } else if (command.includes("pause") || command.includes("stop")) {
        togglePlay();
        toast.success("Paused playback");
      } else if (command.includes("next") || command.includes("skip")) {
        nextTrack();
        toast.success("Playing next track");
      } else if (command.includes("previous") || command.includes("back")) {
        prevTrack();
        toast.success("Playing previous track");
      } else if (command.includes("volume")) {
        if (command.includes("up") || command.includes("louder")) {
          setVolume(80);
          toast.success("Volume increased");
        } else if (command.includes("down") || command.includes("quiet") || command.includes("lower")) {
          setVolume(30);
          toast.success("Volume decreased");
        } else if (command.includes("mute") || command.includes("off")) {
          setVolume(0);
          toast.success("Volume muted");
        } else if (command.includes("max") || command.includes("full")) {
          setVolume(100);
          toast.success("Volume maximized");
        }
      } else if (command.includes("shuffle")) {
        toast.success("Shuffle toggled");
      } else {
        // Default: play music based on mood
        const genre = moodToGenre(mood);
        await playGenre(genre);
        toast.info(`Detected mood: ${mood}. Playing ${genre} music.`);
      }
    } catch (error) {
      console.error("Command processing error:", error);
      toast.error("Failed to process command");
    } finally {
      setProcessing(false);
      setTimeout(() => onClose(), 1500);
    }
  }, [togglePlay, nextTrack, prevTrack, setVolume, onClose]);

  const playGenre = async (genre: string) => {
    const { data: tracks, error } = await supabase
      .from("tracks")
      .select("*")
      .ilike("genre", `%${genre}%`)
      .limit(20);

    if (error) {
      throw error;
    }

    if (tracks && tracks.length > 0) {
      // Shuffle tracks
      const shuffled = [...tracks].sort(() => Math.random() - 0.5);
      playPlaylist(shuffled, 0);
      toast.success(`Playing ${genre} music (${tracks.length} tracks)`);
    } else {
      toast.info(`No ${genre} tracks found. Playing all music.`);
      const { data: allTracks } = await supabase.from("tracks").select("*").limit(20);
      if (allTracks && allTracks.length > 0) {
        playPlaylist(allTracks, 0);
      }
    }
  };

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
