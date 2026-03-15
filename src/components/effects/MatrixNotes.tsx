import { useEffect, useRef } from "react";

const NOTE_CHARS = ["♩", "♪", "♫", "♬", "𝄞", "♭", "♯", "𝅘𝅥", "𝅗𝅥"];

interface NoteParticle {
  x: number;
  y: number;
  speed: number;
  char: string;
  hue: number;
  size: number;
  alpha: number;
  wobble: number;
}

interface MatrixNotesProps {
  enabled: boolean;
  width?: number;
  height?: number;
}

export const MatrixNotes = ({ enabled, width = 280, height = 96 }: MatrixNotesProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<NoteParticle[]>([]);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = 2;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Create particles
    const count = Math.max(8, Math.floor(width / 18));
    particlesRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      speed: 0.3 + Math.random() * 0.5,
      char: NOTE_CHARS[Math.floor(Math.random() * NOTE_CHARS.length)],
      hue: 15 + Math.random() * 30, // orange range
      size: 12 + Math.random() * 6,
      alpha: 0.5 + Math.random() * 0.5,
      wobble: Math.random() * Math.PI * 2,
    }));

    let animId: number;

    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height);
      const particles = particlesRef.current;

      for (const p of particles) {
        // Move down
        p.y += p.speed;
        p.wobble += 0.02;
        const xOff = Math.sin(p.wobble) * 3;

        // Reset at bottom
        if (p.y > height + p.size) {
          p.y = -p.size;
          p.x = Math.random() * width;
          p.char = NOTE_CHARS[Math.floor(Math.random() * NOTE_CHARS.length)];
          p.hue = 15 + Math.random() * 30;
        }

        // Shimmer alpha
        const shimmer = 0.3 + Math.sin(time * 0.003 + p.wobble * 5) * 0.25;
        const a = p.alpha * shimmer + 0.2;

        // Draw glow
        ctx.save();
        ctx.globalAlpha = a * 0.4;
        ctx.shadowColor = `hsl(${p.hue}, 100%, 55%)`;
        ctx.shadowBlur = 12;
        ctx.font = `bold ${p.size}px serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = `hsl(${p.hue}, 100%, 60%)`;
        ctx.fillText(p.char, p.x + xOff, p.y);
        ctx.restore();

        // Draw note
        ctx.save();
        ctx.globalAlpha = a;
        ctx.font = `bold ${p.size}px serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = `hsl(${p.hue}, 95%, ${55 + Math.sin(time * 0.004 + p.wobble) * 10}%)`;
        ctx.fillText(p.char, p.x + xOff, p.y);
        ctx.restore();
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [enabled, width, height]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-0"
      style={{ width, height }}
    />
  );
};
