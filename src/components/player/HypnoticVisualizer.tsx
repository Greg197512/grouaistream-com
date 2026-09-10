// Hipnotyczny wizualizer do FullscreenPlayer — płynne, pulsujące fale i poświaty
// w barwach marki. WAŻNE: nie dotyka Web Audio (AnalyserNode wymagałby CORS,
// którego R2 nie daje → zepsułoby odtwarzanie). Ruch napędza czas + stan grania,
// nie realne FFT. Na słabym sprzęcie / reduced-motion: statyczny, delikatny gradient.
import { useEffect, useRef } from "react";

interface Props { active: boolean; className?: string }

function reduced(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (document.documentElement.getAttribute("data-lowpower") !== null) return true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  } catch { /* */ }
  return false;
}

// Barwy marki (magenta / fiolet / pomarańcz).
const HUES = [
  [255, 45, 177], // magenta
  [169, 92, 255], // fiolet
  [255, 122, 26], // pomarańcz
];

export function HypnoticVisualizer({ active, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const raf = useRef<number | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Wersja lite: jeden statyczny, miękki gradient i koniec — zero animacji.
    if (reduced()) {
      const w = (canvas.width = canvas.offsetWidth);
      const h = (canvas.height = canvas.offsetHeight);
      const g = ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.4, Math.max(w, h) * 0.7);
      g.addColorStop(0, "rgba(169,92,255,0.16)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      return;
    }

    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = 0, h = 0;
    const resize = () => {
      w = canvas.offsetWidth; h = canvas.offsetHeight;
      canvas.width = Math.floor(w * DPR); canvas.height = Math.floor(h * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    let t = 0;          // faza czasu
    let energy = 0;     // 0..1, rośnie gdy gra, opada gdy pauza — daje „oddech"
    const orbs = HUES.map((c, i) => ({ c, phase: i * 2.1, sx: 0.6 + i * 0.25, sy: 0.5 + i * 0.3 }));

    const draw = () => {
      const target = activeRef.current ? 1 : 0.28;
      energy += (target - energy) * 0.02;                 // płynne dochodzenie
      const speed = 0.006 + energy * 0.012;
      t += speed;
      const beat = 0.5 + 0.5 * Math.sin(t * 2.2);         // pseudo-puls
      const amp = 0.5 + energy * (0.5 + beat * 0.5);

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      // Trzy dryfujące poświaty (orby).
      orbs.forEach((o, i) => {
        const cx = w * (0.5 + 0.32 * Math.sin(t * o.sx + o.phase));
        const cy = h * (0.5 + 0.30 * Math.cos(t * o.sy + o.phase * 1.3));
        const rad = Math.max(w, h) * (0.28 + 0.10 * Math.sin(t * 1.4 + i)) * (0.7 + amp * 0.5);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        const a = (0.10 + energy * 0.16).toFixed(3);
        g.addColorStop(0, `rgba(${o.c[0]},${o.c[1]},${o.c[2]},${a})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
      });

      // Faliste linie (hipnotyczny „strumień").
      ctx.globalCompositeOperation = "screen";
      for (let L = 0; L < 3; L++) {
        const [r, gc, b] = HUES[L];
        ctx.beginPath();
        for (let x = 0; x <= w; x += 8) {
          const y = h * 0.5
            + Math.sin(x * 0.006 + t * (1.1 + L * 0.4)) * (36 + amp * 60) * (1 - L * 0.2)
            + Math.sin(x * 0.013 - t * 1.7) * (14 + amp * 22);
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(${r},${gc},${b},${(0.06 + energy * 0.10).toFixed(3)})`;
        ctx.lineWidth = 2 + L;
        ctx.stroke();
      }

      raf.current = requestAnimationFrame(draw);
    };
    raf.current = requestAnimationFrame(draw);

    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={className}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    />
  );
}
