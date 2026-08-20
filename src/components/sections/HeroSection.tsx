import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Sparkles, Zap, Brain, Radio, Loader2, Volume2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLanguage } from "@/contexts/LanguageContext";

import { useAudioAnalyser } from "@/hooks/useAudioAnalyser";
import { HeroEqualizer } from "@/components/sections/HeroEqualizer";
import { useTimeRotation } from "@/hooks/useTimeRotation";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import heroBg from "@/assets/hero-bg.jpg";
import { BassParticles } from "@/components/effects/BassParticles";
import { getGenrePalette } from "@/utils/genreColors";
import { BlogPromoButton } from "@/components/sections/BlogPromoButton";

// Gentle idle equalizer frequencies
function generateIdleFrequencies(barCount: number): number[] {
  const t = Date.now() / 1000;
  const freqs: number[] = [];
  for (let i = 0; i < barCount; i++) {
    const base = 0.12 + Math.sin(t * 1.2 + i * 0.5) * 0.06 + Math.sin(t * 1.8 + i * 0.9) * 0.05;
    freqs.push(Math.max(0.05, Math.min(0.3, base)));
  }
  return freqs;
}

export const HeroSection = () => {
  const navigate = useNavigate();
  const { playPlaylist, isPlaying, audioElement, isVideoMode, currentTrack } = usePlayer();
  const { t } = useLanguage();
  
  const [isLoading, setIsLoading] = useState(false);
  const levels = useAudioAnalyser(audioElement, isPlaying, isVideoMode);
  const timeTheme = useTimeRotation();
  const [idleFrequencies, setIdleFrequencies] = useState(() => generateIdleFrequencies(18));
  const [blendedFrequencies, setBlendedFrequencies] = useState(() => generateIdleFrequencies(18));
  const transitionRef = useRef(0);
  const genrePalette = getGenrePalette(currentTrack?.genre);

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
        const activeVal = Math.min(1, (levels.frequencies[i] ?? idleVal) * 1.6); // boost decibels
        return idleVal * (1 - t) + activeVal * t;
      });
      setBlendedFrequencies(blended);
    }, 35); // faster refresh = more alive
    return () => clearInterval(id);
  }, [isPlaying, levels.frequencies]);

  const handleStartListening = async () => {
    setIsLoading(true);
    try {
      const { data: tracks, error } = await supabase
        .from("tracks")
        .select("id,title,artist,album,cover_url,audio_url,video_url,duration,genre,mood")
        .not("audio_url", "is", null)
        .eq("artist", "Unknown Artist")
        .order("created_at", { ascending: false })
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
        <img src={heroBg} alt="Hero background" className="h-full w-full object-cover opacity-40" style={{ filter: `hue-rotate(${timeTheme.accentHue - 25}deg)` }} />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background/60" />
        {/* Time-based rotating accent overlay */}
        <div className="absolute inset-0 transition-all duration-[3000ms]" style={{ background: timeTheme.bgOverlay }} />
        
        {/* Audio-reactive wave layers */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Bass wave - large, slow */}
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse 120% 80% at ${50 + (isPlaying ? Math.sin(Date.now() / 800) * 15 * levels.bass : 0)}% ${60 + (isPlaying ? Math.cos(Date.now() / 1000) * 10 * levels.bass : 0)}%, hsl(15 90% 45% / ${isPlaying ? 0.06 + levels.bass * 0.18 : 0.03}) 0%, transparent 70%)`,
              transition: 'background 0.15s ease-out',
            }}
          />
          {/* Mid wave - medium, undulating */}
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse 90% 60% at ${35 + (isPlaying ? Math.sin(Date.now() / 600 + 2) * 20 * levels.mid : 0)}% ${40 + (isPlaying ? Math.cos(Date.now() / 700 + 1) * 12 * levels.mid : 0)}%, hsl(25 95% 55% / ${isPlaying ? 0.04 + levels.mid * 0.14 : 0.02}) 0%, transparent 60%)`,
              transition: 'background 0.12s ease-out',
            }}
          />
          {/* Treble shimmer - small, fast */}
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse 60% 40% at ${65 + (isPlaying ? Math.sin(Date.now() / 400 + 4) * 18 * levels.treble : 0)}% ${30 + (isPlaying ? Math.cos(Date.now() / 500 + 3) * 15 * levels.treble : 0)}%, hsl(40 100% 65% / ${isPlaying ? 0.03 + levels.treble * 0.1 : 0.01}) 0%, transparent 50%)`,
              transition: 'background 0.08s ease-out',
            }}
          />
          {/* Horizontal wave band reacting to overall */}
          <div
            className="absolute left-0 right-0"
            style={{
              top: `${55 + (isPlaying ? Math.sin(Date.now() / 900) * 8 * levels.overall : 0)}%`,
              height: `${isPlaying ? 20 + levels.bass * 30 : 15}%`,
              background: `linear-gradient(to bottom, transparent, hsl(var(--primary) / ${isPlaying ? 0.03 + levels.overall * 0.08 : 0.015}), transparent)`,
              filter: `blur(${30 + (isPlaying ? levels.bass * 20 : 0)}px)`,
              transition: 'top 0.2s ease-out, height 0.15s ease-out',
            }}
          />
        </div>
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

              {/* Real-data equalizer — 10 przełączanych stylów (malutki przycisk) */}
              <HeroEqualizer
                frequencies={blendedFrequencies}
                levels={levels}
                isPlaying={isPlaying}
                palette={genrePalette}
              />
            </div>
          </motion.div>

          {/* === MAIN TITLE === */}
          <div className="mb-6 relative">
            <BassParticles bass={levels.bass} overall={levels.overall} isPlaying={isPlaying} palette={genrePalette} />
            <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold leading-tight relative z-10">
              <span className="block">Music That</span>
              <span className="block groove-gradient-text mt-1">Understands</span>
            </h1>
          </div>

          <p className="text-base md:text-lg text-muted-foreground mb-4 max-w-xl leading-relaxed">
            {t("hero.subtitle")}
          </p>
          
          {/* Anti-fraud explainer */}
          <div className="flex items-start gap-3 mb-6 max-w-xl rounded-lg border border-primary/20 bg-primary/5 backdrop-blur-sm px-4 py-3">
            <Zap className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("hero.antiFraudExplainer")}
            </p>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-3 mb-8">
            {[
              { icon: Zap, label: "Verified Human Streams" },
              { icon: Brain, label: "AI Anti-Fraud" },
              { icon: Sparkles, label: "Mood-Based Playlists" },
            ].map((tag, i) => (
              <motion.div
                key={tag.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-medium text-primary"
              >
                <tag.icon className="h-3.5 w-3.5" />
                {tag.label}
              </motion.div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 mb-8">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button size="lg" className="groove-gradient-bg text-primary-foreground hover:opacity-90 gap-2 rounded-full px-8 h-14 font-semibold text-base shadow-[0_0_30px_hsl(var(--primary)/0.3)]" onClick={handleStartListening} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5 fill-current" />}
                {t("hero.startListening")}
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="relative">
              {/* Iskierki unoszące się znad przycisku */}
              <div className="pointer-events-none absolute -inset-x-2 -top-8 bottom-0 overflow-visible" aria-hidden="true">
                {Array.from({ length: 14 }).map((_, i) => {
                  const left = (i / 14) * 100 + (Math.random() * 8 - 4);
                  const size = 1.5 + Math.random() * 2.5;
                  const delay = Math.random() * 4;
                  const duration = 2.2 + Math.random() * 2.8;
                  const drift = (Math.random() - 0.5) * 30;
                  const hue =
                    Math.random() > 0.6
                      ? "hsl(38 100% 65%)"
                      : Math.random() > 0.3
                      ? "hsl(24 100% 60%)"
                      : "hsl(14 100% 57%)";
                  return (
                    <span
                      key={`liveradio-spark-${i}`}
                      className="liveradio-spark absolute rounded-full"
                      style={{
                        left: `${left}%`,
                        width: `${size}px`,
                        height: `${size}px`,
                        background: hue,
                        boxShadow: `0 0 ${size * 4}px ${hue}`,
                        animationDelay: `${delay}s`,
                        animationDuration: `${duration}s`,
                        ["--drift" as string]: `${drift}px`,
                      }}
                    />
                  );
                })}
              </div>
              <Button
                size="lg"
                className="liveradio-burning-btn relative gap-2 rounded-full px-6 h-14 font-semibold text-base text-primary-foreground border-0 overflow-hidden"
                onClick={() => navigate("/radio-live")}
              >
                <Radio className="h-5 w-5 relative z-10" />
                <span className="relative z-10">{t("hero.liveRadio")}</span>
              </Button>
            </motion.div>
            <BlogPromoButton />
          </div>

        </motion.div>

        <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="absolute right-10 top-20 hidden lg:block">
          <div className="groove-gradient-bg h-32 w-32 rounded-2xl opacity-20 blur-2xl" />
        </motion.div>
      </div>
    </section>
  );
};
