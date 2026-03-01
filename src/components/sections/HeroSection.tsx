import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Sparkles, Zap, Brain, Radio, Loader2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAudioAnalyser } from "@/hooks/useAudioAnalyser";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import heroBg from "@/assets/hero-bg.jpg";

// Gentle idle equalizer frequencies
function generateIdleFrequencies(barCount: number): number[] {
  const t = Date.now() / 1000;
  const freqs: number[] = [];
  for (let i = 0; i < barCount; i++) {
    const base = 0.08 + Math.sin(t * 0.8 + i * 0.4) * 0.04 + Math.sin(t * 1.3 + i * 0.7) * 0.03;
    freqs.push(Math.max(0.03, Math.min(0.2, base)));
  }
  return freqs;
}

export const HeroSection = () => {
  const navigate = useNavigate();
  const { playPlaylist, isPlaying, audioElement, isVideoMode } = usePlayer();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const levels = useAudioAnalyser(audioElement, isPlaying, isVideoMode);
  const [idleFrequencies, setIdleFrequencies] = useState(() => generateIdleFrequencies(18));
  const [blendedFrequencies, setBlendedFrequencies] = useState(() => generateIdleFrequencies(18));
  const transitionRef = useRef(0); // 0 = idle, 1 = playing

  // Animate idle equalizer + smooth blend
  useEffect(() => {
    const id = setInterval(() => {
      // Smoothly transition the blend factor
      const target = isPlaying ? 1 : 0;
      transitionRef.current += (target - transitionRef.current) * 0.12;
      
      const idle = generateIdleFrequencies(18);
      setIdleFrequencies(idle);
      
      const t = transitionRef.current;
      const blended = idle.map((idleVal, i) => {
        const activeVal = levels.frequencies[i] ?? idleVal;
        return idleVal * (1 - t) + activeVal * t;
      });
      setBlendedFrequencies(blended);
    }, 60);
    return () => clearInterval(id);
  }, [isPlaying, levels.frequencies]);

  const handleStartListening = async () => {
    setIsLoading(true);
    try {
      const { data: tracks, error } = await supabase
        .from("tracks")
        .select("id,title,artist,album,cover_url,audio_url,video_url,duration,genre,mood")
        .not("audio_url", "is", null)
        .limit(10);
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
            style={isPlaying ? { filter: `drop-shadow(0 0 ${8 + levels.overall * 16}px hsl(var(--primary) / ${0.2 + levels.overall * 0.3}))` } : {}}
          >
            {/* Logo + speaker */}
            <div className="relative flex items-center justify-center" style={{ width: 40, height: 40 }}>
              {isPlaying && (
                <>
                  {/* Speaker pulsing to real bass */}
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ 
                      transform: `scale(${1 + levels.bass * 0.4}) rotate(${(levels.bass - 0.5) * 4}deg)`,
                      transition: 'transform 0.05s ease-out',
                    }}
                  >
                    <Volume2 className="h-9 w-9 text-primary/60" />
                  </motion.div>

                  {/* Echo rings reacting to bass */}
                  {[0, 1, 2, 3].map((i) => (
                    <motion.div
                      key={`ring-${i}`}
                      className="absolute rounded-full"
                      style={{ 
                        width: 40, height: 40, left: 0, top: 0,
                        border: `${1.5 + levels.bass * 1.5}px solid hsl(var(--primary) / ${0.15 + levels.bass * 0.25})`,
                        boxShadow: `0 0 ${4 + levels.bass * 8}px hsl(var(--primary) / ${0.1 + levels.bass * 0.2})`,
                        transform: `scale(${1.2 + i * 0.35 + levels.bass * 0.5})`,
                        opacity: Math.max(0, 0.5 - i * 0.12 - (1 - levels.bass) * 0.2),
                        transition: 'all 0.08s ease-out',
                      }}
                    />
                  ))}

                  {/* Vibration from bass */}
                  <div
                    className="absolute inset-0"
                    style={{
                      transform: `translate(${(Math.random() - 0.5) * levels.bass * 4}px, ${(Math.random() - 0.5) * levels.bass * 3}px)`,
                    }}
                  />
                </>
              )}

              <motion.img
                src="/logo-icon.png"
                alt="GrouAI"
                className="h-10 w-10 relative z-10 rounded-full"
                style={{ 
                  filter: isPlaying 
                    ? `drop-shadow(0 0 ${10 + levels.bass * 12}px hsl(var(--primary) / ${0.5 + levels.bass * 0.4}))` 
                    : 'drop-shadow(0 0 8px hsl(var(--primary) / 0.6))',
                  transform: isPlaying 
                    ? `scale(${1 + levels.bass * 0.1}) rotate(${(levels.mid - 0.5) * 6}deg)` 
                    : undefined,
                  transition: 'filter 0.05s, transform 0.05s',
                  boxShadow: 'inset -3px -3px 6px hsl(0 0% 0% / 0.4), inset 3px 3px 6px hsl(0 0% 100% / 0.15), 0 4px 10px hsl(0 0% 0% / 0.3)',
                  border: '2px solid hsl(0 0% 100% / 0.1)',
                }}
                animate={!isPlaying ? { rotate: [0, 5, -5, 0] } : undefined}
                transition={!isPlaying ? { duration: 4, repeat: Infinity, ease: "easeInOut" } : undefined}
              />
            </div>

            {/* Text + equalizer */}
            <div className="relative flex flex-col items-start">
              {/* Letters bouncing to bass with shadow */}
              <span className="text-base font-medium text-accent relative z-10 flex">
                {(t("hero.badge") + " ").split("").map((char, i) => {
                  const bounce = levels.bass * 12 * Math.max(0, Math.sin(Date.now() / 150 + i * 0.5));
                  return (
                    <span
                      key={`badge-${i}`}
                      className="inline-block"
                      style={{ 
                        transform: isPlaying ? `translateY(${-bounce}px)` : undefined,
                        textShadow: isPlaying ? `0 ${bounce}px ${bounce * 0.8}px hsl(var(--primary) / ${bounce / 30})` : undefined,
                        transition: 'transform 0.06s ease-out, text-shadow 0.06s ease-out',
                        minWidth: char === ' ' ? '0.25em' : undefined,
                      }}
                    >
                      {char === ' ' ? '\u00A0' : char}
                    </span>
                  );
                })}
                <span className="font-bold flex">
                  {"by GrouaRock".split("").map((char, i) => {
                    const bounce = levels.bass * 14 * Math.max(0, Math.sin(Date.now() / 130 + i * 0.6 + 2));
                    return (
                      <span
                        key={`rock-${i}`}
                        className="inline-block"
                        style={{ 
                          transform: isPlaying ? `translateY(${-bounce}px)` : undefined,
                          textShadow: isPlaying ? `0 ${bounce}px ${bounce * 0.7}px hsl(25 95% 55% / ${bounce / 35})` : undefined,
                          transition: 'transform 0.06s ease-out, text-shadow 0.06s ease-out',
                          minWidth: char === ' ' ? '0.25em' : undefined,
                        }}
                      >
                        {char === ' ' ? '\u00A0' : char}
                      </span>
                    );
                  })}
                </span>
              </span>

              {/* Real-data equalizer */}
              <div 
                  className="flex items-end gap-[2.5px] h-7 mt-0.5 w-full relative"
                  style={{
                    filter: isPlaying 
                      ? `drop-shadow(0 0 ${8 + levels.overall * 14}px hsl(25 90% 50% / ${0.3 + levels.overall * 0.4})) drop-shadow(0 4px 16px hsl(var(--primary) / ${0.15 + levels.bass * 0.25}))`
                      : 'drop-shadow(0 0 4px hsl(25 90% 50% / 0.15))',
                  }}
                >
                  {blendedFrequencies.map((freq, i) => {
                    const isBass = i < 6;
                    const isMid = i >= 6 && i < 12;
                    const height = Math.max(8, freq * 100);
                    const bg = isBass
                      ? `linear-gradient(to top, hsl(15 90% 45% / ${0.4 + freq * 0.4}), hsl(25 95% 55% / ${0.3 + freq * 0.35}), hsl(35 100% 60% / ${0.15 + freq * 0.25}))`
                      : isMid
                      ? `linear-gradient(to top, hsl(25 90% 50% / ${0.35 + freq * 0.35}), hsl(30 95% 58% / ${0.25 + freq * 0.3}), hsl(40 100% 65% / ${0.1 + freq * 0.2}))`
                      : `linear-gradient(to top, hsl(35 85% 55% / ${0.3 + freq * 0.3}), hsl(40 90% 62% / ${0.2 + freq * 0.25}), hsl(45 100% 70% / ${0.1 + freq * 0.15}))`;
                    const borderColor = isBass
                      ? `hsl(20 90% 50% / ${0.2 + freq * 0.3})`
                      : isMid
                      ? `hsl(30 85% 55% / ${0.15 + freq * 0.25})`
                      : `hsl(40 80% 60% / ${0.1 + freq * 0.2})`;
                    return (
                      <div
                        key={`eq-${i}`}
                        className="flex-1 min-w-[2px] rounded-sm relative overflow-hidden"
                        style={{ 
                          height: `${height}%`,
                          background: bg,
                          backdropFilter: 'blur(8px)',
                          border: `1px solid ${borderColor}`,
                          boxShadow: `inset 0 1px 0 hsl(0 0% 100% / ${0.2 + freq * 0.2}), inset 0 -1px 3px hsl(25 90% 50% / ${freq * 0.2}), 0 0 ${4 + freq * 6}px hsl(var(--primary) / ${freq * 0.15})`,
                          opacity: 0.4 + freq * 0.6,
                          transition: 'height 0.06s ease-out, opacity 0.06s ease-out',
                        }}
                      >
                        {/* Glass reflection */}
                        <div 
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            background: 'linear-gradient(135deg, hsl(0 0% 100% / 0.35) 0%, transparent 35%, transparent 65%, hsl(0 0% 100% / 0.1) 100%)',
                          }}
                        />
                        {/* Top highlight */}
                        <div 
                          className="absolute top-0 left-0 right-0 h-[1px] pointer-events-none"
                          style={{
                            background: 'linear-gradient(to right, transparent, hsl(0 0% 100% / 0.5), transparent)',
                          }}
                        />
                      </div>
                    );
                  })}
                  {/* Warm glow reactive */}
                  <div 
                    className="absolute inset-0 pointer-events-none"
                    style={{ 
                      background: `radial-gradient(ellipse at 30% 50%, hsl(25 95% 50% / ${isPlaying ? 0.1 + levels.bass * 0.25 : 0.05}) 0%, transparent 65%)`,
                    }}
                  />
                </div>
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
