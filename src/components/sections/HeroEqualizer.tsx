import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, Check } from "lucide-react";

/**
 * HeroEqualizer — 10 unikalnych, autorskich wizualizerów audio na froncie,
 * przełączanych malutkim przyciskiem. Tryb 0 to nasz „Klasyczny" (szklane
 * słupki, DIV); tryby 1–9 rysowane na jednym lekkim canvasie. Wybór zapisany
 * w localStorage. Wszystko reaguje na realne dane audio (frequencies + pasma).
 */
type Palette = {
  bassHue: number; midHue: number; trebleHue: number; glowHue: number;
  saturation: number; brightness: number; darkness: number;
};
type Levels = { bass: number; mid: number; treble: number; overall: number; frequencies: number[] };

interface Props {
  frequencies: number[]; // blendedFrequencies (~18)
  levels: Levels;
  isPlaying: boolean;
  palette: Palette;
}

export const EQ_MODES = [
  "Klasyczny", "Lustro", "Fala", "Neon-siatka", "Wstążka",
  "Płomień", "Lasery", "Fale mgły", "Bąble", "Puls",
] as const;

const KEY = "grouai-eq-mode";

export function HeroEqualizer({ frequencies, levels, isPlaying, palette }: Props) {
  const [mode, setMode] = useState<number>(() => {
    const v = typeof window !== "undefined" ? parseInt(localStorage.getItem(KEY) || "0", 10) : 0;
    return Number.isFinite(v) && v >= 0 && v < EQ_MODES.length ? v : 0;
  });
  const [open, setOpen] = useState(false);
  useEffect(() => { try { localStorage.setItem(KEY, String(mode)); } catch { /* */ } }, [mode]);

  // Refy z najświeższymi danymi — pętla RAF nie zależy od re-renderów Reacta.
  const dataRef = useRef({ frequencies, levels, isPlaying, palette });
  dataRef.current = { frequencies, levels, isPlaying, palette };

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (mode === 0) return; // klasyczny to DIV-y, nie canvas
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let t = 0;

    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth || 1;
      const h = canvas.clientHeight || 1;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const { frequencies: f, levels: lv, isPlaying: playing, palette: p } = dataRef.current;
      const N = f.length || 18;
      const sat = p.saturation, bri = p.brightness;
      const hueAt = (i: number) => i < N / 3 ? p.bassHue : i < (2 * N) / 3 ? p.midHue : p.trebleHue;
      const val = (i: number) => {
        const raw = f[i] ?? 0;
        return playing ? Math.min(1, raw * 1.5) : 0.12 + ((i * 7) % 5) * 0.03;
      };
      t += 0.016;
      const drawer = DRAWERS[mode] || DRAWERS[1];
      drawer(ctx, w, h, N, val, hueAt, sat, bri, lv, playing, t, p);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [mode]);

  // Klasyczny (tryb 0) — dokładnie nasze szklane słupki.
  const classic = (
    <div className="flex items-end gap-[2px] h-full w-full relative"
      style={{
        filter: isPlaying
          ? `drop-shadow(0 0 ${12 + levels.overall * 20}px hsl(${palette.glowHue} ${palette.saturation}% ${palette.brightness}% / ${0.4 + levels.overall * 0.5}))`
          : `drop-shadow(0 0 4px hsl(${palette.glowHue} ${palette.saturation - 5}% ${palette.brightness}% / 0.15))`,
      }}>
      {frequencies.map((freq, i) => {
        const isBass = i < 6, isMid = i >= 6 && i < 12;
        const boosted = Math.min(1, freq * 1.4);
        const height = Math.max(10, boosted * 100);
        const hBase = isBass ? palette.bassHue : isMid ? palette.midHue : palette.trebleHue;
        const sat = palette.saturation, bri = palette.brightness, darkFactor = 1 - palette.darkness * 0.3;
        return (
          <div key={`eq-${i}`} className="flex-1 min-w-[2px] rounded-sm relative overflow-hidden"
            style={{
              height: `${height}%`,
              background: `linear-gradient(to top, hsl(${hBase} ${sat}% ${(bri - 8) * darkFactor}% / ${0.5 + boosted * 0.45}), hsl(${hBase + 8} ${sat + 5}% ${(bri + 10) * darkFactor}% / ${0.25 + boosted * 0.35}))`,
              backdropFilter: "blur(8px)",
              border: `1px solid hsl(${hBase + 5} ${sat - 5}% ${bri}% / ${0.25 + boosted * 0.35})`,
              boxShadow: `inset 0 1px 0 hsl(0 0% 100% / ${0.25 + boosted * 0.25}), 0 0 ${6 + boosted * 12}px hsl(${hBase} ${sat}% ${bri * darkFactor}% / ${boosted * 0.3})`,
              opacity: 0.5 + boosted * 0.5, transition: "height 0.05s ease-out",
            }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, hsl(0 0% 100% / 0.35) 0%, transparent 35%)" }} />
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="relative w-full h-10 mt-0.5">
      {mode === 0 ? classic : <canvas ref={canvasRef} className="w-full h-full" />}

      {/* Malutki przycisk zmiany equalizera */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="absolute -right-1 -top-3 grid h-6 w-6 place-items-center rounded-full border border-white/20 bg-black/50 text-white/60 backdrop-blur transition hover:text-white hover:border-white/40"
        title="Zmień equalizer"
        aria-label="Zmień equalizer"
      >
        <SlidersHorizontal className="h-3 w-3" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-4 z-50 w-40 rounded-xl border border-white/12 bg-[#12101c]/95 p-1 shadow-2xl backdrop-blur">
            <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white/40">Equalizer</div>
            {EQ_MODES.map((name, i) => (
              <button
                key={name}
                onClick={() => { setMode(i); setOpen(false); }}
                className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition ${i === mode ? "bg-[#FF7A1A]/20 text-[#FFB020]" : "text-white/70 hover:bg-white/5"}`}
              >
                <span>{i === 0 ? `${name} ★` : name}</span>
                {i === mode && <Check className="h-3 w-3" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── 9 autorskich rysowników (tryby 1–9) ─────────────────────────────────────
type Val = (i: number) => number;
type Hue = (i: number) => number;
type Drawer = (ctx: CanvasRenderingContext2D, w: number, h: number, N: number, val: Val, hue: Hue, sat: number, bri: number, lv: Levels, playing: boolean, t: number, p: Palette) => void;

const DRAWERS: Record<number, Drawer> = {
  // 1 — Lustro: słupki odbite od środkowej osi.
  1: (ctx, w, h, N, val, hue, sat, bri) => {
    const bw = w / N, cy = h / 2;
    for (let i = 0; i < N; i++) {
      const v = val(i), len = (h / 2) * Math.max(0.05, v);
      ctx.fillStyle = `hsl(${hue(i)} ${sat}% ${bri + v * 12}% / ${0.4 + v * 0.6})`;
      ctx.fillRect(i * bw + 1, cy - len, bw - 2, len);
      ctx.fillStyle = `hsl(${hue(i)} ${sat}% ${bri}% / ${0.18 + v * 0.4})`;
      ctx.fillRect(i * bw + 1, cy, bw - 2, len);
    }
    ctx.fillStyle = "rgba(255,255,255,.25)"; ctx.fillRect(0, cy - 0.5, w, 1);
  },
  // 2 — Fala: gładki oscyloskop z wypełnieniem.
  2: (ctx, w, h, N, val, hue, sat, bri, lv, playing, t) => {
    ctx.beginPath();
    for (let x = 0; x <= w; x += 4) {
      const i = Math.floor((x / w) * N);
      const v = val(i);
      const y = h / 2 - Math.sin(x / 26 + t * 3) * (h / 2 - 3) * (0.25 + v);
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, `hsl(${hue(0)} ${sat}% ${bri}% / .35)`);
    g.addColorStop(1, `hsl(${hue(N - 1)} ${sat}% ${bri + 8}% / .35)`);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = `hsl(${hue(Math.floor(N / 2))} ${sat + 8}% ${bri + 14}%)`; ctx.lineWidth = 2; ctx.stroke();
  },
  // 3 — Neon-siatka: matryca kropek zapalana wg częstotliwości.
  3: (ctx, w, h, N, val, hue, sat, bri) => {
    const rows = 5, cw = w / N, ch = h / rows, r = Math.min(cw, ch) * 0.28;
    for (let i = 0; i < N; i++) {
      const lit = Math.round(val(i) * rows);
      for (let j = 0; j < rows; j++) {
        const on = (rows - 1 - j) < lit;
        ctx.beginPath();
        ctx.arc(i * cw + cw / 2, j * ch + ch / 2, r, 0, Math.PI * 2);
        ctx.fillStyle = on ? `hsl(${hue(i)} ${sat}% ${bri + 10}% / .95)` : `hsl(${hue(i)} ${sat - 20}% 30% / .18)`;
        ctx.fill();
      }
    }
  },
  // 4 — Wstążka: gładka wypełniona kontur-fala (spline-ish).
  4: (ctx, w, h, N, val, hue, sat, bri) => {
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1)) * w, y = h - Math.max(0.06, val(i)) * (h - 2);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h); ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, `hsl(${hue(Math.floor(N / 2))} ${sat + 6}% ${bri + 12}% / .8)`);
    g.addColorStop(1, `hsl(${hue(0)} ${sat}% ${bri - 6}% / .1)`);
    ctx.fillStyle = g; ctx.fill();
  },
  // 5 — Płomień: rozmyte słupki z migotaniem, jak ogień.
  5: (ctx, w, h, N, val, hue, sat, bri, lv, playing, t) => {
    ctx.shadowBlur = playing ? 14 : 4;
    const bw = w / N;
    for (let i = 0; i < N; i++) {
      const flick = 0.85 + Math.sin(t * 9 + i) * 0.15;
      const v = val(i) * flick, len = Math.max(0.08, v) * h;
      const hu = 15 + v * 45; // pomarańcz→żółć
      ctx.shadowColor = `hsl(${hu} 100% 55%)`;
      const g = ctx.createLinearGradient(0, h, 0, h - len);
      g.addColorStop(0, `hsl(12 100% 45% / .15)`);
      g.addColorStop(0.6, `hsl(${hu} 100% 55% / .75)`);
      g.addColorStop(1, `hsl(${Math.min(60, hu + 15)} 100% 75% / .95)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(i * bw + 1, h - len, bw - 2, len, [bw, bw, 0, 0]);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  },
  // 6 — Lasery: rzadkie cienkie pionowe wiązki z poświatą i główką.
  6: (ctx, w, h, N, val, hue, sat, bri, lv, playing) => {
    ctx.shadowBlur = playing ? 10 : 3;
    for (let i = 0; i < N; i++) {
      const v = val(i), x = (i + 0.5) * (w / N), len = Math.max(0.06, v) * h;
      ctx.strokeStyle = `hsl(${hue(i)} ${sat + 10}% ${bri + 15}% / ${0.5 + v * 0.5})`;
      ctx.shadowColor = `hsl(${hue(i)} ${sat}% ${bri + 10}%)`;
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x, h - len); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, h - len, 1.6 + v * 2, 0, Math.PI * 2);
      ctx.fillStyle = "#fff"; ctx.fill();
    }
    ctx.shadowBlur = 0;
  },
  // 7 — Fale mgły: kilka nakładających się linii sinus przesuwanych basem.
  7: (ctx, w, h, N, val, hue, sat, bri, lv, playing, t) => {
    for (let L = 0; L < 4; L++) {
      ctx.beginPath();
      const amp = (h / 2 - 2) * (0.15 + (lv.overall || 0.2) * 0.7) * (1 - L * 0.15);
      for (let x = 0; x <= w; x += 5) {
        const i = Math.floor((x / w) * N);
        const y = h / 2 + Math.sin(x / 22 + t * (2 + L * 0.5) + L) * amp * (0.5 + val(i));
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `hsl(${hue(Math.floor((L / 4) * N))} ${sat}% ${bri + L * 6}% / ${0.5 - L * 0.09})`;
      ctx.lineWidth = 1.5; ctx.stroke();
    }
  },
  // 8 — Bąble: kręgi kołyszące się, promień wg częstotliwości.
  8: (ctx, w, h, N, val, hue, sat, bri, lv, playing, t) => {
    for (let i = 0; i < N; i++) {
      const v = val(i), x = (i + 0.5) * (w / N);
      const y = h / 2 + Math.sin(t * 2 + i * 0.7) * (h * 0.22);
      const r = 1.5 + v * (h * 0.4);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `hsl(${hue(i)} ${sat}% ${bri + 15}% / .9)`);
      g.addColorStop(1, `hsl(${hue(i)} ${sat}% ${bri}% / 0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  },
  // 9 — Puls: rząd współśrodkowych pierścieni na pasmo, pulsujących basem.
  9: (ctx, w, h, N, val, hue, sat, bri, lv, playing, t) => {
    const groups = 7, gw = w / groups, cy = h / 2;
    for (let gi = 0; gi < groups; gi++) {
      const idx = Math.floor((gi / groups) * N);
      const v = val(idx), cx = (gi + 0.5) * gw;
      for (let ring = 0; ring < 3; ring++) {
        const rr = (h * 0.16) * (ring + 1) * (0.7 + v * 0.9);
        ctx.strokeStyle = `hsl(${hue(idx)} ${sat}% ${bri + ring * 6}% / ${(0.6 - ring * 0.16) * (0.4 + v)})`;
        ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = `hsl(${hue(idx)} ${sat}% ${bri + 15}% / ${0.5 + v * 0.5})`;
      ctx.beginPath(); ctx.arc(cx, cy, 1.5 + v * 3, 0, Math.PI * 2); ctx.fill();
    }
  },
};
