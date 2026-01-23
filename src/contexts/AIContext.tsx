import { createContext, useContext, ReactNode, useCallback, useState, useEffect } from "react";
import { useAIOrchestrator, DetectedMood, AIRecommendation } from "@/hooks/useAIOrchestrator";
import { Track } from "@/contexts/PlayerContext";

interface AIContextType {
  currentMood: DetectedMood | null;
  isProcessing: boolean;
  listeningStats: {
    topGenres: string[];
    topMoods: string[];
    recentTracks: number;
    averageEnergy: string;
  } | null;
  lastRecommendation: AIRecommendation | null;
  generateAIPlaylist: (mood?: string, genre?: string, context?: string) => Promise<Track[]>;
  handleMoodDetected: (mood: DetectedMood, autoPlay?: boolean) => Promise<void>;
  processVoiceCommand: (command: string) => Promise<{
    action: string;
    genre?: string;
    mood?: string;
    tracks?: Track[];
  }>;
  adaptToUserBehavior: (signal: { type: "skip" | "repeat" | "volume_change" | "seek"; value?: number }) => Promise<void>;
  isAIEnabled: boolean;
  toggleAI: () => void;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export const useAI = () => {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error("useAI must be used within an AIProvider");
  }
  return context;
};

export const AIProvider = ({ children }: { children: ReactNode }) => {
  const [isAIEnabled, setIsAIEnabled] = useState(true);
  
  const {
    currentMood,
    isProcessing,
    listeningStats,
    lastRecommendation,
    generateAIPlaylist,
    handleMoodDetected,
    processVoiceCommand,
    adaptToUserBehavior,
  } = useAIOrchestrator();

  const toggleAI = useCallback(() => {
    setIsAIEnabled((prev) => !prev);
  }, []);

  // Load AI preference from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("ai-enabled");
    if (stored !== null) {
      setIsAIEnabled(stored === "true");
    }
  }, []);

  // Save AI preference
  useEffect(() => {
    localStorage.setItem("ai-enabled", String(isAIEnabled));
  }, [isAIEnabled]);

  return (
    <AIContext.Provider
      value={{
        currentMood,
        isProcessing,
        listeningStats,
        lastRecommendation,
        generateAIPlaylist,
        handleMoodDetected,
        processVoiceCommand,
        adaptToUserBehavior,
        isAIEnabled,
        toggleAI,
      }}
    >
      {children}
    </AIContext.Provider>
  );
};
