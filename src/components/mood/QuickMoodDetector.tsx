import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { Camera, CameraOff, X, GripHorizontal, Sparkles, Loader2, Brain, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAI } from "@/contexts/AIContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { supabase } from "@/integrations/supabase/client";
import { DetectedMood } from "@/hooks/useAIOrchestrator";
import { useFaceDetection } from "@/hooks/useFaceDetection";

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
  const { isModelLoaded, isLoadingModel, modelError, loadModels, detectWithSampling } = useFaceDetection();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStep, setAnalysisStep] = useState<string>("");
  const [currentMood, setCurrentMood] = useState<MoodResult | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [noFaceDetected, setNoFaceDetected] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const dragControls = useDragControls();

  // Load models when component opens
  useEffect(() => {
    if (isOpen && !isModelLoaded && !isLoadingModel) {
      loadModels();
    }
  }, [isOpen, isModelLoaded, isLoadingModel, loadModels]);

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
    setNoFaceDetected(false);
    setAnalysisStep("");
  }, []);

  const startAnalysis = useCallback(async () => {
    if (!videoRef.current || !isModelLoaded) {
      toast.error("Model AI nie jest gotowy. Poczekaj chwilę...");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setNoFaceDetected(false);
    setAnalysisStep("Inicjalizacja TensorFlow.js...");

    // Progress animation
    let progress = 0;
    progressIntervalRef.current = setInterval(() => {
      progress += 1.5;
      setAnalysisProgress(Math.min(progress, 95));
      
      // Update step descriptions
      if (progress > 10 && progress < 30) {
        setAnalysisStep("Wykrywanie twarzy...");
      } else if (progress > 30 && progress < 60) {
        setAnalysisStep("Analiza wyrazu twarzy...");
      } else if (progress > 60 && progress < 85) {
        setAnalysisStep("Rozpoznawanie emocji...");
      } else if (progress > 85) {
        setAnalysisStep("Finalizacja wyników...");
      }
    }, 75);

    try {
      // Wait for video to be ready
      await new Promise(resolve => setTimeout(resolve, 500));

      // Perform real face detection with sampling over ~4 seconds
      const result = await detectWithSampling(videoRef.current, 5, 800);

      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      setAnalysisProgress(100);

      if (!result || !result.faceDetected) {
        setNoFaceDetected(true);
        setIsAnalyzing(false);
        toast.error("Nie wykryto twarzy. Upewnij się, że twarz jest widoczna w kamerze.");
        return;
      }

      // Map detected emotion to our mood system
      const emotionKey = result.dominantEmotion;
      const baseMood = moodMapping[emotionKey] || moodMapping.neutral;
      
      const detectedMood: MoodResult = {
        ...baseMood,
        confidence: result.confidence,
      };

      setCurrentMood(detectedMood);
      setIsAnalyzing(false);

      toast(
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{detectedMood.emoji}</span>
            <span className="font-bold">{detectedMood.mood}</span>
            <span className="text-xs text-muted-foreground ml-auto">{detectedMood.confidence}% pewności</span>
          </div>
          <p className="text-sm text-muted-foreground">{detectedMood.dayDescription}</p>
        </div>,
        { duration: 4000 }
      );

      // Auto-play after short delay
      setTimeout(async () => {
        await playMoodPlaylist(detectedMood);
        stopCamera();
        onClose();
      }, 1500);

    } catch (error) {
      console.error("Face detection error:", error);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      setIsAnalyzing(false);
      toast.error("Błąd podczas analizy twarzy. Spróbuj ponownie.");
    }
  }, [isModelLoaded, detectWithSampling, playMoodPlaylist, stopCamera, onClose]);

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
              <Brain className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">AI Rozpoznawanie Nastroju</h3>
              <p className="text-[10px] text-white/50">
                {isLoadingModel ? "Ładowanie TensorFlow.js..." : isModelLoaded ? "TensorFlow.js gotowy" : "face-api.js"}
              </p>
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
          
          {!isActive && !isLoadingModel && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <Brain className="h-10 w-10 text-white/30" />
              <p className="text-xs text-white/40 text-center px-4">
                Włącz kamerę - AI wykryje emocje z Twojej twarzy i włączy muzykę!
              </p>
              {isModelLoaded && (
                <span className="text-[10px] text-green-400/70 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 bg-green-400 rounded-full animate-pulse" />
                  TensorFlow.js gotowy
                </span>
              )}
            </div>
          )}

          {!isActive && isLoadingModel && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <p className="text-xs text-white/60 text-center px-4">
                Ładowanie modeli face-api.js...
              </p>
              <p className="text-[10px] text-white/40">To może potrwać kilka sekund</p>
            </div>
          )}

          {isActive && isAnalyzing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/40"
            >
              <div className="relative">
                <Brain className="h-12 w-12 text-primary" />
                <motion.div
                  className="absolute inset-0 border-2 border-primary rounded-full"
                  animate={{ scale: [1, 1.3, 1], opacity: [1, 0, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              </div>
              <p className="text-white font-medium text-sm mt-4">{analysisStep || "Inicjalizacja..."}</p>
              <div className="w-48 h-2 bg-white/20 rounded-full mt-3 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary to-accent"
                  animate={{ width: `${analysisProgress}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
              <p className="text-white/60 text-xs mt-2">{Math.round(analysisProgress)}%</p>
            </motion.div>
          )}

          {isActive && noFaceDetected && !isAnalyzing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/60"
            >
              <AlertCircle className="h-12 w-12 text-yellow-400 mb-3" />
              <p className="text-white font-medium text-sm">Nie wykryto twarzy</p>
              <p className="text-white/60 text-xs text-center px-6 mt-1">
                Upewnij się, że twarz jest dobrze oświetlona i widoczna w kamerze
              </p>
              <Button
                onClick={startAnalysis}
                size="sm"
                className="mt-3 groove-gradient-bg"
              >
                Spróbuj ponownie
              </Button>
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
                disabled={isLoading || isLoadingModel}
                className="flex-1 h-10 groove-gradient-bg text-white hover:opacity-90"
              >
                {isLoading || isLoadingModel ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Brain className="h-4 w-4 mr-2" />
                )}
                {isLoadingModel ? "Ładowanie AI..." : isLoading ? "Uruchamiam..." : "Analizuj emocje (5s)"}
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

          {modelError && (
            <p className="text-[10px] text-yellow-400 text-center">
              {modelError} - używam trybu uproszczonego
            </p>
          )}

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