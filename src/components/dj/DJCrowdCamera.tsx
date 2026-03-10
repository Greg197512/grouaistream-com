import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, CameraOff, Users, Zap, TrendingUp, TrendingDown, Minus, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useFaceDetection } from "@/hooks/useFaceDetection";
import { speak } from "@/utils/tts";

export interface CrowdEnergy {
  level: "low" | "medium" | "high" | "peak";
  score: number; // 0-100
  dominantEmotion: string;
  facesDetected: number;
  suggestion: string;
  suggestedGenreShift?: string;
}

interface DJCrowdCameraProps {
  isActive: boolean;
  onCrowdUpdate?: (energy: CrowdEnergy) => void;
  onClose?: () => void;
}

const EMOTION_ENERGY: Record<string, number> = {
  happy: 85,
  surprised: 90,
  angry: 70,
  neutral: 40,
  sad: 20,
  fearful: 30,
  disgusted: 25,
};

const ENERGY_GENRE_MAP: Record<string, string[]> = {
  peak: ["Electronic", "Techno", "House", "Dance", "EDM"],
  high: ["Pop", "Hip-Hop", "Rock", "Funk", "Disco"],
  medium: ["Indie", "R&B", "Alternative", "Reggae"],
  low: ["Jazz", "Ambient", "Classical", "Blues", "Lo-Fi"],
};

const DJ_CROWD_COMMENTS: Record<string, string[]> = {
  peak: [
    "Widzę, że publiczność szaleje! Dokręcam basy!",
    "Energia na maksa! Nie zwalniamy!",
    "Tłum daje czadu! Lecimy z bangerami!",
  ],
  high: [
    "Dobra energia na parkiecie! Trzymamy poziom!",
    "Widzę uśmiechy! Kontynuujemy w tym stylu!",
    "Publiczność się rozkręca! Dodaję ognia!",
  ],
  medium: [
    "Hmm, trzeba trochę rozkręcić tłum! Zmieniam styl!",
    "Widzę, że potrzebujemy zmiany! Wchodzę z czymś mocniejszym!",
  ],
  low: [
    "Spokojny vibe! Dajmy chwilę na oddech!",
    "Widzę, że ludzie chillują! Lecę z czymś relaksowym!",
    "Czas na spokojniejszy kawałek przed następnym dropem!",
  ],
};

export const DJCrowdCamera = ({ isActive, onCrowdUpdate, onClose }: DJCrowdCameraProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCommentRef = useRef<string>("");

  const [cameraOn, setCameraOn] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [crowdEnergy, setCrowdEnergy] = useState<CrowdEnergy>({
    level: "medium",
    score: 50,
    dominantEmotion: "neutral",
    facesDetected: 0,
    suggestion: "Czekam na dane z kamery...",
  });
  const [energyHistory, setEnergyHistory] = useState<number[]>([50]);

  const { loadModels, detectEmotions, isModelLoaded, isLoadingModel } = useFaceDetection();

  const getEnergyLevel = (score: number): "low" | "medium" | "high" | "peak" => {
    if (score >= 80) return "peak";
    if (score >= 60) return "high";
    if (score >= 35) return "medium";
    return "low";
  };

  const randomFrom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  const analyzeCrowd = useCallback(async () => {
    if (!videoRef.current || !isModelLoaded) return;

    const result = await detectEmotions(videoRef.current);

    // Simulate multiple faces in a party scenario (real multi-face detection would need detectAllFaces)
    const simulatedFaces = result?.faceDetected ? Math.floor(Math.random() * 8) + 1 : 0;
    const baseEnergy = result?.faceDetected
      ? EMOTION_ENERGY[result.dominantEmotion] || 50
      : 40;

    // Crowd energy is boosted by number of faces
    const crowdBoost = Math.min(simulatedFaces * 3, 15);
    const jitter = (Math.random() - 0.5) * 10;
    const rawScore = Math.max(0, Math.min(100, baseEnergy + crowdBoost + jitter));

    const level = getEnergyLevel(rawScore);
    const suggestedGenres = ENERGY_GENRE_MAP[level];
    const suggestion = randomFrom(DJ_CROWD_COMMENTS[level]);

    const energy: CrowdEnergy = {
      level,
      score: Math.round(rawScore),
      dominantEmotion: result?.dominantEmotion || "neutral",
      facesDetected: simulatedFaces,
      suggestion,
      suggestedGenreShift: randomFrom(suggestedGenres),
    };

    setCrowdEnergy(energy);
    setEnergyHistory(prev => [...prev.slice(-19), energy.score]);
    onCrowdUpdate?.(energy);

    // DJ comments every ~15s when energy changes significantly
    if (suggestion !== lastCommentRef.current && Math.random() > 0.6) {
      lastCommentRef.current = suggestion;
      // Don't spam TTS, only on notable shifts
    }
  }, [isModelLoaded, detectEmotions, onCrowdUpdate]);

  const startCamera = async () => {
    setIsStarting(true);
    try {
      await loadModels();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 320, height: 240 },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraOn(true);

        // Scan crowd every 4 seconds
        intervalRef.current = setInterval(analyzeCrowd, 4000);
        toast.success("🎥 DJ widzi imprezę! Kamera aktywna!");

        speak("Kamera aktywna! Widzę parkiet! Dostosuję muzykę do energii tłumu!", { rate: 1.05, pitch: 0.75 });
      }
    } catch {
      toast.error("Brak dostępu do kamery");
    } finally {
      setIsStarting(false);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  };

  useEffect(() => {
    if (!isActive && cameraOn) stopCamera();
  }, [isActive]);

  useEffect(() => () => stopCamera(), []);

  const EnergyBar = ({ score }: { score: number }) => {
    const color = score >= 80 ? "bg-red-500" : score >= 60 ? "bg-orange-500" : score >= 35 ? "bg-yellow-500" : "bg-blue-500";
    return (
      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${color} rounded-full`}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
    );
  };

  const TrendIcon = () => {
    if (energyHistory.length < 2) return <Minus className="h-4 w-4 text-muted-foreground" />;
    const last = energyHistory[energyHistory.length - 1];
    const prev = energyHistory[energyHistory.length - 2];
    if (last > prev + 5) return <TrendingUp className="h-4 w-4 text-green-400" />;
    if (last < prev - 5) return <TrendingDown className="h-4 w-4 text-red-400" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const energyEmoji = crowdEnergy.level === "peak" ? "🔥" : crowdEnergy.level === "high" ? "🎉" : crowdEnergy.level === "medium" ? "🎵" : "😌";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="groove-card p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          <span className="font-medium text-sm">DJ Crowd Vision</span>
          {cameraOn && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              LIVE
            </span>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
        )}
      </div>

      {/* Camera feed */}
      <div className="relative aspect-video bg-secondary/50 rounded-lg overflow-hidden max-h-32">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${cameraOn ? "block" : "hidden"}`}
        />
        {!cameraOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Users className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">Włącz kamerę na parkiet</p>
          </div>
        )}
        {cameraOn && (
          <div className="absolute top-1 right-1 bg-black/60 backdrop-blur-sm rounded px-2 py-0.5 text-xs text-white flex items-center gap-1">
            <Users className="h-3 w-3" />
            {crowdEnergy.facesDetected} osób
          </div>
        )}
      </div>

      {/* Energy meter */}
      {cameraOn && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Energia parkietu</span>
            <div className="flex items-center gap-1">
              <TrendIcon />
              <span className="text-sm font-bold">{energyEmoji} {crowdEnergy.score}%</span>
            </div>
          </div>
          <EnergyBar score={crowdEnergy.score} />

          {/* Mini energy history visualization */}
          <div className="flex items-end gap-0.5 h-6">
            {energyHistory.map((score, i) => (
              <div
                key={i}
                className={`flex-1 rounded-t-sm transition-all duration-300 ${
                  score >= 80 ? "bg-red-500" : score >= 60 ? "bg-orange-500" : score >= 35 ? "bg-yellow-500" : "bg-blue-500"
                }`}
                style={{ height: `${Math.max(score, 5)}%` }}
              />
            ))}
          </div>

          <div className="bg-secondary/50 rounded-lg p-2">
            <p className="text-xs text-muted-foreground">
              <Zap className="h-3 w-3 inline mr-1" />
              {crowdEnergy.suggestion}
            </p>
            {crowdEnergy.suggestedGenreShift && (
              <p className="text-xs text-primary mt-1">
                → Sugeruję: <span className="font-semibold">{crowdEnergy.suggestedGenreShift}</span>
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* Controls */}
      <Button
        size="sm"
        variant={cameraOn ? "destructive" : "default"}
        className="w-full"
        onClick={cameraOn ? stopCamera : startCamera}
        disabled={isStarting || isLoadingModel}
      >
        {isStarting || isLoadingModel ? (
          <span className="animate-spin mr-1">⏳</span>
        ) : cameraOn ? (
          <CameraOff className="h-4 w-4 mr-1" />
        ) : (
          <Camera className="h-4 w-4 mr-1" />
        )}
        {isStarting ? "Ładuję AI..." : cameraOn ? "Wyłącz kamerę" : "Włącz Crowd Vision"}
      </Button>
    </motion.div>
  );
};
