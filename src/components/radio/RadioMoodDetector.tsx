import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Sparkles, Eye, Camera, CameraOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAISafe } from "@/contexts/AIContext";
import { useFaceDetection } from "@/hooks/useFaceDetection";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

const QUICK_MOODS = [
  { mood: "euphoric", emoji: "🤩", genre: "EDM", color: "from-yellow-500 to-orange-500" },
  { mood: "chill", emoji: "😌", genre: "Lo-Fi", color: "from-cyan-500 to-blue-500" },
  { mood: "energetic", emoji: "⚡", genre: "Rock", color: "from-red-500 to-pink-500" },
  { mood: "melancholic", emoji: "🌙", genre: "Ambient", color: "from-indigo-500 to-purple-500" },
  { mood: "party", emoji: "🎉", genre: "House", color: "from-pink-500 to-yellow-500" },
  { mood: "focus", emoji: "🧠", genre: "Classical", color: "from-emerald-500 to-teal-500" },
];

const EMOTION_TO_MOOD: Record<string, typeof QUICK_MOODS[0]> = {
  happy: { mood: "euphoric", emoji: "🤩", genre: "EDM", color: "from-yellow-500 to-orange-500" },
  sad: { mood: "melancholic", emoji: "🌙", genre: "Ambient", color: "from-indigo-500 to-purple-500" },
  angry: { mood: "energetic", emoji: "⚡", genre: "Rock", color: "from-red-500 to-pink-500" },
  surprised: { mood: "party", emoji: "🎉", genre: "House", color: "from-pink-500 to-yellow-500" },
  neutral: { mood: "chill", emoji: "😌", genre: "Lo-Fi", color: "from-cyan-500 to-blue-500" },
  fearful: { mood: "melancholic", emoji: "🌙", genre: "Ambient", color: "from-indigo-500 to-purple-500" },
  disgusted: { mood: "energetic", emoji: "⚡", genre: "Rock", color: "from-red-500 to-pink-500" },
};

export const RadioMoodDetector = () => {
  const ai = useAISafe();
  const { t } = useLanguage();
  const { isModelLoaded, isLoadingModel, loadModels, detectWithSampling } = useFaceDetection();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [activeMood, setActiveMood] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [detectedConfidence, setDetectedConfidence] = useState<number | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    setIsAnalyzing(false);
    setAnalysisProgress(0);
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const applyMood = useCallback(async (mood: typeof QUICK_MOODS[0], confidence: number, source: "manual" | "webcam") => {
    setActiveMood(mood.mood);
    setDetectedConfidence(source === "webcam" ? confidence : null);

    if (ai?.handleMoodDetected) {
      await ai.handleMoodDetected({
        mood: mood.mood,
        confidence,
        emoji: mood.emoji,
        color: mood.color,
        genre: mood.genre,
        source,
      }, false);
    }

    toast.success(`${mood.emoji} Nastrój: ${mood.mood} → gatunek: ${mood.genre}${source === "webcam" ? ` (${confidence}%)` : ""}`);
  }, [ai]);

  const startCameraDetection = useCallback(async () => {
    // Load models if needed
    if (!isModelLoaded && !isLoadingModel) {
      loadModels();
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 320, height: 240 },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraActive(true);
        toast.info("📷 Kamera aktywna — analizuję emocje...");

        // Wait for model + video ready
        const waitForReady = async () => {
          let attempts = 0;
          while (attempts < 30) {
            if (isModelLoaded && videoRef.current && videoRef.current.readyState >= 2) return true;
            await new Promise(r => setTimeout(r, 300));
            attempts++;
          }
          return false;
        };

        setIsAnalyzing(true);
        setAnalysisProgress(10);

        const ready = await waitForReady();
        if (!ready) {
          toast.error("AI model nie załadował się w czasie");
          stopCamera();
          return;
        }

        // Animate progress
        setAnalysisProgress(30);
        await new Promise(r => setTimeout(r, 200));
        setAnalysisProgress(60);

        const result = await detectWithSampling(videoRef.current, 2, 150);
        setAnalysisProgress(100);

        if (result?.faceDetected) {
          const emotionKey = result.dominantEmotion;
          const matched = EMOTION_TO_MOOD[emotionKey] || EMOTION_TO_MOOD.neutral;
          await applyMood(matched, result.confidence, "webcam");
        } else {
          toast.error("😕 Nie wykryto twarzy — spróbuj ponownie");
        }

        stopCamera();
      }
    } catch (error) {
      console.error("Camera error:", error);
      toast.error("Brak dostępu do kamery");
      stopCamera();
    }
  }, [isModelLoaded, isLoadingModel, loadModels, detectWithSampling, applyMood, stopCamera]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-4 space-y-3"
    >
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <Brain className="h-4 w-4 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold">AI Mood Detection</h3>
          <p className="text-[10px] text-muted-foreground">Radio dopasowane do Twojego nastroju</p>
        </div>
        <Sparkles className="h-3 w-3 text-primary ml-auto animate-pulse" />
      </div>

      {/* Camera detection button */}
      <Button
        onClick={cameraActive ? stopCamera : startCameraDetection}
        disabled={isAnalyzing}
        variant={cameraActive ? "destructive" : "default"}
        size="sm"
        className="w-full gap-2 text-xs"
      >
        {isAnalyzing ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Analizuję emocje... {analysisProgress}%
          </>
        ) : cameraActive ? (
          <>
            <CameraOff className="h-3.5 w-3.5" />
            Zatrzymaj kamerę
          </>
        ) : (
          <>
            <Camera className="h-3.5 w-3.5" />
            📷 Wykryj nastrój z kamery
          </>
        )}
      </Button>

      {/* Hidden video element for camera */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full rounded-lg ${cameraActive ? "block max-h-32 object-cover" : "hidden"}`}
      />

      {/* Analysis progress bar */}
      <AnimatePresence>
        {isAnalyzing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                animate={{ width: `${analysisProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current mood indicator */}
      <AnimatePresence>
        {activeMood && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
              <Eye className="h-3 w-3 text-primary" />
              <span className="text-xs text-primary font-medium">
                Wykryty nastrój: <strong>{activeMood}</strong>
                {detectedConfidence !== null && (
                  <span className="text-muted-foreground"> ({detectedConfidence}% pewności)</span>
                )}
                {" — "}AI dostosowuje playlistę
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick mood buttons */}
      <div className="grid grid-cols-3 gap-2">
        {QUICK_MOODS.map((mood) => (
          <motion.button
            key={mood.mood}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => applyMood(mood, 95, "manual")}
            className={`relative flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-xs font-medium transition-all border ${
              activeMood === mood.mood 
                ? "border-primary bg-primary/10 shadow-md shadow-primary/20" 
                : "border-border/30 bg-card/50 hover:bg-card hover:border-border/60"
            }`}
          >
            <span className="text-lg">{mood.emoji}</span>
            <span className="capitalize text-[10px]">{mood.mood}</span>
            {activeMood === mood.mood && (
              <motion.div
                layoutId="mood-indicator"
                className={`absolute inset-0 rounded-xl bg-gradient-to-br ${mood.color} opacity-10`}
              />
            )}
          </motion.button>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground/60 text-center">
        {isLoadingModel ? "⏳ Ładowanie modelu AI..." : "Kliknij 📷 lub wybierz nastrój ręcznie"}
      </p>
    </motion.div>
  );
};
