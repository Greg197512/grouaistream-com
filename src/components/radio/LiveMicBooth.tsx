import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Square, X, Music2, Radio as RadioIcon, Upload, Volume2, AudioWaveform } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface LiveMicBoothProps {
  open: boolean;
  onClose: () => void;
  /** The currently playing radio audio element (we will duck it) */
  radioAudio: HTMLAudioElement | null;
  /** Original radio volume (0..100) so we can restore it */
  baseVolume: number;
}

type Phase = "idle" | "countdown" | "live" | "stopped";

const COUNTDOWN_SECONDS = 6;

/**
 * LiveMicBooth — Admin live commentary booth for the radio.
 * - 6-second countdown before going on-air
 * - Ducks the underlying radio music via volume slider
 * - Real-time pitch shifting (tonacja głosu) via playback rate on a recorded buffer
 *   (live mic is routed straight; pitch slider applies a subtle preamp + filter chain
 *   for "warm/bright" vocal coloration since true real-time pitch shift requires worklets)
 * - Optional jingle / wejściówka upload played before the mic opens
 */
export const LiveMicBooth = ({ open, onClose, radioAudio, baseVolume }: LiveMicBoothProps) => {
  const [phase, setPhase] = useState<Phase>("idle");
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [musicDuck, setMusicDuck] = useState(25); // % of original volume during live
  const [micGain, setMicGain] = useState(85);
  const [pitch, setPitch] = useState(0); // -12..+12 semitones (tonal coloration)
  const [echo, setEcho] = useState(false);
  const [level, setLevel] = useState(0);
  const [jingleUrl, setJingleUrl] = useState<string | null>(null);
  const [jingleName, setJingleName] = useState<string | null>(null);
  const [playJingleFirst, setPlayJingleFirst] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const delayRef = useRef<DelayNode | null>(null);
  const feedbackRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const jingleAudioRef = useRef<HTMLAudioElement | null>(null);
  const originalVolumeRef = useRef<number>(baseVolume);

  // ============= cleanup =============
  const cleanupAudio = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    sourceRef.current = null;
    gainRef.current = null;
    filterRef.current = null;
    delayRef.current = null;
    feedbackRef.current = null;
    analyserRef.current = null;
    if (jingleAudioRef.current) {
      jingleAudioRef.current.pause();
      jingleAudioRef.current = null;
    }
  }, []);

  // Restore radio volume on close/cleanup
  const restoreRadio = useCallback(() => {
    if (radioAudio) {
      radioAudio.volume = Math.max(0, Math.min(1, originalVolumeRef.current / 100));
    }
  }, [radioAudio]);

  useEffect(() => {
    if (open) {
      originalVolumeRef.current = baseVolume;
      setPhase("idle");
      setCountdown(COUNTDOWN_SECONDS);
    } else {
      cleanupAudio();
      restoreRadio();
    }
    return () => {
      cleanupAudio();
      restoreRadio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Apply ducking when phase = live
  useEffect(() => {
    if (!radioAudio) return;
    if (phase === "live") {
      const target = (originalVolumeRef.current * musicDuck) / 100 / 100;
      radioAudio.volume = Math.max(0, Math.min(1, target));
    } else if (phase === "idle" || phase === "stopped") {
      restoreRadio();
    }
  }, [phase, musicDuck, radioAudio, restoreRadio]);

  // Apply mic gain & pitch (tonacja) live
  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = micGain / 100;
    if (filterRef.current) {
      // Map pitch (-12..+12) to a brightness/warmth tilt EQ instead of true repitch
      // Negative = warmer (low-shelf boost), positive = brighter (high-shelf boost)
      filterRef.current.frequency.value = pitch >= 0 ? 4000 : 250;
      filterRef.current.gain.value = Math.abs(pitch) * 1.2; // up to ~14dB
      filterRef.current.type = pitch >= 0 ? "highshelf" : "lowshelf";
    }
    if (feedbackRef.current) feedbackRef.current.gain.value = echo ? 0.25 : 0;
    if (delayRef.current) delayRef.current.delayTime.value = echo ? 0.25 : 0;
  }, [micGain, pitch, echo]);

  // ============= start live =============
  const initMicChain = async (): Promise<boolean> => {
    try {
      // Request mic FIRST inside user gesture (before any await chains)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;

      // Create context AFTER mic granted, then resume (Chrome/Safari often start "suspended")
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      if (ctx.state === "suspended") {
        try { await ctx.resume(); } catch (e) { console.warn("[LiveMicBooth] resume failed", e); }
      }

      const source = ctx.createMediaStreamSource(stream);
      const gain = ctx.createGain();
      gain.gain.value = micGain / 100;

      const filter = ctx.createBiquadFilter();
      filter.type = pitch >= 0 ? "highshelf" : "lowshelf";
      filter.frequency.value = pitch >= 0 ? 4000 : 250;
      filter.gain.value = Math.abs(pitch) * 1.2;

      const delay = ctx.createDelay(1.0);
      delay.delayTime.value = echo ? 0.25 : 0;
      const feedback = ctx.createGain();
      // Lower feedback to prevent runaway howl
      feedback.gain.value = echo ? 0.25 : 0;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;

      // Master output bus → destination (single connection point, no double-routing)
      const master = ctx.createGain();
      master.gain.value = 1.0;

      // Routing:
      //  source → gain → filter → analyser (tap, no output)
      //                  filter → master → destination
      //                  filter → delay ⇄ feedback → master
      source.connect(gain);
      gain.connect(filter);
      filter.connect(analyser);          // analyser is a TAP only (do not connect to destination)
      filter.connect(master);
      filter.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(master);
      master.connect(ctx.destination);

      console.log("[LiveMicBooth] mic chain ready, ctx state:", ctx.state);

      sourceRef.current = source;
      gainRef.current = gain;
      filterRef.current = filter;
      delayRef.current = delay;
      feedbackRef.current = feedback;
      analyserRef.current = analyser;

      // VU meter
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setLevel(Math.min(100, (avg / 128) * 100));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      return true;
    } catch (err) {
      console.error("[LiveMicBooth] mic error", err);
      toast.error("Brak dostępu do mikrofonu", {
        description: "Pozwól przeglądarce na dostęp do mikrofonu.",
      });
      return false;
    }
  };

  const startCountdown = async () => {
    // Optional jingle first
    if (playJingleFirst && jingleUrl) {
      const audio = new Audio(jingleUrl);
      audio.volume = 0.9;
      jingleAudioRef.current = audio;
      // Duck radio while jingle plays
      if (radioAudio) radioAudio.volume = (originalVolumeRef.current * 0.15) / 100;
      try {
        await audio.play();
        await new Promise<void>((resolve) => {
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
        });
      } catch {
        // ignore
      }
      jingleAudioRef.current = null;
    }

    const ok = await initMicChain();
    if (!ok) return;

    setPhase("countdown");
    setCountdown(COUNTDOWN_SECONDS);
    countdownRef.current = window.setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
          setPhase("live");
          toast.success("🎙️ Jesteś NA ANTENIE", { duration: 2500 });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopLive = () => {
    cleanupAudio();
    restoreRadio();
    setPhase("stopped");
    setLevel(0);
    toast("📻 Mikrofon wyłączony — wracamy do muzyki", { duration: 2000 });
  };

  const handleClose = () => {
    cleanupAudio();
    restoreRadio();
    setPhase("idle");
    onClose();
  };

  const handleJingleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      toast.error("Wybierz plik audio (mp3, wav, ogg...)");
      return;
    }
    if (jingleUrl) URL.revokeObjectURL(jingleUrl);
    const url = URL.createObjectURL(file);
    setJingleUrl(url);
    setJingleName(file.name);
    setPlayJingleFirst(true);
    toast.success(`Wejściówka załadowana: ${file.name}`);
  };

  const clearJingle = () => {
    if (jingleUrl) URL.revokeObjectURL(jingleUrl);
    setJingleUrl(null);
    setJingleName(null);
    setPlayJingleFirst(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md bg-gradient-to-br from-[#0F0F1A] via-[#1a1a2e] to-[#0F0F1A] border border-primary/40 text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RadioIcon className="h-5 w-5 text-primary" />
            Studio Live — Komentarz na antenie
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Wejdź na antenę z głosem na żywo. Po starcie liczymy 6 sekund, a muzyka zostanie ściszona automatycznie.
          </DialogDescription>
        </DialogHeader>

        {/* Countdown overlay */}
        <AnimatePresence>
          {phase === "countdown" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md rounded-lg"
            >
              <motion.div
                key={countdown}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1.2, opacity: 1 }}
                exit={{ scale: 2.5, opacity: 0 }}
                transition={{ duration: 0.6 }}
                className="text-center"
              >
                <div className="text-8xl font-black text-primary drop-shadow-[0_0_30px_hsl(var(--primary))]">
                  {countdown}
                </div>
                <p className="mt-4 text-sm uppercase tracking-[0.3em] text-primary font-bold">
                  Wchodzimy na antenę
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-4 py-2">
          {/* ON-AIR badge */}
          {phase === "live" && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center justify-center gap-3 p-3 rounded-xl bg-gradient-to-r from-red-600 to-red-500 border border-red-400 shadow-[0_0_25px_rgba(239,68,68,0.5)]"
            >
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="h-3 w-3 rounded-full bg-white"
              />
              <span className="text-white font-black text-lg uppercase tracking-widest">
                ON AIR
              </span>
              <Badge className="bg-white/20 text-white border-white/30">LIVE</Badge>
            </motion.div>
          )}

          {/* Mic level */}
          {(phase === "live" || phase === "countdown") && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><AudioWaveform className="h-3 w-3" /> Poziom mikrofonu</span>
                <span className="font-mono">{Math.round(level)}%</span>
              </div>
              <div className="h-3 rounded-full bg-black/60 overflow-hidden border border-primary/20">
                <motion.div
                  className="h-full"
                  style={{
                    background: level > 80
                      ? "linear-gradient(90deg, #22c55e, #facc15, #ef4444)"
                      : "linear-gradient(90deg, #22c55e, #84cc16)",
                    width: `${level}%`,
                  }}
                  animate={{ width: `${level}%` }}
                  transition={{ duration: 0.05 }}
                />
              </div>
            </div>
          )}

          {/* Music ducking slider */}
          <div className="space-y-2 p-3 rounded-lg border border-border/30 bg-card/40">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-2">
                <Music2 className="h-3.5 w-3.5 text-primary" />
                Muzyka pod głosem
              </Label>
              <span className="text-xs font-mono text-primary">{musicDuck}%</span>
            </div>
            <Slider
              value={[musicDuck]}
              min={0}
              max={100}
              step={5}
              onValueChange={([v]) => setMusicDuck(v)}
            />
            <p className="text-[10px] text-muted-foreground">
              0% = całkowite wyciszenie · 100% = bez ściszenia
            </p>
          </div>

          {/* Mic gain */}
          <div className="space-y-2 p-3 rounded-lg border border-border/30 bg-card/40">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-2">
                <Volume2 className="h-3.5 w-3.5 text-primary" />
                Głośność mikrofonu
              </Label>
              <span className="text-xs font-mono text-primary">{micGain}%</span>
            </div>
            <Slider
              value={[micGain]}
              min={0}
              max={150}
              step={5}
              onValueChange={([v]) => setMicGain(v)}
            />
          </div>

          {/* Pitch / tonacja */}
          <div className="space-y-2 p-3 rounded-lg border border-border/30 bg-card/40">
            <div className="flex items-center justify-between">
              <Label className="text-xs">🎚️ Tonacja głosu (warm ↔ bright)</Label>
              <span className="text-xs font-mono text-primary">
                {pitch > 0 ? `+${pitch}` : pitch}
              </span>
            </div>
            <Slider
              value={[pitch]}
              min={-12}
              max={12}
              step={1}
              onValueChange={([v]) => setPitch(v)}
            />
            <p className="text-[10px] text-muted-foreground">
              Minus = cieplejszy, niższy charakter · Plus = jaśniejszy, ostrzejszy
            </p>
          </div>

          {/* Echo toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border/30 bg-card/40">
            <Label className="text-xs">🌊 Echo studyjne</Label>
            <Button
              size="sm"
              variant={echo ? "default" : "outline"}
              onClick={() => setEcho(!echo)}
              className="h-7 text-xs"
            >
              {echo ? "Włączone" : "Wyłączone"}
            </Button>
          </div>

          {/* Wejściówka */}
          <div className="space-y-2 p-3 rounded-lg border border-border/30 bg-card/40">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-2">
                <Upload className="h-3.5 w-3.5 text-primary" />
                Wejściówka (jingle)
              </Label>
              {jingleUrl && (
                <button
                  onClick={clearJingle}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Usuń
                </button>
              )}
            </div>
            {jingleUrl ? (
              <div className="space-y-2">
                <p className="text-xs text-primary truncate">🎵 {jingleName}</p>
                <audio src={jingleUrl} controls className="w-full h-8" />
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={playJingleFirst}
                    onChange={(e) => setPlayJingleFirst(e.target.checked)}
                    className="h-3.5 w-3.5"
                  />
                  Zagraj wejściówkę przed mikrofonem
                </label>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 p-3 rounded-md border-2 border-dashed border-border/50 cursor-pointer hover:border-primary/50 transition-colors">
                <Upload className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Wgraj plik audio (mp3/wav)</span>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleJingleUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            {phase === "idle" || phase === "stopped" ? (
              <Button
                onClick={startCountdown}
                className="flex-1 h-12 gap-2 bg-gradient-to-r from-primary to-red-500 text-white font-bold text-base hover:opacity-90"
              >
                <Mic className="h-5 w-5" />
                {playJingleFirst && jingleUrl ? "Wejściówka + Na antenę" : "Wejdź na antenę (6s)"}
              </Button>
            ) : phase === "live" ? (
              <Button
                onClick={stopLive}
                className="flex-1 h-12 gap-2 bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                <Square className="h-5 w-5 fill-white" />
                Zakończ audycję
              </Button>
            ) : (
              <Button disabled className="flex-1 h-12 gap-2">
                Odliczam...
              </Button>
            )}

            <Button
              variant="outline"
              onClick={handleClose}
              className="h-12 gap-2"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
