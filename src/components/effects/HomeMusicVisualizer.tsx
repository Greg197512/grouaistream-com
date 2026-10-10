import { useEffect, useRef } from "react";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAudioAnalyser } from "@/hooks/useAudioAnalyser";

export const HomeMusicVisualizer = () => {
  const { audioElement, isPlaying, isVideoMode } = usePlayer();
  const levels = useAudioAnalyser(audioElement, isPlaying, isVideoMode, 32);
  const state = useRef({ levels, isPlaying });
  state.current = { levels, isPlaying };
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
    let width = 0, height = 0, frame = 0, last = 0;
    const sparks: { x: number; y: number; life: number; speed: number; hue: number }[] = [];
    // Cached bar gradient (amber → deep orange, bottom → top); rebuilt on resize.
    let barGrad: CanvasGradient | null = null;
    const resize = () => {
      width = canvas.clientWidth; height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio, 1.5);
      canvas.width = width * dpr; canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      barGrad = ctx.createLinearGradient(0, height, 0, 0);
      barGrad.addColorStop(0, `hsl(${HUE} ${SAT}% 46%)`);
      barGrad.addColorStop(0.55, `hsl(${HUE} ${SAT}% 60%)`);
      barGrad.addColorStop(1, `hsl(${HUE + 8} ${SAT}% 74%)`);
    };
    const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
    const draw = (now: number) => {
      if (now - last >= (lowPower ? 100 : 40) && !document.hidden) {
        const dt = Math.min((now - last) / 1000, .1); last = now;
        ctx.clearRect(0, 0, width, height);
        const { levels: l, isPlaying: playing } = state.current;
        const step = width / 32;
        for (let i = 0; i < 32; i++) {
          const value = playing && !reduced.matches ? (l.frequencies[i] || .12) : .16 + Math.sin(i * .7) * .09;
          const bar = Math.max(5, value * height * .62);
          // 1) soft orange glow behind the bar (cheap, no shadowBlur)
          ctx.fillStyle = `hsl(${HUE + 4} 100% 55% / ${.14 + value * .2})`;
          ctx.fillRect(i * step - 1, height - bar, Math.max(4, step), bar + 3);
          // 2) amber→orange gradient body
          ctx.fillStyle = barGrad || `hsl(${HUE} ${SAT}% 55%)`;
          ctx.fillRect(i * step + 2, height - bar, Math.max(2, step - 4), bar);
          // 3) bright holographic cap
          ctx.fillStyle = `hsl(${HUE + 14} 100% 84% / .95)`;
          ctx.fillRect(i * step + 2, height - bar - 2, Math.max(2, step - 4), 2);
        }
        // 4) holographic iridescent sheen — one gradient, composited only onto
        //    what's already drawn (bars + sparks), so it reads as a shimmer on
        //    the orange, never a flat rainbow fill. Subtle: low alpha.
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
          ctx.fillRect(0, 0, width, height);
          ctx.globalCompositeOperation = "source-over";
        }
        if (playing && !reduced.matches && sparks.length < (lowPower ? 12 : 42)) {
          sparks.push({ x: Math.random() * width, y: height, life: 1, speed: 28 + l.bass * 70, hue: HUE + Math.random() * 24 - 8 });
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
  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />;
};
