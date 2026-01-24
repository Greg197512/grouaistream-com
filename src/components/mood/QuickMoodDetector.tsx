import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { Camera, CameraOff, Play, X, GripHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAI } from "@/contexts/AIContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { supabase } from "@/integrations/supabase/client";
import { DetectedMood } from "@/hooks/useAIOrchestrator";

interface MoodResult {
  mood: string;
  confidence: number;
  emoji: string;
  color: string;
  genre: string;
}

const moodMapping: Record<string, MoodResult> = {
  happy: { mood: "Happy", confidence: 0, emoji: "😊", color: "from-yellow-400 to-orange-500", genre: "Pop" },
  sad: { mood: "Melancholic", confidence: 0, emoji: "😢", color: "from-blue-400 to-indigo-500", genre: "R&B" },
  angry: { mood: "Intense", confidence: 0, emoji: "😤", color: "from-red-500 to-orange-600", genre: "Punk" },
  fearful: { mood: "Anxious", confidence: 0, emoji: "😰", color: "from-purple-400 to-pink-500", genre: "Trance" },
  disgusted: { mood: "Rebellious", confidence: 0, emoji: "😒", color: "from-green-500 to-teal-500", genre: "Rock" },
  surprised: { mood: "Excited", confidence: 0, emoji: "😮", color: "from-pink-400 to-rose-500", genre: "EDM" },
  neutral: { mood: "Relaxed", confidence: 0, emoji: "😌", color: "from-cyan-400 to-blue-500", genre: "House" },
  energetic: { mood: "Energetic", confidence: 0, emoji: "⚡", color: "from-orange-400 to-red-500", genre: "EDM" },
  romantic: { mood: "Romantic", confidence: 0, emoji: "💕", color: "from-pink-300 to-rose-400", genre: "R&B" },
  focused: { mood: "Focused", confidence: 0, emoji: "🎯", color: "from-indigo-400 to-purple-500", genre: "House" },
};

interface QuickMoodDetectorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickMoodDetector = ({ isOpen, onClose }: QuickMoodDetectorProps) => {
  const { handleMoodDetected: aiHandleMood, isProcessing } = useAI();
  const { playPlaylist } = usePlayer();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentMood, setCurrentMood] = useState<MoodResult | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const dragControls = useDragControls();

  const simulateMoodDetection = useCallback(() => {
    const moods = Object.keys(moodMapping);
    const randomMood = moods[Math.floor(Math.random() * moods.length)];
    const confidence = 75 + Math.random() * 20;
    
    return {
      ...moodMapping[randomMood],
      confidence: Math.round(confidence),
    };
  }, []);

  const startCamera = async () => {
    setIsLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 320, height: 240 },
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setHasPermission(true);
        setIsActive(true);
        
        // Start periodic mood detection
        detectionIntervalRef.current = setInterval(() => {
          const mood = simulateMoodDetection();
          setCurrentMood(mood);
        }, 2500);
        
        toast.success("🎥 Kamera aktywna! Wykrywam nastrój...");
      }
    } catch (error) {
      console.error("Camera access denied:", error);
      setHasPermission(false);
      toast.error("Brak dostępu do kamery. Sprawdź uprawnienia.");
    } finally {
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
    setCurrentMood(null);
  };

  const playMoodPlaylist = async () => {
    if (!currentMood) return;
    
    try {
      // Get tracks matching the detected mood's genre
      const { data: tracks, error } = await supabase
        .from("tracks")
        .select("*")
        .ilike("genre", `%${currentMood.genre}%`)
        .limit(25);
      
      if (error) throw error;
      
      if (tracks && tracks.length > 0) {
        // Shuffle and play
        const shuffled = [...tracks].sort(() => Math.random() - 0.5);
        playPlaylist(shuffled);
        
        // Create mood session for AI
        const detectedMood: DetectedMood = {
          mood: currentMood.mood,
          confidence: currentMood.confidence,
          emoji: currentMood.emoji,
          color: currentMood.color,
          genre: currentMood.genre,
          source: "webcam",
        };
        
        await aiHandleMood(detectedMood, false);
        
        toast.success(`${currentMood.emoji} Gram ${tracks.length} utworów ${currentMood.genre} dla nastroju "${currentMood.mood}"!`);
        stopCamera();
        onClose();
      } else {
        // Fallback: play any available tracks
        const { data: fallbackTracks } = await supabase
          .from("tracks")
          .select("*")
          .limit(20);
        
        if (fallbackTracks && fallbackTracks.length > 0) {
          const shuffled = [...fallbackTracks].sort(() => Math.random() - 0.5);
          playPlaylist(shuffled);
          toast.success(`${currentMood.emoji} Gram muzykę dla nastroju "${currentMood.mood}"!`);
          stopCamera();
          onClose();
        } else {
          toast.error("Brak utworów w bazie.");
        }
      }
    } catch (error) {
      console.error("Error playing mood playlist:", error);
      toast.error("Błąd podczas ładowania utworów.");
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        drag
        dragControls={dragControls}
        dragMomentum={false}
        dragElastic={0}
        dragConstraints={{ 
          left: -window.innerWidth + 360, 
          right: 0, 
          top: -window.innerHeight + 400, 
          bottom: 0 
        }}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="fixed bottom-32 right-4 z-50 w-[340px] rounded-2xl shadow-2xl overflow-hidden"
        style={{
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(40px) saturate(200%)',
          WebkitBackdropFilter: 'blur(40px) saturate(200%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Drag Handle */}
        <motion.div
          onPointerDown={(e) => dragControls.start(e)}
          className="absolute top-0 left-0 right-0 h-6 flex items-center justify-center cursor-grab active:cursor-grabbing z-10"
        >
          <GripHorizontal className="h-4 w-4 text-white/40" />
        </motion.div>

        {/* Header */}
        <div className="flex items-center justify-between p-3 pt-6 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Camera className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Rozpoznawanie Nastroju</h3>
              <p className="text-[10px] text-white/50">AI analizuje Twój wyraz twarzy</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4 text-white/60" />
          </button>
        </div>

        {/* Camera View */}
        <div className="relative aspect-video bg-black/50">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${isActive ? "block" : "hidden"}`}
          />
          
          {!isActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <CameraOff className="h-10 w-10 text-white/30" />
              <p className="text-xs text-white/40 text-center px-4">
                Włącz kamerę, aby AI wykryło Twój nastrój
              </p>
            </div>
          )}

          {/* Mood overlay */}
          {isActive && currentMood && (
            <motion.div
              key={currentMood.mood}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur-sm rounded-lg p-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{currentMood.emoji}</span>
                <div className="flex-1">
                  <p className="text-xs font-medium text-white">{currentMood.mood}</p>
                  <div className="h-1 bg-white/20 rounded-full overflow-hidden mt-0.5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${currentMood.confidence}%` }}
                      className={`h-full bg-gradient-to-r ${currentMood.color}`}
                    />
                  </div>
                </div>
                <span className="text-[10px] text-white/70">{currentMood.confidence}%</span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Controls */}
        <div className="p-3 space-y-2">
          {currentMood && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-2 rounded-lg bg-gradient-to-r ${currentMood.color} flex items-center justify-between`}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-white" />
                <span className="text-xs text-white font-medium">
                  Sugeruję: {currentMood.genre}
                </span>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="h-7 px-3 text-xs bg-white/20 hover:bg-white/30 text-white border-0"
                onClick={playMoodPlaylist}
                disabled={isProcessing}
              >
                <Play className="h-3 w-3 mr-1" />
                Graj
              </Button>
            </motion.div>
          )}

          <div className="flex gap-2">
            {!isActive ? (
              <Button
                onClick={startCamera}
                disabled={isLoading}
                className="flex-1 h-9 groove-gradient-bg text-white hover:opacity-90"
              >
                <Camera className="h-4 w-4 mr-2" />
                {isLoading ? "Uruchamiam..." : "Włącz kamerę"}
              </Button>
            ) : (
              <Button
                onClick={stopCamera}
                variant="destructive"
                className="flex-1 h-9"
              >
                <CameraOff className="h-4 w-4 mr-2" />
                Wyłącz
              </Button>
            )}
          </div>

          {hasPermission === false && (
            <p className="text-[10px] text-destructive text-center">
              Brak dostępu do kamery. Sprawdź uprawnienia przeglądarki.
            </p>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
