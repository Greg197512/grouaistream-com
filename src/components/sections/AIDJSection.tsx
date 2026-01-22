import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Brain, Headphones, TrendingUp, Play, Pause, Camera } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MoodDetector } from "@/components/mood/MoodDetector";

interface MoodState {
  mood: string;
  confidence: number;
  icon: string;
  color: string;
}

const moods: MoodState[] = [
  { mood: "Energetic", confidence: 85, icon: "⚡", color: "from-yellow-400 to-orange-500" },
  { mood: "Relaxed", confidence: 92, icon: "🌊", color: "from-blue-400 to-cyan-500" },
  { mood: "Focused", confidence: 78, icon: "🎯", color: "from-purple-400 to-pink-500" },
  { mood: "Happy", confidence: 88, icon: "☀️", color: "from-green-400 to-emerald-500" },
];

export const AIDJSection = () => {
  const [currentMood, setCurrentMood] = useState(moods[1]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [djActive, setDjActive] = useState(true);
  const [showMoodDetector, setShowMoodDetector] = useState(false);

  const handleAnalyze = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      const randomMood = moods[Math.floor(Math.random() * moods.length)];
      setCurrentMood(randomMood);
      setIsAnalyzing(false);
    }, 2000);
  };

  const handleMoodDetected = (detectedMood: { mood: string; confidence: number; emoji: string; color: string }) => {
    const mappedMood: MoodState = {
      mood: detectedMood.mood,
      confidence: detectedMood.confidence,
      icon: detectedMood.emoji,
      color: detectedMood.color,
    };
    setCurrentMood(mappedMood);
  };

  return (
    <section className="px-6 py-12">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="groove-gradient-bg h-10 w-10 rounded-xl flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold">AI DJ</h2>
            <p className="text-sm text-muted-foreground">Your personal music curator</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowMoodDetector(!showMoodDetector)}
            variant="outline"
            className="gap-2 rounded-full"
          >
            <Camera className="h-4 w-4" />
            {showMoodDetector ? "Ukryj kamerę" : "Wykryj nastrój"}
          </Button>
          <Button 
            onClick={() => setDjActive(!djActive)}
            variant={djActive ? "default" : "outline"}
            className="gap-2 rounded-full"
          >
            {djActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {djActive ? "Pause DJ" : "Start DJ"}
          </Button>
        </div>
      </div>

      {/* Mood Detector Panel */}
      <AnimatePresence>
        {showMoodDetector && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 overflow-hidden"
          >
            <MoodDetector 
              onMoodDetected={handleMoodDetected}
              onClose={() => setShowMoodDetector(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Mood Card */}
        <motion.div 
          className="groove-card p-6 col-span-1 md:col-span-2"
          whileHover={{ scale: 1.01 }}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Brain className="h-5 w-5 text-accent" />
              <span className="font-medium">Current Mood Detection</span>
            </div>
            <button 
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="text-sm text-primary hover:underline disabled:opacity-50"
            >
              {isAnalyzing ? "Analyzing..." : "Refresh"}
            </button>
          </div>

          <div className="flex items-center gap-6">
            <motion.div 
              animate={isAnalyzing ? { rotate: 360 } : {}}
              transition={{ duration: 1, repeat: isAnalyzing ? Infinity : 0, ease: "linear" }}
              className={`h-24 w-24 rounded-2xl bg-gradient-to-br ${currentMood.color} flex items-center justify-center text-4xl shadow-lg`}
            >
              {currentMood.icon}
            </motion.div>
            
            <div className="flex-1">
              <h3 className="font-display text-3xl font-bold mb-2">{currentMood.mood}</h3>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${currentMood.confidence}%` }}
                    transition={{ duration: 0.5 }}
                    className={`h-full bg-gradient-to-r ${currentMood.color}`}
                  />
                </div>
                <span className="text-sm text-muted-foreground">{currentMood.confidence}% confidence</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Based on your listening patterns, time of day, and behavioral signals.
              </p>
            </div>
          </div>

          {/* Quick Mood Buttons */}
          <div className="flex gap-2 mt-6">
            {moods.map((mood) => (
              <button
                key={mood.mood}
                onClick={() => setCurrentMood(mood)}
                className={`px-4 py-2 rounded-full text-sm transition-all ${
                  currentMood.mood === mood.mood 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-secondary hover:bg-muted"
                }`}
              >
                {mood.icon} {mood.mood}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Stats Card */}
        <motion.div 
          className="groove-card p-6 space-y-6"
          whileHover={{ scale: 1.01 }}
        >
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span className="font-medium">AI Insights</span>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Personalization Score</span>
                <span className="font-medium">94%</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full w-[94%] groove-gradient-bg" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Tracks Analyzed</span>
                <span className="font-medium">2,847</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Skip Rate Reduced</span>
                <span className="font-medium text-green-400">-67%</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Session Duration</span>
                <span className="font-medium">+42%</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Headphones className="h-4 w-4" />
              <span>Listening for 2h 34m today</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
