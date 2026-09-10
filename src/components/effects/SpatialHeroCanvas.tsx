// Przestrzenna warstwa hero — pole cząstek z głębią (parallax pod kursor) + miękka
// aurora, w barwach marki. Canvas 2D (lekkie, bez WebGL/kontekstu do utraty).
// RENDER TYLKO NA MOCNYM SPRZĘCIE: przy <html data-lowpower>, prefers-reduced-motion
// lub ekranie dotykowym komponent nie montuje canvasu (zwraca null) — słabe
// urządzenia zostają na dotychczasowym, lekkim tle. Zatrzymuje rAF, gdy karta ukryta.
import { useEffect, useRef, useState } from "react";

interface Props { className?: string }

function heavyEffectsOff(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (document.documentElement.getAttribute("data-lowpower") !== null) return true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
    if (window.matchMedia("(pointer: coarse)").matches) return true;
    if ((navigator as any).deviceMemory && (navigator as any).deviceMemory <= 4) return true;
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) return true;
  } catch { /* */ }
  return false;
}

const HUES = ["255,45,177", "169,92,255", "255,122,26"]; // magenta / fiolet / pomarańcz

export function SpatialHeroCanvas({ className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const raf = useRef<number | null>(null);
  const pointer = useRef({ x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 });
  const [on, setOn] = useState(false);

  useEffect(() => { setOn(!heavyEffectsOff()); }, []);

  useEffect(() => {
    if (!on) return;
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;

    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = 0, h = 0;
    const resize = () => {
      const p = canvas.parentElement; if (!p) return;
      w = p.offsetWidth; h = p.offsetHeight;
      canvas.width = Math.floor(w * DPR); canvas.height = Math.floor(h * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Cząstki z głębią (z: 0 daleko … 1 blisko).
    const N = 64;
    const P = Array.from({ length: N }, () => ({
      x: Math.random(), y: Math.random(), z: Math.random(),
      s: 0.4 + Math.random() * 0.6, hue: HUES[(Math.random() * HUES.length) | 0],
      vy: 0.00006 + Math.random() * 0.00014,
    }));

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      pointer.current.tx = (e.clientX - r.left) / r.width;
      pointer.current.ty = (e.clientY - r.top) / r.height;
    };
    window.addEventListener("pointermove", onMove);

    let t = 0;
    const draw = () => {
      t += 0.0032;
      // płynne dochodzenie parallaxu
      pointer.current.x += (pointer.current.tx - pointer.current.x) * 0.05;
      pointer.current.y += (pointer.current.ty - pointer.current.y) * 0.05;
      const par = (pointer.current.x - 0.5);
      const parY = (pointer.current.y - 0.5);

      ctx.clearRect(0, 0, w, h);

      // Dwie dryfujące poświaty aurora.
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 2; i++) {
        const cx = w * (0.4 + 0.3 * Math.sin(t * (0.5 + i * 0.3) + i)) - par * 40 * (i + 1);
        const cy = h * (0.45 + 0.25 * Math.cos(t * (0.4 + i * 0.25) + i)) - parY * 30 * (i + 1);
        const rad = Math.max(w, h) * (0.45 + 0.1 * i);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g.addColorStop(0, `rgba(${HUES[i]},0.10)`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
      }

      // Cząstki z parallaxem wg głębi.
      for (const p of P) {
        p.y -= p.vy; if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
        const depth = 0.35 + p.z * 0.65;
        const px = (p.x - 0.5 + par * 0.12 * depth) * w + w / 2;
        const py = (p.y - 0.5 + parY * 0.10 * depth) * h + h / 2;
        const r = p.s * (0.6 + p.z * 2.2);
        const a = (0.10 + p.z * 0.35);
        ctx.beginPath();
        ctx.fillStyle = `rgba(${p.hue},${a.toFixed(3)})`;
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf.current = requestAnimationFrame(draw);
    };
    const start = () => { if (raf.current == null) raf.current = requestAnimationFrame(draw); };
    const stop = () => { if (raf.current != null) { cancelAnimationFrame(raf.current); raf.current = null; } };
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    start();

    return () => {
      stop();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [on]);

  if (!on) return null;
  return (
    <canvas
      ref={ref}
      aria-hidden
      className={className}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity: 0.7, mixBlendMode: "screen" }}
    />
  );
}
