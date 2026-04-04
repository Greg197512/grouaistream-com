import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Brain, Calendar, TrendingUp, Music, Sparkles, 
  AlertCircle, CheckCircle2, RefreshCw, Play, 
  BarChart3, HeartPulse, Loader2, Lock, LineChart
} from "lucide-react";
import einsteinIcon from "@/assets/einstein-headphones-icon.png";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer } from "@/contexts/PlayerContext";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { generatePsychologistReport } from "@/utils/generatePsychologistReport";
import { MoodTrendChart } from "@/components/charts/MoodTrendChart";
import { FeatureGate } from "@/components/ui/FeatureGate";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface MoodSession {
  id: string;
  mood: string;
  confidence: number;
  source: string;
  detected_at: string;
}

interface MoodAnalysis {
  dominantMood: string;
  moodDistribution: Record<string, number>;
  averageConfidence: number;
  sessionsCount: number;
  patterns: string[];
  recommendations: {
    music: string[];
    frequencies: string[];
    symptoms: string[];
    advice: string[];
  };
  suggestedGenres: string[];
  healingFrequencies: { hz: number; purpose: string }[];
}

const moodColors: Record<string, string> = {
  Happy: "from-yellow-400 to-orange-500",
  Melancholic: "from-blue-400 to-indigo-500",
  Intense: "from-red-500 to-orange-600",
  Anxious: "from-purple-400 to-pink-500",
  Rebellious: "from-green-500 to-teal-500",
  Excited: "from-pink-400 to-rose-500",
  Relaxed: "from-cyan-400 to-blue-500",
  Energetic: "from-orange-400 to-red-500",
  Romantic: "from-pink-300 to-rose-400",
  Focused: "from-indigo-400 to-purple-500",
};

const moodEmojis: Record<string, string> = {
  Happy: "😊",
  Melancholic: "😢",
  Intense: "😤",
  Anxious: "😰",
  Rebellious: "😒",
  Excited: "😮",
  Relaxed: "😌",
  Energetic: "⚡",
  Romantic: "💕",
  Focused: "🎯",
};

const moodGenres: Record<string, string[]> = {
  Happy: ["Pop", "Dance", "Funk"],
  Melancholic: ["R&B", "Soul", "Acoustic"],
  Intense: ["Rock", "Metal", "Punk"],
  Anxious: ["Ambient", "Trance", "Chillout"],
  Rebellious: ["Punk", "Rock", "Alternative"],
  Excited: ["EDM", "House", "Pop"],
  Relaxed: ["Lounge", "Jazz", "Acoustic"],
  Energetic: ["EDM", "Hip-Hop", "Dance"],
  Romantic: ["R&B", "Soul", "Ballads"],
  Focused: ["House", "Lo-Fi", "Instrumental"],
};

const healingFrequencies: Record<string, { hz: number; purpose: string }[]> = {
  Anxious: [
    { hz: 396, purpose: "Uwalnianie strachu i lęku" },
    { hz: 528, purpose: "Transformacja i naprawa DNA" },
    { hz: 639, purpose: "Harmonizacja relacji" },
  ],
  Melancholic: [
    { hz: 417, purpose: "Zmiana i uwalnianie przeszłości" },
    { hz: 528, purpose: "Miłość i uzdrawianie" },
    { hz: 852, purpose: "Powrót do duchowego ładu" },
  ],
  Intense: [
    { hz: 741, purpose: "Rozwiązywanie problemów" },
    { hz: 639, purpose: "Łączenie i harmonizacja" },
    { hz: 396, purpose: "Uwalnianie negatywnej energii" },
  ],
  Happy: [
    { hz: 528, purpose: "Częstotliwość miłości" },
    { hz: 963, purpose: "Aktywacja szyszynki" },
    { hz: 852, purpose: "Przebudzenie intuicji" },
  ],
  Relaxed: [
    { hz: 432, purpose: "Naturalna harmonia wszechświata" },
    { hz: 528, purpose: "Regeneracja i spokój" },
    { hz: 639, purpose: "Balans emocjonalny" },
  ],
  default: [
    { hz: 432, purpose: "Uniwersalna harmonia" },
    { hz: 528, purpose: "Częstotliwość uzdrawiająca" },
  ],
};

export default function MoodHistory() {
  const { user } = useAuth();
  const { playPlaylist } = usePlayer();
  const navigate = useNavigate();
  
  
  const [selectedDays, setSelectedDays] = useState<2 | 4 | 6>(2);
  const [moodSessions, setMoodSessions] = useState<MoodSession[]>([]);
  const [analysis, setAnalysis] = useState<MoodAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recommendedTracks, setRecommendedTracks] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchMoodHistory();
    }
  }, [user, selectedDays]);

  const fetchMoodHistory = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - selectedDays);

      const { data, error } = await supabase
        .from("mood_sessions")
        .select("*")
        .eq("user_id", user.id)
        .gte("detected_at", daysAgo.toISOString())
        .order("detected_at", { ascending: false });

      if (error) throw error;
      
      setMoodSessions(data || []);
      
      if (data && data.length > 0) {
        analyzeHistory(data);
      } else {
        setAnalysis(null);
        setRecommendedTracks([]);
      }
    } catch (error) {
      console.error("Error fetching mood history:", error);
      toast.error("Błąd podczas pobierania historii nastrojów");
    } finally {
      setIsLoading(false);
    }
  };

  const analyzeHistory = async (sessions: MoodSession[]) => {
    setIsAnalyzing(true);
    
    try {
      // Calculate mood distribution
      const moodCounts: Record<string, number> = {};
      let totalConfidence = 0;
      
      sessions.forEach(session => {
        moodCounts[session.mood] = (moodCounts[session.mood] || 0) + 1;
        totalConfidence += session.confidence;
      });

      // Find dominant mood
      const dominantMood = Object.entries(moodCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || "Relaxed";

      // Detect patterns
      const patterns: string[] = [];
      const moodPercentages = Object.entries(moodCounts).map(([mood, count]) => ({
        mood,
        percentage: Math.round((count / sessions.length) * 100),
      }));

      // Pattern detection
      const anxiousPercentage = moodPercentages.find(m => m.mood === "Anxious")?.percentage || 0;
      const melancholicPercentage = moodPercentages.find(m => m.mood === "Melancholic")?.percentage || 0;
      const happyPercentage = moodPercentages.find(m => m.mood === "Happy")?.percentage || 0;
      const intensePercentage = moodPercentages.find(m => m.mood === "Intense")?.percentage || 0;

      if (anxiousPercentage > 30) {
        patterns.push("🔴 Wykryto podwyższony poziom stresu/lęku");
      }
      if (melancholicPercentage > 40) {
        patterns.push("🔵 Przewaga nastrojów melancholijnych");
      }
      if (happyPercentage > 50) {
        patterns.push("🟢 Dominująca pozytywna energia!");
      }
      if (intensePercentage > 30) {
        patterns.push("🟠 Wysoki poziom intensywności emocjonalnej");
      }
      if (sessions.length < 3) {
        patterns.push("ℹ️ Za mało danych dla pełnej analizy - kontynuuj skanowanie");
      }

      // Generate recommendations based on patterns
      const recommendations = generateRecommendations(dominantMood, moodPercentages);
      
      // Get suggested genres
      const suggestedGenres = moodGenres[dominantMood] || ["Pop", "House"];
      
      // Get healing frequencies
      const frequencies = healingFrequencies[dominantMood] || healingFrequencies.default;

      const analysisResult: MoodAnalysis = {
        dominantMood,
        moodDistribution: moodCounts,
        averageConfidence: Math.round(totalConfidence / sessions.length),
        sessionsCount: sessions.length,
        patterns,
        recommendations,
        suggestedGenres,
        healingFrequencies: frequencies,
      };

      setAnalysis(analysisResult);
      
      // Fetch recommended tracks
      await fetchRecommendedTracks(suggestedGenres, dominantMood);
      
    } catch (error) {
      console.error("Analysis error:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateRecommendations = (
    dominantMood: string, 
    moodPercentages: { mood: string; percentage: number }[]
  ) => {
    const recommendations = {
      music: [] as string[],
      frequencies: [] as string[],
      symptoms: [] as string[],
      advice: [] as string[],
    };

    const anxious = moodPercentages.find(m => m.mood === "Anxious")?.percentage || 0;
    const melancholic = moodPercentages.find(m => m.mood === "Melancholic")?.percentage || 0;
    const intense = moodPercentages.find(m => m.mood === "Intense")?.percentage || 0;

    // Music recommendations
    recommendations.music.push(`Słuchaj ${moodGenres[dominantMood]?.join(", ") || "różnorodnej muzyki"}`);
    if (anxious > 20) {
      recommendations.music.push("Muzyka ambient i nature sounds dla relaksu");
    }
    if (melancholic > 30) {
      recommendations.music.push("Pozytywna muzyka instrumentalna dla poprawy nastroju");
    }

    // Frequency recommendations
    const freqs = healingFrequencies[dominantMood] || healingFrequencies.default;
    freqs.forEach(f => {
      recommendations.frequencies.push(`${f.hz} Hz - ${f.purpose}`);
    });

    // Symptom detection
    if (anxious > 40) {
      recommendations.symptoms.push("Możliwy chroniczny stres - rozważ techniki relaksacyjne");
    }
    if (melancholic > 50) {
      recommendations.symptoms.push("Tendencja do obniżonego nastroju - dbaj o aktywność");
    }
    if (intense > 40) {
      recommendations.symptoms.push("Wysoka emocjonalność - ćwiczenia oddechowe mogą pomóc");
    }

    // General advice
    recommendations.advice.push("Kontynuuj codzienne skanowanie dla lepszej analizy");
    recommendations.advice.push("Słuchaj muzyki dopasowanej do nastroju przez 20-30 min dziennie");
    if (anxious > 20 || melancholic > 20) {
      recommendations.advice.push("Rozważ medytację z częstotliwościami uzdrawiającymi");
    }

    return recommendations;
  };

  const fetchRecommendedTracks = async (genres: string[], mood: string) => {
    try {
      const genreFilter = genres.map(g => `genre.ilike.%${g}%`).join(",");
      
      const { data: tracks } = await supabase
        .from("tracks")
        .select("*")
        .or(`${genreFilter},mood.ilike.%${mood}%`)
        .limit(20);

      if (tracks && tracks.length > 0) {
        const filtered = filterTracks(tracks);
        const shuffled = [...filtered].sort(() => Math.random() - 0.5);
        setRecommendedTracks(shuffled);
      } else {
        const { data: fallback } = await supabase
          .from("tracks")
          .select("*")
          .limit(15);
        setRecommendedTracks(filterTracks(fallback || []));
      }
    } catch (error) {
      console.error("Error fetching tracks:", error);
    }
  };

  const playRecommendedMusic = () => {
    if (recommendedTracks.length > 0) {
      playPlaylist(recommendedTracks);
      toast.success(`🎵 Odtwarzam ${recommendedTracks.length} utworów dopasowanych do Twojego profilu!`);
    }
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="max-w-md w-full groove-card">
            <CardContent className="flex flex-col items-center gap-4 p-8">
              <Lock className="h-16 w-16 text-muted-foreground" />
              <h2 className="text-xl font-bold text-center">Wymagane logowanie</h2>
              <p className="text-muted-foreground text-center">
                Zaloguj się, aby zobaczyć historię nastrojów i analizę AI
              </p>
              <Button onClick={() => navigate("/auth")} className="groove-gradient-bg">
                Zaloguj się
              </Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-screen p-4 md:p-8 pb-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-6xl mx-auto space-y-6"
        >
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl groove-gradient-bg flex items-center justify-center">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-display font-bold">Historia Nastrojów</h1>
                <p className="text-muted-foreground text-sm">Analiza AI Twojego samopoczucia</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Tabs value={String(selectedDays)} onValueChange={(v) => setSelectedDays(Number(v) as 2 | 4 | 6)}>
                <TabsList className="groove-card">
                  <TabsTrigger value="2" className="data-[state=active]:groove-gradient-bg text-xs md:text-sm">
                    <Calendar className="h-3 w-3 md:h-4 md:w-4 mr-1" /> 2 dni
                  </TabsTrigger>
                  <TabsTrigger value="4" className="data-[state=active]:groove-gradient-bg text-xs md:text-sm">
                    <Calendar className="h-3 w-3 md:h-4 md:w-4 mr-1" /> 4 dni
                  </TabsTrigger>
                  <TabsTrigger value="6" className="data-[state=active]:groove-gradient-bg text-xs md:text-sm">
                    <Calendar className="h-3 w-3 md:h-4 md:w-4 mr-1" /> 6 dni
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              
              {analysis && (
                <FeatureGate requiredPlan="ultimate" featureName="AI Psychologist Reports" mode="hide" fallback={
                  <Button 
                    onClick={() => {}}
                    className="bg-background hover:bg-muted border-2 border-muted p-1 opacity-50"
                    size="sm"
                    title="Ultimate plan required"
                  >
                    <Lock className="h-5 w-5 text-muted-foreground" />
                  </Button>
                }>
                  <Button 
                    onClick={async () => {
                      toast.loading("🧠 AI analizuje stan emocjonalny...", { id: "ai-report" });
                      try {
                        const { data, error } = await supabase.functions.invoke("ai-psychologist", {
                          body: {
                            analysis,
                            sessions: moodSessions,
                            selectedDays,
                            userName: user?.user_metadata?.display_name,
                          },
                        });
                        
                        if (error) throw error;
                        
                        generatePsychologistReport(
                          analysis, 
                          moodSessions, 
                          selectedDays, 
                          user?.user_metadata?.display_name,
                          data?.opinion
                        );
                        toast.success("📄 Pełna opinia psychologiczna AI została wygenerowana!", { id: "ai-report" });
                      } catch (err) {
                        console.error("AI report error:", err);
                        generatePsychologistReport(analysis, moodSessions, selectedDays, user?.user_metadata?.display_name);
                        toast.error("AI niedostępne - wygenerowano podstawowy raport", { id: "ai-report" });
                      }
                    }}
                    className="bg-background hover:bg-muted border-2 border-primary p-1"
                    size="sm"
                  >
                    <img src={einsteinIcon} alt="Psycholog AI" className="h-8 w-8 rounded-full object-cover" />
                  </Button>
                </FeatureGate>
              )}
              
              <Button 
                variant="outline" 
                size="icon"
                onClick={fetchMoodHistory}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          ) : moodSessions.length === 0 ? (
            <Card className="groove-card">
              <CardContent className="flex flex-col items-center gap-4 p-12">
                <Brain className="h-16 w-16 text-muted-foreground" />
                <h2 className="text-xl font-bold text-center">Brak danych o nastroju</h2>
                <p className="text-muted-foreground text-center max-w-md">
                  Użyj funkcji skanowania nastroju na stronie głównej, 
                  aby rozpocząć zbieranie danych o swoim samopoczuciu.
                </p>
                <Button onClick={() => navigate("/")} className="groove-gradient-bg mt-2">
                  <Sparkles className="h-4 w-4 mr-2" /> Rozpocznij skanowanie
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Analysis Results */}
              {analysis && (
                <AnimatePresence mode="wait">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-4"
                  >
                    {/* Dominant Mood Card */}
                    <Card className={`groove-card overflow-hidden`}>
                      <div className={`h-2 bg-gradient-to-r ${moodColors[analysis.dominantMood] || moodColors.Relaxed}`} />
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">
                          Dominujący nastrój
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex items-center gap-3">
                        <span className="text-4xl">{moodEmojis[analysis.dominantMood] || "😌"}</span>
                        <div>
                          <p className="text-2xl font-bold">{analysis.dominantMood}</p>
                          <p className="text-sm text-muted-foreground">
                            {analysis.sessionsCount} skanów
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Confidence Card */}
                    <Card className="groove-card">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" /> Średnia pewność
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-end gap-2">
                          <span className="text-3xl font-bold">{analysis.averageConfidence}%</span>
                        </div>
                        <Progress value={analysis.averageConfidence} className="mt-2" />
                      </CardContent>
                    </Card>

                    {/* Quick Action Card */}
                    <Card className="groove-card">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                          <Music className="h-4 w-4" /> Rekomendowana muzyka
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Button 
                          onClick={playRecommendedMusic}
                          className="w-full groove-gradient-bg"
                          disabled={recommendedTracks.length === 0}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Odtwórz {recommendedTracks.length} utworów
                        </Button>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {analysis.suggestedGenres.map(genre => (
                            <Badge key={genre} variant="secondary" className="text-xs">
                              {genre}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Mood Trend Chart */}
                  <Card className="groove-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2">
                        <LineChart className="h-5 w-5 text-primary" />
                        Trend nastrojów w czasie
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <MoodTrendChart sessions={moodSessions} height={280} />
                    </CardContent>
                  </Card>

                  {/* Mood Distribution */}
                  <Card className="groove-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        Rozkład nastrojów
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                        {Object.entries(analysis.moodDistribution).map(([mood, count]) => {
                          const percentage = Math.round((count / analysis.sessionsCount) * 100);
                          return (
                            <motion.div
                              key={mood}
                              initial={{ scale: 0.9, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className={`p-2 sm:p-3 rounded-lg bg-gradient-to-br ${moodColors[mood] || moodColors.Relaxed} text-white min-w-0`}
                            >
                              <div className="flex items-center gap-1 sm:gap-2 mb-1">
                                <span className="text-base sm:text-xl flex-shrink-0">{moodEmojis[mood] || "😌"}</span>
                                <span className="font-medium text-xs sm:text-sm truncate">{mood}</span>
                              </div>
                              <div className="text-lg sm:text-2xl font-bold">{percentage}%</div>
                              <div className="text-[10px] sm:text-xs opacity-80">{count} skanów</div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Patterns & Recommendations */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Patterns */}
                    <Card className="groove-card">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <HeartPulse className="h-5 w-5 text-primary" />
                          Wykryte wzorce
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {analysis.patterns.length > 0 ? (
                          analysis.patterns.map((pattern, i) => (
                            <motion.div
                              key={i}
                              initial={{ x: -20, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              transition={{ delay: i * 0.1 }}
                              className="p-3 rounded-lg bg-secondary/50"
                            >
                              {pattern}
                            </motion.div>
                          ))
                        ) : (
                          <p className="text-muted-foreground">
                            Zbierz więcej danych dla wykrycia wzorców
                          </p>
                        )}

                        {analysis.recommendations.symptoms.length > 0 && (
                          <div className="pt-4 border-t border-border">
                            <h4 className="font-semibold mb-2 flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-yellow-500" />
                              Możliwe symptomy
                            </h4>
                            {analysis.recommendations.symptoms.map((symptom, i) => (
                              <p key={i} className="text-sm text-muted-foreground mb-1">
                                • {symptom}
                              </p>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Recommendations */}
                    <Card className="groove-card">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-primary" />
                          Zalecenia AI
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <Music className="h-4 w-4" /> Muzyka
                          </h4>
                          {analysis.recommendations.music.map((rec, i) => (
                            <div key={i} className="flex items-start gap-2 mb-1">
                              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                              <span className="text-sm">{rec}</span>
                            </div>
                          ))}
                        </div>

                        <div>
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <HeartPulse className="h-4 w-4" /> Częstotliwości uzdrawiające
                          </h4>
                          {analysis.healingFrequencies.map((freq, i) => (
                            <div key={i} className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">
                                {freq.hz} Hz
                              </Badge>
                              <span className="text-sm text-muted-foreground">{freq.purpose}</span>
                            </div>
                          ))}
                        </div>

                        <div className="pt-2 border-t border-border">
                          <h4 className="font-semibold mb-2">Porady</h4>
                          {analysis.recommendations.advice.map((advice, i) => (
                            <p key={i} className="text-sm text-muted-foreground mb-1">
                              💡 {advice}
                            </p>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Recommended Tracks */}
                  {recommendedTracks.length > 0 && (
                    <Card className="groove-card">
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <Music className="h-5 w-5 text-primary" />
                          Utwory dopasowane do profilu
                        </CardTitle>
                        <Button onClick={playRecommendedMusic} size="sm" className="groove-gradient-bg">
                          <Play className="h-4 w-4 mr-1" /> Odtwórz wszystkie
                        </Button>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                          {recommendedTracks.slice(0, 10).map((track) => (
                            <motion.div
                              key={track.id}
                              whileHover={{ scale: 1.03 }}
                              className="group cursor-pointer"
                              onClick={() => playPlaylist([track, ...recommendedTracks.filter(t => t.id !== track.id)])}
                            >
                              <div className="relative aspect-square rounded-lg overflow-hidden mb-2">
                                <img
                                  src={track.cover_url || "/placeholder.svg"}
                                  alt={track.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Play className="h-8 w-8 text-white" />
                                </div>
                              </div>
                              <p className="text-sm font-medium truncate">{track.title}</p>
                              <div className="flex items-center gap-1"><p className="text-xs text-muted-foreground truncate">{track.artist}</p><span className="text-[7px] font-bold text-primary/70 whitespace-nowrap">Grouarock®</span></div>
                            </motion.div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Session History */}
                  <Card className="groove-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        Historia skanów ({moodSessions.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {moodSessions.map((session) => {
                          const date = new Date(session.detected_at);
                          return (
                            <div
                              key={session.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">{moodEmojis[session.mood] || "😌"}</span>
                                <div>
                                  <p className="font-medium">{session.mood}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {date.toLocaleDateString("pl-PL")} o {date.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
                                  </p>
                                </div>
                              </div>
                              <Badge 
                                variant="secondary"
                                className={`bg-gradient-to-r ${moodColors[session.mood] || moodColors.Relaxed} text-white border-0`}
                              >
                                {session.confidence}%
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </AnimatePresence>
              )}
            </>
          )}
        </motion.div>
      </div>
    </MainLayout>
  );
}
