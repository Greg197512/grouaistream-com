import { useEffect, useRef } from "react";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAudioAnalyser } from "@/hooks/useAudioAnalyser";

/**
 * Sygnaturowy wizualizer Studia — radialne neonowe słupki reagujące na GRAJĄCY
 * utwór (przez analizer audio playera), z żarzącym się rdzeniem i cząsteczkami.
 * Gdy nic nie gra — delikatnie „oddycha", żeby scena żyła. Canvas 2D, lekki.
 */
export const StudioVisualizer = () => {
  const { audioElement, isPlaying, isVideoMode } = usePlayer();
  const levels = useAudioAnalyser(audioElement, isPlaying, isVideoMode, 56);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const levelsRef = useRef(levels);
  const playingRef = useRef(isPlaying);
  levelsRef.current = levels;
  playingRef.current = isPlaying;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let rot = 0;

    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const freqs = levelsRef.current.frequencies;
      const overall = levelsRef.current.overall;
      const N = freqs.length || 56;
      const minSide = Math.min(w, h);
      const baseR = minSide * 0.17;
      const maxBar = minSide * 0.3;
      // Statycznie w tle — brak rotacji i „oddechu"; ruch tylko przy muzyce.

      // Żarzący się rdzeń
      const coreR = baseR * (0.75 + overall * 0.6);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 2.4);
      g.addColorStop(0, `rgba(255,149,0,${0.22 + overall * 0.4})`);
      g.addColorStop(0.45, `rgba(147,51,234,${0.14 + overall * 0.28})`);
      g.addColorStop(1, "rgba(147,51,234,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR * 2.4, 0, Math.PI * 2);
      ctx.fill();

      // Radialne słupki
      ctx.lineCap = "round";
      const barW = Math.max(2, minSide * 0.011);
      for (let i = 0; i < N; i++) {
        const a = rot + (i / N) * Math.PI * 2;
        const raw = freqs[i] ?? 0;
        // Gdy cisza — statyczny, spokojny wzór (bez ruchu).
        const v = playingRef.current ? raw : 0.1 + ((i * 7) % 5) * 0.02;
        const len = baseR + Math.max(0.04, v) * maxBar;
        const x1 = cx + Math.cos(a) * baseR;
        const y1 = cy + Math.sin(a) * baseR;
        const x2 = cx + Math.cos(a) * len;
        const y2 = cy + Math.sin(a) * len;
        const hue = 275 - Math.min(1, v) * 235; // fiolet → pomarańcz wraz z energią
        ctx.strokeStyle = `hsl(${hue}, 92%, ${56 + v * 16}%)`;
        ctx.lineWidth = barW;
        ctx.shadowBlur = 14;
        ctx.shadowColor = `hsl(${hue}, 92%, 60%)`;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      // Cienki pierścień wewnętrzny
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
      ctx.stroke();

      raf = requestAnimationFrame(draw);
    };

    const onVis = () => {
      if (document.hidden) {
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
      } else if (!raf) {
        raf = requestAnimationFrame(draw);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    raf = requestAnimationFrame(draw);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="studio-hero-glass relative mx-auto w-full max-w-md h-40 overflow-hidden rounded-3xl sm:h-48">
      {/* Animowana aurora za wizualizerem */}
      <div className="studio-aurora" aria-hidden />
      <canvas ref={canvasRef} className="relative z-10 h-full w-full" />
    </div>
  );
};
