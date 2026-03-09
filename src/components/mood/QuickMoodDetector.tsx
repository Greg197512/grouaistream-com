import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { Camera, CameraOff, X, GripHorizontal, Sparkles, Loader2, Brain, AlertCircle, Heart, Shield, Music, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAI } from "@/contexts/AIContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { supabase } from "@/integrations/supabase/client";
import { DetectedMood } from "@/hooks/useAIOrchestrator";
import { useFaceDetection } from "@/hooks/useFaceDetection";
import { useLanguage } from "@/contexts/LanguageContext";

interface MoodResult {
  mood: string;
  confidence: number;
  emoji: string;
  color: string;
  genre: string;
  dayDescription: string;
}

interface DeepAnalysis {
  diagnosis: string;
  emotionalState: string;
  microExpressions: string;
  psychologicalInsight: string;
  riskLevel: string;
  riskNote: string;
  therapeuticAdvice: string;
  musicTherapy: string;
  moodBoostStrategy?: string;
  healingFrequency: string;
  personalMessage: string;
  suggestedGenres: string[];
  suggestedMoods: string[];
  targetEmotion?: string;
}

interface QuickMoodDetectorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickMoodDetector = ({ isOpen, onClose }: QuickMoodDetectorProps) => {
  const { handleMoodDetected: aiHandleMood } = useAI();
  const { playPlaylist } = usePlayer();
  const { isModelLoaded, isLoadingModel, modelError, loadModels, detectWithSampling } = useFaceDetection();
  const { t, language } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDeepAnalyzing, setIsDeepAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStep, setAnalysisStep] = useState<string>("");
  const [currentMood, setCurrentMood] = useState<MoodResult | null>(null);
  const [deepAnalysis, setDeepAnalysis] = useState<DeepAnalysis | null>(null);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [noFaceDetected, setNoFaceDetected] = useState(false);
  const [tracksPlaying, setTracksPlaying] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const dragControls = useDragControls();
  const [detectedEmotion, setDetectedEmotion] = useState<string>("");

  // Build mood mapping using translations
  const getMoodMapping = useCallback((): Record<string, MoodResult> => ({
    happy: { mood: t("moodDet.happy"), confidence: 0, emoji: "😊", color: "from-yellow-400 to-orange-500", genre: "Pop", dayDescription: t("moodDet.happyDesc") },
    sad: { mood: t("moodDet.melancholic"), confidence: 0, emoji: "😢", color: "from-blue-400 to-indigo-500", genre: "R&B", dayDescription: t("moodDet.sadDesc") },
    angry: { mood: t("moodDet.intense"), confidence: 0, emoji: "😤", color: "from-red-500 to-orange-600", genre: "Rock", dayDescription: t("moodDet.angryDesc") },
    fearful: { mood: t("moodDet.anxious"), confidence: 0, emoji: "😰", color: "from-purple-400 to-pink-500", genre: "Trance", dayDescription: t("moodDet.fearfulDesc") },
    disgusted: { mood: t("moodDet.rebellious"), confidence: 0, emoji: "😒", color: "from-green-500 to-teal-500", genre: "Punk", dayDescription: t("moodDet.disgustedDesc") },
    surprised: { mood: t("moodDet.excited"), confidence: 0, emoji: "😮", color: "from-pink-400 to-rose-500", genre: "EDM", dayDescription: t("moodDet.surprisedDesc") },
    neutral: { mood: t("moodDet.relaxed"), confidence: 0, emoji: "😌", color: "from-cyan-400 to-blue-500", genre: "House", dayDescription: t("moodDet.neutralDesc") },
    energetic: { mood: t("moodDet.energetic"), confidence: 0, emoji: "⚡", color: "from-orange-400 to-red-500", genre: "EDM", dayDescription: t("moodDet.energeticDesc") },
    romantic: { mood: t("moodDet.romantic"), confidence: 0, emoji: "💕", color: "from-pink-300 to-rose-400", genre: "R&B", dayDescription: t("moodDet.romanticDesc") },
    focused: { mood: t("moodDet.focused"), confidence: 0, emoji: "🎯", color: "from-indigo-400 to-purple-500", genre: "House", dayDescription: t("moodDet.focusedDesc") },
  }), [t]);

  useEffect(() => {
    if (isOpen && !isModelLoaded && !isLoadingModel) {
      loadModels();
    }
  }, [isOpen, isModelLoaded, isLoadingModel, loadModels]);

  const fetchDeepAnalysis = useCallback(async (mood: MoodResult, emotion: string) => {
    setIsDeepAnalyzing(true);
    setAnalysisStep(t("moodDet.professorAnalyzing"));
    
    try {
      const { data, error } = await supabase.functions.invoke("ai-mood-analysis", {
        body: {
          mood: mood.mood,
          confidence: mood.confidence,
          emotion: emotion,
          userName: "Patient",
          language: language,
        },
      });

      if (error) throw error;

      if (data?.analysis) {
        setDeepAnalysis(data.analysis);
        return data.analysis as DeepAnalysis;
      }
    } catch (error) {
      console.error("Deep analysis error:", error);
      toast.error(t("moodDet.analysisError"));
    } finally {
      setIsDeepAnalyzing(false);
    }
    return null;
  }, [language, t]);

  // Mood-boosting genre mapping
  const moodBoostGenres: Record<string, string[]> = {
    sad: ["Pop", "Dance", "Funk", "EDM", "Reggae"],
    angry: ["Chill", "R&B", "Soul", "Jazz", "Ambient"],
    fearful: ["Rock", "Hip-Hop", "Indie", "Pop", "Funk"],
    disgusted: ["Pop", "Dance", "Funk", "Electronic", "Reggae"],
    neutral: ["Electronic", "Dance", "Funk", "Pop", "EDM"],
    happy: ["Pop", "Dance", "Funk", "Reggae", "EDM"],
    surprised: ["Pop", "Electronic", "Dance", "Indie", "Funk"],
    energetic: ["EDM", "Rock", "Hip-Hop", "Dance", "Electronic"],
    romantic: ["R&B", "Pop", "Soul", "Jazz", "Chill"],
    focused: ["Electronic", "House", "Ambient", "Chill", "Lo-Fi"],
  };

  const playMoodPlaylist = useCallback(async (mood: MoodResult, analysis: DeepAnalysis | null) => {
    try {
      // First try AI-suggested genres, then boost map, then search ALL tracks
      const genres = analysis?.suggestedGenres?.length 
        ? analysis.suggestedGenres 
        : moodBoostGenres[detectedEmotion] || ["Pop", "Dance", "Funk"];
      
      const targetMoods = analysis?.suggestedMoods?.length
        ? analysis.suggestedMoods
        : ["Happy", "Energetic", "Excited"];
      
      // Build OR query for uplifting genres/moods
      const genreFilters = genres.map(g => `genre.ilike.%${g}%`).join(",");
      const moodFilters = targetMoods.map(m => `mood.ilike.%${m}%`).join(",");
      
      const { data: tracks, error } = await supabase
        .from("tracks")
        .select("*")
        .or(`${genreFilters},${moodFilters}`)
        .limit(50);

      if (error) throw error;

      let selectedTracks = tracks || [];
      
      // Fallback: if not enough tracks, get ALL tracks from the entire library
      if (selectedTracks.length < 5) {
        const { data: allTracks } = await supabase
          .from("tracks")
          .select("*")
          .limit(200);
        selectedTracks = allTracks || [];
      }

      if (selectedTracks.length > 0) {
        // Shuffle and take exactly 5
        const shuffled = [...selectedTracks].sort(() => Math.random() - 0.5).slice(0, 5);
        playPlaylist(shuffled);
        setTracksPlaying(true);

        const detectedMoodObj: DetectedMood = {
          mood: mood.mood,
          confidence: mood.confidence,
          emoji: mood.emoji,
          color: mood.color,
          genre: mood.genre,
          source: "webcam",
        };
        await aiHandleMood(detectedMoodObj, false);

        const boostMsg = analysis?.targetEmotion 
          ? `${t("moodDet.goalLabel")}: ${analysis.targetEmotion} — ${t("moodDet.boostGuarantee")}` 
          : t("moodDet.boostGuarantee");
        toast.success(`${mood.emoji} ${boostMsg} ${t("moodDet.playing5tracks")}!`);
      } else {
        toast.error(t("moodDet.noTracks"));
      }
    } catch (error) {
      console.error("Error playing mood playlist:", error);
      toast.error(t("moodDet.trackError"));
    }
  }, [playPlaylist, aiHandleMood, detectedEmotion, t]);

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
    setNoFaceDetected(false);
    setAnalysisStep("");
  }, []);

  const resetAll = useCallback(() => {
    stopCamera();
    setCurrentMood(null);
    setDeepAnalysis(null);
    setShowFullAnalysis(false);
    setTracksPlaying(false);
    setDetectedEmotion("");
  }, [stopCamera]);

  const startAnalysis = useCallback(async () => {
    if (!videoRef.current || !isModelLoaded) {
      toast.error(t("moodDet.loadingAI"));
      return;
    }

    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setNoFaceDetected(false);
    setAnalysisStep(t("moodDet.initTf"));

    let progress = 0;
    progressIntervalRef.current = setInterval(() => {
      progress += 1.5;
      setAnalysisProgress(Math.min(progress, 95));
      if (progress > 10 && progress < 30) setAnalysisStep(t("moodDet.detectingFace"));
      else if (progress > 30 && progress < 60) setAnalysisStep(t("moodDet.analyzingExpression"));
      else if (progress > 60 && progress < 85) setAnalysisStep(t("moodDet.recognizingEmotions"));
      else if (progress > 85) setAnalysisStep(t("moodDet.finalizing"));
    }, 75);

    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const result = await detectWithSampling(videoRef.current, 5, 800);

      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setAnalysisProgress(100);

      if (!result || !result.faceDetected) {
        setNoFaceDetected(true);
        setIsAnalyzing(false);
        toast.error(t("moodDet.noFace"));
        return;
      }

      const emotionKey = result.dominantEmotion;
      setDetectedEmotion(emotionKey);
      const moodMapping = getMoodMapping();
      const baseMood = moodMapping[emotionKey] || moodMapping.neutral;
      const detectedMood: MoodResult = { ...baseMood, confidence: result.confidence };

      setCurrentMood(detectedMood);
      setIsAnalyzing(false);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;

      const analysis = await fetchDeepAnalysis(detectedMood, emotionKey);
      await playMoodPlaylist(detectedMood, analysis);

    } catch (error) {
      console.error("Face detection error:", error);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setIsAnalyzing(false);
      toast.error(t("moodDet.faceError"));
    }
  }, [isModelLoaded, detectWithSampling, fetchDeepAnalysis, playMoodPlaylist, getMoodMapping, t]);

  const startCamera = async () => {
    setIsLoading(true);
    resetAll();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 320, height: 240 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setHasPermission(true);
        setIsActive(true);
        toast.success(t("moodDet.cameraActive"));
        startAnalysis();
      }
    } catch (error) {
      console.error("Camera access denied:", error);
      setHasPermission(false);
      toast.error(t("moodDet.noCameraAccess"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) resetAll();
    return () => resetAll();
  }, [isOpen, resetAll]);

  if (!isOpen) return null;

  const riskColor = deepAnalysis?.riskLevel === "wysoki" || deepAnalysis?.riskLevel === "high" || deepAnalysis?.riskLevel === "hoog" || deepAnalysis?.riskLevel === "високий"
    ? "text-red-400" 
    : deepAnalysis?.riskLevel === "średni" || deepAnalysis?.riskLevel === "medium" || deepAnalysis?.riskLevel === "gemiddeld" || deepAnalysis?.riskLevel === "середній"
    ? "text-yellow-400" 
    : "text-green-400";

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
          bottom: 0,
        }}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="fixed bottom-32 right-4 z-50 w-[340px] max-h-[80vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{
          background: "rgba(0, 0, 0, 0.4)",
          backdropFilter: "blur(40px) saturate(200%)",
          WebkitBackdropFilter: "blur(40px) saturate(200%)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
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
              <h3 className="text-sm font-semibold text-white">{t("moodDet.title")}</h3>
              <p className="text-[10px] text-white/50">
                {isDeepAnalyzing ? t("moodDet.deepAnalyzing") : isLoadingModel ? t("moodDet.loadingModels") : isModelLoaded ? t("moodDet.subtitle") : "face-api.js"}
              </p>
            </div>
          </div>
          <button
            onClick={() => { resetAll(); onClose(); }}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4 text-white/60" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Video / Detection Area */}
          {!deepAnalysis && !tracksPlaying && (
            <div className="relative aspect-video bg-black/50">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${isActive ? "block" : "hidden"}`}
              />

              {!isActive && !isLoadingModel && !currentMood && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <Brain className="h-10 w-10 text-white/30" />
                  <p className="text-xs text-white/40 text-center px-4">
                    {t("moodDet.aiDescription")}
                  </p>
                  {isModelLoaded && (
                    <span className="text-[10px] text-green-400/70 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 bg-green-400 rounded-full animate-pulse" />
                      {t("moodDet.tfReady")}
                    </span>
                  )}
                </div>
              )}

              {!isActive && isLoadingModel && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="h-10 w-10 text-primary animate-spin" />
                  <p className="text-xs text-white/60 text-center px-4">{t("moodDet.loadingModels")}</p>
                  <p className="text-[10px] text-white/40">{t("moodDet.loadingWait")}</p>
                </div>
              )}

              {isActive && isAnalyzing && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
                  <div className="relative">
                    <Brain className="h-12 w-12 text-primary" />
                    <motion.div className="absolute inset-0 border-2 border-primary rounded-full" animate={{ scale: [1, 1.3, 1], opacity: [1, 0, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
                  </div>
                  <p className="text-white font-medium text-sm mt-4">{analysisStep || t("moodDet.initTf")}</p>
                  <div className="w-48 h-2 bg-white/20 rounded-full mt-3 overflow-hidden">
                    <motion.div className="h-full bg-gradient-to-r from-primary to-accent" animate={{ width: `${analysisProgress}%` }} transition={{ duration: 0.1 }} />
                  </div>
                  <p className="text-white/60 text-xs mt-2">{Math.round(analysisProgress)}%</p>
                </motion.div>
              )}

              {isActive && noFaceDetected && !isAnalyzing && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
                  <AlertCircle className="h-12 w-12 text-yellow-400 mb-3" />
                  <p className="text-white font-medium text-sm">{t("moodDet.noFace")}</p>
                  <p className="text-white/60 text-xs text-center px-6 mt-1">{t("moodDet.noFaceHint")}</p>
                  <Button onClick={startAnalysis} size="sm" className="mt-3 groove-gradient-bg">{t("moodDet.tryAgain")}</Button>
                </motion.div>
              )}
            </div>
          )}

          {/* Deep Analysis Loading */}
          {isDeepAnalyzing && currentMood && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 flex flex-col items-center gap-3">
              <motion.span className="text-4xl" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                {currentMood.emoji}
              </motion.span>
              <p className="text-white font-bold">{currentMood.mood} — {currentMood.confidence}%</p>
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
                <p className="text-white/70 text-sm">{analysisStep}</p>
              </div>
              <div className="w-full space-y-1.5 mt-2">
                {[t("moodDet.microStep"), t("moodDet.diagStep"), t("moodDet.therapyStep"), t("moodDet.selectionStep")].map((step, i) => (
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.8 }}
                    className="flex items-center gap-2 text-white/50 text-xs"
                  >
                    <motion.div
                      className="h-1.5 w-1.5 rounded-full bg-primary"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.3 }}
                    />
                    {step}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Deep Analysis Results */}
          {deepAnalysis && currentMood && !isDeepAnalyzing && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-3 space-y-3">
              {/* Header with mood */}
              <div className={`p-3 rounded-xl bg-gradient-to-r ${currentMood.color} relative overflow-hidden`}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{currentMood.emoji}</span>
                  <div className="flex-1">
                    <p className="text-white font-bold text-lg">{currentMood.mood}</p>
                    <p className="text-white/80 text-xs">{currentMood.confidence}% {t("moodDet.confidence")}</p>
                  </div>
                  {tracksPlaying && (
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                      <Music className="h-5 w-5 text-white" />
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Diagnosis */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="h-4 w-4 text-primary" />
                  <h4 className="text-white font-semibold text-xs uppercase tracking-wider">{t("moodDet.diagnosisTitle")}</h4>
                </div>
                <p className="text-white/80 text-xs leading-relaxed">{deepAnalysis.diagnosis}</p>
              </div>

              {/* Emotional State */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="h-4 w-4 text-pink-400" />
                  <h4 className="text-white font-semibold text-xs uppercase tracking-wider">{t("moodDet.emotionalStateTitle")}</h4>
                </div>
                <p className="text-white/80 text-xs leading-relaxed">{deepAnalysis.emotionalState}</p>
              </div>

              {/* Risk Level */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-4 w-4 text-primary" />
                  <h4 className="text-white font-semibold text-xs uppercase tracking-wider">{t("moodDet.riskTitle")}</h4>
                  <span className={`ml-auto text-xs font-bold ${riskColor}`}>{deepAnalysis.riskLevel?.toUpperCase()}</span>
                </div>
                <p className="text-white/60 text-[11px]">{deepAnalysis.riskNote}</p>
              </div>

              {/* Expandable full analysis */}
              <button
                onClick={() => setShowFullAnalysis(!showFullAnalysis)}
                className="w-full flex items-center justify-center gap-1 text-primary text-xs py-1.5 hover:text-primary/80 transition-colors"
              >
                {showFullAnalysis ? t("moodDet.collapse") : t("moodDet.fullAnalysis")}
                {showFullAnalysis ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>

              <AnimatePresence>
                {showFullAnalysis && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3 overflow-hidden"
                  >
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <h4 className="text-white font-semibold text-xs uppercase tracking-wider mb-1">🔬 {t("moodDet.microExpressions")}</h4>
                      <p className="text-white/70 text-xs leading-relaxed">{deepAnalysis.microExpressions}</p>
                    </div>

                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <h4 className="text-white font-semibold text-xs uppercase tracking-wider mb-1">🧩 {t("moodDet.psychInsight")}</h4>
                      <p className="text-white/70 text-xs leading-relaxed">{deepAnalysis.psychologicalInsight}</p>
                    </div>

                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <h4 className="text-white font-semibold text-xs uppercase tracking-wider mb-1">💊 {t("moodDet.therapeuticAdvice")}</h4>
                      <p className="text-white/70 text-xs leading-relaxed">{deepAnalysis.therapeuticAdvice}</p>
                    </div>

                    <div className="p-3 rounded-xl bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/20">
                      <h4 className="text-white font-semibold text-xs uppercase tracking-wider mb-1">🎵 {t("moodDet.musicTherapy")}</h4>
                      <p className="text-white/70 text-xs leading-relaxed">{deepAnalysis.musicTherapy}</p>
                    </div>

                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <h4 className="text-white font-semibold text-xs uppercase tracking-wider mb-1">〰️ {t("moodDet.healingFreq")}</h4>
                      <p className="text-white/70 text-xs leading-relaxed">{deepAnalysis.healingFrequency}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Personal Message */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="p-3 rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20"
              >
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-white/80 text-xs italic leading-relaxed">{deepAnalysis.personalMessage}</p>
                </div>
              </motion.div>

              {tracksPlaying && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center text-primary text-xs flex items-center justify-center gap-1.5"
                >
                  <Music className="h-3 w-3" />
                  {t("moodDet.playing5tracks")}
                </motion.p>
              )}
            </motion.div>
          )}

          {/* Controls */}
          <div className="p-3 space-y-2">
            {!deepAnalysis && !isDeepAnalyzing && (
              <div className="flex gap-2">
                {!isActive && !currentMood ? (
                  <Button onClick={startCamera} disabled={isLoading || isLoadingModel} className="flex-1 h-10 groove-gradient-bg text-white hover:opacity-90">
                    {isLoading || isLoadingModel ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Brain className="h-4 w-4 mr-2" />}
                    {isLoadingModel ? t("moodDet.loadingAI") : isLoading ? t("moodDet.starting") : t("moodDet.analyzeBtn")}
                  </Button>
                ) : isActive && !currentMood ? (
                  <Button onClick={stopCamera} variant="destructive" className="flex-1 h-10" disabled={isAnalyzing}>
                    <CameraOff className="h-4 w-4 mr-2" />
                    {t("moodDet.cancel")}
                  </Button>
                ) : null}
              </div>
            )}

            {deepAnalysis && (
              <Button onClick={startCamera} disabled={isLoading || isLoadingModel} className="w-full h-10 groove-gradient-bg text-white hover:opacity-90">
                <Camera className="h-4 w-4 mr-2" />
                {t("moodDet.scanAgain")}
              </Button>
            )}

            {modelError && (
              <p className="text-[10px] text-yellow-400 text-center">{modelError}</p>
            )}

            {hasPermission === false && (
              <p className="text-[10px] text-destructive text-center">{t("moodDet.noCameraAccess")}</p>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
