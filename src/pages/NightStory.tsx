import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Play, Pause, Moon } from "lucide-react";

/**
 * /nocne — Nocne czytanie z MUZYKĄ W TLE.
 * Głos (mp3 z ?u= albo najnowszy) gra przez <audio>, a pod spodem generatywny,
 * ciepły pad (Web Audio) — bez plików zewnętrznych, ściszony pod lektora.
 */
const DEFAULT_VOICE =
  "https://bmwtydwpevzhbdplilbr.supabase.co/storage/v1/object/public/night-audio/1787099400474-nocne-czytanie.mp3";

export default function NightStory() {
  const [params] = useSearchParams();
  const voiceUrl = params.get("u") || DEFAULT_VOICE;
  const title = params.get("t") || "Nocne czytanie";

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [playing, setPlaying] = useState(false);

  // Generatywny nocny pad — uruchamiany raz, przy pierwszym Play (gest usera).
  const startPad = useCallback(() => {
    if (ctxRef.current) { void ctxRef.current.resume(); return; }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    const ctx: AudioContext = new AC();
    ctxRef.current = ctx;
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    master.gain.linearRampToValueAtTime(0.13, ctx.currentTime + 5);
    masterRef.current = master;

    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 640;
    filt.Q.value = 5;
    filt.connect(master);
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.value = 0.05;
    lg.gain.value = 260;
    lfo.connect(lg); lg.connect(filt.frequency); lfo.start();

    [110, 164.81, 220, 277.18].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i % 2 ? "sine" : "triangle";
      o.frequency.value = f;
      o.detune.value = Math.random() * 10 - 5;
      const g = ctx.createGain();
      g.gain.value = 0.11;
      const amp = ctx.createOscillator();
      const ag = ctx.createGain();
      amp.frequency.value = 0.06 + Math.random() * 0.06;
      ag.gain.value = 0.09;
      amp.connect(ag); ag.connect(g.gain); amp.start();
      o.connect(g); g.connect(filt); o.start();
    });
  }, []);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (!playing) {
      startPad();
      void a.play();
      setPlaying(true);
    } else {
      a.pause();
      const ctx = ctxRef.current, m = masterRef.current;
      if (ctx && m) m.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
      setPlaying(false);
    }
  }, [playing, startPad]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onEnd = () => {
      setPlaying(false);
      const ctx = ctxRef.current, m = masterRef.current;
      if (ctx && m) m.gain.linearRampToValueAtTime(0, ctx.currentTime + 2);
    };
    a.addEventListener("ended", onEnd);
    return () => { a.removeEventListener("ended", onEnd); };
  }, []);

  useEffect(() => () => { void ctxRef.current?.close(); }, []);

  // Aurora w tle (canvas)
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const x = c.getContext("2d");
    if (!x) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, t = 0;
    const cols = [[52, 229, 196], [176, 112, 255], [255, 122, 69]];
    const size = () => { c.width = innerWidth; c.height = innerHeight; };
    size(); addEventListener("resize", size);
    const draw = () => {
      x.clearRect(0, 0, c.width, c.height);
      x.globalCompositeOperation = "lighter";
      for (let b = 0; b < 3; b++) {
        const g = x.createLinearGradient(0, 0, c.width, 0);
        const [r, gr, bl] = cols[b];
        g.addColorStop(0, `rgba(${r},${gr},${bl},0)`);
        g.addColorStop(0.5, `rgba(${r},${gr},${bl},0.32)`);
        g.addColorStop(1, `rgba(${r},${gr},${bl},0)`);
        x.fillStyle = g;
        x.beginPath(); x.moveTo(0, c.height);
        for (let px = 0; px <= c.width; px += 16) {
          const ny = px / c.width;
          const y = (0.36 + b * 0.12 + Math.sin(ny * 4 + t * (0.2 + b * 0.1) + b) * 0.09) * c.height;
          x.lineTo(px, y);
        }
        x.lineTo(c.width, c.height); x.closePath(); x.fill();
      }
      x.globalCompositeOperation = "source-over";
      t += 0.01;
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", size); };
  }, []);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "radial-gradient(120% 90% at 50% -10%, #1a1230, #09080f 70%)",
      color: "#ece9f5", overflow: "hidden", position: "relative",
      fontFamily: "-apple-system, Segoe UI, Roboto, sans-serif",
    }}>
      <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 0, opacity: 0.7 }} />
      <div style={{ position: "relative", zIndex: 2, textAlign: "center", maxWidth: 540, padding: 40 }}>
        <div style={{ fontFamily: "ui-monospace, monospace", letterSpacing: "0.3em", color: "#ff7a45", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Moon size={14} /> 04:17 · GROUAI STREAM
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 600, margin: "16px 0 6px", lineHeight: 1.2 }}>{title}</h1>
        <p style={{ color: "#a79fc0", fontSize: 15, marginBottom: 38 }}>Nocne czytanie z muzyką w tle</p>
        <button onClick={toggle} aria-label={playing ? "Pauza" : "Odtwarzaj"} style={{
          cursor: "pointer", border: 0, borderRadius: 999, width: 76, height: 76,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: "linear-gradient(105deg, #34e5c4, #79eaf1)", color: "#04140f",
          boxShadow: "0 14px 40px rgba(52,229,196,.4)",
        }}>
          {playing ? <Pause size={30} /> : <Play size={30} style={{ marginLeft: 3 }} />}
        </button>
        <p style={{ marginTop: 22, color: "#6f6791", fontSize: 12 }}>
          podkład generowany na żywo — ściszony pod głos lektora
        </p>
      </div>
      <audio ref={audioRef} src={voiceUrl} preload="auto" />
    </div>
  );
}
