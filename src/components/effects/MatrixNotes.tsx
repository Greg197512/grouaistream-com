import { useEffect, useRef } from "react";

const NOTE_CHARS = ["♩", "♪", "♫", "♬", "𝄞", "𝄢", "♭", "♯", "𝅘𝅥", "𝅗𝅥", "𝅘𝅥𝅮", "𝅘𝅥𝅯"];

export const MatrixNotes = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const fontSize = 14;
    let columns = 0;
    let drops: number[] = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      columns = Math.floor(canvas.width / fontSize);
      drops = Array.from({ length: columns }, () => Math.random() * -50);
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      // Semi-transparent black to create trail effect
      ctx.fillStyle = "rgba(0, 0, 0, 0.06)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < columns; i++) {
        const char = NOTE_CHARS[Math.floor(Math.random() * NOTE_CHARS.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        // Brighter head
        const alpha = 0.15 + Math.random() * 0.25;
        const hue = 25 + Math.random() * 15; // warm orange matching theme
        ctx.font = `${fontSize}px monospace`;
        ctx.fillStyle = `hsla(${hue}, 90%, 60%, ${alpha})`;
        ctx.fillText(char, x, y);

        // Dimmer trailing glow
        if (drops[i] > 1) {
          ctx.fillStyle = `hsla(${hue}, 80%, 45%, ${alpha * 0.3})`;
          ctx.fillText(
            NOTE_CHARS[Math.floor(Math.random() * NOTE_CHARS.length)],
            x,
            y - fontSize
          );
        }

        // Reset or advance
        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i] += 0.4 + Math.random() * 0.3;
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-0 opacity-40"
      style={{ mixBlendMode: "screen" }}
    />
  );
};
