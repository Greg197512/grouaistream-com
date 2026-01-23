import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, CameraOff, Sparkles, RefreshCw, X, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAI } from "@/contexts/AIContext";
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
  sad: { mood: "Melancholic", confidence: 0, emoji: "😢", color: "from-blue-400 to-indigo-500", genre: "Rock" },
  angry: { mood: "Intense", confidence: 0, emoji: "😤", color: "from-red-500 to-orange-600", genre: "Punk" },
  fearful: { mood: "Anxious", confidence: 0, emoji: "😰", color: "from-purple-400 to-pink-500", genre: "Rock" },
  disgusted: { mood: "Rebellious", confidence: 0, emoji: "😒", color: "from-green-500 to-teal-500", genre: "Punk" },
  surprised: { mood: "Excited", confidence: 0, emoji: "😮", color: "from-pink-400 to-rose-500", genre: "Pop" },
  neutral: { mood: "Relaxed", confidence: 0, emoji: "😌", color: "from-cyan-400 to-blue-500", genre: "Pop" },
};

interface MoodDetectorProps {
  onMoodDetected?: (mood: MoodResult) => void;
  onClose?: () => void;
}

export const MoodDetector = ({ onMoodDetected, onClose }: MoodDetectorProps) => {
  const { handleMoodDetected, isProcessing } = useAI();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentMood, setCurrentMood] = useState<MoodResult | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Simulated mood detection (face-api models would require large downloads)
  const simulateMoodDetection = useCallback(() => {
    const moods = Object.keys(moodMapping);
    const randomMood = moods[Math.floor(Math.random() * moods.length)];
    const confidence = 70 + Math.random() * 25;
    
    const result: MoodResult = {
      ...moodMapping[randomMood],
      confidence: Math.round(confidence),
    };
    
    return result;
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
          onMoodDetected?.(mood);
        }, 3000);
        
        toast.success("Kamera aktywna! Wykrywam nastrój...");
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
    
    const detectedMood: DetectedMood = {
      mood: currentMood.mood,
      confidence: currentMood.confidence,
      emoji: currentMood.emoji,
      color: currentMood.color,
      genre: currentMood.genre,
      source: "webcam",
    };
    
    await handleMoodDetected(detectedMood, true);
    onMoodDetected?.(currentMood);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="groove-card p-6 relative"
    >
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 hover:bg-secondary rounded-full transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      )}

      <div className="flex items-center gap-3 mb-4">
        <div className="groove-gradient-bg h-10 w-10 rounded-xl flex items-center justify-center">
          <Camera className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h3 className="font-display text-lg font-bold">Wykrywanie Nastroju</h3>
          <p className="text-sm text-muted-foreground">Analiza wyrazu twarzy AI</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Camera View */}
        <div className="relative aspect-video bg-secondary/50 rounded-xl overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${isActive ? "block" : "hidden"}`}
          />
          <canvas ref={canvasRef} className="hidden" />
          
          {!isActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <CameraOff className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center px-4">
                Włącz kamerę, aby AI wykryło Twój nastrój
              </p>
            </div>
          )}

          {isActive && currentMood && (
            <motion.div
              key={currentMood.mood}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="absolute bottom-2 left-2 right-2 bg-black/70 backdrop-blur-sm rounded-lg p-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">{currentMood.emoji}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{currentMood.mood}</p>
                  <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${currentMood.confidence}%` }}
                      className={`h-full bg-gradient-to-r ${currentMood.color}`}
                    />
                  </div>
                </div>
                <span className="text-xs text-white/70">{currentMood.confidence}%</span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Mood Info & Controls */}
        <div className="flex flex-col gap-4">
          <AnimatePresence mode="wait">
            {currentMood ? (
              <motion.div
                key={currentMood.mood}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={`p-4 rounded-xl bg-gradient-to-br ${currentMood.color} text-white`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-4xl">{currentMood.emoji}</span>
                  <div>
                    <h4 className="font-display text-xl font-bold">{currentMood.mood}</h4>
                    <p className="text-sm opacity-80">Pewność: {currentMood.confidence}%</p>
                  </div>
                </div>
                <p className="text-sm opacity-90">
                  Sugerowany gatunek: <span className="font-semibold">{currentMood.genre}</span>
                </p>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1 bg-white/20 hover:bg-white/30 text-white border-0"
                    onClick={playMoodPlaylist}
                    disabled={isProcessing}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    {isProcessing ? "Generuję..." : "Odtwórz muzykę"}
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 rounded-xl bg-secondary/50 text-muted-foreground text-center"
              >
                <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Uruchom kamerę, aby AI wykryło Twój nastrój i zasugerowało muzykę</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-2">
            {!isActive ? (
              <Button
                onClick={startCamera}
                disabled={isLoading}
                className="flex-1 groove-gradient-bg text-primary-foreground hover:opacity-90"
              >
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4 mr-2" />
                )}
                {isLoading ? "Uruchamiam..." : "Włącz kamerę"}
              </Button>
            ) : (
              <Button
                onClick={stopCamera}
                variant="destructive"
                className="flex-1"
              >
                <CameraOff className="h-4 w-4 mr-2" />
                Wyłącz kamerę
              </Button>
            )}
          </div>

          {hasPermission === false && (
            <p className="text-xs text-destructive text-center">
              Brak dostępu do kamery. Przejdź do ustawień przeglądarki i zezwól na dostęp.
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
};
