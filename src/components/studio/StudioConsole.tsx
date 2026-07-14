import { useEffect, useRef } from "react";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAudioAnalyser } from "@/hooks/useAudioAnalyser";

/**
 * Analogowa konsola GrouAI — jak w klasycznych amplitunerach:
 * dwa wskazówkowe VU-metry (parabola podziałki + świecąca igła), między nimi
 * krzywa EQ z pasmami. Wszystko reaguje na GRAJĄCY utwór; gdy cisza — delikatnie żyje.
 * Canvas 2D, jeden rAF, throttle + pauza w tle.
 */
export const StudioConsole = () => {
  const { audioElement, isPlaying, isVideoMode } = usePlayer();
  const levels = useAudioAnalyser(audioElement, isPlaying, isVideoMode, 24);
  const ref = useRef(levels);
  const playing = useRef(isPlaying);
  ref.current = levels;
  playing.current = isPlaying;

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    // Wygładzone pozycje igieł (bezwładność jak w prawdziwym VU)
    let nL = 0, nR = 0;

    const START = (215 * Math.PI) / 180; // dolny-lewy
    const END = (325 * Math.PI) / 180;   // dolny-prawy

    const drawGauge = (
      cx: number, cy: number, R: number, value: number, label: string,
    ) => {
      // Łuk podziałki
      ctx.lineWidth = Math.max(1.5, R * 0.03);
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.arc(cx, cy, R, START, END);
      ctx.stroke();
      // Strefa czerwona (koniec skali)
      const redStart = START + (END - START) * 0.75;
      ctx.strokeStyle = "rgba(255,60,40,0.85)";
      ctx.beginPath();
      ctx.arc(cx, cy, R, redStart, END);
      ctx.stroke();
      // Kreski podziałki
      const ticks = 11;
      for (let i = 0; i <= ticks; i++) {
        const a = START + (END - START) * (i / ticks);
        const r1 = R - (i % 5 === 0 ? R * 0.16 : R * 0.09);
        ctx.strokeStyle = i / ticks > 0.75 ? "rgba(255,120,90,0.9)" : "rgba(255,255,255,0.4)";
        ctx.lineWidth = i % 5 === 0 ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.lineTo(cx + Math.cos(a) * (R - 1), cy + Math.sin(a) * (R - 1));
        ctx.stroke();
      }
      // Igła (świecąca, bursztynowa)
      const ang = START + (END - START) * Math.max(0, Math.min(1, value));
      const nx = cx + Math.cos(ang) * (R * 0.92);
      const ny = cy + Math.sin(ang) * (R * 0.92);
      ctx.strokeStyle = "#FFB245";
      ctx.shadowBlur = 14;
      ctx.shadowColor = "#FF9500";
      ctx.lineWidth = Math.max(2, R * 0.035);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // Piasta
      ctx.fillStyle = "#20161f";
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,180,80,0.6)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Etykieta + „VU"
      ctx.fillStyle = "rgba(255,220,170,0.75)";
      ctx.font = `${Math.round(R * 0.16)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(label, cx, cy + R * 0.42);
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.font = `${Math.round(R * 0.12)}px system-ui, sans-serif`;
      ctx.fillText("VU", cx, cy - R * 0.55);
    };

    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const L = ref.current;
      const live = playing.current;
      // Cele igieł: L=bas, R=soprany (z „oddechem" w ciszy)
      const tL = live ? Math.min(1, L.bass * 1.1) : 0.18;
      const tR = live ? Math.min(1, L.treble * 1.25) : 0.15;
      nL += (tL - nL) * 0.18;
      nR += (tR - nR) * 0.18;

      const R = Math.min(h * 0.42, w * 0.16);
      const gy = h * 0.56;
      drawGauge(w * 0.17, gy, R, nL, "LOW");
      drawGauge(w * 0.83, gy, R, nR, "HIGH");

      // Środek: krzywa EQ (parabola z pasm)
      const freqs = L.frequencies;
      const N = freqs.length || 24;
      const x0 = w * 0.30, x1 = w * 0.70, baseY = h * 0.74, top = h * 0.16;
      // Słupki
      const bw = (x1 - x0) / N;
      for (let i = 0; i < N; i++) {
        const v = live ? freqs[i] : 0.12 + ((i * 7) % 5) * 0.03;
        const bx = x0 + i * bw;
        const bh = (baseY - top) * v;
        const hue = 275 - v * 235;
        ctx.fillStyle = `hsla(${hue},90%,58%,0.55)`;
        ctx.fillRect(bx + bw * 0.15, baseY - bh, bw * 0.7, bh);
      }
      // Świecąca krzywa (gładka)
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const v = live ? freqs[i] : 0.12 + ((i * 7) % 5) * 0.03;
        const bx = x0 + i * bw + bw / 2;
        const by = baseY - (baseY - top) * v;
        if (i === 0) ctx.moveTo(bx, by);
        else ctx.lineTo(bx, by);
      }
      ctx.strokeStyle = "#FF9500";
      ctx.shadowBlur = 12;
      ctx.shadowColor = "#9333EA";
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.shadowBlur = 0;
      // Linia bazowa
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, baseY);
      ctx.lineTo(x1, baseY);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("EQ", (x0 + x1) / 2, top - 2);

      raf = requestAnimationFrame(draw);
    };

    const onVis = () => {
      if (document.hidden) { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
      else if (!raf) raf = requestAnimationFrame(draw);
    };
    document.addEventListener("visibilitychange", onVis);
    raf = requestAnimationFrame(draw);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="studio-console relative mx-auto w-full max-w-md overflow-hidden rounded-2xl">
      <canvas ref={canvasRef} className="relative z-10 block h-40 w-full sm:h-44" />
    </div>
  );
};
