import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Sparkles, Zap, Brain, Radio, Loader2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import heroBg from "@/assets/hero-bg.jpg";

export const HeroSection = () => {
  const navigate = useNavigate();
  const { playPlaylist, isPlaying } = usePlayer();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);

  const handleStartListening = async () => {
    setIsLoading(true);
    try {
      const { data: tracks, error } = await supabase.from("tracks").select("*").limit(20);
      if (error) throw error;
      if (tracks && tracks.length > 0) {
        const shuffled = [...tracks].sort(() => Math.random() - 0.5);
        playPlaylist(shuffled);
        toast.success(t("hero.nowPlaying"));
      } else {
        toast.info(t("hero.noTracks"));
      }
    } catch (error) {
      console.error("Error starting playback:", error);
      toast.error(t("hero.failedLoad"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeatureClick = (feature: string) => {
    switch (feature) {
      case "moodDetection":
        navigate("/settings");
        toast.info(t("hero.enableMoodDetection"));
        break;
      case "realtimeAdaptation":
        toast.success(t("hero.realtimeActive"));
        break;
      case "aiPlaylists":
        navigate("/create-playlist");
        break;
    }
  };

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <img src={heroBg} alt="Hero background" className="h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background/60" />
      </div>

      <div className="relative px-6 py-16 md:py-24">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="max-w-3xl">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="inline-flex items-center gap-3 rounded-full bg-accent/20 border border-accent/30 px-5 py-2.5 mb-6 relative">
            
            {/* Speaker pulsing behind logo when playing */}
            {isPlaying && (
              <>
                {/* Speaker icon beating */}
                <motion.div
                  className="absolute -left-2 top-1/2 -translate-y-1/2"
                  animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Volume2 className="h-5 w-5 text-primary" />
                </motion.div>

                {/* Sound wave parabolas / equalizer bars */}
                <div className="absolute -right-10 top-1/2 -translate-y-1/2 flex items-end gap-[2px] h-8">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <motion.div
                      key={i}
                      className="w-[3px] rounded-full bg-primary"
                      animate={{ height: ["30%", `${50 + Math.random() * 50}%`, "20%", `${40 + Math.random() * 60}%`, "30%"] }}
                      transition={{
                        duration: 0.6 + i * 0.08,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.07,
                      }}
                    />
                  ))}
                </div>

                {/* Pulse rings behind logo */}
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute inset-0 rounded-full border border-primary/30"
                    animate={{ scale: [1, 1.6 + i * 0.3], opacity: [0.4, 0] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.3, ease: "easeOut" }}
                    style={{ left: -4, top: -4, right: -4, bottom: -4 }}
                  />
                ))}
              </>
            )}

            <motion.img
              src="/logo-icon.png"
              alt="GrouAI"
              className="h-10 w-10 drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]"
              animate={isPlaying
                ? { rotate: [0, 5, -5, 0], scale: [1, 1.08, 1, 1.08, 1] }
                : { rotate: [0, 5, -5, 0] }
              }
              transition={isPlaying
                ? { duration: 0.6, repeat: Infinity, ease: "easeInOut" }
                : { duration: 4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }
              }
            />
            <span className="text-base font-medium text-accent">{t("hero.badge")} <span className="font-bold">by GrouaRock</span></span>
          </motion.div>

          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
            {t("hero.title1")}
            <span className="groove-gradient-text">{t("hero.titleHighlight")}</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-xl">{t("hero.subtitle")}</p>

          <div className="flex flex-wrap gap-4 mb-12">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button size="lg" className="groove-gradient-bg text-primary-foreground hover:opacity-90 gap-2 rounded-full px-8 h-12 font-semibold" onClick={handleStartListening} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5 fill-current" />}
                {t("hero.startListening")}
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button size="lg" variant="outline" className="groove-gradient-border hover:bg-muted gap-2 rounded-full px-8 h-12" onClick={() => navigate("/radio")}>
                <Radio className="h-5 w-5" />
                {t("hero.liveRadio")}
              </Button>
            </motion.div>
          </div>

          <div className="flex flex-wrap gap-6">
            {[
              { icon: Brain, labelKey: "hero.moodDetection", key: "moodDetection" },
              { icon: Zap, labelKey: "hero.realtimeAdaptation", key: "realtimeAdaptation" },
              { icon: Sparkles, labelKey: "hero.aiPlaylists", key: "aiPlaylists" },
            ].map((feature, i) => (
              <motion.button key={feature.key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.1 }} whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }} onClick={() => handleFeatureClick(feature.key)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                <feature.icon className="h-4 w-4 text-primary" />
                <span>{t(feature.labelKey)}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>

        <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="absolute right-10 top-20 hidden lg:block">
          <div className="groove-gradient-bg h-32 w-32 rounded-2xl opacity-20 blur-2xl" />
        </motion.div>
      </div>
    </section>
  );
};
