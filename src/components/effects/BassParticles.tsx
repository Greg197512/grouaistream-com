import { useRef, useEffect, useCallback } from "react";
import type { GenreColorPalette } from "@/utils/genreColors";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
  brightness: number;
  type: "spark" | "ember" | "dot";
}

interface BassParticlesProps {
  bass: number;
  overall: number;
  isPlaying: boolean;
  palette?: GenreColorPalette;
  className?: string;
}

const MAX_PARTICLES = 120;
const BASS_THRESHOLD = 0.45;

export const BassParticles = ({ bass, overall, isPlaying, palette, className }: BassParticlesProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef(0);
  const lastBassRef = useRef(0);
  const dimensionsRef = useRef({ w: 0, h: 0 });

  const spawnParticles = useCallback((count: number, bassVal: number) => {
    const { w, h } = dimensionsRef.current;
    if (w === 0 || h === 0) return;

    // Use palette colors or default orange
    const baseHue = palette?.bassHue ?? 10;
    const hueRange = palette ? Math.abs(palette.trebleHue - palette.bassHue) : 30;
    const baseBrightness = palette?.brightness ?? 55;
    const darkness = palette?.darkness ?? 0;

    for (let i = 0; i < count; i++) {
      if (particlesRef.current.length >= MAX_PARTICLES) break;

      const spawnX = Math.random() * w;
      const spawnY = h * 0.3 + Math.random() * h * 0.4;

      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
      const speed = 1.5 + Math.random() * 4 * bassVal;
      const type = Math.random() < 0.3 ? "ember" : Math.random() < 0.6 ? "spark" : "dot";

      // Hue varies within the palette range
      const hue = baseHue + Math.random() * hueRange;
      // Dark genres get lower brightness
      const brightness = baseBrightness * (1 - darkness * 0.4) + Math.random() * 25;

      particlesRef.current.push({
        x: spawnX,
        y: spawnY,
        vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 2,
        vy: Math.sin(angle) * speed - Math.random() * 2,
        life: 1,
        maxLife: 0.6 + Math.random() * 0.8,
        size: type === "spark" ? 1.5 + Math.random() * 2.5 : type === "ember" ? 3 + Math.random() * 4 : 1 + Math.random() * 1.5,
        hue,
        brightness,
        type,
      });
    }
  }, [palette]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.scale(dpr, dpr);
      dimensionsRef.current = { w: rect.width, h: rect.height };
    };

    resize();
    window.addEventListener("resize", resize);

    const tick = () => {
      const { w, h } = dimensionsRef.current;
      ctx.clearRect(0, 0, w, h);

      if (!isPlaying) {
        particlesRef.current = [];
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const bassRise = bass - lastBassRef.current;
      lastBassRef.current = bass;

      if (bass > BASS_THRESHOLD && bassRise > 0.05) {
        const intensity = Math.min(1, (bass - BASS_THRESHOLD) / (1 - BASS_THRESHOLD));
        spawnParticles(Math.floor(6 + intensity * 18), intensity);
      }

      const dt = 1 / 60;
      const alive: Particle[] = [];
      const sat = palette?.saturation ?? 95;

      for (const p of particlesRef.current) {
        p.life -= dt / p.maxLife;
        if (p.life <= 0) continue;

        p.vy += 1.2 * dt;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;

        const alpha = p.life * p.life;

        if (p.type === "spark") {
          const len = Math.sqrt(p.vx * p.vx + p.vy * p.vy) * 2;
          const angle = Math.atan2(p.vy, p.vx);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(angle);
          ctx.beginPath();
          ctx.moveTo(-len / 2, 0);
          ctx.lineTo(len / 2, 0);
          ctx.strokeStyle = `hsla(${p.hue}, ${sat}%, ${p.brightness}%, ${alpha})`;
          ctx.lineWidth = p.size;
          ctx.lineCap = "round";
          ctx.shadowColor = `hsla(${p.hue}, 100%, ${p.brightness + 10}%, ${alpha * 0.6})`;
          ctx.shadowBlur = 6 + alpha * 8;
          ctx.stroke();
          ctx.restore();
        } else if (p.type === "ember") {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${p.hue}, ${sat - 5}%, ${p.brightness}%, ${alpha * 0.8})`;
          ctx.shadowColor = `hsla(${p.hue}, 100%, ${p.brightness + 15}%, ${alpha * 0.7})`;
          ctx.shadowBlur = 10 + alpha * 14;
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${p.hue + 10}, ${sat - 10}%, ${p.brightness + 10}%, ${alpha * 0.9})`;
          ctx.shadowColor = `hsla(${p.hue}, ${sat}%, 60%, ${alpha * 0.5})`;
          ctx.shadowBlur = 4;
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        alive.push(p);
      }

      particlesRef.current = alive;
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [isPlaying, bass, overall, spawnParticles, palette]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none z-20 ${className ?? ""}`}
    />
  );
};
