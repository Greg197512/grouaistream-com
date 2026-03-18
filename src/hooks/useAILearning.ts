import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface UserPreferences {
  genre_weights: Record<string, number>;
  mood_weights: Record<string, number>;
  daily_patterns: Record<string, string[]>;
  weekly_patterns: Record<string, string[]>;
  preferred_energy: string;
  preferred_tempo: string;
  avoid_genres: string[];
  avoid_moods: string[];
  total_tracks_analyzed: number;
  last_analyzed_at: string | null;
  ai_profile_summary: string | null;
}

const LEARN_INTERVAL = 30 * 60 * 1000; // 30 minutes
const LEARN_STORAGE_KEY = "ai-last-learn";

export const useAILearning = () => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLearning, setIsLearning] = useState(false);
  const learningRef = useRef(false);

  // Load cached preferences from DB
  const loadPreferences = useCallback(async () => {
    if (!user) return null;
    try {
      const { data } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        const prefs: UserPreferences = {
          genre_weights: (data as any).genre_weights || {},
          mood_weights: (data as any).mood_weights || {},
          daily_patterns: (data as any).daily_patterns || {},
          weekly_patterns: (data as any).weekly_patterns || {},
          preferred_energy: (data as any).preferred_energy || "medium",
          preferred_tempo: (data as any).preferred_tempo || "medium",
          avoid_genres: (data as any).avoid_genres || [],
          avoid_moods: (data as any).avoid_moods || [],
          total_tracks_analyzed: (data as any).total_tracks_analyzed || 0,
          last_analyzed_at: (data as any).last_analyzed_at,
          ai_profile_summary: (data as any).ai_profile_summary,
        };
        setPreferences(prefs);
        return prefs;
      }
    } catch (e) {
      console.error("Failed to load preferences:", e);
    }
    return null;
  }, [user]);

  // Trigger AI learning (calls edge function)
  const triggerLearning = useCallback(async () => {
    if (!user || learningRef.current) return;

    // Check if we recently learned
    const lastLearn = localStorage.getItem(LEARN_STORAGE_KEY);
    if (lastLearn && Date.now() - parseInt(lastLearn) < LEARN_INTERVAL) {
      return;
    }

    learningRef.current = true;
    setIsLearning(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-learn", {
        body: { userId: user.id },
      });

      if (!error && data?.success) {
        localStorage.setItem(LEARN_STORAGE_KEY, String(Date.now()));
        await loadPreferences();
      }
    } catch (e) {
      console.error("AI learning failed:", e);
    } finally {
      setIsLearning(false);
      learningRef.current = false;
    }
  }, [user, loadPreferences]);

  // Get recommended genres for current time of day
  const getTimeBasedRecommendations = useCallback((): string[] => {
    if (!preferences?.daily_patterns) return [];
    const hour = new Date().getHours();
    let slot = "morning";
    if (hour >= 12 && hour < 18) slot = "afternoon";
    else if (hour >= 18) slot = "evening";
    else if (hour < 6) slot = "night";
    return preferences.daily_patterns[slot] || [];
  }, [preferences]);

  // Get recommended genres for current day of week
  const getDayBasedRecommendations = useCallback((): string[] => {
    if (!preferences?.weekly_patterns) return [];
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const today = days[new Date().getDay()];
    return preferences.weekly_patterns[today] || [];
  }, [preferences]);

  // Get top genres sorted by weight
  const getTopGenres = useCallback((count = 5): string[] => {
    if (!preferences?.genre_weights) return [];
    return Object.entries(preferences.genre_weights)
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([g]) => g);
  }, [preferences]);

  // Load on mount, trigger learning if needed
  useEffect(() => {
    if (!user) return;
    loadPreferences().then(() => {
      triggerLearning();
    });
  }, [user]);

  // Periodic learning
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(triggerLearning, LEARN_INTERVAL);
    return () => clearInterval(interval);
  }, [user, triggerLearning]);

  return {
    preferences,
    isLearning,
    triggerLearning,
    loadPreferences,
    getTimeBasedRecommendations,
    getDayBasedRecommendations,
    getTopGenres,
  };
};
