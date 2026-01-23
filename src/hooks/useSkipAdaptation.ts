import { useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Track } from "@/contexts/PlayerContext";

interface SkipPattern {
  genre: string;
  mood: string;
  skipCount: number;
  lastSkipped: Date;
}

export const useSkipAdaptation = () => {
  const { user } = useAuth();
  const skipPatterns = useRef<Map<string, SkipPattern>>(new Map());
  const recentSkips = useRef<{ track: Track; timestamp: number; playDuration: number }[]>([]);
  const consecutiveSkips = useRef(0);

  // Clear old skip data periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      recentSkips.current = recentSkips.current.filter(
        (s) => now - s.timestamp < 5 * 60 * 1000 // Keep last 5 minutes
      );
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const recordSkip = useCallback(
    async (track: Track, playDuration: number, trackDuration: number) => {
      // Only count as skip if less than 30% played
      const skipThreshold = 0.3;
      const wasSkipped = playDuration / trackDuration < skipThreshold;

      if (!wasSkipped) {
        consecutiveSkips.current = 0;
        return { wasSkipped: false, shouldAdapt: false };
      }

      consecutiveSkips.current += 1;

      // Record skip pattern
      const key = `${track.genre || "unknown"}-${track.mood || "unknown"}`;
      const existing = skipPatterns.current.get(key) || {
        genre: track.genre || "unknown",
        mood: track.mood || "unknown",
        skipCount: 0,
        lastSkipped: new Date(),
      };
      existing.skipCount += 1;
      existing.lastSkipped = new Date();
      skipPatterns.current.set(key, existing);

      // Add to recent skips
      recentSkips.current.push({
        track,
        timestamp: Date.now(),
        playDuration,
      });

      // Log to database if user is authenticated
      if (user) {
        try {
          await supabase.from("listening_history").insert({
            user_id: user.id,
            track_id: track.id,
            duration_played: Math.round(playDuration),
            skipped: true,
            mood_detected: track.mood,
          });
        } catch (error) {
          console.error("Failed to log skip:", error);
        }
      }

      // Determine if we should adapt (3+ consecutive skips or pattern detected)
      const shouldAdapt = consecutiveSkips.current >= 3 || existing.skipCount >= 5;

      return { wasSkipped: true, shouldAdapt, consecutiveSkips: consecutiveSkips.current };
    },
    [user]
  );

  const getSkipAnalysis = useCallback(() => {
    const patterns = Array.from(skipPatterns.current.values());
    const mostSkipped = patterns.sort((a, b) => b.skipCount - a.skipCount);

    const avoidGenres = mostSkipped
      .filter((p) => p.skipCount >= 3)
      .map((p) => p.genre);

    const avoidMoods = mostSkipped
      .filter((p) => p.skipCount >= 3)
      .map((p) => p.mood);

    return {
      avoidGenres: [...new Set(avoidGenres)],
      avoidMoods: [...new Set(avoidMoods)],
      recentSkipCount: recentSkips.current.length,
      consecutiveSkips: consecutiveSkips.current,
    };
  }, []);

  const triggerAIAdaptation = useCallback(
    async (currentMood?: string) => {
      const analysis = getSkipAnalysis();

      if (analysis.avoidGenres.length === 0 && analysis.consecutiveSkips < 3) {
        return null;
      }

      try {
        const { data } = await supabase.functions.invoke("ai-playlist", {
          body: {
            action: "adapt_to_skips",
            context: `User is skipping tracks. Avoid genres: ${analysis.avoidGenres.join(", ")}. Avoid moods: ${analysis.avoidMoods.join(", ")}. Consecutive skips: ${analysis.consecutiveSkips}. Current mood preference: ${currentMood || "unknown"}`,
          },
        });

        if (data?.data?.suggestedGenre) {
          toast.info(
            `🤖 AI noticed you're skipping ${analysis.avoidGenres[0] || "tracks"} - switching to ${data.data.suggestedGenre}`,
            { duration: 4000 }
          );
        }

        return data?.data;
      } catch (error) {
        console.error("AI adaptation failed:", error);
        return null;
      }
    },
    [getSkipAnalysis]
  );

  const resetSkipPatterns = useCallback(() => {
    skipPatterns.current.clear();
    recentSkips.current = [];
    consecutiveSkips.current = 0;
  }, []);

  return {
    recordSkip,
    getSkipAnalysis,
    triggerAIAdaptation,
    resetSkipPatterns,
  };
};
