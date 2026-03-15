import { useEffect, useRef } from "react";

const NOTE_CHARS = ["♩", "♪", "♫", "♬", "𝄞", "♭", "♯"];

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

    const dpr = 2;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const fontSize = 11;
    const columns = Math.floor(width / fontSize);
    const drops = Array.from({ length: columns }, () => Math.random() * -(height / fontSize));
    const speeds = Array.from({ length: columns }, () => 0.25 + Math.random() * 0.35);

    let animId: number;
    let lastTime = 0;

    const draw = (time: number) => {
      const delta = time - lastTime;
      if (delta < 45) {
        animId = requestAnimationFrame(draw);
        return;
      }
      lastTime = time;

      // Fade trail
      ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
      ctx.fillRect(0, 0, width, height);

      ctx.font = `bold ${fontSize}px monospace`;
      ctx.textAlign = "center";

      for (let i = 0; i < columns; i++) {
        const char = NOTE_CHARS[Math.floor(Math.random() * NOTE_CHARS.length)];
        const x = i * fontSize + fontSize / 2;
        const y = drops[i] * fontSize;

        // Shimmer hue shift
        const hue = 20 + Math.sin(time * 0.003 + i * 0.7) * 15;
        const lightness = 55 + Math.sin(time * 0.002 + i * 1.3) * 10;
        const alpha = 0.6 + Math.sin(time * 0.004 + i * 0.9) * 0.3;

        // Head note — bright
        ctx.globalAlpha = Math.max(0.3, alpha);
        ctx.fillStyle = `hsl(${hue}, 95%, ${lightness}%)`;
        ctx.shadowColor = `hsl(${hue}, 90%, 50%)`;
        ctx.shadowBlur = 6;
        ctx.fillText(char, x, y);

        // Trail note — dimmer
        if (drops[i] > 1) {
          ctx.globalAlpha = Math.max(0.1, alpha * 0.35);
          ctx.shadowBlur = 2;
          ctx.fillText(
            NOTE_CHARS[Math.floor(Math.random() * NOTE_CHARS.length)],
            x,
            y - fontSize
          );
        }

        // Reset
        if (y > height + fontSize) {
          drops[i] = Math.random() * -3;
        }
        drops[i] += speeds[i];
      }

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
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
