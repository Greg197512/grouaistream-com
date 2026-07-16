import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Sparkles, Eye, Camera, CameraOff, Loader2, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAISafe } from "@/contexts/AIContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { supabase } from "@/integrations/supabase/client";
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
  const { user } = useAuth();
  const { playPlaylist } = usePlayer();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [activeMood, setActiveMood] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [detectedConfidence, setDetectedConfidence] = useState<number | null>(null);
  const [shrinkAnalysis, setShrinkAnalysis] = useState<string | null>(null);
  const [bonusGranted, setBonusGranted] = useState<number | null>(null);

  const stopProgressTimer = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  const stopCamera = useCallback(() => {
    stopProgressTimer();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopProgressTimer();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const claimBonus = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.rpc("claim_mood_analysis_bonus");
      if (error) {
        console.warn("[bonus] rpc error", error);
        return;
      }
      const result = data as { success: boolean; amount?: number; error?: string };
      if (result?.success && result.amount) {
        setBonusGranted(result.amount);
        toast.success(`🎁 +${result.amount} $ na Twoje zarobki za pierwszą analizę!`, { duration: 6000 });
      }
    } catch (e) {
      console.warn("[bonus] failed", e);
    }
  }, [user]);

  const fetchShrinkAnalysis = useCallback(async (mood: string, confidence: number, emotions: any) => {
    try {
      const { data, error } = await supabase.functions.invoke("ai-music-shrink", {
        body: { mood, confidence, emotions },
      });
      if (error) throw error;
      if (data?.analysis) {
        setShrinkAnalysis(data.analysis);
      }
    } catch (e) {
      console.warn("[shrink] failed", e);
      setShrinkAnalysis("Coś dziś jesteś tajemniczy 🤔 Daj sobie chwilę i wrzuć coś z dobrym basem.");
    }
  }, []);

  // Fallback bez orchestratora AI: dobierz utwory z bazy po gatunku/nastroju i zagraj.
  const playCategoryFallback = useCallback(async (mood: typeof QUICK_MOODS[0]) => {
    try {
      const [byGenre, byMood] = await Promise.all([
        supabase.from("tracks").select("*").not("audio_url", "is", null).ilike("genre", `%${mood.genre}%`).limit(20),
        supabase.from("tracks").select("*").not("audio_url", "is", null).ilike("mood", `%${mood.mood}%`).limit(20),
      ]);
      const merged = [...(byGenre.data || []), ...(byMood.data || [])] as Track[];
      const seen = new Set<string>();
      let tracks = merged.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true))).filter((t) => t.audio_url || t.video_url);
      if (!tracks.length) {
        const fb = await supabase.from("tracks").select("*").not("audio_url", "is", null).limit(20);
        tracks = (fb.data as Track[]) || [];
      }
      if (!tracks.length) { toast.error("Brak utworów do tej kategorii"); return; }
      for (let i = tracks.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [tracks[i], tracks[j]] = [tracks[j], tracks[i]]; }
      playPlaylist(tracks, 0, "radio-mood");
    } catch (e) {
      console.warn("[mood-detector] fallback play failed", e);
    }
  }, [playPlaylist]);

  const applyMood = useCallback(async (mood: typeof QUICK_MOODS[0], confidence: number, source: "manual" | "webcam", emotions?: any) => {
    setActiveMood(mood.mood);
    setDetectedConfidence(source === "webcam" ? confidence : null);

    if (ai?.handleMoodDetected) {
      // autoPlay=true → klik kategorii OD RAZU przełącza granie na utwory z tego nastroju/gatunku.
      await ai.handleMoodDetected({
        mood: mood.mood,
        confidence,
        emoji: mood.emoji,
        color: mood.color,
        genre: mood.genre,
        source,
      }, true);
    } else {
      // Brak orchestratora AI (fallback) — sami dobierz i zagraj utwory z kategorii.
      await playCategoryFallback(mood);
    }

    toast.success(`${mood.emoji} Nastrój: ${mood.mood} → gatunek: ${mood.genre}${source === "webcam" ? ` (${confidence}%)` : ""}`);

    if (source === "webcam" && emotions) {
      await fetchShrinkAnalysis(mood.mood, confidence, emotions);
      await claimBonus();
    }
  }, [ai, fetchShrinkAnalysis, claimBonus, playCategoryFallback]);

  // Capture a snapshot from the video element as JPEG base64
  const captureSnapshot = (video: HTMLVideoElement): string | null => {
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    if (!w || !h) return null;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.85);
  };

  const startCameraDetection = useCallback(async () => {
    setShrinkAnalysis(null);
    setBonusGranted(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });

      if (!videoRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      videoRef.current.srcObject = stream;
      streamRef.current = stream;
      setCameraActive(true);
      setIsAnalyzing(true);
      setAnalysisProgress(5);
      toast.info("📷 Kamera aktywna — analizuję emocje...");

      // Wait for video to be ready & playing
      await new Promise<void>((resolve) => {
        const v = videoRef.current!;
        if (v.readyState >= 3) return resolve();
        const onReady = () => {
          v.removeEventListener("loadeddata", onReady);
          resolve();
        };
        v.addEventListener("loadeddata", onReady);
      });

      // Give camera 800ms to autofocus & expose
      await new Promise(r => setTimeout(r, 800));
      setAnalysisProgress(20);

      stopProgressTimer();
      progressTimerRef.current = setInterval(() => {
        setAnalysisProgress(prev => (prev < 90 ? prev + 3 : prev));
      }, 200);

      // Capture snapshot
      const snapshot = captureSnapshot(videoRef.current);
      if (!snapshot) {
        throw new Error("Nie udało się przechwycić obrazu z kamery");
      }
      console.log("[mood-detector] snapshot captured, size:", snapshot.length);

      // Send to Lovable AI Vision
      const { data, error } = await supabase.functions.invoke("ai-vision-mood", {
        body: { imageBase64: snapshot },
      });

      stopProgressTimer();
      setAnalysisProgress(100);

      if (error) {
        console.error("[mood-detector] vision error:", error);
        toast.error(error.message || "Błąd analizy AI Vision");
        stopCamera();
        setTimeout(() => { setIsAnalyzing(false); setAnalysisProgress(0); }, 600);
        return;
      }

      console.log("[mood-detector] vision result:", data);

      if (data?.faceDetected) {
        const emotionKey = data.dominantEmotion;
        const matched = EMOTION_TO_MOOD[emotionKey] || EMOTION_TO_MOOD.neutral;
        try {
          await applyMood(matched, data.confidence || 90, "webcam", data.emotions);
        } catch (e) {
          console.error("[mood-detector] applyMood error:", e);
          toast.error("Wykryto nastrój, ale wystąpił błąd");
        }
      } else {
        toast.error("😕 Nie wykryto twarzy — popraw oświetlenie i ustaw się na wprost kamery");
      }

      stopCamera();
      setTimeout(() => {
        setIsAnalyzing(false);
        setAnalysisProgress(0);
      }, 600);
    } catch (error: any) {
      console.error("[mood-detector] camera error:", error);
      toast.error(error?.message || "Brak dostępu do kamery lub błąd analizy");
      stopCamera();
      setIsAnalyzing(false);
      setAnalysisProgress(0);
    }
  }, [applyMood, stopCamera]);

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
          <p className="text-[10px] text-muted-foreground">Pierwsza analiza = +10 $ na zarobki 🎁</p>
        </div>
        <Sparkles className="h-3 w-3 text-primary ml-auto animate-pulse" />
      </div>

      <Button
        onClick={cameraActive ? () => { stopCamera(); setIsAnalyzing(false); setAnalysisProgress(0); } : startCameraDetection}
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

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full rounded-lg ${cameraActive ? "block max-h-32 object-cover" : "hidden"}`}
      />

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

      <AnimatePresence>
        {activeMood && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
              <Eye className="h-3 w-3 text-primary shrink-0" />
              <span className="text-xs text-primary font-medium">
                Wykryty nastrój: <strong>{activeMood}</strong>
                {detectedConfidence !== null && (
                  <span className="text-muted-foreground"> ({detectedConfidence}%)</span>
                )}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {shrinkAnalysis && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 py-2.5 rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20">
              <div className="flex items-center gap-1.5 mb-1">
                <Brain className="h-3 w-3 text-purple-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">Muzyczny socjolog</span>
              </div>
              <p className="text-xs leading-relaxed text-foreground/90 italic">"{shrinkAnalysis}"</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bonusGranted && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
          >
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30">
              <Gift className="h-4 w-4 text-yellow-400" />
              <span className="text-xs font-bold text-yellow-200">
                +{bonusGranted} $ trafiło na Twoje zarobki!
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
        Powered by Lovable AI Vision · Kliknij 📷 lub wybierz nastrój ręcznie
      </p>
    </motion.div>
  );
};
