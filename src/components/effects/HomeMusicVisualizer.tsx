import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAudioAnalyser } from "@/hooks/useAudioAnalyser";

/**
 * HomeMusicVisualizer — spektrum na stronie głównej.
 * Przestrzenne (przechył 3D reagujący na bas + wytłoczone słupki + lustrzane
 * odbicie z zanikiem), zawsze dopasowane do motywu strony (kolor z tokenów
 * --primary/--background, nie na sztywno), z animowanym podpisem pod spektrum
 * (co gra teraz / ambientowy tekst w ciszy).
 */
export const HomeMusicVisualizer = () => {
  const { audioElement, isPlaying, isVideoMode, currentTrack } = usePlayer();
  const levels = useAudioAnalyser(audioElement, isPlaying, isVideoMode, 32);
  const state = useRef({ levels, isPlaying });
  state.current = { levels, isPlaying };
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const lowPower = document.documentElement.dataset.lowpower === "on";
    // Bazowy bursztyn z tokenów (36 85% 65%) — reszta palety pochodzi z niego.
    const token = getComputedStyle(canvas).getPropertyValue("--premium-highlight").trim();
    const [h, s] = (token || "36 85% 65%").split(/\s+/).map(parseFloat);
    const HUE = Number.isFinite(h) ? h : 36;
    const SAT = Number.isFinite(s) ? s : 85;
    let width = 0, height = 0, barsH = 0, reflH = 0, frame = 0, last = 0, tilt = 0;
    const sparks: { x: number; y: number; life: number; speed: number; hue: number }[] = [];
    let barGrad: CanvasGradient | null = null;
    let reflGrad: CanvasGradient | null = null;
    const resize = () => {
      width = canvas.clientWidth; height = canvas.clientHeight;
      barsH = height * 0.72; reflH = height - barsH;
      const dpr = Math.min(window.devicePixelRatio, 1.5);
      canvas.width = width * dpr; canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      barGrad = ctx.createLinearGradient(0, barsH, 0, 0);
      barGrad.addColorStop(0, `hsl(${HUE} ${SAT}% 46%)`);
      barGrad.addColorStop(0.55, `hsl(${HUE} ${SAT}% 60%)`);
      barGrad.addColorStop(1, `hsl(${HUE + 8} ${SAT}% 74%)`);
      reflGrad = ctx.createLinearGradient(0, barsH, 0, height);
      reflGrad.addColorStop(0, `hsl(${HUE} ${SAT}% 55% / .3)`);
      reflGrad.addColorStop(1, `hsl(${HUE} ${SAT}% 55% / 0)`);
    };
    const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
    const draw = (now: number) => {
      if (now - last >= (lowPower ? 100 : 40) && !document.hidden) {
        const dt = Math.min((now - last) / 1000, .1); last = now;
        ctx.clearRect(0, 0, width, height);
        const { levels: l, isPlaying: playing } = state.current;
        const step = width / 32;

        // Przechył 3D całej płyty — delikatny, mocniejszy przy mocnym basie.
        if (tiltRef.current && !reduced.matches) {
          const target = playing ? -4 - l.bass * 6 : -2;
          tilt += (target - tilt) * 0.08;
          tiltRef.current.style.transform = `perspective(600px) rotateX(${tilt}deg)`;
        }

        for (let i = 0; i < 32; i++) {
          const value = playing && !reduced.matches ? (l.frequencies[i] || .12) : .16 + Math.sin(i * .7) * .09;
          const bar = Math.max(5, value * barsH * .9);
          const x = i * step;

          // 0) wytłoczony bok słupka — ciemniejszy równoległobok daje wrażenie głębi/3D.
          const sideW = Math.max(1.5, step * 0.22);
          ctx.fillStyle = `hsl(${HUE} ${SAT}% 28% / ${.5 + value * .2})`;
          ctx.beginPath();
          ctx.moveTo(x + step - 2, barsH - bar);
          ctx.lineTo(x + step - 2 + sideW, barsH - bar - sideW * 0.6);
          ctx.lineTo(x + step - 2 + sideW, barsH - sideW * 0.6);
          ctx.lineTo(x + step - 2, barsH);
          ctx.closePath(); ctx.fill();

          // 1) miękka poświata za słupkiem
          ctx.fillStyle = `hsl(${HUE + 4} 100% 55% / ${.14 + value * .2})`;
          ctx.fillRect(x - 1, barsH - bar, Math.max(4, step), bar + 3);
          // 2) ciało słupka — gradient bursztyn→pomarańcz
          ctx.fillStyle = barGrad || `hsl(${HUE} ${SAT}% 55%)`;
          ctx.fillRect(x + 2, barsH - bar, Math.max(2, step - 4), bar);
          // 3) jasna, holograficzna nasadka
          ctx.fillStyle = `hsl(${HUE + 14} 100% 84% / .95)`;
          ctx.fillRect(x + 2, barsH - bar - 2, Math.max(2, step - 4), 2);

          // 4) lustrzane odbicie pod linią bazową, zanikające w dół.
          const rb = Math.min(reflH, bar * 0.55);
          ctx.fillStyle = `hsl(${HUE} ${SAT}% 50% / ${.22 + value * .18})`;
          ctx.fillRect(x + 2, barsH, Math.max(2, step - 4), rb);
        }

        // Przykryj strefę odbicia gradientem zanikającym do przezroczystości (podłoga).
        if (reflGrad) { ctx.fillStyle = reflGrad; ctx.fillRect(0, barsH, width, reflH); }

        // 5) holograficzny, tęczowy połysk — tylko na już narysowanych słupkach.
        if (!reduced.matches) {
          const phase = (now / 3600) % 1;
          const sheen = ctx.createLinearGradient(0, 0, width, 0);
          const stops = [HUE + 40, HUE + 190, HUE + 300, HUE + 90, HUE + 40];
          stops.forEach((hu, k) => {
            let off = k / (stops.length - 1) - phase;
            off = ((off % 1) + 1) % 1;
            sheen.addColorStop(Math.min(1, Math.max(0, off)), `hsl(${hu} 90% 65% / .18)`);
          });
          ctx.globalCompositeOperation = "source-atop";
          ctx.fillStyle = sheen;
          ctx.fillRect(0, 0, width, barsH);
          ctx.globalCompositeOperation = "source-over";
        }
        if (playing && !reduced.matches && sparks.length < (lowPower ? 12 : 42)) {
          sparks.push({ x: Math.random() * width, y: barsH, life: 1, speed: 28 + l.bass * 70, hue: HUE + Math.random() * 24 - 8 });
        }
        for (let i = sparks.length - 1; i >= 0; i--) {
          const spark = sparks[i]; spark.life -= dt * .45; spark.y -= dt * spark.speed;
          if (!playing || spark.life <= 0) { sparks.splice(i, 1); continue; }
          ctx.fillStyle = `hsl(${spark.hue} 100% ${55 + spark.life * 18}% / ${spark.life})`;
          ctx.beginPath(); ctx.ellipse(spark.x, spark.y, 1, 2.5, .25, 0, Math.PI * 2); ctx.fill();
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, []);

  const label = isPlaying && currentTrack
    ? `${currentTrack.title}${currentTrack.artist ? ` — ${currentTrack.artist}` : ""}`
    : "GrouAI Stream · żywy dźwięk, na żywo z Tobą";

  return (
    <div className="flex flex-col gap-1.5">
      {/* Poświata w kolorach motywu strony, żeby spektrum zawsze pasowało do tła. */}
      <div
        ref={tiltRef}
        className="relative h-20 overflow-hidden rounded-xl transition-transform"
        style={{ transformStyle: "preserve-3d" }}
      >
        <div
          className="pointer-events-none absolute -inset-4"
          style={{ background: "radial-gradient(ellipse at 50% 30%, hsl(var(--primary) / 0.16), hsl(var(--background) / 0) 70%)" }}
        />
        <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
      </div>

      {/* Podpis pod spektrum — zawsze widoczny, animowany przy zmianie utworu. */}
      <AnimatePresence mode="wait">
        <motion.p
          key={isPlaying ? currentTrack?.id || "playing" : "idle"}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="groove-gradient-text truncate text-xs font-semibold tracking-wide sm:text-sm"
        >
          {label}
        </motion.p>
      </AnimatePresence>
    </div>
  );
};
