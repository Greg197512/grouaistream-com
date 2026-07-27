import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";

/**
 * HeroEqualizer — 10 wizualizerów audio na froncie, każdy stylizowany na INNY
 * sprzęt Hi-Fi. Przełącznik jest ukryty pod malutkim przyciskiem (lista z
 * nazwami). Tryb 0 to nasz „Klasyczny" (szklane słupki, DIV); tryby 1–9 rysowane
 * na jednym lekkim canvasie i reagują na realne dane audio.
 */
type Palette = {
  bassHue: number; midHue: number; trebleHue: number; glowHue: number;
  saturation: number; brightness: number; darkness: number;
};
type Levels = { bass: number; mid: number; treble: number; overall: number; frequencies: number[] };

interface Props {
  frequencies: number[];
  levels: Levels;
  isPlaying: boolean;
  palette: Palette;
}

export const EQ_MODES = [
  "Klasyczny", "VU lampowy", "Korektor", "Analizator", "Magnetofon",
  "Gramofon", "Oscyloskop", "Tuner", "Boombox", "Panel LED",
  "Szpulowiec", "Korektor param.", "Radar", "Plazma",
  "Winamp", "Milkdrop", "Tunel gwiazd", "Fontanna",
] as const;

const KEY = "grouai-eq-mode";
const TAU = Math.PI * 2;

export function HeroEqualizer({ frequencies, levels, isPlaying, palette }: Props) {
  const [mode, setMode] = useState<number>(() => {
    const v = typeof window !== "undefined" ? parseInt(localStorage.getItem(KEY) || "0", 10) : 0;
    return Number.isFinite(v) && v >= 0 && v < EQ_MODES.length ? v : 0;
  });
  useEffect(() => { try { localStorage.setItem(KEY, String(mode)); } catch { /* */ } }, [mode]);

  // Kliknięcie przycisku = następny styl (cykl). Krótko pokazujemy jego nazwę.
  const [showName, setShowName] = useState(false);
  const nameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cycle = () => {
    setMode((m) => (m + 1) % EQ_MODES.length);
    setShowName(true);
    if (nameTimer.current) clearTimeout(nameTimer.current);
    nameTimer.current = setTimeout(() => setShowName(false), 1600);
  };
  useEffect(() => () => { if (nameTimer.current) clearTimeout(nameTimer.current); }, []);

  const dataRef = useRef({ frequencies, levels, isPlaying, palette });
  dataRef.current = { frequencies, levels, isPlaying, palette };
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (mode === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0, t = 0;
    const mem = new Float32Array(64); // peak-hold / stan między klatkami

    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const { frequencies: f, levels: lv, isPlaying: playing, palette: p } = dataRef.current;
      const N = f.length || 18;
      const hueAt = (i: number) => i < N / 3 ? p.bassHue : i < (2 * N) / 3 ? p.midHue : p.trebleHue;
      const val = (i: number) => {
        const raw = f[i] ?? 0;
        return playing ? Math.min(1, raw * 1.5) : 0.1 + ((i * 7) % 5) * 0.03;
      };
      t += 0.016;
      (DRAWERS[mode] || DRAWERS[1])(ctx, w, h, N, val, hueAt, p.saturation, p.brightness, lv, playing, t, mem);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [mode]);

  // Tryb 0 — nasze szklane słupki (DIV).
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

      {/* Przycisk equalizera — kliknięcie przełącza na następny styl */}
      <button
        type="button"
        onClick={cycle}
        className="absolute -right-1 -top-3 z-30 grid h-6 w-6 place-items-center rounded-full border border-white/20 bg-black/50 text-white/60 backdrop-blur transition hover:text-white hover:border-white/40"
        title={`Equalizer: ${EQ_MODES[mode]} (kliknij, by zmienić)`}
        aria-label="Zmień equalizer"
      >
        <SlidersHorizontal className="h-3 w-3" />
      </button>

      {/* Krótka nazwa aktualnego stylu po zmianie — pływająca, bez wpływu na layout */}
      {showName && (
        <div className="absolute -top-3 right-6 z-30 whitespace-nowrap rounded-full bg-black/75 px-2 py-0.5 text-[10px] font-semibold text-[#FFB020] backdrop-blur pointer-events-none">
          {mode === 0 ? `${EQ_MODES[mode]} ★` : EQ_MODES[mode]} · {mode + 1}/{EQ_MODES.length}
        </div>
      )}
    </div>
  );
}

// ─── 9 sprzętowych rysowników (tryby 1–9) ────────────────────────────────────
type Val = (i: number) => number;
type Hue = (i: number) => number;
type Drawer = (ctx: CanvasRenderingContext2D, w: number, h: number, N: number, val: Val, hue: Hue, sat: number, bri: number, lv: Levels, playing: boolean, t: number, mem: Float32Array) => void;

const DRAWERS: Record<number, Drawer> = {
  // 1 — VU LAMPOWY: dwie analogowe tarcze z igłami (jak wzmacniacz lampowy).
  1: (ctx, w, h, N, val, hue, sat, bri, lv, playing) => {
    const cy = h * 0.94, R = Math.min(w * 0.2, h * 0.82);
    const dial = (cx: number, level: number) => {
      ctx.strokeStyle = "rgba(255,238,206,.16)"; ctx.lineWidth = Math.max(1.5, h * 0.02);
      ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI * 1.18, Math.PI * 1.82); ctx.stroke();
      for (let k = 0; k <= 10; k++) {
        const a = Math.PI * 1.18 + (k / 10) * (Math.PI * 0.64), red = k > 7;
        ctx.strokeStyle = red ? "rgba(255,90,70,.85)" : "rgba(255,224,186,.45)";
        ctx.lineWidth = k % 5 === 0 ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * R * 0.84, cy + Math.sin(a) * R * 0.84);
        ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke();
      }
      const a = Math.PI * 1.18 + Math.min(1, level * 1.15) * (Math.PI * 0.64);
      if (playing) { ctx.shadowBlur = 8; ctx.shadowColor = "#FF9500"; }
      ctx.strokeStyle = "#FFD79A"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R * 0.9, cy + Math.sin(a) * R * 0.9); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#FFD79A"; ctx.beginPath(); ctx.arc(cx, cy, 2.2, 0, TAU); ctx.fill();
    };
    dial(w * 0.28, lv.bass); dial(w * 0.72, lv.treble || lv.overall);
  },

  // 2 — KOREKTOR: rząd suwaków (fadery) jak w graficznym korektorze.
  2: (ctx, w, h, N, val, hue, sat, bri, lv, playing) => {
    const cols = Math.min(N, 12), cw = w / cols, top = h * 0.14, bot = h * 0.86, span = bot - top;
    for (let i = 0; i < cols; i++) {
      const cx = (i + 0.5) * cw;
      ctx.strokeStyle = "rgba(255,255,255,.14)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx, bot); ctx.stroke();
      for (let k = 0; k <= 4; k++) {
        const y = top + (k / 4) * span;
        ctx.strokeStyle = "rgba(255,255,255,.10)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx - cw * 0.16, y); ctx.lineTo(cx + cw * 0.16, y); ctx.stroke();
      }
      const v = val(Math.floor((i / cols) * N)), y = bot - Math.max(0.04, v) * span;
      if (playing) { ctx.shadowBlur = 6; ctx.shadowColor = `hsl(${hue(i)} ${sat}% ${bri}%)`; }
      ctx.fillStyle = `hsl(${hue(i)} ${sat}% ${bri + 8}%)`;
      ctx.beginPath(); ctx.roundRect(cx - cw * 0.32, y - h * 0.05, cw * 0.64, h * 0.1, 3); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(0,0,0,.45)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - cw * 0.22, y); ctx.lineTo(cx + cw * 0.22, y); ctx.stroke();
    }
  },

  // 3 — ANALIZATOR: kolumny segmentów LED (zielony→bursztyn→czerwień) + peak-hold.
  3: (ctx, w, h, N, val, hue, sat, bri, lv, playing, t, mem) => {
    const cols = Math.min(N, 16), cw = w / cols, segs = Math.max(6, Math.floor(h / 7)), gap = 2, segH = (h - 2) / segs;
    for (let i = 0; i < cols; i++) {
      const v = val(Math.floor((i / cols) * N)), lit = Math.round(v * segs);
      mem[i] = Math.max((mem[i] || 0) - 0.018, v);
      const peakSeg = Math.round(mem[i] * segs);
      for (let s = 0; s < segs; s++) {
        const frac = s / segs, hu = frac < 0.6 ? 140 : frac < 0.85 ? 45 : 8;
        const y = h - (s + 1) * segH + gap / 2;
        ctx.fillStyle = s < lit ? `hsl(${hu} 90% 55% / .95)` : `hsl(${hu} 40% 30% / .16)`;
        ctx.fillRect(i * cw + 1, y, cw - 2, segH - gap);
      }
      if (peakSeg > 0) { ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.fillRect(i * cw + 1, h - peakSeg * segH, cw - 2, 2); }
    }
  },

  // 10 — SZPULOWIEC: dwie duże otwarte szpule (reel-to-reel) z taśmą.
  10: (ctx, w, h, N, val, hue, sat, bri, lv, playing, t) => {
    const cy = h * 0.5, R = Math.min(w * 0.19, h * 0.44), spd = 0.9 + (lv.overall || 0.15) * 3;
    const reel = (cx: number, dir: number) => {
      const rot = t * spd * dir;
      ctx.strokeStyle = "rgba(180,140,90,.55)"; ctx.lineWidth = R * 0.5;
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.66, 0, TAU); ctx.stroke(); // nawinięta taśma
      ctx.strokeStyle = "rgba(255,255,255,.28)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.9, 0, TAU); ctx.stroke();
      for (let k = 0; k < 3; k++) {
        const a = rot + (k * Math.PI) / 3;
        ctx.strokeStyle = "rgba(255,235,200,.6)"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R * 0.9, cy + Math.sin(a) * R * 0.9);
        ctx.lineTo(cx - Math.cos(a) * R * 0.9, cy - Math.sin(a) * R * 0.9); ctx.stroke();
      }
      ctx.fillStyle = "rgba(60,50,40,.9)"; ctx.beginPath(); ctx.arc(cx, cy, R * 0.16, 0, TAU); ctx.fill();
    };
    reel(w * 0.26, 1); reel(w * 0.74, -1);
    ctx.strokeStyle = "rgba(180,140,90,.6)"; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.26 + R, cy); ctx.quadraticCurveTo(w * 0.5, cy + R * 0.9 + lv.bass * 8, w * 0.74 - R, cy);
    ctx.stroke();
  },

  // 11 — KOREKTOR PARAMETRYCZNY: gładka krzywa odpowiedzi + węzły pasm.
  11: (ctx, w, h, N, val, hue, sat, bri, lv, playing) => {
    ctx.strokeStyle = "rgba(255,255,255,.07)"; ctx.lineWidth = 1;
    for (let y = 0; y <= h; y += h / 4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    const nodes = 5;
    const yOf = (k: number) => {
      const idx = Math.floor((k / (nodes - 1)) * (N - 1));
      return h - (0.2 + val(idx) * 0.7) * h;
    };
    ctx.beginPath(); ctx.moveTo(0, yOf(0));
    for (let k = 0; k < nodes - 1; k++) {
      const x1 = (k / (nodes - 1)) * w, x2 = ((k + 1) / (nodes - 1)) * w;
      const y1 = yOf(k), y2 = yOf(k + 1), mx = (x1 + x2) / 2;
      ctx.bezierCurveTo(mx, y1, mx, y2, x2, y2);
    }
    const line = ctx.getLineDash;
    ctx.save();
    ctx.strokeStyle = `hsl(${hue(9)} ${sat}% ${bri + 12}%)`; ctx.lineWidth = 2.5;
    if (playing) { ctx.shadowBlur = 8; ctx.shadowColor = `hsl(${hue(9)} ${sat}% ${bri}%)`; }
    ctx.stroke(); ctx.restore(); ctx.shadowBlur = 0; void line;
    for (let k = 0; k < nodes; k++) {
      const x = (k / (nodes - 1)) * w, y = yOf(k);
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill();
      ctx.strokeStyle = `hsl(${hue(Math.floor((k / nodes) * N))} ${sat}% ${bri + 10}%)`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.stroke();
    }
  },

  // 12 — RADAR: kołowy analizator z obrotowym promieniem sweep.
  12: (ctx, w, h, N, val, hue, sat, bri, lv, playing, t) => {
    const cx = w / 2, cy = h / 2, R = Math.min(w * 0.5, h * 0.46);
    for (let ring = 1; ring <= 3; ring++) {
      ctx.strokeStyle = "rgba(80,255,140,.10)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, (R * ring) / 3, 0, TAU); ctx.stroke();
    }
    const bars = Math.min(N, 24);
    for (let i = 0; i < bars; i++) {
      const a = (i / bars) * TAU, v = val(Math.floor((i / bars) * N)), len = R * (0.3 + v * 0.7);
      ctx.strokeStyle = `hsl(${140 - v * 130} 85% 55% / ${0.4 + v * 0.5})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R * 0.28, cy + Math.sin(a) * R * 0.28);
      ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len); ctx.stroke();
    }
    const sweep = t * 1.6;
    const g = ctx.createLinearGradient(cx, cy, cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R);
    g.addColorStop(0, "rgba(80,255,140,.5)"); g.addColorStop(1, "rgba(80,255,140,0)");
    ctx.strokeStyle = g; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R); ctx.stroke();
  },

  // 13 — PLAZMA: neonowe kolumny plazmy z elektrycznym migotaniem.
  13: (ctx, w, h, N, val, hue, sat, bri, lv, playing, t) => {
    ctx.shadowBlur = playing ? 12 : 4;
    const cols = Math.min(N, 14), cw = w / cols;
    for (let i = 0; i < cols; i++) {
      const v = val(Math.floor((i / cols) * N)) * (0.85 + Math.sin(t * 11 + i) * 0.15);
      const len = Math.max(0.08, v) * h, x = (i + 0.5) * cw;
      const hu = 190 + (i / cols) * 100; // cyan → fiolet
      ctx.shadowColor = `hsl(${hu} 100% 60%)`;
      ctx.strokeStyle = `hsl(${hu} 100% ${60 + v * 20}% / ${0.5 + v * 0.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, h);
      let y = h;
      while (y > h - len) {
        y -= h * 0.12;
        ctx.lineTo(x + (Math.random() - 0.5) * cw * 0.5, Math.max(h - len, y));
      }
      ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, h - len, 1.5 + v * 2, 0, TAU); ctx.fill();
    }
    ctx.shadowBlur = 0;
  },

  // 4 — MAGNETOFON: dwie kręcące się szpule + poziom taśmy (kaseta).
  4: (ctx, w, h, N, val, hue, sat, bri, lv, playing, t) => {
    const cy = h * 0.42, R = Math.min(w * 0.12, h * 0.32);
    const spd = 1.1 + (lv.overall || 0.15) * 3.5;
    const reel = (cx: number, dir: number) => {
      ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.beginPath(); ctx.arc(cx, cy, R * 0.28, 0, TAU); ctx.fill();
      for (let k = 0; k < 6; k++) {
        const a = t * spd * dir + (k * TAU) / 6;
        ctx.strokeStyle = "rgba(255,220,180,.55)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R * 0.3, cy + Math.sin(a) * R * 0.3);
        ctx.lineTo(cx + Math.cos(a) * R * 0.9, cy + Math.sin(a) * R * 0.9); ctx.stroke();
      }
    };
    reel(w * 0.32, 1); reel(w * 0.68, -1);
    ctx.strokeStyle = "rgba(150,100,60,.5)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(w * 0.32 + R, cy + R * 0.5); ctx.lineTo(w * 0.68 - R, cy + R * 0.5); ctx.stroke();
    const by = h * 0.82, bx = w * 0.15, bw = w * 0.7, bh = h * 0.1;
    ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fillRect(bx, by, bw, bh);
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, "#5de1ff"); g.addColorStop(0.7, "#ffd24d"); g.addColorStop(1, "#ff5a4d");
    ctx.fillStyle = g; ctx.fillRect(bx, by, bw * Math.min(1, (lv.overall || 0) * 1.3), bh);
  },

  // 5 — GRAMOFON: obracający się winyl + ramię (jak talerz gramofonu).
  5: (ctx, w, h, N, val, hue, sat, bri, lv, playing, t) => {
    const cx = w * 0.34, cy = h * 0.54, R = Math.min(w * 0.28, h * 0.46);
    ctx.fillStyle = "#0b0710"; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    for (let r = R; r > R * 0.34; r -= Math.max(2, R * 0.09)) {
      ctx.strokeStyle = "rgba(255,255,255,.05)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
    }
    ctx.fillStyle = `hsl(${hue(6)} ${sat}% ${bri}%)`; ctx.beginPath(); ctx.arc(cx, cy, R * 0.3, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * (0.8 + (lv.overall || 0.15) * 1.6));
    const g = ctx.createLinearGradient(-R, 0, R, 0);
    g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,.16)"); g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill(); ctx.restore();
    ctx.fillStyle = "#ccc"; ctx.beginPath(); ctx.arc(cx, cy, 2, 0, TAU); ctx.fill();
    // ramię
    const ax = w * 0.92, ay = h * 0.14, tx = cx + R * 0.7, ty = cy - R * 0.4;
    ctx.strokeStyle = "rgba(220,220,230,.7)"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.fillStyle = "#ddd"; ctx.beginPath(); ctx.arc(ax, ay, 3, 0, TAU); ctx.fill();
    ctx.fillStyle = "#bbb"; ctx.fillRect(tx - 3, ty - 1, 6, 5);
    // pierścień poświaty reagujący na bas
    ctx.strokeStyle = `hsl(${hue(0)} ${sat}% ${bri + 10}% / ${0.2 + lv.bass * 0.5})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, R + 2 + lv.bass * 5, 0, TAU); ctx.stroke();
  },

  // 6 — OSCYLOSKOP: zielony fosforowy CRT z siatką i falą.
  6: (ctx, w, h, N, val, hue, sat, bri, lv, playing, t) => {
    ctx.strokeStyle = "rgba(80,255,120,.09)"; ctx.lineWidth = 1;
    for (let x = 0; x <= w + 1; x += w / 10) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y <= h + 1; y += h / 4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    if (playing) { ctx.shadowBlur = 8; ctx.shadowColor = "#4dff7a"; }
    ctx.strokeStyle = "#4dff7a"; ctx.lineWidth = 2; ctx.beginPath();
    for (let x = 0; x <= w; x += 3) {
      const i = Math.floor((x / w) * N), v = val(i);
      const y = h / 2 - Math.sin(x / 15 + t * 4) * (h * 0.4) * (0.3 + v);
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke(); ctx.shadowBlur = 0;
  },

  // 7 — TUNER: skala radiowa z ruchomą igłą (środek widma) + dioda STEREO.
  7: (ctx, w, h, N, val, hue, sat, bri, lv, playing) => {
    const sy = h * 0.5;
    ctx.strokeStyle = "rgba(255,235,200,.3)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(w * 0.05, sy); ctx.lineTo(w * 0.95, sy); ctx.stroke();
    for (let k = 0; k <= 20; k++) {
      const x = w * 0.05 + (k / 20) * w * 0.9, big = k % 5 === 0;
      ctx.strokeStyle = "rgba(255,235,200,.45)"; ctx.lineWidth = big ? 1.6 : 1;
      ctx.beginPath(); ctx.moveTo(x, sy); ctx.lineTo(x, sy - (big ? h * 0.2 : h * 0.1)); ctx.stroke();
      if (big) { ctx.fillStyle = "rgba(255,225,190,.4)"; ctx.font = `${Math.round(h * 0.13)}px system-ui`; ctx.textAlign = "center"; ctx.fillText(String(88 + k), x, sy + h * 0.24); }
    }
    let sum = 0, ws = 0; for (let i = 0; i < N; i++) { const v = val(i); sum += v; ws += v * i; }
    const c = sum > 0 ? (ws / sum) / (N - 1) : 0.5;
    const nx = w * 0.05 + (0.1 + c * 0.8) * w * 0.9;
    if (playing) { ctx.shadowBlur = 10; ctx.shadowColor = "#FF5A4D"; }
    ctx.strokeStyle = "#FF5A4D"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(nx, sy - h * 0.3); ctx.lineTo(nx, sy + h * 0.3); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = (lv.overall || 0) > 0.35 ? "#4dff7a" : "rgba(255,255,255,.2)";
    ctx.beginPath(); ctx.arc(w * 0.93, h * 0.86, 3, 0, TAU); ctx.fill();
  },

  // 8 — BOOMBOX: dwa głośniki (stożki) pulsujące basem + pasek LED.
  8: (ctx, w, h, N, val, hue, sat, bri, lv, playing, t) => {
    const cy = h * 0.5, R = Math.min(w * 0.2, h * 0.44), pulse = 1 + lv.bass * 0.25;
    const cone = (cx: number) => {
      for (let r = R; r > R * 0.2; r -= Math.max(2, R * 0.16)) {
        ctx.strokeStyle = `hsl(${hue(3)} ${sat}% ${bri}% / ${0.14 + 0.14 * Math.sin(r + t)})`;
        ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, r * pulse, 0, TAU); ctx.stroke();
      }
      ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.4);
      cg.addColorStop(0, `hsl(${hue(0)} ${sat}% ${bri + 15}% / ${0.6 + lv.bass * 0.4})`);
      cg.addColorStop(1, `hsl(${hue(0)} ${sat}% ${bri}% / 0)`);
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, R * 0.4 * pulse, 0, TAU); ctx.fill();
    };
    cone(w * 0.24); cone(w * 0.76);
    const bx = w * 0.43, bw = w * 0.14;
    for (let i = 0; i < 5; i++) {
      const on = val(i * 3) > 0.18 + i * 0.14;
      ctx.fillStyle = on ? `hsl(${120 - i * 28} 90% 55%)` : "rgba(255,255,255,.12)";
      ctx.fillRect(bx, h * 0.28 + i * (h * 0.09), bw, h * 0.06);
    }
  },

  // 9 — PANEL LED: matryca punktów (jak panel w racku), kolumny wg pasm.
  9: (ctx, w, h, N, val, hue, sat, bri) => {
    const cols = Math.min(N, 22), rows = Math.max(5, Math.floor(h / 6));
    const cw = w / cols, ch = h / rows, r = Math.min(cw, ch) * 0.32;
    for (let i = 0; i < cols; i++) {
      const v = val(Math.floor((i / cols) * N)), lit = Math.round(v * rows);
      for (let j = 0; j < rows; j++) {
        const on = (rows - 1 - j) < lit, frac = (rows - 1 - j) / rows;
        const hu = frac < 0.6 ? 140 : frac < 0.85 ? 45 : 8;
        ctx.fillStyle = on ? `hsl(${hu} 90% 55% / .95)` : "rgba(255,255,255,.05)";
        ctx.beginPath(); ctx.arc(i * cw + cw / 2, j * ch + ch / 2, r, 0, TAU); ctx.fill();
      }
    }
  },

  // 14 — WINAMP: kultowe widmo — słupki zieleń→żółć→czerwień + spadające peaki.
  14: (ctx, w, h, N, val, hue, sat, bri, lv, playing, t, mem) => {
    const cols = Math.min(N, 20), cw = w / cols, gap = Math.max(1, cw * 0.16);
    for (let i = 0; i < cols; i++) {
      const v = val(Math.floor((i / cols) * N)), len = Math.max(2, v * h);
      const g = ctx.createLinearGradient(0, h, 0, h - len);
      g.addColorStop(0, "#00e070"); g.addColorStop(0.6, "#e8e000"); g.addColorStop(1, "#ff3b30");
      ctx.fillStyle = g; ctx.fillRect(i * cw + gap, h - len, cw - gap * 2, len);
      mem[i] = Math.max((mem[i] || 0) - 0.02, v);
      ctx.fillStyle = "rgba(220,230,255,.9)";
      ctx.fillRect(i * cw + gap, h - mem[i] * h - 2, cw - gap * 2, 2);
    }
  },

  // 15 — MILKDROP: psychodeliczna plazma (additive) + fala, jak preset AVS.
  15: (ctx, w, h, N, val, hue, sat, bri, lv, playing, t) => {
    ctx.globalCompositeOperation = "lighter";
    const zoom = 1 + lv.bass * 0.35;
    for (let b = 0; b < 5; b++) {
      const px = w * (0.5 + 0.42 * Math.sin(t * 0.7 + b * 1.3));
      const py = h * (0.5 + 0.42 * Math.cos(t * 0.9 + b * 2.1));
      const r = Math.min(w, h) * 0.55 * zoom * (0.6 + 0.4 * Math.sin(t + b));
      const hu = (t * 40 + b * 70) % 360;
      const g = ctx.createRadialGradient(px, py, 0, px, py, Math.max(1, r));
      g.addColorStop(0, `hsla(${hu},90%,60%,.5)`); g.addColorStop(1, `hsla(${hu},90%,60%,0)`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let x = 0; x <= w; x += 4) {
      const i = Math.floor((x / w) * N);
      const y = h / 2 - Math.sin(x / 18 + t * 3) * (h * 0.3) * (0.3 + val(i));
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  },

  // 16 — TUNEL GWIAZD: gwiazdy lecące od środka ze smugami (warp), bas = prędkość.
  16: (ctx, w, h, N, val, hue, sat, bri, lv, playing, t) => {
    const cx = w / 2, cy = h / 2, speed = 0.35 + (lv.overall || 0.15) * 1.6, maxR = Math.max(w, h) * 0.62;
    ctx.lineCap = "round";
    for (let i = 0; i < 120; i++) {
      const ang = i * 2.399, seed = (i * 0.137) % 1;
      const prog = (t * speed + seed) % 1;
      const rad = prog * maxR, rad2 = Math.max(0, prog - 0.06) * maxR;
      const x = cx + Math.cos(ang) * rad, y = cy + Math.sin(ang) * rad * 0.5;
      const x2 = cx + Math.cos(ang) * rad2, y2 = cy + Math.sin(ang) * rad2 * 0.5;
      const a = 0.2 + prog * 0.8;
      ctx.strokeStyle = `hsl(${hue(i % N)} ${sat}% ${bri + 30}% / ${a})`;
      ctx.lineWidth = 0.6 + prog * 2;
      ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = `hsl(0 0% 100% / ${a})`;
      ctx.beginPath(); ctx.arc(x, y, 0.6 + prog * 1.6, 0, TAU); ctx.fill();
    }
  },

  // 17 — FONTANNA: kropelki wystrzeliwane z dołu na pasmo (parabola).
  17: (ctx, w, h, N, val, hue, sat, bri, lv, playing, t) => {
    const cols = Math.min(N, 12), cw = w / cols;
    for (let i = 0; i < cols; i++) {
      const x = (i + 0.5) * cw, v = val(Math.floor((i / cols) * N)), launch = v * h * 1.5;
      for (let d = 0; d < 4; d++) {
        const phase = (t * 1.3 + d / 4 + i * 0.1) % 1;
        const y = h - (launch * phase - 0.5 * launch * 2 * phase * phase);
        const yy = Math.max(0, Math.min(h, y)), a = 1 - phase;
        ctx.fillStyle = `hsl(${hue(i)} ${sat}% ${bri + 12}% / ${a * 0.9})`;
        ctx.beginPath(); ctx.arc(x + (d - 1.5) * 2.2, yy, 1.4 + v * 1.6, 0, TAU); ctx.fill();
      }
    }
  },
};
