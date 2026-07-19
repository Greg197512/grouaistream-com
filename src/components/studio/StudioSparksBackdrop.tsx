import { useEffect, useRef } from "react";

/**
 * Iskry z płomienia — stabilne, ciche tło pod panelem generowania.
 * Fixed pełnoekranowe, pointer-events none, brak błysków — tylko unoszące
 * się drobne iskierki. Uruchamiane wyłącznie gdy `active` = true.
 */
export const StudioSparksBackdrop = ({ active }: { active: boolean }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; hue: number };
    const sparks: Spark[] = [];
    const MAX = 90;

    const spawn = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const count = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i++) {
        if (sparks.length >= MAX) break;
        sparks.push({
          x: Math.random() * w,
          y: h + 10,
          vx: (Math.random() - 0.5) * 0.6,
          vy: -0.6 - Math.random() * 1.4,
          life: 1,
          max: 2.5 + Math.random() * 2.5,
          size: 0.7 + Math.random() * 1.6,
          hue: 18 + Math.random() * 22,
        });
      }
    };

    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (Math.random() < 0.9) spawn();

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.life -= dt / p.max;
        if (p.life <= 0) { sparks.splice(i, 1); continue; }
        p.vy += -0.05 * dt; // lekki auftryb
        p.vx += (Math.random() - 0.5) * 0.05;
        p.x += p.vx;
        p.y += p.vy;
        const a = Math.max(0, Math.min(1, p.life)) * 0.85;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 100%, 60%, ${a})`;
        ctx.shadowColor = `hsla(${p.hue}, 100%, 55%, ${a * 0.9})`;
        ctx.shadowBlur = 8;
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [active]);

  if (!active) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[5] opacity-80"
    />
  );
};
