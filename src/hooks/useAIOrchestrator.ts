import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface DetectedMood {
  mood: string;
  confidence: number;
  emoji: string;
  color: string;
  genre: string;
  source: "webcam" | "voice" | "history" | "manual";
}

export interface AIRecommendation {
  playlistName: string;
  description: string;
  explanation: string;
  suggestedGenres: string[];
  energyLevel: "low" | "medium" | "high";
  tempo: "slow" | "medium" | "fast";
}

interface ListeningStats {
  topGenres: string[];
  topMoods: string[];
  recentTracks: number;
  averageEnergy: string;
}

export const useAIOrchestrator = () => {
  const { playPlaylist } = usePlayer();
  const { user } = useAuth();
  
  const [currentMood, setCurrentMood] = useState<DetectedMood | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [listeningStats, setListeningStats] = useState<ListeningStats | null>(null);
  const [lastRecommendation, setLastRecommendation] = useState<AIRecommendation | null>(null);

  // Fetch listening history stats on mount
  useEffect(() => {
    if (user) {
      fetchListeningStats();
    }
  }, [user]);

  const fetchListeningStats = async () => {
    if (!user) return null;

    try {
      // Get recent listening history
      const { data: history } = await supabase
        .from("listening_history")
        .select("track_id, mood_detected, tracks(genre, mood)")
        .eq("user_id", user.id)
        .order("played_at", { ascending: false })
        .limit(50);

      if (!history || history.length === 0) {
        return null;
      }

      // Analyze genres and moods
      const genres: Record<string, number> = {};
      const moods: Record<string, number> = {};

      history.forEach((h) => {
        const track = h.tracks as { genre: string | null; mood: string | null } | null;
        if (track?.genre) {
          genres[track.genre] = (genres[track.genre] || 0) + 1;
        }
        if (track?.mood || h.mood_detected) {
          const mood = track?.mood || h.mood_detected;
          if (mood) {
            moods[mood] = (moods[mood] || 0) + 1;
          }
        }
      });

      const topGenres = Object.entries(genres)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([g]) => g);

      const topMoods = Object.entries(moods)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([m]) => m);

      const stats: ListeningStats = {
        topGenres,
        topMoods,
        recentTracks: history.length,
        averageEnergy: topGenres.includes("Rock") || topGenres.includes("Punk") ? "high" : "medium",
      };

      setListeningStats(stats);
      return stats;
    } catch (error) {
      console.error("Failed to fetch listening stats:", error);
      return null;
    }
  };

  // Generate AI playlist based on mood and history
  const generateAIPlaylist = useCallback(async (
    mood?: string,
    genre?: string,
    context?: string
  ): Promise<Track[]> => {
    setIsProcessing(true);

    try {
      const stats = listeningStats || await fetchListeningStats();
      
      // Build context for AI
      const aiContext = [
        context || "",
        stats ? `User's top genres: ${stats.topGenres.join(", ")}` : "",
        stats ? `User's recent moods: ${stats.topMoods.join(", ")}` : "",
        currentMood ? `Currently detected mood: ${currentMood.mood} (${currentMood.confidence}% confidence)` : "",
      ].filter(Boolean).join(". ");

      // Call AI edge function
      const { data: aiData, error: aiError } = await supabase.functions.invoke("ai-playlist", {
        body: {
          action: "generate_playlist",
          mood: mood || currentMood?.mood || "relaxed",
          genre: genre || stats?.topGenres[0] || "Pop",
          context: aiContext,
        },
      });

      if (aiError) {
        console.error("AI error:", aiError);
      } else if (aiData?.data) {
        setLastRecommendation(aiData.data as AIRecommendation);
      }

      // Fetch matching tracks
      const targetMood = mood || currentMood?.mood || "relaxed";
      const targetGenre = genre || stats?.topGenres[0] || "Pop";

      const { data: tracks, error } = await supabase
        .from("tracks")
        .select("*")
        .or(`genre.ilike.%${targetGenre}%,mood.ilike.%${targetMood}%`)
        .limit(25);

      if (error) throw error;

      if (tracks && tracks.length > 0) {
        // Shuffle for variety
        const shuffled = [...tracks].sort(() => Math.random() - 0.5);
        return shuffled;
      }

      // Fallback to random tracks
      const { data: fallback } = await supabase
        .from("tracks")
        .select("*")
        .limit(20);

      return fallback ? [...fallback].sort(() => Math.random() - 0.5) : [];
    } catch (error) {
      console.error("AI playlist generation failed:", error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [currentMood, listeningStats]);

  // Handle mood detection and auto-play
  const handleMoodDetected = useCallback(async (mood: DetectedMood, autoPlay = true) => {
    setCurrentMood(mood);

    // Save to database if user is logged in
    if (user) {
      try {
        await supabase.from("mood_sessions").insert({
          user_id: user.id,
          mood: mood.mood,
          confidence: mood.confidence,
          source: mood.source,
        });
      } catch (error) {
        console.error("Failed to save mood:", error);
      }
    }

    // Auto-generate and play playlist
    if (autoPlay) {
      toast.loading(`🎭 AI analyzing mood: ${mood.mood}...`, { id: "mood-playlist" });

      try {
        const tracks = await generateAIPlaylist(mood.mood, mood.genre);
        
        if (tracks.length > 0) {
          playPlaylist(tracks);
          toast.success(
            `🎵 Playing ${mood.genre} for your ${mood.mood} mood! ${tracks.length} tracks`,
            { id: "mood-playlist", duration: 4000 }
          );
        } else {
          toast.error("No tracks found for this mood", { id: "mood-playlist" });
        }
      } catch (error) {
        toast.error("Failed to generate mood playlist", { id: "mood-playlist" });
      }
    }
  }, [user, generateAIPlaylist, playPlaylist]);

  // Process voice command with AI enhancement
  const processVoiceCommand = useCallback(async (command: string): Promise<{
    action: string;
    genre?: string;
    mood?: string;
    tracks?: Track[];
  }> => {
    setIsProcessing(true);

    try {
      // Call AI for real-time adaptation
      const { data: aiResponse } = await supabase.functions.invoke("ai-playlist", {
        body: {
          action: "analyze_mood",
          context: `User voice command: "${command}". ${listeningStats ? `User typically listens to: ${listeningStats.topGenres.join(", ")}` : ""}`,
        },
      });

      const detectedMood = aiResponse?.data?.detectedMood || "neutral";
      const suggestedGenre = aiResponse?.data?.musicRecommendation || "Pop";

      // Parse command for explicit genre requests
      let targetGenre = suggestedGenre;
      if (command.includes("rock")) targetGenre = "Rock";
      else if (command.includes("punk")) targetGenre = "Punk";
      else if (command.includes("pop")) targetGenre = "Pop";

      // Determine action
      let action = "play";
      if (command.includes("pause") || command.includes("stop")) action = "pause";
      else if (command.includes("next") || command.includes("skip")) action = "next";
      else if (command.includes("previous") || command.includes("back")) action = "previous";
      else if (command.includes("volume")) action = "volume";

      if (action === "play") {
        const tracks = await generateAIPlaylist(detectedMood, targetGenre, `Voice command: ${command}`);
        return { action, genre: targetGenre, mood: detectedMood, tracks };
      }

      return { action, genre: targetGenre, mood: detectedMood };
    } catch (error) {
      console.error("Voice command processing failed:", error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [listeningStats, generateAIPlaylist]);

  // Real-time adaptation based on user behavior
  const adaptToUserBehavior = useCallback(async (signal: {
    type: "skip" | "repeat" | "volume_change" | "seek";
    value?: number;
  }) => {
    if (!user) return;

    try {
      const { data } = await supabase.functions.invoke("ai-playlist", {
        body: {
          action: "real_time_adaptation",
          context: `User signal: ${signal.type}${signal.value !== undefined ? ` (value: ${signal.value})` : ""}. Current mood: ${currentMood?.mood || "unknown"}. Preferred genres: ${listeningStats?.topGenres.join(", ") || "various"}`,
        },
      });

      if (data?.data?.action === "change_mood") {
        toast.info(`🤖 AI noticed you ${signal.type === "skip" ? "skipped" : "repeated"} - adjusting recommendations...`);
      }
    } catch (error) {
      console.error("Adaptation error:", error);
    }
  }, [user, currentMood, listeningStats]);

  return {
    currentMood,
    setCurrentMood,
    isProcessing,
    listeningStats,
    lastRecommendation,
    generateAIPlaylist,
    handleMoodDetected,
    processVoiceCommand,
    adaptToUserBehavior,
    fetchListeningStats,
  };
};
