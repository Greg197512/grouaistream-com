import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { Camera, CameraOff, X, GripHorizontal, Sparkles, Loader2 } from "lucide-react";
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
  dayDescription: string;
}

const moodMapping: Record<string, MoodResult> = {
  happy: { 
    mood: "Happy", 
    confidence: 0, 
    emoji: "😊", 
    color: "from-yellow-400 to-orange-500", 
    genre: "Pop",
    dayDescription: "Masz świetny dzień! Energia pozytywna promieniuje z Ciebie!"
  },
  sad: { 
    mood: "Melancholic", 
    confidence: 0, 
    emoji: "😢", 
    color: "from-blue-400 to-indigo-500", 
    genre: "R&B",
    dayDescription: "Wygląda na trudniejszy dzień... Muzyka poprawi Ci nastrój!"
  },
  angry: { 
    mood: "Intense", 
    confidence: 0, 
    emoji: "😤", 
    color: "from-red-500 to-orange-600", 
    genre: "Rock",
    dayDescription: "Czujesz się intensywnie! Czas na muzykę, która to uwolni!"
  },
  fearful: { 
    mood: "Anxious", 
    confidence: 0, 
    emoji: "😰", 
    color: "from-purple-400 to-pink-500", 
    genre: "Trance",
    dayDescription: "Stresujący dzień? Uspokajające dźwięki pomogą!"
  },
  disgusted: { 
    mood: "Rebellious", 
    confidence: 0, 
    emoji: "😒", 
    color: "from-green-500 to-teal-500", 
    genre: "Punk",
    dayDescription: "Buntowniczy nastrój! Rock i punk dla Ciebie!"
  },
  surprised: { 
    mood: "Excited", 
    confidence: 0, 
    emoji: "😮", 
    color: "from-pink-400 to-rose-500", 
    genre: "EDM",
    dayDescription: "Pełen ekscytacji dzień! Czas na energetyczną muzykę!"
  },
  neutral: { 
    mood: "Relaxed", 
    confidence: 0, 
    emoji: "😌", 
    color: "from-cyan-400 to-blue-500", 
    genre: "House",
    dayDescription: "Spokojny, zrelaksowany dzień. Idealna pora na chill!"
  },
  energetic: { 
    mood: "Energetic", 
    confidence: 0, 
    emoji: "⚡", 
    color: "from-orange-400 to-red-500", 
    genre: "EDM",
    dayDescription: "WOW! Mega energetyczny dzień! Czas rozkręcić imprezę!"
  },
  romantic: { 
    mood: "Romantic", 
    confidence: 0, 
    emoji: "💕", 
    color: "from-pink-300 to-rose-400", 
    genre: "R&B",
    dayDescription: "Romantyczny nastrój... Czas na piękne melodie!"
  },
  focused: { 
    mood: "Focused", 
    confidence: 0, 
    emoji: "🎯", 
    color: "from-indigo-400 to-purple-500", 
    genre: "House",
    dayDescription: "Skupiony i gotowy do działania! Muzyka pomoże!"
  },
};

interface QuickMoodDetectorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickMoodDetector = ({ isOpen, onClose }: QuickMoodDetectorProps) => {
  const { handleMoodDetected: aiHandleMood } = useAI();
  const { playPlaylist } = usePlayer();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [currentMood, setCurrentMood] = useState<MoodResult | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analysisTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const dragControls = useDragControls();

  const simulateMoodDetection = useCallback(() => {
    const moods = Object.keys(moodMapping);
    const randomMood = moods[Math.floor(Math.random() * moods.length)];
    const confidence = 80 + Math.random() * 18;
    
    return {
      ...moodMapping[randomMood],
      confidence: Math.round(confidence),
    };
  }, []);

  const playMoodPlaylist = useCallback(async (mood: MoodResult) => {
    try {
      const { data: tracks, error } = await supabase
        .from("tracks")
        .select("*")
        .or(`genre.ilike.%${mood.genre}%,mood.ilike.%${mood.mood}%`)
        .limit(30);
      
      if (error) throw error;
      
      if (tracks && tracks.length > 0) {
        const shuffled = [...tracks].sort(() => Math.random() - 0.5);
        playPlaylist(shuffled);
        
        const detectedMood: DetectedMood = {
          mood: mood.mood,
          confidence: mood.confidence,
          emoji: mood.emoji,
          color: mood.color,
          genre: mood.genre,
          source: "webcam",
        };
        
        await aiHandleMood(detectedMood, false);
        
        toast.success(`${mood.emoji} Gram ${tracks.length} utworów ${mood.genre} dla nastroju "${mood.mood}"!`);
      } else {
        const { data: fallbackTracks } = await supabase
          .from("tracks")
          .select("*")
          .limit(20);
        
        if (fallbackTracks && fallbackTracks.length > 0) {
          const shuffled = [...fallbackTracks].sort(() => Math.random() - 0.5);
          playPlaylist(shuffled);
          toast.success(`${mood.emoji} Gram muzykę dla nastroju "${mood.mood}"!`);
        } else {
          toast.error("Brak utworów w bazie.");
        }
      }
    } catch (error) {
      console.error("Error playing mood playlist:", error);
      toast.error("Błąd podczas ładowania utworów.");
    }
  }, [playPlaylist, aiHandleMood]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (analysisTimeoutRef.current) {
      clearTimeout(analysisTimeoutRef.current);
      analysisTimeoutRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
    setIsAnalyzing(false);
    setAnalysisProgress(0);
    setCurrentMood(null);
  }, []);

  const startAnalysis = useCallback(() => {
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    
    let progress = 0;
    progressIntervalRef.current = setInterval(() => {
      progress += 2;
      setAnalysisProgress(Math.min(progress, 100));
    }, 100);
    
    analysisTimeoutRef.current = setTimeout(async () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      setAnalysisProgress(100);
      
      const detectedMood = simulateMoodDetection();
      setCurrentMood(detectedMood);
      setIsAnalyzing(false);
      
      toast(
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{detectedMood.emoji}</span>
            <span className="font-bold">{detectedMood.mood}</span>
          </div>
          <p className="text-sm text-muted-foreground">{detectedMood.dayDescription}</p>
        </div>,
        { duration: 4000 }
      );
      
      setTimeout(async () => {
        await playMoodPlaylist(detectedMood);
        stopCamera();
        onClose();
      }, 1500);
      
    }, 5000);
  }, [simulateMoodDetection, playMoodPlaylist, stopCamera, onClose]);

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
        
        toast.success("🎥 Kamera aktywna! Analizuję twarz przez 5 sekund...");
        
        startAnalysis();
      }
    } catch (error) {
      console.error("Camera access denied:", error);
      setHasPermission(false);
      toast.error("Brak dostępu do kamery. Sprawdź uprawnienia.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, stopCamera]);

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
        <motion.div
          onPointerDown={(e) => dragControls.start(e)}
          className="absolute top-0 left-0 right-0 h-6 flex items-center justify-center cursor-grab active:cursor-grabbing z-10"
        >
          <GripHorizontal className="h-4 w-4 text-white/40" />
        </motion.div>

        <div className="flex items-center justify-between p-3 pt-6 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Camera className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Rozpoznawanie Nastroju</h3>
              <p className="text-[10px] text-white/50">5 sekund analizy twarzy</p>
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
                Włącz kamerę - automatycznie wykryję nastrój i włączę muzykę!
              </p>
            </div>
          )}

          {isActive && isAnalyzing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/40"
            >
              <Loader2 className="h-10 w-10 text-white animate-spin mb-3" />
              <p className="text-white font-medium text-sm">Analizuję twarz...</p>
              <div className="w-48 h-2 bg-white/20 rounded-full mt-3 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary to-accent"
                  style={{ width: `${analysisProgress}%` }}
                />
              </div>
              <p className="text-white/60 text-xs mt-2">{Math.round(analysisProgress / 20)} / 5 sek</p>
            </motion.div>
          )}

          {isActive && currentMood && !isAnalyzing && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/60"
            >
              <motion.span 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                className="text-5xl mb-2"
              >
                {currentMood.emoji}
              </motion.span>
              <p className="text-white font-bold text-lg">{currentMood.mood}</p>
              <p className="text-white/70 text-xs text-center px-6 mt-1">
                {currentMood.dayDescription}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-white/80 text-sm">Włączam {currentMood.genre}...</span>
              </div>
            </motion.div>
          )}
        </div>

        <div className="p-3 space-y-2">
          {currentMood && !isAnalyzing && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-3 rounded-lg bg-gradient-to-r ${currentMood.color}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{currentMood.emoji}</span>
                <span className="text-white font-bold">{currentMood.mood}</span>
                <span className="text-white/70 text-xs ml-auto">{currentMood.confidence}%</span>
              </div>
              <p className="text-white/90 text-xs">{currentMood.dayDescription}</p>
            </motion.div>
          )}

          <div className="flex gap-2">
            {!isActive ? (
              <Button
                onClick={startCamera}
                disabled={isLoading}
                className="flex-1 h-10 groove-gradient-bg text-white hover:opacity-90"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4 mr-2" />
                )}
                {isLoading ? "Uruchamiam..." : "Włącz i analizuj (5s)"}
              </Button>
            ) : (
              <Button
                onClick={stopCamera}
                variant="destructive"
                className="flex-1 h-10"
                disabled={isAnalyzing}
              >
                <CameraOff className="h-4 w-4 mr-2" />
                Anuluj
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