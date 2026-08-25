import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Sparkles, Zap, Brain, Radio, Loader2, Volume2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLanguage } from "@/contexts/LanguageContext";

import { useAudioAnalyser } from "@/hooks/useAudioAnalyser";
import { useTimeRotation } from "@/hooks/useTimeRotation";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import heroBg from "@/assets/hero-neon.jpg";
import { BassParticles } from "@/components/effects/BassParticles";
import { getGenrePalette } from "@/utils/genreColors";
import { BlogPromoButton } from "@/components/sections/BlogPromoButton";

// Gentle idle equalizer frequencies
function generateIdleFrequencies(barCount: number): number[] {
  const t = Date.now() / 1000;
  const freqs: number[] = [];
  for (let i = 0; i < barCount; i++) {
    // Żywszy „idle": większa amplituda, szybciej, więcej warstw fal + delikatny puls.
    const base =
      0.26 +
      Math.sin(t * 2.4 + i * 0.55) * 0.16 +
      Math.sin(t * 3.7 + i * 0.9) * 0.12 +
      Math.sin(t * 1.5 + i * 1.7) * 0.08 +
      Math.sin(t * 5.2 + i * 0.35) * 0.05;
    freqs.push(Math.max(0.08, Math.min(0.72, base)));
  }
  return freqs;
}

// Wspólny styl krystalicznego szklanego przycisku (jednakowe efekty dla wszystkich CTA).
// Kolorowy refleks róż↔fiolet: inset ring (magenta) + podwójna poświata (róż + fiolet).
const GLASS_BTN =
  "group relative overflow-hidden rounded-full px-7 h-14 gap-2 font-semibold text-base text-white " +
  "border border-white/25 bg-white/[0.07] backdrop-blur-xl transition-all duration-300 " +
  "hover:bg-white/[0.14] hover:border-white/60 hover:-translate-y-0.5 " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.32),inset_0_0_0_1px_hsl(315_100%_72%/0.28),0_12px_34px_-14px_rgba(0,0,0,0.78),0_0_26px_-8px_hsl(331_100%_62%/0.65),0_0_26px_-6px_hsl(268_100%_66%/0.55)]";

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
        <img src={heroBg} alt="Hero background" className="h-full w-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/75 to-background" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background/60" />
        {/* Time-based rotating accent overlay */}
        <div className="absolute inset-0 transition-all duration-[3000ms]" style={{ background: timeTheme.bgOverlay }} />
        
        {/* Audio-reactive wave layers */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Bass wave - large, slow */}
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse 120% 80% at ${50 + (isPlaying ? Math.sin(Date.now() / 800) * 15 * levels.bass : 0)}% ${60 + (isPlaying ? Math.cos(Date.now() / 1000) * 10 * levels.bass : 0)}%, hsl(268 100% 62% / ${isPlaying ? 0.08 + levels.bass * 0.2 : 0.04}) 0%, transparent 70%)`,
              transition: 'background 0.15s ease-out',
            }}
          />
          {/* Mid wave - medium, undulating */}
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse 90% 60% at ${35 + (isPlaying ? Math.sin(Date.now() / 600 + 2) * 20 * levels.mid : 0)}% ${40 + (isPlaying ? Math.cos(Date.now() / 700 + 1) * 12 * levels.mid : 0)}%, hsl(331 100% 60% / ${isPlaying ? 0.04 + levels.mid * 0.16 : 0.02}) 0%, transparent 60%)`,
              transition: 'background 0.12s ease-out',
            }}
          />
          {/* Treble shimmer - small, fast */}
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse 60% 40% at ${65 + (isPlaying ? Math.sin(Date.now() / 400 + 4) * 18 * levels.treble : 0)}% ${30 + (isPlaying ? Math.cos(Date.now() / 500 + 3) * 15 * levels.treble : 0)}%, hsl(189 100% 62% / ${isPlaying ? 0.03 + levels.treble * 0.12 : 0.015}) 0%, transparent 50%)`,
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
          {/* === MAIN TITLE === */}
          <div className="mb-6 relative">
            <BassParticles bass={levels.bass} overall={levels.overall} isPlaying={isPlaying} palette={genrePalette} />

            {/* Equalizer rozciągnięty NAD CAŁYM tytułem — bez obramówek, audio-reaktywny */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 -top-2 bottom-1 z-0 flex items-end gap-[3px] sm:gap-[4px]"
              style={{
                opacity: isPlaying ? 0.85 : 0.62,
                filter: isPlaying
                  ? `drop-shadow(0 0 ${18 + levels.overall * 22}px hsl(300 100% 66% / 0.6))`
                  : "drop-shadow(0 0 12px hsl(300 100% 66% / 0.4))",
                transition: "opacity .3s ease-out",
              }}
            >
              {blendedFrequencies.map((f, i) => {
                const boosted = Math.min(1, f * 1.9);
                const hue = i < 6 ? 331 : i < 12 ? 285 : 200; // pink / magenta-violet / cyan
                return (
                  <div
                    key={`title-eq-${i}`}
                    className="flex-1 rounded-t-[3px]"
                    style={{
                      height: `${Math.max(10, boosted * 100)}%`,
                      background: `linear-gradient(to top, hsl(${hue} 100% 60% / 0.75), hsl(${hue} 100% 74% / 0.22))`,
                      boxShadow: `0 0 8px hsl(${hue} 100% 65% / ${0.25 + boosted * 0.4})`,
                      transition: "height 0.05s ease-out",
                    }}
                  />
                );
              })}
            </div>

            <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold leading-tight relative z-10">
              <span className="block">Music That</span>
              <span className="block groove-gradient-text mt-1">Understands You</span>
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
                className="relative isolate inline-flex rounded-full"
              >
                <span aria-hidden className="pointer-events-none absolute -inset-[2px] rounded-full z-0 opacity-55 blur-[4px] animate-spin" style={{ background: "conic-gradient(from 0deg,#ff3d9a,#8b4dff,#38e6ff,#ffb15c,#ff3d9a)", animationDuration: `${6 + i * 1.3}s` }} />
                <span className="relative z-10 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.06] backdrop-blur-md px-3.5 py-1.5 text-xs font-medium text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_0_0_1px_hsl(315_100%_72%/0.18),0_0_18px_-8px_hsl(300_100%_66%/0.5)]">
                  <tag.icon className="h-3.5 w-3.5" />
                  {tag.label}
                </span>
              </motion.div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 mb-8">
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="relative rounded-full isolate">
              <span aria-hidden className="pointer-events-none absolute -inset-[2px] rounded-full z-0 opacity-60 blur-[5px] animate-spin" style={{ background: "conic-gradient(from 0deg,#ff3d9a,#8b4dff,#38e6ff,#ffb15c,#ff3d9a)", animationDuration: "6s" }} />
              <Button size="lg" className={GLASS_BTN + " z-10"} onClick={() => navigate("/studio")}>
                <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full" style={{ background: "linear-gradient(180deg, rgba(255,255,255,.26), transparent 42%)" }} />
                <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(100deg, transparent 20%, rgba(255,255,255,.32) 50%, transparent 80%)", animation: "shimmer 3.6s ease-in-out infinite", willChange: "transform" }} />
                <span className="relative z-10 inline-flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  GrouAI Studio
                </span>
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="relative rounded-full isolate">
              <span aria-hidden className="pointer-events-none absolute -inset-[2px] rounded-full z-0 opacity-60 blur-[5px] animate-spin" style={{ background: "conic-gradient(from 180deg,#38e6ff,#8b4dff,#ff3d9a,#ffb15c,#38e6ff)", animationDuration: "7s" }} />
              <Button size="lg" className={GLASS_BTN + " z-10"} onClick={() => navigate("/radio-live")}>
                <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full" style={{ background: "linear-gradient(180deg, rgba(255,255,255,.26), transparent 42%)" }} />
                <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(100deg, transparent 20%, rgba(255,255,255,.32) 50%, transparent 80%)", animation: "shimmer 3.6s ease-in-out infinite", animationDelay: "0.6s", willChange: "transform" }} />
                <span className="relative z-10 inline-flex items-center gap-2">
                  <Radio className="h-5 w-5" />
                  {t("hero.liveRadio")}
                </span>
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
