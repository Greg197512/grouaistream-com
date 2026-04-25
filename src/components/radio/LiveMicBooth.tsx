import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, X, Music2, Radio as RadioIcon, Upload, Volume2, AudioWaveform, Headphones, HeadphoneOff } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";

interface LiveMicBoothProps {
  open: boolean;
  onClose: () => void;
  /** The currently playing radio audio element (we will duck it) */
  radioAudio: HTMLAudioElement | null;
  /** Original radio volume (0..100) so we can restore it */
  baseVolume: number;
  /** Prevents the admin tab from receiving its own Cloud broadcast */
  sourceId: string;
}

type Phase = "idle" | "preparing" | "countdown" | "live" | "stopped";

const COUNTDOWN_SECONDS = 6;

const buildMicConstraints = (deviceId: string): MediaTrackConstraints => ({
  ...(deviceId && deviceId !== "default" ? { deviceId: { exact: deviceId } } : {}),
  echoCancellation: { ideal: true },
  noiseSuppression: { ideal: true },
  autoGainControl: { ideal: true },
  channelCount: { ideal: 1 },
  sampleRate: { ideal: 48000 },
});

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

const pickBroadcastMimeType = () => {
  if (typeof MediaRecorder === "undefined") return "";
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  return "";
};

/**
 * LiveMicBooth — Profesjonalny pulpit live komentarza radiowego.
 *
 * Architektura sygnału (Web Audio API):
 *
 *  mic → [HighPass 80Hz] → [Compressor] → [Gain] → [EQ tilt] ─┬─→ [Analyser TAP]
 *                                                              │
 *                                                              ├─→ [Master] → ctx.destination  (TYLKO gdy monitor=on)
 *                                                              │
 *                                                              └─→ [Delay ⇄ Feedback] → [Master]
 *
 * KLUCZOWE: domyślnie monitor=OFF, bo słuchanie własnego głosu w głośnikach
 * powoduje echo + sprzężenie (mic łapie z głośnika z opóźnieniem). Gdy admin
 * chce odsłuch — używa słuchawek i włącza monitor ręcznie.
 */
export const LiveMicBooth = ({ open, onClose, radioAudio, baseVolume, sourceId }: LiveMicBoothProps) => {
  const [phase, setPhase] = useState<Phase>("idle");
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [musicDuck, setMusicDuck] = useState(20); // % oryginału w live
  const [micGain, setMicGain] = useState(100);
  const [pitch, setPitch] = useState(0); // -12..+12 (EQ tilt)
  const [echo, setEcho] = useState(false);
  const [monitor, setMonitor] = useState(true); // odsłuch w słuchawkach / lokalny miks antenowy
  const [level, setLevel] = useState(0);
  const [peak, setPeak] = useState(0);
  const [jingleUrl, setJingleUrl] = useState<string | null>(null);
  const [jingleName, setJingleName] = useState<string | null>(null);
  const [playJingleFirst, setPlayJingleFirst] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("default");
  const [activeMicLabel, setActiveMicLabel] = useState<string | null>(null);
  const [broadcastConnected, setBroadcastConnected] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const hpfRef = useRef<BiquadFilterNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const eqRef = useRef<BiquadFilterNode | null>(null);
  const delayRef = useRef<DelayNode | null>(null);
  const feedbackRef = useRef<GainNode | null>(null);
  const monitorGainRef = useRef<GainNode | null>(null); // brama monitor on/off
  const masterRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const broadcastDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const broadcastReadyRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const jingleAudioRef = useRef<HTMLAudioElement | null>(null);
  const originalVolumeRef = useRef<number>(baseVolume);
  const peakHoldRef = useRef<number>(0);
  const peakHoldTimeRef = useRef<number>(0);

  const refreshMicDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setMicDevices(devices.filter((device) => device.kind === "audioinput"));
    } catch (err) {
      console.warn("[LiveMicBooth] enumerateDevices failed", err);
    }
  }, []);

  // ============= cleanup =============
  const cleanupAudio = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    mediaRecorderRef.current = null;
    if (broadcastChannelRef.current) {
      supabase.removeChannel(broadcastChannelRef.current);
      broadcastChannelRef.current = null;
    }
    broadcastReadyRef.current = false;
    setBroadcastConnected(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => { try { t.stop(); } catch {} });
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch {}
      audioCtxRef.current = null;
    }
    sourceRef.current = null;
    hpfRef.current = null;
    compressorRef.current = null;
    gainRef.current = null;
    eqRef.current = null;
    delayRef.current = null;
    feedbackRef.current = null;
    monitorGainRef.current = null;
    masterRef.current = null;
    analyserRef.current = null;
    broadcastDestinationRef.current = null;
    if (jingleAudioRef.current) {
      try { jingleAudioRef.current.pause(); } catch {}
      jingleAudioRef.current = null;
    }
  }, []);

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
      setErrorMsg(null);
      setActiveMicLabel(null);
      setLevel(0);
      setPeak(0);
      refreshMicDevices();
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

  useEffect(() => {
    if (!open || !navigator.mediaDevices?.addEventListener) return;
    navigator.mediaDevices.addEventListener("devicechange", refreshMicDevices);
    return () => navigator.mediaDevices.removeEventListener("devicechange", refreshMicDevices);
  }, [open, refreshMicDevices]);

  useEffect(() => {
    if (selectedDeviceId === "default") return;
    if (micDevices.length && !micDevices.some((device) => device.deviceId === selectedDeviceId)) {
      setSelectedDeviceId("default");
    }
  }, [micDevices, selectedDeviceId]);

  // Ducking gdy live
  useEffect(() => {
    if (!radioAudio) return;
    if (phase === "live") {
      const target = (originalVolumeRef.current * musicDuck) / 100 / 100;
      radioAudio.volume = Math.max(0, Math.min(1, target));
    } else if (phase === "idle" || phase === "stopped") {
      restoreRadio();
    }
  }, [phase, musicDuck, radioAudio, restoreRadio]);

  // Live efekty
  useEffect(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    if (gainRef.current) gainRef.current.gain.setTargetAtTime(micGain / 100, now, 0.02);
    if (eqRef.current) {
      eqRef.current.frequency.value = pitch >= 0 ? 4000 : 250;
      eqRef.current.gain.value = Math.abs(pitch) * 1.2;
      eqRef.current.type = pitch >= 0 ? "highshelf" : "lowshelf";
    }
    if (feedbackRef.current) feedbackRef.current.gain.setTargetAtTime(echo ? 0.22 : 0, now, 0.05);
    if (delayRef.current) delayRef.current.delayTime.setTargetAtTime(echo ? 0.22 : 0, now, 0.05);
    if (monitorGainRef.current) monitorGainRef.current.gain.setTargetAtTime(monitor ? 1 : 0, now, 0.02);
  }, [micGain, pitch, echo, monitor]);

  // ============= start mikrofonu =============
  // KLUCZOWE: getUserMedia musi być wywołane SYNCHRONICZNIE w handlerze user-gesture.
  // Tworzymy AudioContext też w gesture (resume po await jest OK).
  const initMicChain = useCallback(async (): Promise<boolean> => {
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setErrorMsg("Ta przeglądarka nie udostępnia mikrofonu. Otwórz stronę przez HTTPS i użyj Chrome, Edge albo Safari.");
        return false;
      }

      // 1) AudioContext + getUserMedia muszą wystartować natychmiast po kliknięciu.
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      const ctx = new Ctx({ latencyHint: "interactive" });
      audioCtxRef.current = ctx;
      const streamPromise = navigator.mediaDevices.getUserMedia({
        audio: buildMicConstraints(selectedDeviceId),
        video: false,
      });

      if (ctx.state === "suspended") {
        try { await ctx.resume(); } catch (e) { console.warn("[LiveMicBooth] resume failed", e); }
      }

      // 2) Mic stream — wybrany mikrofon lub domyślny systemowy
      const stream = await streamPromise;
      streamRef.current = stream;
      await refreshMicDevices();
      const track = stream.getAudioTracks()[0];
      const settings = track?.getSettings?.();
      const picked = micDevices.find((device) => device.deviceId === settings?.deviceId);
      setActiveMicLabel(track?.label || picked?.label || "Aktywny mikrofon");

      // 3) Łańcuch przetwarzania
      const source = ctx.createMediaStreamSource(stream);

      // High-pass 80Hz — wycina rumble/wiatr
      const hpf = ctx.createBiquadFilter();
      hpf.type = "highpass";
      hpf.frequency.value = 80;
      hpf.Q.value = 0.7;

      // Kompresor — wyrównanie dynamiki głosu
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -22;
      compressor.knee.value = 30;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.005;
      compressor.release.value = 0.15;

      // Gain użytkownika
      const gain = ctx.createGain();
      gain.gain.value = micGain / 100;

      // EQ tilt
      const eq = ctx.createBiquadFilter();
      eq.type = pitch >= 0 ? "highshelf" : "lowshelf";
      eq.frequency.value = pitch >= 0 ? 4000 : 250;
      eq.gain.value = Math.abs(pitch) * 1.2;

      // Echo (delay + feedback)
      const delay = ctx.createDelay(1.0);
      delay.delayTime.value = echo ? 0.22 : 0;
      const feedback = ctx.createGain();
      feedback.gain.value = echo ? 0.22 : 0;

      // Analyser TAP
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.6;

      // Wyjście "antenowe" do Lovable Cloud — niezależne od lokalnego odsłuchu.
      const broadcastDestination = ctx.createMediaStreamDestination();

      // Brama monitora (domyślnie 0 = brak odsłuchu — eliminuje sprzężenie)
      const monitorGain = ctx.createGain();
      monitorGain.gain.value = monitor ? 1 : 0;

      // Master → destination
      const master = ctx.createGain();
      master.gain.value = 1.0;

      // Routing
      source.connect(hpf);
      hpf.connect(compressor);
      compressor.connect(gain);
      gain.connect(eq);
      eq.connect(analyser);            // TAP — analyser nie idzie dalej
      eq.connect(monitorGain);         // sygnał suchy do monitora
      eq.connect(broadcastDestination); // sygnał suchy do słuchaczy radia
      eq.connect(delay);               // sygnał do delay
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(monitorGain);      // mokry sygnał też przez monitor gate
      delay.connect(broadcastDestination);

      monitorGain.connect(master);
      master.connect(ctx.destination);

      sourceRef.current = source;
      hpfRef.current = hpf;
      compressorRef.current = compressor;
      gainRef.current = gain;
      eqRef.current = eq;
      delayRef.current = delay;
      feedbackRef.current = feedback;
      monitorGainRef.current = monitorGain;
      masterRef.current = master;
      analyserRef.current = analyser;
      broadcastDestinationRef.current = broadcastDestination;

      console.log("[LiveMicBooth] ✅ chain ready, ctx:", ctx.state, "mic:", track?.label || settings?.deviceId, "tracks:", stream.getAudioTracks().length);

      // VU meter (RMS + peak hold)
      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(data);
        let sum = 0;
        let max = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
          const av = Math.abs(v);
          if (av > max) max = av;
        }
        const rms = Math.sqrt(sum / data.length);
        const lvl = Math.min(100, rms * 180);
        setLevel(lvl);

        const peakNow = Math.min(100, max * 110);
        const t = performance.now();
        if (peakNow > peakHoldRef.current || t - peakHoldTimeRef.current > 700) {
          peakHoldRef.current = peakNow;
          peakHoldTimeRef.current = t;
          setPeak(peakNow);
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      return true;
    } catch (err: any) {
      console.error("[LiveMicBooth] ❌ mic error", err);
      let msg = "Nieznany błąd mikrofonu.";
      if (err?.name === "NotAllowedError") msg = "Brak zgody na mikrofon. Pozwól w przeglądarce.";
      else if (err?.name === "NotFoundError") msg = "Nie znaleziono mikrofonu w systemie.";
      else if (err?.name === "NotReadableError") msg = "Mikrofon jest używany przez inną aplikację.";
      else if (err?.name === "OverconstrainedError") msg = "Wybrany mikrofon nie jest dostępny. Wybierz inny mikrofon albo ustaw domyślny w systemie.";
      setErrorMsg(msg);
      toast.error("Mikrofon", { description: msg });
      cleanupAudio();
      return false;
    }
  }, [micGain, pitch, echo, monitor, selectedDeviceId, micDevices, refreshMicDevices, cleanupAudio]);

  const startCloudBroadcast = useCallback(() => {
    const destination = broadcastDestinationRef.current;
    if (!destination || !destination.stream.getAudioTracks().length || typeof MediaRecorder === "undefined") {
      setErrorMsg("Mikrofon działa lokalnie, ale ta przeglądarka nie potrafi wysłać głosu na radio.");
      return false;
    }

    const mimeType = pickBroadcastMimeType();
    if (!mimeType) {
      setErrorMsg("Brak obsługi nagrywania audio w tej przeglądarce. Użyj Chrome albo Edge.");
      return false;
    }

    const channel = supabase.channel("radio-live-voice", { config: { broadcast: { self: false } } });
    broadcastChannelRef.current = channel;

    const recorder = new MediaRecorder(destination.stream, { mimeType, audioBitsPerSecond: 96_000 });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = async (event) => {
      if (!event.data.size || !broadcastReadyRef.current) return;
      try {
        const audioBase64 = arrayBufferToBase64(await event.data.arrayBuffer());
        await channel.send({
          type: "broadcast",
          event: "chunk",
          payload: { sourceId, mimeType, audioBase64, sentAt: Date.now() },
        });
      } catch (err) {
        console.warn("[LiveMicBooth] broadcast chunk failed", err);
      }
    };

    recorder.onerror = () => {
      setBroadcastConnected(false);
      setErrorMsg("Połączenie głosu live z radiem zostało przerwane. Zatrzymaj i wejdź na antenę ponownie.");
    };

    channel.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      broadcastReadyRef.current = true;
      setBroadcastConnected(true);
      channel.send({
        type: "broadcast",
        event: "start",
        payload: { sourceId, mimeType, sentAt: Date.now() },
      });
      recorder.start(750);
    });

    return true;
  }, [sourceId]);

  const startCountdown = useCallback(async () => {
    setErrorMsg(null);
    setPhase("preparing");

    // KROK 1 — mikrofon najpierw (synchroniczne wywołanie w gesture-chain)
    const ok = await initMicChain();
    if (!ok) {
      setPhase("idle");
      return;
    }

    // KROK 2 — opcjonalna wejściówka (PO uzyskaniu mikrofonu, żeby nie tracić gestu)
    if (playJingleFirst && jingleUrl) {
      const audio = new Audio(jingleUrl);
      audio.volume = 0.9;
      jingleAudioRef.current = audio;
      if (radioAudio) radioAudio.volume = (originalVolumeRef.current * 0.15) / 100;
      try {
        await audio.play();
        await new Promise<void>((resolve) => {
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          // safety timeout 30s
          setTimeout(() => resolve(), 30_000);
        });
      } catch (e) {
        console.warn("[LiveMicBooth] jingle play failed", e);
      }
      jingleAudioRef.current = null;
    }

    // KROK 3 — odliczanie
    setPhase("countdown");
    setCountdown(COUNTDOWN_SECONDS);
    countdownRef.current = window.setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
          setPhase("live");
          startCloudBroadcast();
          toast.success("🎙️ JESTEŚ NA ANTENIE", { duration: 2500 });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [initMicChain, playJingleFirst, jingleUrl, radioAudio, startCloudBroadcast]);

  const stopLive = () => {
    cleanupAudio();
    restoreRadio();
    setPhase("stopped");
    setLevel(0);
    setPeak(0);
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

  const isBusy = phase === "preparing" || phase === "countdown" || phase === "live";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md bg-gradient-to-br from-[#0F0F1A] via-[#1a1a2e] to-[#0F0F1A] border border-primary/40 text-foreground max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RadioIcon className="h-5 w-5 text-primary" />
            Studio Live — Komentarz na antenie
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Wejdź na antenę z głosem na żywo. Po starcie liczymy 6 sekund i muzyka zostanie ściszona automatycznie.
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
          {errorMsg && (
            <div className="p-3 rounded-lg border border-red-500/40 bg-red-950/40 text-red-200 text-xs">
              ⚠️ {errorMsg}
            </div>
          )}

          <div className="space-y-2 p-3 rounded-lg border border-border/30 bg-card/40">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs flex items-center gap-2">
                <Mic className="h-3.5 w-3.5 text-primary" />
                Mikrofon wejściowy
              </Label>
              {activeMicLabel && (
                <Badge className="bg-primary/15 text-primary border-primary/30 max-w-[180px] truncate">
                  {activeMicLabel}
                </Badge>
              )}
            </div>
            <select
              value={selectedDeviceId}
              onChange={(event) => setSelectedDeviceId(event.target.value)}
              disabled={isBusy}
              className="w-full h-9 rounded-md border border-border/50 bg-background px-3 text-xs text-foreground outline-none focus:border-primary disabled:opacity-60"
            >
              <option value="default">Domyślny mikrofon systemowy</option>
              {micDevices.map((device, index) => (
                <option key={device.deviceId || index} value={device.deviceId}>
                  {device.label || `Mikrofon ${index + 1}`}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-muted-foreground">
              Jeśli masz słuchawki z mikrofonem, wybierz je tutaj przed wejściem na antenę.
            </p>
          </div>

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

          {/* VU meter */}
          {isBusy && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><AudioWaveform className="h-3 w-3" /> Poziom mikrofonu</span>
                <span className="font-mono">{Math.round(level)}% · peak {Math.round(peak)}%</span>
              </div>
              <div className="relative h-4 rounded-full bg-black/60 overflow-hidden border border-primary/20">
                <motion.div
                  className="h-full"
                  style={{
                    background: level > 80
                      ? "linear-gradient(90deg, #22c55e, #facc15, #ef4444)"
                      : level > 55
                        ? "linear-gradient(90deg, #22c55e, #84cc16, #facc15)"
                        : "linear-gradient(90deg, #22c55e, #65a30d)",
                    width: `${level}%`,
                  }}
                  animate={{ width: `${level}%` }}
                  transition={{ duration: 0.05 }}
                />
                {/* peak marker */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_6px_white]"
                  style={{ left: `${peak}%` }}
                />
              </div>
              {phase === "live" && level < 2 && (
                <p className="text-[10px] text-amber-300">
                  ⚠️ Brak sygnału z mikrofonu — mów głośniej lub sprawdź urządzenie wejściowe.
                </p>
              )}
            </div>
          )}

          {/* Music ducking */}
          <div className="space-y-2 p-3 rounded-lg border border-border/30 bg-card/40">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-2">
                <Music2 className="h-3.5 w-3.5 text-primary" />
                Muzyka pod głosem
              </Label>
              <span className="text-xs font-mono text-primary">{musicDuck}%</span>
            </div>
            <Slider value={[musicDuck]} min={0} max={100} step={5} onValueChange={([v]) => setMusicDuck(v)} />
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
            <Slider value={[micGain]} min={0} max={200} step={5} onValueChange={([v]) => setMicGain(v)} />
          </div>

          {/* Tonacja */}
          <div className="space-y-2 p-3 rounded-lg border border-border/30 bg-card/40">
            <div className="flex items-center justify-between">
              <Label className="text-xs">🎚️ Tonacja głosu (warm ↔ bright)</Label>
              <span className="text-xs font-mono text-primary">{pitch > 0 ? `+${pitch}` : pitch}</span>
            </div>
            <Slider value={[pitch]} min={-12} max={12} step={1} onValueChange={([v]) => setPitch(v)} />
            <p className="text-[10px] text-muted-foreground">Minus = cieplej · Plus = jaśniej</p>
          </div>

          {/* Echo + Monitor */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/30 bg-card/40">
              <Label className="text-xs">🌊 Echo</Label>
              <Button size="sm" variant={echo ? "default" : "outline"} onClick={() => setEcho(!echo)} className="h-7 text-xs">
                {echo ? "ON" : "OFF"}
              </Button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/30 bg-card/40">
              <Label className="text-xs flex items-center gap-1">
                {monitor ? <Headphones className="h-3.5 w-3.5" /> : <HeadphoneOff className="h-3.5 w-3.5" />}
                Odsłuch
              </Label>
              <Button size="sm" variant={monitor ? "default" : "outline"} onClick={() => setMonitor(!monitor)} className="h-7 text-xs">
                {monitor ? "ON" : "OFF"}
              </Button>
            </div>
          </div>
          {monitor && (
            <p className="text-[10px] text-amber-300 -mt-2">
              ⚠️ Włącz odsłuch tylko ze słuchawkami — bez nich powstanie sprzężenie!
            </p>
          )}

          {/* Wejściówka */}
          <div className="space-y-2 p-3 rounded-lg border border-border/30 bg-card/40">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-2">
                <Upload className="h-3.5 w-3.5 text-primary" />
                Wejściówka (jingle)
              </Label>
              {jingleUrl && (
                <button onClick={clearJingle} className="text-xs text-red-400 hover:text-red-300">Usuń</button>
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
                <input type="file" accept="audio/*" onChange={handleJingleUpload} className="hidden" />
              </label>
            )}
          </div>

          {/* Akcje */}
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
                {phase === "preparing" ? "Inicjalizuję mikrofon..." : "Odliczam..."}
              </Button>
            )}

            <Button variant="outline" onClick={handleClose} className="h-12 gap-2">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
