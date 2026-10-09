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
    const color = getComputedStyle(canvas).getPropertyValue("--premium-highlight").trim();
    let width = 0, height = 0, frame = 0, last = 0;
    const sparks: { x: number; y: number; life: number; speed: number }[] = [];
    const resize = () => {
      width = canvas.clientWidth; height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio, 1.5);
      canvas.width = width * dpr; canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
    const draw = (now: number) => {
      if (now - last >= (lowPower ? 100 : 40) && !document.hidden) {
        const dt = Math.min((now - last) / 1000, .1); last = now;
        ctx.clearRect(0, 0, width, height);
        const { levels: l, isPlaying: playing } = state.current;
        const step = width / 32;
        for (let i = 0; i < 32; i++) {
          const value = playing && !reduced.matches ? (l.frequencies[i] || .12) : .12 + Math.sin(i * .7) * .07;
          const bar = Math.max(4, value * height * .62);
          ctx.fillStyle = `hsl(${color} / .65)`;
          ctx.fillRect(i * step + 2, height - bar, Math.max(2, step - 4), bar);
        }
        if (playing && !reduced.matches && sparks.length < (lowPower ? 12 : 42)) {
          sparks.push({ x: Math.random() * width, y: height, life: 1, speed: 28 + l.bass * 70 });
        }
        for (let i = sparks.length - 1; i >= 0; i--) {
          const spark = sparks[i]; spark.life -= dt * .45; spark.y -= dt * spark.speed;
          if (!playing || spark.life <= 0) { sparks.splice(i, 1); continue; }
          ctx.fillStyle = `hsl(${color} / ${spark.life})`;
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