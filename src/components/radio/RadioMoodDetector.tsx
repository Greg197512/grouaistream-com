import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Sparkles, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAISafe } from "@/contexts/AIContext";
import { toast } from "sonner";

const QUICK_MOODS = [
  { mood: "euphoric", emoji: "🤩", genre: "EDM", color: "from-yellow-500 to-orange-500" },
  { mood: "chill", emoji: "😌", genre: "Lo-Fi", color: "from-cyan-500 to-blue-500" },
  { mood: "energetic", emoji: "⚡", genre: "Rock", color: "from-red-500 to-pink-500" },
  { mood: "melancholic", emoji: "🌙", genre: "Ambient", color: "from-indigo-500 to-purple-500" },
  { mood: "party", emoji: "🎉", genre: "House", color: "from-pink-500 to-yellow-500" },
  { mood: "focus", emoji: "🧠", genre: "Classical", color: "from-emerald-500 to-teal-500" },
];

export const RadioMoodDetector = () => {
  const ai = useAISafe();
  const [activeMood, setActiveMood] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  const handleMoodSelect = async (mood: typeof QUICK_MOODS[0]) => {
    setActiveMood(mood.mood);
    
    if (ai?.handleMoodDetected) {
      await ai.handleMoodDetected({
        mood: mood.mood,
        confidence: 95,
        emoji: mood.emoji,
        color: mood.color,
        genre: mood.genre,
        source: "manual",
      }, false);
    }
    
    toast.success(`${mood.emoji} Nastrój: ${mood.mood} → gatunek: ${mood.genre}`);
  };

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
                Wykryty nastrój: <strong>{activeMood}</strong> — AI dostosowuje playlistę
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
            onClick={() => handleMoodSelect(mood)}
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
        Wybierz nastrój lub użyj kamery 📷 na stronie głównej
      </p>
    </motion.div>
  );
};
