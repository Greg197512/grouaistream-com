import { useEffect, useRef } from "react";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAudioAnalyser } from "@/hooks/useAudioAnalyser";

/** Equalizer strony głównej: kolumny z izometrycznych klocków. */
export const HomeMusicVisualizer = () => {
  const { audioElement, isPlaying, isVideoMode } = usePlayer();
  const levels = useAudioAnalyser(audioElement, isPlaying, isVideoMode, 16);
  const state = useRef({ levels, isPlaying });
  state.current = { levels, isPlaying };
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lowPower = document.documentElement.dataset.lowpower === "on";
    const cols = lowPower ? 7 : 10;
    let width = 0;
    let height = 0;
    let frame = 0;
    let last = 0;
    const chips: { x: number; y: number; life: number; vy: number; hue: number }[] = [];

    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.5);
      canvas.width = Math.max(1, width * dpr);
      canvas.height = Math.max(1, height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const cube = (
      x: number,
      base: number,
      w: number,
      h: number,
      dx: number,
      dy: number,
      hue: number,
      lit: number,
    ) => {
      ctx.fillStyle = `hsl(${hue} 72% ${lit}%)`;
      ctx.beginPath();
      ctx.moveTo(x, base);
      ctx.lineTo(x + w, base);
      ctx.lineTo(x + w, base - h);
      ctx.lineTo(x, base - h);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = `hsl(${hue} 86% ${Math.min(90, lit + 20)}%)`;
      ctx.beginPath();
      ctx.moveTo(x, base - h);
      ctx.lineTo(x + dx, base - h - dy);
      ctx.lineTo(x + w + dx, base - h - dy);
      ctx.lineTo(x + w, base - h);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = `hsl(${hue} 64% ${Math.max(14, lit - 16)}%)`;
      ctx.beginPath();
      ctx.moveTo(x + w, base);
      ctx.lineTo(x + w + dx, base - dy);
      ctx.lineTo(x + w + dx, base - h - dy);
      ctx.lineTo(x + w, base - h);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = `hsl(${hue} 100% 92% / 0.28)`;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(x, base - h);
      ctx.lineTo(x + dx, base - h - dy);
      ctx.lineTo(x + w + dx, base - h - dy);
      ctx.stroke();
    };

    const paint = (now: number) => {
      ctx.clearRect(0, 0, width, height);
      const { levels: l, isPlaying: playing } = state.current;
      const dx = lowPower ? 6 : 9;
      const dy = lowPower ? 5 : 7;
      const gap = 10;
      const cw = Math.max(18, (width - dx - 16) / cols - gap);
      const unit = Math.max(16, Math.min(cw * 0.72, (height - 18) / 4.4));
      const step = unit + 3;
      const maxStack = Math.max(2, Math.floor((height - dy - 8) / step));
      const floor = height - 3;

      ctx.strokeStyle = "hsl(280 40% 70% / 0.16)";
      ctx.lineWidth = 1;
      for (let g = 0; g < 4; g++) {
        const y = floor - g * 7;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y - g * 2);
        ctx.stroke();
      }

      for (let i = 0; i < cols; i++) {
        const freq = l.frequencies[Math.min(l.frequencies.length - 1, i)] || 0;
        const wave = 0.5 + 0.5 * Math.sin(i * 1.15 + (reduced ? 0 : now / 1400));
        const idle = 0.2 + wave * 0.8;
        const value = playing && !reduced ? Math.max(0.16, freq) : idle;
        const stacks = Math.max(1, Math.round(value * maxStack));
        const hue = 262 + (i / cols) * 78;
        const x = 4 + i * (cw + gap);
        for (let s = 0; s < stacks; s++) {
          const lift = playing && !reduced ? Math.sin(now / 280 + i * 0.4 + s) * 0.6 : 0;
          const base = floor - s * step + lift;
          cube(x, base, cw, unit, dx, dy, hue, 38 + s * 5 + value * 12);
        }
      }

      if (playing && !reduced && !lowPower && chips.length < 10 && Math.random() < 0.18) {
        const i = Math.floor(Math.random() * cols);
        chips.push({
          x: 4 + i * (cw + gap) + cw / 2,
          y: floor - 8,
          life: 1,
          vy: 18 + (l.bass || 0.2) * 36,
          hue: 268 + Math.random() * 70,
        });
      }
      const dt = Math.min((now - last) / 1000, 0.1);
      for (let i = chips.length - 1; i >= 0; i--) {
        const chip = chips[i];
        chip.life -= dt * 0.7;
        chip.y -= dt * chip.vy;
        if (chip.life <= 0) {
          chips.splice(i, 1);
          continue;
        }
        cube(chip.x, chip.y, 5, 4, 3, 2, chip.hue, 62);
      }
    };

    const draw = (now: number) => {
      const interval = lowPower ? 100 : 40;
      if (!document.hidden && now - last >= interval) {
        paint(now);
        last = now;
      }
      if (reduced) return;
      frame = requestAnimationFrame(draw);
    };

    paint(performance.now());
    if (!reduced) frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
};
