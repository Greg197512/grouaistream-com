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
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }} 
            transition={{ delay: 0.2 }} 
            className="inline-flex items-center gap-3 rounded-full bg-accent/20 border border-accent/30 px-5 py-2.5 mb-6 relative overflow-visible"
          >
            {/* Logo container with speaker behind */}
            <div className="relative flex items-center justify-center">
              {/* Speaker beating behind logo like a real subwoofer */}
              {isPlaying && (
                <>
                  {/* Bass speaker membrane pulsing */}
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ width: 44, height: 44, left: -2, top: -2 }}
                  >
                    <motion.div
                      animate={{ 
                        scale: [1, 1.25, 0.95, 1.2, 1],
                        rotate: [0, 2, -2, 1, 0]
                      }}
                      transition={{ duration: 0.4, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <Volume2 className="h-8 w-8 text-primary/70" />
                    </motion.div>
                  </motion.div>

                  {/* Echo sonar rings expanding outward */}
                  {[0, 1, 2, 3].map((i) => (
                    <motion.div
                      key={`ring-${i}`}
                      className="absolute rounded-full border-2 border-primary/40"
                      style={{ width: 40, height: 40, left: 0, top: 0 }}
                      animate={{ 
                        scale: [1, 2 + i * 0.5], 
                        opacity: [0.6, 0],
                        borderWidth: ['2px', '0.5px']
                      }}
                      transition={{ 
                        duration: 1.2, 
                        repeat: Infinity, 
                        delay: i * 0.25, 
                        ease: "easeOut" 
                      }}
                    />
                  ))}

                  {/* Vibration shake on the speaker */}
                  <motion.div
                    className="absolute"
                    style={{ width: 40, height: 40, left: 0, top: 0 }}
                    animate={{ 
                      x: [0, -1.5, 2, -2, 1.5, 0],
                      y: [0, 1, -1.5, 1, -0.5, 0]
                    }}
                    transition={{ duration: 0.15, repeat: Infinity, ease: "linear" }}
                  />
                </>
              )}

              <motion.img
                src="/logo-icon.png"
                alt="GrouAI"
                className="h-10 w-10 drop-shadow-[0_0_12px_hsl(var(--primary)/0.7)] relative z-10"
                animate={isPlaying
                  ? { rotate: [0, 3, -3, 0], scale: [1, 1.06, 0.97, 1.06, 1] }
                  : { rotate: [0, 5, -5, 0] }
                }
                transition={isPlaying
                  ? { duration: 0.35, repeat: Infinity, ease: "easeInOut" }
                  : { duration: 4, repeat: Infinity, ease: "easeInOut" }
                }
              />
            </div>

            {/* Text with equalizer underneath */}
            <div className="relative flex flex-col items-start">
              <motion.span 
                className="text-base font-medium text-accent relative z-10"
                animate={isPlaying ? { x: [0, 0.5, -0.5, 0] } : {}}
                transition={isPlaying ? { duration: 0.3, repeat: Infinity, ease: "easeInOut" } : {}}
              >
                {t("hero.badge")} <span className="font-bold">by GrouaRock</span>
              </motion.span>

              {/* Orange equalizer bars under the text */}
              {isPlaying && (
                <motion.div 
                  className="flex items-end gap-[2px] h-3 mt-0.5 w-full"
                  initial={{ opacity: 0, scaleX: 0.5 }}
                  animate={{ 
                    opacity: 1, 
                    scaleX: [1, 1.08, 1, 1.05, 1],
                  }}
                  transition={{ 
                    opacity: { duration: 0.3 },
                    scaleX: { duration: 0.5, repeat: Infinity, ease: "easeInOut" }
                  }}
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((i) => (
                    <motion.div
                      key={`eq-${i}`}
                      className="flex-1 min-w-[2px] rounded-full"
                      style={{ 
                        background: `linear-gradient(to top, hsl(var(--primary)), hsl(25 95% 60%))`,
                      }}
                      animate={{ 
                        height: [
                          `${20 + Math.random() * 30}%`, 
                          `${60 + Math.random() * 40}%`, 
                          `${15 + Math.random() * 25}%`, 
                          `${50 + Math.random() * 50}%`, 
                          `${20 + Math.random() * 30}%`
                        ],
                        opacity: [0.7, 1, 0.6, 1, 0.7]
                      }}
                      transition={{
                        duration: 0.3 + Math.random() * 0.3,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.03,
                      }}
                    />
                  ))}
                </motion.div>
              )}
            </div>
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
