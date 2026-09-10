// GrouAI Core — reaktywna kula energii zastępująca gramofon w GrouAI Studio.
// Pulsuje i przyspiesza, gdy gra muzyka; sama jest przyciskiem play/pauza.
// Canvas 2D (tanie transformy/gradienty, bez Web Audio → nie psuje R2).
// Na słabym sprzęcie / reduced-motion: statyczny, świecący rdzeń (bez rAF).
import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

interface Props { active: boolean; onClick?: () => void; label?: string; sub?: string }

function reduced(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (document.documentElement.getAttribute("data-lowpower") !== null) return true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  } catch { /* */ }
  return false;
}

const HUES = ["255,45,177", "169,92,255", "255,122,26"]; // magenta / fiolet / pomarańcz

export function StudioCore({ active, onClick, label, sub }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const raf = useRef<number | null>(null);
  const activeRef = useRef(active); activeRef.current = active;
  const [lite, setLite] = useState(false);

  useEffect(() => { setLite(reduced()); }, []);

  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = 0, h = 0;
    const resize = () => {
      const p = canvas.parentElement; if (!p) return;
      const size = Math.min(p.offsetWidth, p.offsetHeight);
      w = h = size;
      canvas.width = Math.floor(size * DPR); canvas.height = Math.floor(size * DPR);
      canvas.style.width = canvas.style.height = size + "px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Wersja lite: jeden statyczny, świecący rdzeń.
    if (lite) {
      const cx = w / 2, cy = h / 2, r = w * 0.34;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.6);
      g.addColorStop(0, "rgba(255,180,80,0.95)");
      g.addColorStop(0.4, "rgba(255,45,177,0.5)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, r * 1.6, 0, Math.PI * 2); ctx.fill();
      return () => window.removeEventListener("resize", resize);
    }

    const N = 26;
    const parts = Array.from({ length: N }, (_, i) => ({
      a: (i / N) * Math.PI * 2, r: 0.55 + Math.random() * 0.5,
      sp: 0.3 + Math.random() * 0.8, hue: HUES[i % HUES.length], sz: 0.6 + Math.random() * 1.6,
    }));
    let t = 0, energy = 0;

    const draw = () => {
      const target = activeRef.current ? 1 : 0.3;
      energy += (target - energy) * 0.03;
      t += 0.01 + energy * 0.03;
      const cx = w / 2, cy = h / 2;
      const base = w * 0.30;
      const pulse = base * (1 + Math.sin(t * 3) * 0.05 * (0.4 + energy));

      ctx.clearRect(0, 0, w, h);

      // Poświata zewnętrzna.
      ctx.globalCompositeOperation = "lighter";
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.5);
      glow.addColorStop(0, `rgba(255,120,26,${0.10 + energy * 0.18})`);
      glow.addColorStop(0.5, `rgba(169,92,255,${0.06 + energy * 0.12})`);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, w * 0.5, 0, Math.PI * 2); ctx.fill();

      // Obracający się pierścień energii.
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        const rr = pulse * (1.12 + k * 0.16);
        for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.15) {
          const wob = Math.sin(a * 6 + t * (2 + k) ) * (3 + energy * 8);
          const x = cx + Math.cos(a + t * (0.6 + k * 0.2)) * (rr + wob);
          const y = cy + Math.sin(a + t * (0.6 + k * 0.2)) * (rr + wob);
          a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(${HUES[k]},${0.10 + energy * 0.18})`;
        ctx.lineWidth = 1.5; ctx.stroke();
      }

      // Orbitujące cząstki.
      for (const p of parts) {
        const ang = p.a + t * p.sp;
        const rad = pulse * (1.25 + p.r * 0.5);
        const x = cx + Math.cos(ang) * rad;
        const y = cy + Math.sin(ang) * rad;
        ctx.beginPath();
        ctx.fillStyle = `rgba(${p.hue},${0.35 + energy * 0.5})`;
        ctx.arc(x, y, p.sz * (0.6 + energy), 0, Math.PI * 2); ctx.fill();
      }

      // Rdzeń.
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulse);
      core.addColorStop(0, "rgba(255,255,255,0.95)");
      core.addColorStop(0.35, `rgba(255,180,80,${0.85})`);
      core.addColorStop(0.75, `rgba(255,45,177,${0.5 + energy * 0.3})`);
      core.addColorStop(1, "rgba(90,20,60,0)");
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = core; ctx.beginPath(); ctx.arc(cx, cy, pulse, 0, Math.PI * 2); ctx.fill();

      raf.current = requestAnimationFrame(draw);
    };
    const start = () => { if (raf.current == null) raf.current = requestAnimationFrame(draw); };
    const stop = () => { if (raf.current != null) { cancelAnimationFrame(raf.current); raf.current = null; } };
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    start();
    return () => { stop(); window.removeEventListener("resize", resize); document.removeEventListener("visibilitychange", onVis); };
  }, [lite]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={active ? "Pauza" : "Graj"}
      className="group relative flex aspect-square w-full items-center justify-center rounded-2xl border border-white/10 bg-black/40 overflow-hidden"
      style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,.06)" }}
    >
      <canvas ref={ref} aria-hidden className="absolute inset-0 m-auto" />
      <span className="relative z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        {active ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
      </span>
      {(label || sub) && (
        <span className="absolute bottom-1.5 left-0 right-0 z-10 px-2 text-center">
          <span className="block truncate text-[10px] font-bold uppercase tracking-wider text-[#FFB020]">{label}</span>
        </span>
      )}
    </button>
  );
}
