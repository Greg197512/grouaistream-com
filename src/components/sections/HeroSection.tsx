import { useState, useMemo } from "react";
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
            style={isPlaying ? { filter: 'drop-shadow(0 0 12px hsl(var(--primary) / 0.3))' } : {}}
          >
            {/* Logo container with speaker behind */}
            <div className="relative flex items-center justify-center" style={{ width: 40, height: 40 }}>
              {isPlaying && (
                <>
                  {/* Bass speaker membrane pulsing behind logo */}
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center"
                    animate={{ 
                      scale: [1, 1.3, 0.9, 1.25, 1],
                      rotate: [0, 2, -3, 1, 0]
                    }}
                    transition={{ duration: 0.35, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Volume2 className="h-9 w-9 text-primary/60" />
                  </motion.div>

                  {/* Echo sonar rings that vibrate like equalizer */}
                  {[0, 1, 2, 3].map((i) => (
                    <motion.div
                      key={`ring-${i}`}
                      className="absolute rounded-full"
                      style={{ 
                        width: 40, height: 40, left: 0, top: 0,
                        border: '2px solid hsl(var(--primary) / 0.35)',
                        boxShadow: '0 0 6px hsl(var(--primary) / 0.2)'
                      }}
                      animate={{ 
                        scale: [1, 1.8 + i * 0.4, 1.5 + i * 0.3, 2 + i * 0.5], 
                        opacity: [0.5, 0.3, 0.4, 0],
                        borderWidth: ['2px', '1.5px', '2px', '0.5px'],
                      }}
                      transition={{ 
                        duration: 1.4, 
                        repeat: Infinity, 
                        delay: i * 0.2, 
                        ease: "easeOut" 
                      }}
                    />
                  ))}

                  {/* Speaker vibration shake */}
                  <motion.div
                    className="absolute inset-0"
                    animate={{ 
                      x: [0, -2, 2.5, -2.5, 2, 0],
                      y: [0, 1.5, -2, 1.5, -1, 0]
                    }}
                    transition={{ duration: 0.12, repeat: Infinity, ease: "linear" }}
                  />
                </>
              )}

              <motion.img
                src="/logo-icon.png"
                alt="GrouAI"
                className="h-10 w-10 relative z-10"
                style={{ filter: isPlaying ? 'drop-shadow(0 0 14px hsl(var(--primary) / 0.8))' : 'drop-shadow(0 0 8px hsl(var(--primary) / 0.6))' }}
                animate={isPlaying
                  ? { rotate: [0, 3, -3, 0], scale: [1, 1.08, 0.95, 1.08, 1] }
                  : { rotate: [0, 5, -5, 0] }
                }
                transition={isPlaying
                  ? { duration: 0.3, repeat: Infinity, ease: "easeInOut" }
                  : { duration: 4, repeat: Infinity, ease: "easeInOut" }
                }
              />
            </div>

            {/* Text with bouncing letters + equalizer underneath */}
            <div className="relative flex flex-col items-start">
              {/* Bouncing letters */}
              <span className="text-base font-medium text-accent relative z-10 flex">
                {(t("hero.badge") + " ").split("").map((char, i) => (
                  <motion.span
                    key={`badge-${i}`}
                    animate={isPlaying ? { 
                      y: [0, -3, 0, -1.5, 0],
                    } : {}}
                    transition={isPlaying ? { 
                      duration: 0.6, 
                      repeat: Infinity, 
                      ease: "easeInOut",
                      delay: i * 0.05,
                    } : {}}
                    className="inline-block"
                    style={{ minWidth: char === ' ' ? '0.25em' : undefined }}
                  >
                    {char === ' ' ? '\u00A0' : char}
                  </motion.span>
                ))}
                <span className="font-bold flex">
                  {"by GrouaRock".split("").map((char, i) => (
                    <motion.span
                      key={`rock-${i}`}
                      animate={isPlaying ? { 
                        y: [0, -4, 0, -2, 0],
                      } : {}}
                      transition={isPlaying ? { 
                        duration: 0.5, 
                        repeat: Infinity, 
                        ease: "easeInOut",
                        delay: 0.4 + i * 0.04,
                      } : {}}
                      className="inline-block"
                      style={{ minWidth: char === ' ' ? '0.25em' : undefined }}
                    >
                      {char === ' ' ? '\u00A0' : char}
                    </motion.span>
                  ))}
                </span>
              </span>

              {/* Orange equalizer with glow under text */}
              {isPlaying && (
                <motion.div 
                  className="flex items-end gap-[2px] h-4 mt-0.5 w-full relative"
                  initial={{ opacity: 0, scaleX: 0.5 }}
                  animate={{ 
                    opacity: 1, 
                    scaleX: [1, 1.06, 1, 1.04, 1],
                  }}
                  transition={{ 
                    opacity: { duration: 0.3 },
                    scaleX: { duration: 0.45, repeat: Infinity, ease: "easeInOut" }
                  }}
                  style={{
                    filter: 'drop-shadow(0 0 8px hsl(25 95% 55% / 0.6)) drop-shadow(0 2px 12px hsl(var(--primary) / 0.4))'
                  }}
                >
                  {Array.from({ length: 18 }, (_, i) => (
                    <motion.div
                      key={`eq-${i}`}
                      className="flex-1 min-w-[2px] rounded-sm relative"
                      style={{ 
                        background: `linear-gradient(to top, hsl(var(--primary) / 0.5), hsl(25 95% 55% / 0.4), hsl(35 100% 65% / 0.25))`,
                        backdropFilter: 'blur(4px)',
                        border: '1px solid hsl(25 95% 55% / 0.3)',
                        boxShadow: 'inset 0 0 4px hsl(25 95% 55% / 0.15), 0 0 3px hsl(var(--primary) / 0.2)',
                      }}
                      animate={{ 
                        height: [
                          `${15 + Math.random() * 25}%`, 
                          `${65 + Math.random() * 35}%`, 
                          `${10 + Math.random() * 20}%`, 
                          `${55 + Math.random() * 45}%`, 
                          `${15 + Math.random() * 25}%`
                        ],
                        opacity: [0.6, 0.9, 0.5, 0.85, 0.6]
                      }}
                      transition={{
                        duration: 0.25 + Math.random() * 0.25,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.025,
                      }}
                    />
                  ))}
                  {/* Glow overlay */}
                  <div 
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{ 
                      background: 'radial-gradient(ellipse at center, hsl(25 95% 55% / 0.25) 0%, transparent 70%)',
                    }}
                  />
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
