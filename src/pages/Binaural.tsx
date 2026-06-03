import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Play, Square, Volume2, Clock, Headphones,
  Zap, Wind, Moon, Sun, Heart
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";

interface Preset {
  id: string;
  name: string;
  hz: number;
  base: number;
  color: string;
  gradient: string;
  description: string;
  benefits: string[];
  icon: React.ElementType;
  brainwave: string;
}

const PRESETS: Preset[] = [
  {
    id: "gamma",
    name: "Focus",
    hz: 40,
    base: 200,
    color: "#9333EA",
    gradient: "from-purple-600/20 to-fuchsia-500/10",
    description: "Fale Gamma — szczytowa koncentracja",
    benefits: ["Pamięć robocza", "Uwaga", "Poznanie wyższego rzędu", "Szybkie myślenie"],
    icon: Brain,
    brainwave: "γ Gamma",
  },
  {
    id: "beta",
    name: "Alert",
    hz: 20,
    base: 200,
    color: "#3B82F6",
    gradient: "from-blue-600/20 to-cyan-500/10",
    description: "Fale Beta — czujność i aktywność",
    benefits: ["Aktywne myślenie", "Rozwiązywanie problemów", "Motywacja", "Koncentracja"],
    icon: Zap,
    brainwave: "β Beta",
  },
  {
    id: "alpha",
    name: "Relax",
    hz: 10,
    base: 200,
    color: "#10B981",
    gradient: "from-emerald-600/20 to-teal-500/10",
    description: "Fale Alfa — spokojny flow",
    benefits: ["Kreatywność", "Redukcja stresu", "Łagodna świadomość", "Stan flow"],
    icon: Wind,
    brainwave: "α Alfa",
  },
  {
    id: "theta",
    name: "Meditate",
    hz: 6,
    base: 200,
    color: "#F59E0B",
    gradient: "from-amber-600/20 to-orange-500/10",
    description: "Fale Theta — głęboka medytacja",
    benefits: ["Intuicja", "Kreatywne wglądy", "Głęboka relaksacja", "Hipnagogiczne stany"],
    icon: Heart,
    brainwave: "θ Theta",
  },
  {
    id: "delta",
    name: "Sleep",
    hz: 2,
    base: 200,
    color: "#6366F1",
    gradient: "from-indigo-600/20 to-violet-500/10",
    description: "Fale Delta — głęboki sen",
    benefits: ["Regeneracja ciała", "Głęboki sen", "Uzdrawianie", "Bez świadomości"],
    icon: Moon,
    brainwave: "δ Delta",
  },
];

const TIMERS = [
  { label: "5 min", value: 5 },
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "60 min", value: 60 },
  { label: "∞", value: 0 },
];

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (s: number) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;

// Canvas sine wave visualizer
function WaveVisualizer({ preset, active, elapsed }: { preset: Preset; active: boolean; elapsed: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const tRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    const H = canvas.height = canvas.offsetHeight * window.devicePixelRatio;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      if (!active) {
        // Static flat lines when paused
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, H * 0.35); ctx.lineTo(W, H * 0.35); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, H * 0.65); ctx.lineTo(W, H * 0.65); ctx.stroke();
        return;
      }

      const t = tRef.current;
      const baseFreqNorm = preset.base / 400; // visual scaling
      const beatFreqNorm = preset.hz / 200;

      // Left channel (base frequency) — top half
      ctx.beginPath();
      ctx.strokeStyle = preset.color + "cc";
      ctx.lineWidth = 2;
      for (let x = 0; x < W; x++) {
        const phase = (x / W) * Math.PI * 2 * baseFreqNorm * 6 + t;
        const y = H * 0.3 + Math.sin(phase) * H * 0.18;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Right channel (base + beat) — bottom half
      ctx.beginPath();
      ctx.strokeStyle = preset.color + "88";
      ctx.lineWidth = 2;
      for (let x = 0; x < W; x++) {
        const phase = (x / W) * Math.PI * 2 * (baseFreqNorm + beatFreqNorm * 0.1) * 6 + t * 1.2;
        const y = H * 0.7 + Math.sin(phase) * H * 0.18;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Beat envelope (combined effect visualization)
      ctx.beginPath();
      ctx.strokeStyle = preset.color + "44";
      ctx.lineWidth = 3;
      for (let x = 0; x < W; x++) {
        const beatPhase = (x / W) * Math.PI * 2 * beatFreqNorm * 0.5 + t * 0.1;
        const envelope = Math.abs(Math.sin(beatPhase)) * H * 0.15;
        const y = H * 0.5 + Math.sin((x / W) * Math.PI * 8 + t * 2) * envelope;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      tRef.current += 0.03;
      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [preset, active]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-32 rounded-xl"
      style={{ background: `linear-gradient(135deg, rgba(0,0,0,0.4), rgba(0,0,0,0.2))` }}
    />
  );
}

export default function Binaural() {
  const [active, setActive] = useState(false);
  const [preset, setPreset] = useState<Preset>(PRESETS[0]);
  const [volume, setVolume] = useState(25);
  const [timerMin, setTimerMin] = useState(15);
  const [elapsed, setElapsed] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const leftOscRef = useRef<OscillatorNode | null>(null);
  const rightOscRef = useRef<OscillatorNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    try {
      leftOscRef.current?.stop();
      rightOscRef.current?.stop();
    } catch {}
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    leftOscRef.current = null;
    rightOscRef.current = null;
    masterGainRef.current = null;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setActive(false);
    setElapsed(0);
  }, []);

  const start = useCallback(() => {
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const leftOsc = ctx.createOscillator();
    const rightOsc = ctx.createOscillator();
    const leftGain = ctx.createGain();
    const rightGain = ctx.createGain();
    const masterGain = ctx.createGain();
    const merger = ctx.createChannelMerger(2);
    const splitter = ctx.createChannelSplitter(2);

    leftOsc.type = "sine";
    rightOsc.type = "sine";
    leftOsc.frequency.value = preset.base;
    rightOsc.frequency.value = preset.base + preset.hz;

    leftGain.gain.value = 1;
    rightGain.gain.value = 1;
    masterGain.gain.value = volume / 100;
    masterGainRef.current = masterGain;

    // Route left osc to left channel only, right osc to right channel only
    leftOsc.connect(leftGain);
    rightOsc.connect(rightGain);
    leftGain.connect(merger, 0, 0);
    rightGain.connect(merger, 0, 1);
    merger.connect(masterGain);
    masterGain.connect(ctx.destination);

    leftOscRef.current = leftOsc;
    rightOscRef.current = rightOsc;

    // Fade in over 500ms
    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(volume / 100, ctx.currentTime + 0.5);

    leftOsc.start();
    rightOsc.start();

    setActive(true);
    setElapsed(0);

    const startTime = Date.now();
    intervalRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - startTime) / 1000);
      setElapsed(secs);
      if (timerMin > 0 && secs >= timerMin * 60) {
        stop();
      }
    }, 1000);
  }, [preset, volume, timerMin, stop]);

  const toggle = () => {
    if (active) stop();
    else start();
  };

  // Update volume live
  useEffect(() => {
    if (masterGainRef.current && audioCtxRef.current) {
      masterGainRef.current.gain.linearRampToValueAtTime(
        volume / 100,
        audioCtxRef.current.currentTime + 0.05
      );
    }
  }, [volume]);

  // Stop on unmount
  useEffect(() => () => stop(), [stop]);

  // When preset changes while active, restart
  useEffect(() => {
    if (active) {
      stop();
      setTimeout(() => start(), 100);
    }
  }, [preset.id]);

  const remaining = timerMin > 0 ? Math.max(0, timerMin * 60 - elapsed) : null;
  const progress = timerMin > 0 ? (elapsed / (timerMin * 60)) * 100 : 0;

  return (
    <MainLayout>
      <div className="px-4 sm:px-6 py-8 max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center">
              <Brain className="w-6 h-6 text-primary" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">Binaural Beats</h1>
              <p className="text-sm text-muted-foreground">Stymulacja fal mózgowych — tylko w GrouAI</p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary">
            <Headphones className="w-3.5 h-3.5" />
            Wymagane słuchawki stereo dla pełnego efektu binaural
          </div>
        </div>

        {/* Preset grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-6">
          {PRESETS.map((p) => {
            const Icon = p.icon;
            const isSelected = preset.id === p.id;
            return (
              <motion.button
                key={p.id}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setPreset(p)}
                className={`relative p-3 rounded-xl border-2 transition-all text-center ${
                  isSelected
                    ? "border-current bg-current/10"
                    : "border-border bg-card hover:border-border/80"
                }`}
                style={isSelected ? { borderColor: p.color, background: p.color + "18" } : undefined}
              >
                <Icon className="w-5 h-5 mx-auto mb-1.5" style={{ color: isSelected ? p.color : undefined }} />
                <div className="font-bold text-xs text-foreground">{p.name}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{p.hz} Hz</div>
                {isSelected && (
                  <motion.div
                    layoutId="preset-indicator"
                    className="absolute -top-1 -right-1 w-3 h-3 rounded-full"
                    style={{ background: p.color }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Active preset info */}
        <motion.div
          key={preset.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-5 rounded-2xl border border-border bg-gradient-to-br ${preset.gradient} mb-6`}
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">{preset.description}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="text-[11px] font-mono" style={{ background: preset.color + "30", color: preset.color, borderColor: preset.color + "50" }}>
                  {preset.brainwave}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  L: {preset.base} Hz · R: {preset.base + preset.hz} Hz · Beat: {preset.hz} Hz
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {preset.benefits.map((b) => (
              <span key={b} className="text-[11px] px-2 py-0.5 rounded-full border border-border bg-background/50 text-muted-foreground">
                {b}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Wave Visualizer */}
        <div className="mb-6">
          <WaveVisualizer preset={preset} active={active} elapsed={elapsed} />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-1">
            <span>Lewe ucho: {preset.base} Hz</span>
            <span>Prawe ucho: {preset.base + preset.hz} Hz</span>
          </div>
        </div>

        {/* Volume */}
        <div className="mb-5 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-muted-foreground" /> Głośność
            </label>
            <span className="text-sm text-muted-foreground tabular-nums">{volume}%</span>
          </div>
          <Slider
            value={[volume]}
            onValueChange={([v]) => setVolume(v)}
            min={5}
            max={80}
            step={1}
            className="w-full"
          />
          <p className="text-[11px] text-muted-foreground">
            Zalecane: 20–40%. Zbyt głośny dźwięk może być nieprzyjemny.
          </p>
        </div>

        {/* Timer */}
        <div className="mb-6 space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <label className="text-sm font-medium">Timer</label>
          </div>
          <div className="flex gap-2 flex-wrap">
            {TIMERS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTimerMin(t.value)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                  timerMin === t.value
                    ? "border-primary bg-primary/15 text-primary font-semibold"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Progress bar (when timer active) */}
        {active && timerMin > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mb-5"
          >
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>Upłynęło: {fmt(elapsed)}</span>
              <span>Pozostało: {fmt(remaining ?? 0)}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: preset.color }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </motion.div>
        )}

        {/* Elapsed (no timer) */}
        {active && timerMin === 0 && (
          <div className="mb-5 text-center text-sm text-muted-foreground">
            Czas trwania: <span className="font-mono text-foreground">{fmt(elapsed)}</span>
          </div>
        )}

        {/* Play/Stop button */}
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} className="mb-8">
          <Button
            onClick={toggle}
            className="w-full h-16 text-lg font-bold gap-3 border-0"
            style={{
              background: active
                ? "linear-gradient(135deg, #ef4444, #dc2626)"
                : `linear-gradient(135deg, ${preset.color}, ${preset.color}99)`,
              boxShadow: active
                ? "0 0 30px #ef444440"
                : `0 0 40px ${preset.color}40`,
            }}
          >
            <AnimatePresence mode="wait">
              {active ? (
                <motion.div key="stop" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="flex items-center gap-3">
                  <Square className="w-5 h-5 fill-white" />
                  <span>Zatrzymaj</span>
                  {timerMin > 0 && <span className="font-mono text-sm opacity-80">{fmt(remaining ?? 0)}</span>}
                </motion.div>
              ) : (
                <motion.div key="play" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="flex items-center gap-3">
                  <Play className="w-5 h-5 fill-white" />
                  <span>Start — {preset.name} {preset.hz} Hz</span>
                </motion.div>
              )}
            </AnimatePresence>
          </Button>
        </motion.div>

        {/* Info panel */}
        <div className="rounded-2xl border border-border bg-card/50 p-5 space-y-4 text-sm">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <Sun className="w-4 h-4 text-primary" /> Jak działają Binaural Beats?
          </h3>
          <p className="text-muted-foreground leading-relaxed">
            Binaural beats to technika dźwiękowa oparta na zjawisku, gdy każde ucho słyszy nieco inną częstotliwość.
            Mózg <strong className="text-foreground">sam generuje brakujący ton</strong> będący różnicą — np. L: 200 Hz + P: 240 Hz = 40 Hz beat.
            Badania sugerują, że może to synchronizować aktywność neuronalną z pożądanym stanem mózgu.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {PRESETS.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.id} className="flex items-start gap-2 p-2 rounded-lg bg-background/50">
                  <Icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: p.color }} />
                  <div>
                    <div className="font-semibold text-xs text-foreground">{p.brainwave} ({p.hz} Hz) — {p.name}</div>
                    <div className="text-[11px] text-muted-foreground">{p.benefits[0]}, {p.benefits[1]}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground border-t border-border pt-3">
            ⚠️ Binaural beats wymagają stereo słuchawek. Nie używaj podczas prowadzenia pojazdu ani obsługi maszyn.
            Ta funkcja służy celom relaksacyjnym i nie jest substytutem leczenia medycznego.
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
