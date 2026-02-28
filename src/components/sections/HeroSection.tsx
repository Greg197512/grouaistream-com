import { useState } from "react";
import { motion } from "framer-motion";
import { Play, Sparkles, Zap, Brain, Radio, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "@/contexts/PlayerContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import heroBg from "@/assets/hero-bg.jpg";

export const HeroSection = () => {
  const navigate = useNavigate();
  const { playPlaylist } = usePlayer();
  const [isLoading, setIsLoading] = useState(false);

  const handleStartListening = async () => {
    setIsLoading(true);
    try {
      // Fetch random tracks from the database
      const { data: tracks, error } = await supabase
        .from("tracks")
        .select("*")
        .limit(20);

      if (error) throw error;

      if (tracks && tracks.length > 0) {
        // Shuffle the tracks
        const shuffled = [...tracks].sort(() => Math.random() - 0.5);
        
        // Play the shuffled playlist
        playPlaylist(shuffled);

        toast.success("Now playing your personalized mix!");
      } else {
        toast.info("No tracks available yet. Check back soon!");
      }
    } catch (error) {
      console.error("Error starting playback:", error);
      toast.error("Failed to load tracks. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLiveRadio = () => {
    navigate("/radio");
  };

  const handleFeatureClick = (feature: string) => {
    switch (feature) {
      case "Mood Detection":
        navigate("/settings");
        toast.info("Enable Mood Detection in Settings → AI & Privacy");
        break;
      case "Real-time Adaptation":
        toast.success("Real-time adaptation is always active while you listen!");
        break;
      case "AI Playlists":
        navigate("/create-playlist");
        break;
      default:
        break;
    }
  };

  return (
    <section className="relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <img 
          src={heroBg} 
          alt="Hero background" 
          className="h-full w-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background/60" />
      </div>

      {/* Content */}
      <div className="relative px-6 py-16 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-3xl"
        >
          {/* Badge */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-3 rounded-full bg-accent/20 border border-accent/30 px-5 py-2.5 mb-6"
          >
            <motion.img 
              src="/logo-icon.png" 
              alt="GrouAI" 
              className="h-10 w-10 drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            />
            <span className="text-base font-medium text-accent">GrouAI Stream <span className="font-bold">by GrouaRock</span></span>
          </motion.div>

          {/* Headline */}
          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
            Music That{" "}
            <span className="groove-gradient-text">Understands</span>
            {" "}You
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-xl">
            Experience the future of music streaming with AI that learns your mood, 
            adapts to your rhythm, and creates the perfect soundtrack for every moment.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap gap-4 mb-12">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button 
                size="lg" 
                className="groove-gradient-bg text-primary-foreground hover:opacity-90 gap-2 rounded-full px-8 h-12 font-semibold"
                onClick={handleStartListening}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Play className="h-5 w-5 fill-current" />
                )}
                Start Listening Free
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button 
                size="lg" 
                variant="outline" 
                className="groove-gradient-border hover:bg-muted gap-2 rounded-full px-8 h-12"
                onClick={handleLiveRadio}
              >
                <Radio className="h-5 w-5" />
                Live Radio
              </Button>
            </motion.div>
          </div>

          {/* Features */}
          <div className="flex flex-wrap gap-6">
            {[
              { icon: Brain, label: "Mood Detection" },
              { icon: Zap, label: "Real-time Adaptation" },
              { icon: Sparkles, label: "AI Playlists" },
            ].map((feature, i) => (
              <motion.button
                key={feature.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleFeatureClick(feature.label)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <feature.icon className="h-4 w-4 text-primary" />
                <span>{feature.label}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Floating Elements */}
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute right-10 top-20 hidden lg:block"
        >
          <div className="groove-gradient-bg h-32 w-32 rounded-2xl opacity-20 blur-2xl" />
        </motion.div>
      </div>
    </section>
  );
};
