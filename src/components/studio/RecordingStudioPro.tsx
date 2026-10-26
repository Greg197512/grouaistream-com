import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, Square, Play, Pause, Trash2, Plus, Download, Save, Loader2,
  Piano, Volume2, VolumeX, Crown, Disc3, Usb, RadioTower, Upload,
  SlidersHorizontal, ChevronDown, Sparkles, Music4, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/integrations/supabase/client";
import { uploadToR2 } from "@/lib/r2Upload";
import { WaveformPlayer } from "@/components/studio/WaveformPlayer";
import { StemsWorkbench } from "@/components/studio/StemsWorkbench";
import { checkSpotifyReady, type SpotifyReadyCheck } from "@/lib/loudness";
import { SpotifyReadyBadge } from "@/components/studio/SpotifyReadyBadge";
import { buildFxChain, DEFAULT_FX, FX_IS_DEFAULT, type TrackFx } from "@/lib/trackEffects";
import { analyzeSong, type SongAnalysis } from "@/lib/pitchAnalysis";

/**
 * Studio Nagrań Pro (VIP) — wielościeżkowe nagrywanie na prawdziwym sprzęcie:
 * mikrofon/interfejs audio (Web Audio API, urządzenie wybierasz z listy — USB
 * audio interface pokazuje się tam jak zwykły mikrofon) + klawiatura MIDI
 * (Web MIDI API — dźwięk gra od razu, prosty syntezator). Nagrywasz warstwy
 * (wokal, instrument) na podkładzie z Twojej biblioteki, miksujesz, zapisujesz.
 */

type Track = {
  id: string;
  name: string;
  blob: Blob;
  url: string;
  volume: number;
  muted: boolean;
  fx: TrackFx;
};

type BackingTrack = { id: string; title: string; audio_url: string };

function SynthKey({ note, active }: { note: number; active: boolean }) {
  const white = ![1, 3, 6, 8, 10].includes(note % 12);
  return (
    <div
      className={`rounded-sm transition-colors ${white ? "h-10 w-3 bg-white/80" : "h-6 w-2 -mx-1 z-10 bg-black"} ${
        active ? (white ? "!bg-[#FF9500]" : "!bg-[#FF6B00]") : ""
      }`}
    />
  );
}

// Brzmienia pod klawiaturę MIDI — różny kształt fali + obwiednia głośności.
type InstrumentVoice = { id: string; label: string; type: OscillatorType; attack: number; release: number; gain: number; detune?: number };
const INSTRUMENTS: InstrumentVoice[] = [
  { id: "piano", label: "🎹 Pianino", type: "triangle", attack: 0.008, release: 0.35, gain: 0.28 },
  { id: "lead", label: "⚡ Lead", type: "sawtooth", attack: 0.02, release: 0.08, gain: 0.22 },
  { id: "bass", label: "🔊 Bas", type: "sine", attack: 0.01, release: 0.2, gain: 0.35, detune: -1200 },
  { id: "pad", label: "🌫️ Pad", type: "sine", attack: 0.4, release: 1.1, gain: 0.2 },
  { id: "pluck", label: "🪕 Pluck", type: "square", attack: 0.002, release: 0.12, gain: 0.16 },
];

export function RecordingStudioPro() {
  const { user } = useAuth();
  const { isVip, isUltimate, showUpgradeFor } = useSubscription();
  const unlocked = isVip || isUltimate;

  // --- wejście audio (mikrofon / interfejs USB) ---
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInput, setSelectedInput] = useState<string>("");
  const [inputLevel, setInputLevel] = useState(0);
  const [micGranted, setMicGranted] = useState(false);

  // --- MIDI ---
  const [midiDevices, setMidiDevices] = useState<string[]>([]);
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [instrument, setInstrument] = useState("piano");
  const instrumentRef = useRef(instrument);
  useEffect(() => { instrumentRef.current = instrument; }, [instrument]);
  const midiAudioCtxRef = useRef<AudioContext | null>(null);
  const midiOscRef = useRef<Map<number, { osc: OscillatorNode; gain: GainNode }>>(new Map());

  // --- nagrywanie ---
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [tracks, setTracks] = useState<Track[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const meterCtxRef = useRef<AudioContext | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  // --- podkład z biblioteki (do nagrywania "na żywo" nad istniejącym utworem) ---
  const [backingTracks, setBackingTracks] = useState<BackingTrack[]>([]);
  const [backingId, setBackingId] = useState<string>("");
  const backingAudioRef = useRef<HTMLAudioElement | null>(null);

  // --- mixdown ---
  const [mixing, setMixing] = useState(false);
  const [mixUrl, setMixUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [spotifyCheck, setSpotifyCheck] = useState<SpotifyReadyCheck | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fxOpenId, setFxOpenId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<SongAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const lastMixBufferRef = useRef<AudioBuffer | null>(null);

  useEffect(() => {
    if (!unlocked || !user) return;
    supabase
      .from("tracks")
      .select("id, title, audio_url")
      .eq("user_id", user.id)
      .not("audio_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setBackingTracks((data as BackingTrack[]) || []));
  }, [unlocked, user]);

  // Lista urządzeń wejściowych — po pierwszym pozwoleniu przeglądarka pokazuje
  // też nazwy (np. "Focusrite Scarlett 2i2"), nie tylko "Microphone 1".
  const refreshDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter((d) => d.kind === "audioinput");
      setInputDevices(inputs);
      if (!selectedInput && inputs[0]) setSelectedInput(inputs[0].deviceId);
    } catch { /* brak uprawnień jeszcze */ }
  }, [selectedInput]);

  const requestMic = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
      setMicGranted(true);
      await refreshDevices();
      toast.success("🎙️ Mikrofon / interfejs audio podłączony");
    } catch {
      toast.error("Nie udało się uzyskać dostępu do mikrofonu — sprawdź uprawnienia przeglądarki");
    }
  };

  useEffect(() => {
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshDevices);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", refreshDevices);
  }, [refreshDevices]);

  // --- Web MIDI: podłącz klawiaturę/kontroler, graj dźwięk od razu ---
  useEffect(() => {
    if (!unlocked) return;
    let access: any;
    const noteOn = (note: number, velocity: number) => {
      if (!midiAudioCtxRef.current) midiAudioCtxRef.current = new AudioContext();
      const ctx = midiAudioCtxRef.current;
      const voice = INSTRUMENTS.find((v) => v.id === instrumentRef.current) || INSTRUMENTS[0];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = voice.type;
      osc.frequency.value = 440 * Math.pow(2, (note - 69) / 12);
      if (voice.detune) osc.detune.value = voice.detune;
      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime((velocity / 127) * voice.gain, ctx.currentTime + voice.attack);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      midiOscRef.current.set(note, { osc, gain });
      setActiveNotes((s) => new Set(s).add(note));
    };
    const noteOff = (note: number) => {
      const v = midiOscRef.current.get(note);
      if (v && midiAudioCtxRef.current) {
        const ctx = midiAudioCtxRef.current;
        const voice = INSTRUMENTS.find((x) => x.id === instrumentRef.current) || INSTRUMENTS[0];
        v.gain.gain.cancelScheduledValues(ctx.currentTime);
        v.gain.gain.setValueAtTime(v.gain.gain.value, ctx.currentTime);
        v.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + voice.release);
        v.osc.stop(ctx.currentTime + voice.release + 0.02);
        midiOscRef.current.delete(note);
      }
      setActiveNotes((s) => { const n = new Set(s); n.delete(note); return n; });
    };
    const onMessage = (e: any) => {
      const [status, note, velocity] = e.data;
      const cmd = status & 0xf0;
      if (cmd === 0x90 && velocity > 0) noteOn(note, velocity);
      else if (cmd === 0x80 || (cmd === 0x90 && velocity === 0)) noteOff(note);
    };
    const listDevices = (midi: any) => {
      const names: string[] = [];
      midi.inputs.forEach((input: any) => {
        names.push(input.name || "MIDI");
        input.onmidimessage = onMessage;
      });
      setMidiDevices(names);
    };
    (navigator as any).requestMIDIAccess?.()
      .then((midi: any) => {
        access = midi;
        listDevices(midi);
        midi.onstatechange = () => listDevices(midi);
      })
      .catch(() => {});
    return () => { if (access) access.onstatechange = null; };
  }, [unlocked]);

  // --- Miernik poziomu wejścia (podgląd, żeby widzieć że sprzęt gra) ---
  const startMeter = (stream: MediaStream) => {
    const ctx = new AudioContext();
    meterCtxRef.current = ctx;
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      setInputLevel(Math.min(100, (avg / 255) * 180));
      meterRafRef.current = requestAnimationFrame(tick);
    };
    tick();
  };

  const stopMeter = () => {
    if (meterRafRef.current) cancelAnimationFrame(meterRafRef.current);
    meterCtxRef.current?.close().catch(() => {});
    meterCtxRef.current = null;
    setInputLevel(0);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedInput ? { deviceId: { exact: selectedInput } } : true,
      });
      streamRef.current = stream;
      startMeter(stream);
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setTracks((prev) => [...prev, {
          id: crypto.randomUUID(), name: `Warstwa ${prev.length + 1}`, blob, url, volume: 100, muted: false, fx: { ...DEFAULT_FX },
        }]);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
      if (backingId) {
        const bt = backingTracks.find((b) => b.id === backingId);
        if (bt) {
          const audio = new Audio(bt.audio_url);
          backingAudioRef.current = audio;
          audio.currentTime = 0;
          audio.play().catch(() => {});
        }
      }
    } catch {
      toast.error("Nie udało się uruchomić nagrywania — sprawdź mikrofon/interfejs");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    stopMeter();
    setRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    backingAudioRef.current?.pause();
    backingAudioRef.current = null;
    toast.success("🎙️ Warstwa nagrana");
  };

  const removeTrack = (id: string) => {
    setTracks((prev) => {
      const t = prev.find((x) => x.id === id);
      if (t) URL.revokeObjectURL(t.url);
      return prev.filter((x) => x.id !== id);
    });
    setMixUrl(null);
    setSpotifyCheck(null);
    setAnalysis(null);
    lastMixBufferRef.current = null;
  };

  // --- Wgraj własny plik audio jako warstwę (do obróbki/miksu razem z nagranymi) ---
  const addFileAsTrack = async (file: File) => {
    try {
      const ctx = new AudioContext();
      const arr = await file.arrayBuffer();
      await ctx.decodeAudioData(arr.slice(0)); // tylko walidacja, że to prawidłowe audio
      ctx.close();
      const url = URL.createObjectURL(file);
      setTracks((prev) => [...prev, {
        id: crypto.randomUUID(), name: file.name.replace(/\.[^.]+$/, "").slice(0, 24), blob: file, url, volume: 100, muted: false, fx: { ...DEFAULT_FX },
      }]);
      toast.success(`📁 "${file.name}" dodano jako warstwę`);
    } catch {
      toast.error("Nie udało się odczytać tego pliku audio");
    }
  };

  const updateTrackFx = (id: string, patch: Partial<TrackFx>) => {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, fx: { ...t.fx, ...patch } } : t)));
  };

  // --- Miksdown: łączy wszystkie warstwy (+ efekty per warstwa + opcjonalny podkład) w jeden WAV ---
  const mixdown = async () => {
    if (!tracks.length) { toast.error("Nagraj przynajmniej jedną warstwę"); return; }
    setMixing(true);
    setSpotifyCheck(null);
    setAnalysis(null);
    try {
      const ctx = new OfflineAudioContext(2, 44100 * 240, 44100);
      const buffers = await Promise.all(
        tracks.filter((t) => !t.muted).map(async (t) => {
          const arr = await t.blob.arrayBuffer();
          return { buf: await ctx.decodeAudioData(arr), volume: t.volume / 100, fx: t.fx };
        }),
      );
      let maxLen = 0;
      for (const b of buffers) maxLen = Math.max(maxLen, b.buf.duration);
      if (backingId) {
        const bt = backingTracks.find((b) => b.id === backingId);
        if (bt) {
          const r = await fetch(bt.audio_url);
          const arr = await r.arrayBuffer();
          const buf = await ctx.decodeAudioData(arr);
          maxLen = Math.max(maxLen, buf.duration);
          const src = ctx.createBufferSource();
          const gain = ctx.createGain();
          gain.gain.value = 0.85;
          src.buffer = buf;
          src.connect(gain).connect(ctx.destination);
          src.start(0);
        }
      }
      for (const b of buffers) {
        const src = ctx.createBufferSource();
        const gain = ctx.createGain();
        gain.gain.value = b.volume;
        src.buffer = b.buf;
        if (FX_IS_DEFAULT(b.fx)) {
          src.connect(gain).connect(ctx.destination);
        } else {
          const fxInput = buildFxChain(ctx, b.fx, ctx.destination);
          src.connect(gain).connect(fxInput);
        }
        src.start(0);
      }
      const rendered = await ctx.startRendering();
      const trimmedLen = Math.max(1, Math.ceil(maxLen * 44100));
      const wav = audioBufferToWav(rendered, trimmedLen);
      const blob = new Blob([wav], { type: "audio/wav" });
      setMixUrl(URL.createObjectURL(blob));

      // Przytnij do realnej długości przed analizą (rendered ma 240s bufora, w tym cisza).
      const trimmed = new AudioBuffer({ numberOfChannels: rendered.numberOfChannels, length: trimmedLen, sampleRate: rendered.sampleRate });
      for (let c = 0; c < rendered.numberOfChannels; c++) {
        trimmed.copyToChannel(rendered.getChannelData(c).subarray(0, trimmedLen), c);
      }
      lastMixBufferRef.current = trimmed;
      setSpotifyCheck(checkSpotifyReady(trimmed));
      toast.success("🎚️ Miks gotowy");
    } catch (e: any) {
      toast.error("Nie udało się zmiksować: " + (e?.message || "błąd"));
    } finally {
      setMixing(false);
    }
  };

  // --- Analiza: tonacja, zakres wysokości, podpowiedź strojenia dla kapeli ---
  const runAnalysis = () => {
    if (!lastMixBufferRef.current) { toast.error("Najpierw zmiksuj warstwy"); return; }
    setAnalyzing(true);
    setTimeout(() => {
      try {
        setAnalysis(analyzeSong(lastMixBufferRef.current!));
      } catch {
        toast.error("Nie udało się przeanalizować utworu");
      } finally {
        setAnalyzing(false);
      }
    }, 30); // mikro-opóźnienie, żeby UI zdążyło pokazać spinner przed ciężkim liczeniem
  };

  const saveMix = async () => {
    if (!mixUrl || !user) return;
    setSaving(true);
    try {
      const r = await fetch(mixUrl);
      const blob = await r.blob();
      const file = new File([blob], `studio-pro-${Date.now()}.wav`, { type: "audio/wav" });
      const { publicUrl } = await uploadToR2({ file, folder: "studio-pro" });
      const title = `Nagranie Studio Pro ${new Date().toLocaleDateString("pl-PL")}`;
      const { error } = await supabase.from("tracks").insert({
        user_id: user.id, title, artist: user.user_metadata?.display_name || user.email?.split("@")[0] || "GrouAI Studio",
        album: "Studio Nagrań Pro", duration: null, audio_url: publicUrl, genre: "recording", mood: "live",
      });
      if (error) throw error;
      toast.success("Zapisano w bibliotece! 🎉");
      window.dispatchEvent(new CustomEvent("grouai:generations-changed"));
    } catch (e: any) {
      toast.error("Błąd zapisu: " + (e?.message || "nieznany"));
    } finally {
      setSaving(false);
    }
  };

  if (!unlocked) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-[#FFD400]/30 bg-gradient-to-br from-[#1a1a2e]/80 to-[#12121c]/80 p-8 text-center">
        <Crown className="mx-auto h-10 w-10 text-[#FFD400] mb-3" />
        <h3 className="text-lg font-extrabold text-white mb-2">Studio Nagrań Pro — tylko VIP</h3>
        <p className="text-sm text-gray-400 mb-5 max-w-md mx-auto">
          Podłącz mikrofon, interfejs audio lub klawiaturę MIDI i nagrywaj prawdziwe wielościeżkowe warstwy
          (wokal, instrument) nad swoimi utworami z GrouAI Studio — wszystko w przeglądarce, bez instalowania niczego.
        </p>
        <Button onClick={() => showUpgradeFor("Studio Nagrań Pro")} className="font-bold text-white border-0" style={{ background: "linear-gradient(135deg, #FFD400, #FF6B00)" }}>
          <Crown className="h-4 w-4 mr-1.5" /> Odblokuj VIP
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Disc3 className="h-5 w-5 text-[#FFD400]" />
        <h3 className="text-lg font-extrabold text-white">Studio Nagrań Pro</h3>
        <span className="inline-flex items-center gap-1 rounded-full border border-[#FFD400]/40 bg-[#FFD400]/10 px-2 py-0.5 text-[10px] font-bold text-[#FFD400]"><Crown className="h-3 w-3" /> VIP</span>
      </div>

      {/* Wejście audio: mikrofon / interfejs USB */}
      <div className="p-4 rounded-xl border border-white/10 bg-[#1a1a2e]/60 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-200"><Usb className="h-4 w-4 text-[#FF9500]" /> Wejście audio (mikrofon / interfejs)</div>
        {!micGranted ? (
          <Button size="sm" variant="outline" onClick={requestMic} className="gap-2 border-[#FF6B00]/30 text-gray-300">
            <Mic className="h-3.5 w-3.5" /> Podłącz mikrofon / interfejs
          </Button>
        ) : (
          <div className="flex items-center gap-3">
            <Select value={selectedInput} onValueChange={setSelectedInput}>
              <SelectTrigger className="bg-[#0f0f1e] border-white/10 text-white text-xs h-9 flex-1">
                <SelectValue placeholder="Wybierz urządzenie" />
              </SelectTrigger>
              <SelectContent>
                {inputDevices.map((d) => (
                  <SelectItem key={d.deviceId} value={d.deviceId}>{d.label || "Urządzenie audio"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="h-2 w-20 rounded-full bg-white/10 overflow-hidden">
              <motion.div className="h-full bg-gradient-to-r from-emerald-400 to-[#FF9500]" animate={{ width: `${inputLevel}%` }} transition={{ duration: 0.1 }} />
            </div>
          </div>
        )}
      </div>

      {/* MIDI */}
      <div className="p-4 rounded-xl border border-white/10 bg-[#1a1a2e]/60 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-200"><Piano className="h-4 w-4 text-[#9333EA]" /> Klawiatura / kontroler MIDI</div>
          <Select value={instrument} onValueChange={setInstrument}>
            <SelectTrigger className="bg-[#0f0f1e] border-white/10 text-white text-xs h-8 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INSTRUMENTS.map((v) => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {midiDevices.length === 0 ? (
          <p className="text-[11px] text-gray-500">Nie wykryto urządzenia MIDI — podłącz klawiaturę przez USB, przeglądarka wykryje ją automatycznie.</p>
        ) : (
          <p className="text-[11px] text-emerald-300">🎹 Podłączono: {midiDevices.join(", ")}</p>
        )}
        <div className="flex gap-[1px] mt-1 overflow-x-auto pb-1">
          {Array.from({ length: 36 }).map((_, i) => <SynthKey key={i} note={48 + i} active={activeNotes.has(48 + i)} />)}
        </div>
        <p className="text-[10px] text-gray-500">Graj na podłączonym kontrolerze — dźwięk słychać od razu (wbudowany syntezator).</p>
      </div>

      {/* Podkład z biblioteki */}
      {backingTracks.length > 0 && (
        <div className="p-4 rounded-xl border border-white/10 bg-[#1a1a2e]/60 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-200"><RadioTower className="h-4 w-4 text-[#FF9500]" /> Nagrywaj nad podkładem (opcjonalnie)</div>
          <Select value={backingId} onValueChange={(v) => setBackingId(v === "none" ? "" : v)}>
            <SelectTrigger className="bg-[#0f0f1e] border-white/10 text-white text-xs h-9">
              <SelectValue placeholder="Bez podkładu" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Bez podkładu</SelectItem>
              {backingTracks.map((b) => <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Nagrywanie */}
      <div className="flex items-center justify-center p-5 rounded-xl border border-[#FF6B00]/20 bg-[#12121c]/80">
        <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
          <Button
            onClick={recording ? stopRecording : startRecording}
            disabled={!micGranted}
            size="lg"
            className="h-16 w-16 rounded-full border-0 p-0"
            style={{ background: recording ? "linear-gradient(135deg,#ef4444,#b91c1c)" : "linear-gradient(135deg,#FF6B00,#9333EA)" }}
          >
            {recording ? <Square className="h-6 w-6 text-white" /> : <Mic className="h-7 w-7 text-white" />}
          </Button>
        </motion.div>
        <div className="ml-4 text-left">
          <p className="text-white font-bold">{recording ? `🔴 Nagrywam… ${elapsed}s` : "Nagraj nową warstwę"}</p>
          <p className="text-[11px] text-gray-500">{micGranted ? "Kliknij, aby zacząć" : "Najpierw podłącz mikrofon powyżej"}</p>
        </div>
        <div className="ml-auto pl-4 border-l border-white/10">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) addFileAsTrack(f); e.target.value = ""; }}
          />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5 border-[#9333EA]/30 text-gray-300 hover:text-white">
            <Upload className="h-3.5 w-3.5" /> Wgraj plik
          </Button>
          <p className="mt-1 text-[10px] text-gray-500 max-w-[140px]">Dodaj gotowy utwór/stem jako warstwę do obróbki</p>
        </div>
      </div>

      {/* Warstwy */}
      {tracks.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-gray-400">Warstwy ({tracks.length})</Label>
          {tracks.map((t) => (
            <div key={t.id} className="rounded-xl border border-white/10 bg-[#1a1a2e]/60 overflow-hidden">
              <div className="flex items-center gap-2 p-2.5">
                <button onClick={() => setTracks((prev) => prev.map((x) => x.id === t.id ? { ...x, muted: !x.muted } : x))} className="text-gray-400 hover:text-white">
                  {t.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
                <span className="text-xs text-gray-300 w-20 truncate">{t.name}</span>
                <input
                  type="range" min={0} max={100} value={t.volume}
                  onChange={(e) => setTracks((prev) => prev.map((x) => x.id === t.id ? { ...x, volume: parseInt(e.target.value) } : x))}
                  className="flex-1 accent-[#FF9500]"
                />
                <audio src={t.url} controls className="h-8 w-40" />
                <button
                  onClick={() => setFxOpenId((id) => (id === t.id ? null : t.id))}
                  className={`flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold transition-colors ${!FX_IS_DEFAULT(t.fx) ? "text-[#9333EA]" : "text-gray-500 hover:text-white"}`}
                  title="Efekty (EQ, kompresja, pogłos, echo)"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <ChevronDown className={`h-3 w-3 transition-transform ${fxOpenId === t.id ? "rotate-180" : ""}`} />
                </button>
                <button onClick={() => removeTrack(t.id)} className="text-gray-500 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
              </div>
              <AnimatePresence>
                {fxOpenId === t.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden border-t border-white/10 bg-black/20 px-3 py-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Efekty — {t.name}</span>
                      <button onClick={() => updateTrackFx(t.id, { ...DEFAULT_FX })} className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-white">
                        <RotateCcw className="h-3 w-3" /> Reset
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                      {([
                        ["eqLow", "EQ nisko", -12, 12],
                        ["eqMid", "EQ środek", -12, 12],
                        ["eqHigh", "EQ wysoko", -12, 12],
                        ["compress", "Kompresja", 0, 100],
                        ["reverb", "Pogłos", 0, 100],
                        ["delay", "Echo", 0, 100],
                      ] as [keyof TrackFx, string, number, number][]).map(([key, label, min, max]) => (
                        <div key={key} className="space-y-0.5">
                          <div className="flex justify-between text-[10px] text-gray-400"><span>{label}</span><span>{t.fx[key]}</span></div>
                          <input
                            type="range" min={min} max={max} value={t.fx[key]}
                            onChange={(e) => updateTrackFx(t.id, { [key]: parseInt(e.target.value) } as Partial<TrackFx>)}
                            className="w-full accent-[#9333EA]"
                          />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      {/* Miksdown i zapis */}
      {tracks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={mixdown} disabled={mixing} className="font-bold text-white border-0" style={{ background: "linear-gradient(135deg,#FF6B00,#9333EA)" }}>
            {mixing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Disc3 className="h-4 w-4 mr-1.5" />}
            {mixing ? "Miksuję…" : "Zmiksuj warstwy"}
          </Button>
          {mixUrl && (
            <>
              <a href={mixUrl} download="studio-pro-mix.wav" className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-white/10">
                <Download className="h-4 w-4" /> Pobierz WAV
              </a>
              <Button onClick={saveMix} disabled={saving} variant="secondary" className="font-semibold">
                {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                {saving ? "Zapisuję…" : "Zapisz w bibliotece"}
              </Button>
              <Button onClick={runAnalysis} disabled={analyzing} variant="outline" className="font-semibold border-[#9333EA]/30 text-gray-200">
                {analyzing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
                {analyzing ? "Analizuję…" : "Analizuj utwór"}
              </Button>
            </>
          )}
        </div>
      )}

      {mixUrl && (
        <div className="pt-1 space-y-2">
          <WaveformPlayer audioUrl={mixUrl} title="Miks — podgląd" genre="Studio Pro" compact />
          {spotifyCheck && <SpotifyReadyBadge check={spotifyCheck} />}
        </div>
      )}

      {analysis && (
        <div className="p-4 rounded-xl border border-[#9333EA]/30 bg-[#1a1a2e]/60 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-200"><Music4 className="h-4 w-4 text-[#9333EA]" /> Analiza utworu</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div><p className="text-gray-500">Tonacja</p><p className="text-white font-bold">{analysis.key}</p></div>
            <div><p className="text-gray-500">Zakres wysokości</p><p className="text-white font-bold">{analysis.vocalRangeLow} – {analysis.vocalRangeHigh}</p></div>
            <div><p className="text-gray-500">Jakość analizy</p><p className="text-white font-bold">{analysis.detectedNotes} klatek</p></div>
          </div>
          <p className="text-[11px] text-gray-400"><span className="text-gray-300 font-semibold">Strojenie dla kapeli:</span> {analysis.tuningHint}</p>
          <p className="text-[10px] text-gray-600">Orientacyjna analiza (autokorelacja) — na pojedynczym wokalu/melodii działa najlepiej; na gęstym miksie wielu instrumentów naraz dokładność spada.</p>
        </div>
      )}

      {/* Rozkładanie na ścieżki, kafelki, sample */}
      <StemsWorkbench />
    </div>
  );
}

// --- Koder WAV (PCM 16-bit) z AudioBuffer — bez zależności zewnętrznych ---
function audioBufferToWav(buffer: AudioBuffer, length: number): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = length * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);
  const writeStr = (offset: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i] || 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return ab;
}
