import { useEffect, useRef } from "react";

const NOTE_CHARS = ["♩", "♪", "♫", "♬", "𝄞", "♭", "♯"];
const COLORS = [
  "hsl(25, 95%, 55%)",   // orange
  "hsl(35, 92%, 50%)",   // amber
  "hsl(15, 90%, 50%)",   // deep orange
  "hsl(40, 95%, 58%)",   // gold
  "hsl(20, 88%, 52%)",   // warm orange
];

interface MatrixNotesProps {
  enabled: boolean;
  width?: number;
  height?: number;
}

export const MatrixNotes = ({ enabled, width = 280, height = 96 }: MatrixNotesProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = width * 2;
    canvas.height = height * 2;
    ctx.scale(2, 2);

    const fontSize = 10;
    const columns = Math.floor(width / fontSize);
    const drops = Array.from({ length: columns }, () => Math.random() * -10);
    const charColors = Array.from({ length: columns }, () => COLORS[Math.floor(Math.random() * COLORS.length)]);
    const speeds = Array.from({ length: columns }, () => 0.3 + Math.random() * 0.4);

    let animId: number;
    let lastTime = 0;

    const draw = (time: number) => {
      const delta = time - lastTime;
      if (delta < 50) {
        animId = requestAnimationFrame(draw);
        return;
      }
      lastTime = time;

      ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
      ctx.fillRect(0, 0, width, height);

      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < columns; i++) {
        const char = NOTE_CHARS[Math.floor(Math.random() * NOTE_CHARS.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        // Shimmer: randomly shift color occasionally
        if (Math.random() > 0.97) {
          charColors[i] = COLORS[Math.floor(Math.random() * COLORS.length)];
        }

        const alpha = 0.3 + Math.sin(time * 0.002 + i) * 0.2;
        ctx.globalAlpha = Math.max(0.1, alpha);
        ctx.fillStyle = charColors[i];
        ctx.fillText(char, x, y);

        if (y > height && Math.random() > 0.95) {
          drops[i] = 0;
        }
        drops[i] += speeds[i];
      }

      ctx.globalAlpha = 1;
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
      style={{
        width,
        height,
        opacity: 0.5,
        mixBlendMode: "screen",
      }}
    />
  );
};
