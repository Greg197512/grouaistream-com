// GrouAI Studio DAW — pełne okno studia: ścieżki na osi czasu, mikser, wokal na żywo
// (mikrofon + łańcuch studyjny regulowany w czasie rzeczywistym, tryb słuchawek/głośników
// z ochroną przed sprzężeniem), autotune nagrań, instrumenty od zera, wyszukiwarka całego
// katalogu (przeróbki), AI, asystent poleceń, zapis projektów i eksport.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Play, Square, Circle, Repeat, Timer, Plus, Trash2, Copy, Scissors, Mic, Headphones, Volume2, VolumeX, Speaker,
  Sparkles, Drum, Piano, Upload, Download, Save, Loader2, SlidersHorizontal, Wand2, ZoomIn, ZoomOut, Search, FolderOpen, Undo2, FilePlus2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { uploadToR2 } from "@/lib/r2Upload";
import { startStems, waitForStems } from "@/lib/hubStudio";
import { viaProxy, certifyWithToasts } from "@/lib/releasePipeline";
import { encodeWav16 } from "@/lib/releasePrep";
import { isPersistentAudioUrl } from "@/lib/mirrorAudio";
import { generateTrack } from "@/lib/engineGenerate";
import { estimateBpm, peaks, STEM_LABELS } from "@/lib/stemsWorkbench";
import {
  analyzeVocal, DRUM_LABELS, DRUM_PRESETS, DRUM_ROWS, FLAT_FX, NOTE_NAMES, PROGRESSIONS, smartVocalFx, snap,
  VOCAL_PRESETS, type DrumPattern, type StripFx,
} from "@/lib/daw/dsp";
import {
  buildStrip, ensureWorklet, mixdown, projectEnd, renderDrums, renderHarmony, scheduleClicks, scheduleProject,
  type Clip, type Project, type Strip, type Track, type TrackKind, type TrackSource,
} from "@/lib/daw/audio";
import { autotune, SCALE_LABELS, type Scale } from "@/lib/daw/autotune";
import { listProjects, loadProject, saveProject, type ProjectListItem } from "@/lib/daw/projectStore";
import { applyFxChange, askDawAssistant, parseKey, type DawAction, type DawState } from "@/lib/daw/assistant";
import { DawAssistant } from "./DawAssistant";
import { DAW_INSERT_EVENT, getCtx, getCtxIfReady, publishBpm, studioBus, type DawInsert } from "@/lib/daw/context";

const COLORS = ["#FF6B00", "#a78bfa", "#22d3ee", "#34d399", "#f472b6", "#FFD400", "#60a5fa", "#f87171"];
const HEADER_W = 190;
const ROW_H = 64;
const LOST_HOST = "bmwtydwpevzhbdplilbr";
type Panel = "mixer" | "sound" | "instruments" | "ai" | "export";
type CatalogHit = { id: string; title: string; artist: string; audio_url: string; user_id: string | null };

const uid = () => Math.random().toString(36).slice(2, 10);

async function decodeUrl(url: string): Promise<AudioBuffer> {
  const r = await fetch(viaProxy(url));
  if (!r.ok) throw new Error(`Nie udało się pobrać pliku (HTTP ${r.status})`);
  return getCtx().decodeAudioData(await r.arrayBuffer());
}

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;

function newTrack(name: string, kind: TrackKind, index: number, fx: StripFx = FLAT_FX): Track {
  return { id: uid(), name, kind, color: COLORS[index % COLORS.length], volume: 0.85, pan: 0, mute: false, solo: false, armed: false, fx: { ...fx }, clips: [] };
}

/** Miniatura fali klipu. */
function ClipWave({ clip, color }: { clip: Clip; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const data = useMemo(() => {
    const ch = clip.buffer.getChannelData(0);
    const sr = clip.buffer.sampleRate;
    return peaks(ch.subarray(Math.floor(clip.offset * sr), Math.floor((clip.offset + clip.duration) * sr)), 300);
  }, [clip.buffer, clip.offset, clip.duration]);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const g = cv.getContext("2d")!;
    g.clearRect(0, 0, cv.width, cv.height);
    g.fillStyle = color;
    data.forEach((v, x) => { const h = Math.max(1, v * cv.height); g.fillRect(x, (cv.height - h) / 2, 1, h); });
  }, [data, color]);
  return <canvas ref={ref} width={300} height={36} className="h-full w-full opacity-80" />;
}

const HEADPHONES_RE = /headphone|słuchawk|headset|airpods|earbud|earphone|buds|kopfh/i;

/** `active` = okno DAW jest widoczne w GrouAI Studio (spacja steruje transportem zawsze, reszta skrótów tylko tutaj). */
export function StudioDAW({ active = true }: { active?: boolean } = {}) {
  const { user } = useAuth();
  const [project, setProject] = useState<Project>(() => ({ bpm: 100, tracks: [newTrack("Wokal", "vocal", 0, VOCAL_PRESETS[1].fx)] }));
  const [selTrack, setSelTrack] = useState<string>("");
  const [selClip, setSelClip] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("sound");
  const [pps, setPps] = useState(40); // pikseli na sekundę
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [loop, setLoop] = useState(false);
  const [metronome, setMetronome] = useState(true);
  const [masterVol, setMasterVol] = useState(0.9);
  const [busy, setBusy] = useState("");
  const [clipping, setClipping] = useState(false);
  // Projekt
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState("Mój projekt");
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [dirty, setDirty] = useState(false);
  // Mikrofon
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [micOn, setMicOn] = useState(false);
  const [monitor, setMonitor] = useState(false);
  const [speakers, setSpeakers] = useState(false); // odsłuch przez głośniki (z ochroną przed sprzężeniem)
  // Instrumenty
  const [drums, setDrums] = useState<DrumPattern>(() => structuredClone(DRUM_PRESETS["Pop"]));
  const [instBars, setInstBars] = useState(8);
  const [keyRoot, setKeyRoot] = useState(0);
  const [progId, setProgId] = useState(PROGRESSIONS[0].id);
  // Autotune
  const [atKey, setAtKey] = useState(0);
  const [atScale, setAtScale] = useState<Scale>("major");
  const [atStrength, setAtStrength] = useState(80);
  const [atSpeed, setAtSpeed] = useState(40);
  // AI / import / katalog
  const [aiPrompt, setAiPrompt] = useState("");
  const [mySongs, setMySongs] = useState<{ title: string; url: string }[]>([]);
  const [songUrl, setSongUrl] = useState("");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CatalogHit[]>([]);
  const [exportTitle, setExportTitle] = useState("Mój utwór");
  const [smartNotes, setSmartNotes] = useState<{ trackId: string; notes: string[] } | null>(null);
  const [processed, setProcessed] = useState<string[]>([]);

  const projectRef = useRef(project);
  projectRef.current = project;
  const playRef = useRef<{ nodes: AudioScheduledSourceNode[]; strips: Map<string, Strip>; t0: number; from: number } | null>(null);
  const masterRef = useRef<{ gain: GainNode; analyser: AnalyserNode } | null>(null);
  const micRef = useRef<{ stream: MediaStream; source: MediaStreamAudioSourceNode; analyser: AnalyserNode; strip: Strip | null; monitorGain: GainNode; notch: BiquadFilterNode; monAnalyser: AnalyserNode } | null>(null);
  // startedAt = czas kontekstu startu nagrywania, t0 = start transportu (do wyrównania nagrania).
  const recRef = useRef<{ rec: MediaRecorder; chunks: Blob[]; startedAt: number; t0: number; trackId: string; from: number } | null>(null);
  const feedbackRef = useRef({ frames: 0, warned: false });
  const playheadRef = useRef<HTMLDivElement>(null);
  const meterRefs = useRef(new Map<string, HTMLDivElement>());
  const rafRef = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const beat = 60 / project.bpm;
  const bar = beat * 4;
  const track = project.tracks.find((t) => t.id === selTrack) ?? project.tracks[0];
  const totalSec = Math.max(projectEnd(project) + bar * 4, bar * 16);
  const armed = project.tracks.find((t) => t.armed);

  /** Zmiana projektu oznacza niezapisane zmiany. */
  const edit = useCallback((fn: (p: Project) => Project) => { setProject(fn); setDirty(true); }, []);

  // ── Pomocnicze zmiany projektu ────────────────────────────────────────────
  const updateTrack = useCallback((id: string, patch: Partial<Track>) => {
    edit((p) => ({ ...p, tracks: p.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
    const t = projectRef.current.tracks.find((x) => x.id === id);
    if (!t) return;
    const n = { ...t, ...patch };
    const live = playRef.current?.strips.get(id);
    if (live) {
      if (patch.fx) live.setFx(n.fx);
      if ("volume" in patch || "pan" in patch || "mute" in patch) live.setMix(n.mute ? 0 : n.volume, n.pan);
    }
    if (patch.fx && micRef.current?.strip && t.armed) micRef.current.strip.setFx(n.fx);
  }, [edit]);

  const addClip = useCallback((trackId: string, clip: Omit<Clip, "id">) => {
    const c = { ...clip, id: uid() };
    edit((p) => ({ ...p, tracks: p.tracks.map((t) => (t.id === trackId ? { ...t, clips: [...t.clips, c] } : t)) }));
    setSelClip(c.id);
  }, [edit]);

  /** Nowa ścieżka z klipem (import, katalog, podkład AI, ścieżki z rozkładania, instrumenty). */
  const addTrackWithBuffer = useCallback((name: string, kind: TrackKind, buffer: AudioBuffer, start = 0, url?: string, source?: TrackSource) => {
    const t = newTrack(name, kind, projectRef.current.tracks.length);
    t.clips = [{ id: uid(), name, buffer, start, offset: 0, duration: buffer.duration, gain: 1, url }];
    t.source = source;
    edit((p) => ({ ...p, tracks: [...p.tracks, t] }));
    setSelTrack(t.id);
    return t.id;
  }, [edit]);

  // Nagrania z okien Gitara / Instrumenty MIDI trafiają tu jako nowe ścieżki w miejscu wskaźnika.
  const positionRef = useRef(position);
  positionRef.current = position;
  useEffect(() => {
    const onInsert = (e: Event) => {
      const d = (e as CustomEvent<DawInsert>).detail;
      addTrackWithBuffer(d.name, d.kind, d.buffer, positionRef.current); // potwierdzenie pokazuje GrouAI Studio
    };
    window.addEventListener(DAW_INSERT_EVENT, onInsert);
    return () => window.removeEventListener(DAW_INSERT_EVENT, onInsert);
  }, [addTrackWithBuffer]);
  useEffect(() => publishBpm(project.bpm), [project.bpm]);

  /** Ścieżka po nazwie (z asystenta) — dopasowanie fragmentu nazwy; brak → zaznaczona. */
  const findTrack = (name?: string) => {
    const ts = projectRef.current.tracks;
    if (name) {
      const n = name.toLowerCase();
      const hit = ts.find((t) => t.name.toLowerCase() === n) ?? ts.find((t) => t.name.toLowerCase().includes(n) || n.includes(t.name.toLowerCase()));
      if (hit) return hit;
    }
    return ts.find((t) => t.id === selTrack) ?? ts[0];
  };

  // Moje utwory (do importu i rozkładania).
  useEffect(() => {
    if (!user?.id) return;
    void supabase.from("generations").select("title, audio_url").eq("user_id", user.id).eq("status", "completed")
      .order("created_at", { ascending: false }).limit(40)
      .then(({ data }) => setMySongs((data || []).filter((g) => isPersistentAudioUrl(g.audio_url) && !g.audio_url!.includes(LOST_HOST))
        .map((g) => ({ title: g.title, url: g.audio_url! }))));
    void listProjects().then(setProjects);
  }, [user?.id]);

  // ── Transport ─────────────────────────────────────────────────────────────
  const master = () => {
    const ctx = getCtx();
    if (!masterRef.current) {
      const gain = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      gain.connect(analyser).connect(studioBus().input);
      masterRef.current = { gain, analyser };
    }
    masterRef.current.gain.gain.value = masterVol;
    return masterRef.current;
  };

  const stopPlayback = useCallback(() => {
    const p = playRef.current;
    if (p) {
      for (const n of p.nodes) { try { n.stop(); } catch { /* już zatrzymany */ } }
      setPosition(Math.max(0, p.from + (getCtx().currentTime - p.t0)));
    }
    playRef.current = null;
    setPlaying(false);
  }, []);

  const startPlayback = useCallback(async (from: number) => {
    const ctx = getCtx();
    await ctx.resume();
    const gate = await ensureWorklet(ctx);
    const t0 = ctx.currentTime + 0.1;
    const m = master();
    const { nodes, strips } = scheduleProject(ctx, projectRef.current, m.gain, from, t0, gate);
    if (metronome) nodes.push(...scheduleClicks(ctx, m.gain, projectRef.current.bpm, from, t0, Math.max(projectEnd(projectRef.current) - from, 0) + 600));
    playRef.current = { nodes, strips, t0, from };
    setPlaying(true);
    return t0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metronome, masterVol]);

  const togglePlay = useCallback(() => {
    if (recording) return;
    if (playRef.current) stopPlayback();
    else void startPlayback(position);
  }, [recording, stopPlayback, startPlayback, position]);

  // Wskaźnik, mierniki, pętla, wykrywanie przesteru i sprzężenia (rAF, bez re-renderów).
  useEffect(() => {
    const buf = new Float32Array(1024);
    const spec = new Float32Array(1024);
    const level = (a: AnalyserNode) => { a.getFloatTimeDomainData(buf); let m = 0; for (const v of buf) m = Math.max(m, Math.abs(v)); return m; };
    let clipHold = 0;
    const tick = () => {
      const p = playRef.current;
      const ctx = getCtxIfReady();
      let pos = position;
      if (p && ctx) {
        pos = p.from + Math.max(0, ctx.currentTime - p.t0);
        const end = projectEnd(projectRef.current);
        if (!recRef.current && end > 0 && pos >= end + 0.05) {
          stopPlayback();
          if (loop) void startPlayback(0); else setPosition(0);
        }
        for (const [id, s] of p.strips) {
          const el = meterRefs.current.get(id);
          if (el) el.style.height = `${Math.min(100, level(s.analyser) * 100)}%`;
        }
      }
      if (masterRef.current) {
        const lv = level(masterRef.current.analyser);
        const el = meterRefs.current.get("master");
        if (el) el.style.height = `${Math.min(100, lv * 100)}%`;
        if (lv >= 0.99) clipHold = 90; else if (clipHold > 0) clipHold--;
        const isClip = clipHold > 0;
        setClipping((c) => (c === isClip ? c : isClip));
      }
      const m = micRef.current;
      if (m) {
        const el = meterRefs.current.get("mic");
        if (el) el.style.width = `${Math.min(100, level(m.analyser) * 140)}%`;
        // Ochrona przed sprzężeniem: wąski, głośny, utrzymujący się szczyt w odsłuchu → wycięcie i ściszenie.
        if (m.monitorGain.gain.value > 0.01) {
          m.monAnalyser.getFloatFrequencyData(spec);
          const binHz = getCtx().sampleRate / m.monAnalyser.fftSize;
          let max = -Infinity, maxBin = 0, sum = 0, cnt = 0;
          for (let i = Math.floor(150 / binHz); i < Math.min(spec.length, Math.floor(8000 / binHz)); i++) {
            const v = spec[i]; sum += v; cnt++;
            if (v > max) { max = v; maxBin = i; }
          }
          const fb = feedbackRef.current;
          if (max > -30 && max - sum / Math.max(1, cnt) > 32) fb.frames++; else fb.frames = 0;
          if (fb.frames > 12) {
            m.notch.frequency.setValueAtTime(maxBin * binHz, getCtx().currentTime);
            m.monitorGain.gain.setValueAtTime(Math.max(0.05, m.monitorGain.gain.value * 0.5), getCtx().currentTime);
            fb.frames = 0;
            if (!fb.warned) { fb.warned = true; toast.warning(`Wykryto sprzężenie (~${Math.round(maxBin * binHz)} Hz) — wyciąłem tę częstotliwość i ściszyłem odsłuch.`); }
          }
        }
      }
      if (playheadRef.current) playheadRef.current.style.transform = `translateX(${HEADER_W + pos * pps}px)`;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [position, pps, loop, stopPlayback, startPlayback]);

  useEffect(() => { if (masterRef.current) masterRef.current.gain.gain.value = masterVol; }, [masterVol]);

  // ── Mikrofon i wokal na żywo ──────────────────────────────────────────────
  const refreshDevices = async () => {
    const list = await navigator.mediaDevices.enumerateDevices();
    setDevices(list.filter((d) => d.kind === "audioinput"));
    return list;
  };

  const micOff = useCallback(() => {
    const m = micRef.current;
    if (m) { m.stream.getTracks().forEach((t) => t.stop()); m.source.disconnect(); m.monitorGain.disconnect(); }
    micRef.current = null;
    setMicOn(false);
  }, []);

  const micOnFn = async (useSpeakers = speakers) => {
    try {
      const ctx = getCtx();
      await ctx.resume();
      const gate = await ensureWorklet(ctx);
      // Słuchawki: surowy głos (brzmienie ustawiamy sami). Głośniki: redukcja echa przeglądarki przeciw sprzężeniu.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: deviceId ? { exact: deviceId } : undefined, echoCancellation: useSpeakers, noiseSuppression: useSpeakers, autoGainControl: false },
      });
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const notch = ctx.createBiquadFilter();
      notch.type = "notch";
      notch.frequency.value = 20; // nieaktywne, dopóki nie wykryjemy sprzężenia
      notch.Q.value = 30;
      const monitorGain = ctx.createGain();
      monitorGain.gain.value = monitor ? (useSpeakers ? 0.5 : 1) : 0;
      const monAnalyser = ctx.createAnalyser();
      monAnalyser.fftSize = 2048;
      notch.connect(monitorGain).connect(monAnalyser).connect(studioBus().input);
      const target = armed ?? track;
      const strip = target ? buildStrip(ctx, target.fx, 1, 0, notch, gate) : null;
      if (strip) source.connect(strip.input);
      micRef.current = { stream, source, analyser, strip, monitorGain, notch, monAnalyser };
      feedbackRef.current = { frames: 0, warned: false };
      setMicOn(true);
      // Wykrycie słuchawek po nazwie wyjścia (dostępne po zgodzie na mikrofon).
      const outs = (await refreshDevices()).filter((d) => d.kind === "audiooutput");
      const def = outs.find((d) => d.deviceId === "default") ?? outs[0];
      if (def?.label && !HEADPHONES_RE.test(def.label) && !useSpeakers) {
        toast.info(`Wyjście „${def.label}” to chyba głośniki — przy odsłuchu włącz tryb „Głośniki”, żeby uniknąć sprzężenia.`);
      }
      if (target && !target.armed) edit((p) => ({ ...p, tracks: p.tracks.map((x) => ({ ...x, armed: x.id === target.id })) }));
    } catch (e) {
      toast.error(`Brak dostępu do mikrofonu: ${e instanceof Error ? e.message : "błąd"}`);
    }
  };

  useEffect(() => {
    const m = micRef.current;
    if (m) m.monitorGain.gain.value = monitor ? (speakers ? 0.5 : 1) : 0;
  }, [monitor, speakers]);
  useEffect(() => () => { micOff(); stopPlayback(); }, [micOff, stopPlayback]);

  const switchOutput = async (toSpeakers: boolean) => {
    setSpeakers(toSpeakers);
    if (micRef.current) { micOff(); await micOnFn(toSpeakers); }
  };

  const startRecording = async () => {
    const target = armed;
    if (!target) { toast.error("Uzbrój ścieżkę do nagrywania (przycisk R przy ścieżce)"); return; }
    if (!micRef.current) await micOnFn();
    const m = micRef.current;
    if (!m) return;
    const ctx = getCtx();
    const rec = new MediaRecorder(m.stream);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.start();
    const startedAt = ctx.currentTime;
    recRef.current = { rec, chunks, startedAt, t0: startedAt, trackId: target.id, from: position };
    setRecording(true);
    recRef.current.t0 = await startPlayback(position);
  };

  const stopRecording = async () => {
    const r = recRef.current;
    if (!r) return;
    const ctx = getCtx();
    await new Promise<void>((res) => { r.rec.onstop = () => res(); r.rec.stop(); });
    stopPlayback();
    recRef.current = null;
    setRecording(false);
    try {
      const blob = new Blob(r.chunks, { type: r.rec.mimeType });
      const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
      // Wyrównanie: nagranie ruszyło przed transportem; dokładamy opóźnienie wyjścia/wejścia.
      const trim = Math.max(0, r.t0 - r.startedAt + (ctx.outputLatency || 0) + (ctx.baseLatency || 0));
      addClip(r.trackId, { name: "Nagranie", buffer, blob, start: r.from, offset: Math.min(trim, buffer.duration - 0.01), duration: Math.max(0.01, buffer.duration - trim), gain: 1 });
      toast.success("Nagranie dodane — obrób je w „Brzmieniu” albo napisz w asystencie „popraw mój głos”");
    } catch (e) {
      toast.error(`Nie udało się odczytać nagrania: ${e instanceof Error ? e.message : "błąd"}`);
    }
  };

  /** Analiza nagrań ścieżki → ustawienia łańcucha + poziom klipów (jak realizator w studiu). */
  const smartProcess = (t: Track) => {
    const c = t.clips[0];
    if (!c) { toast.error("Na ścieżce nie ma nagrania"); return null; }
    const sr = c.buffer.sampleRate;
    const mono = c.buffer.getChannelData(0).subarray(Math.floor(c.offset * sr), Math.floor((c.offset + c.duration) * sr));
    const s = smartVocalFx(analyzeVocal(mono, sr));
    const k = Math.pow(10, s.gainDb / 20);
    edit((p) => ({ ...p, tracks: p.tracks.map((x) => (x.id === t.id ? { ...x, fx: s.fx, clips: x.clips.map((cl) => ({ ...cl, gain: cl.gain * k })) } : x)) }));
    playRef.current?.strips.get(t.id)?.setFx(s.fx);
    setSmartNotes({ trackId: t.id, notes: s.notes });
    setProcessed((p) => [...p, t.id]);
    return s.notes;
  };

  /** Autotune klipu (zaznaczonego albo pierwszego na ścieżce) — obróbka nagrania, z możliwością cofnięcia. */
  const applyAutotune = async (t: Track, opts?: { key?: number; scale?: Scale; strength?: number; speedMs?: number }) => {
    const c = t.clips.find((x) => x.id === selClip) ?? t.clips[0];
    if (!c) { toast.error("Zaznacz nagranie do korekty"); return null; }
    setBusy("Autotune: analizuję wysokość i stroję…");
    await new Promise((r) => setTimeout(r, 30)); // pokaż komunikat przed obliczeniami
    try {
      const src = c.original ?? c.buffer;
      const o = { keyRoot: opts?.key ?? atKey, scale: opts?.scale ?? atScale, strength: (opts?.strength ?? atStrength / 100), speedMs: opts?.speedMs ?? atSpeed };
      const first = autotune(src.getChannelData(0), src.sampleRate, o);
      const out = getCtx().createBuffer(src.numberOfChannels, src.length, src.sampleRate);
      out.copyToChannel(new Float32Array(first.out), 0);
      for (let ch = 1; ch < src.numberOfChannels; ch++) out.copyToChannel(new Float32Array(autotune(src.getChannelData(ch), src.sampleRate, o, first.curve).out), ch);
      edit((p) => ({ ...p, tracks: p.tracks.map((x) => (x.id !== t.id ? x : { ...x, clips: x.clips.map((cl) => (cl.id === c.id ? { ...cl, buffer: out, original: src, url: undefined, blob: undefined } : cl)) })) }));
      const msg = first.corrected ? `Autotune: poprawiono ${Math.round((first.corrected * 512) / src.sampleRate * 10) / 10} s śpiewu (${NOTE_NAMES[o.keyRoot]} ${SCALE_LABELS[o.scale]}).` : "Autotune: śpiew był czysty — nic nie trzeba było poprawiać.";
      toast.success(msg);
      return msg;
    } finally {
      setBusy("");
    }
  };

  const undoAutotune = (t: Track) => {
    edit((p) => ({ ...p, tracks: p.tracks.map((x) => (x.id !== t.id ? x : { ...x, clips: x.clips.map((cl) => (cl.original ? { ...cl, buffer: cl.original, original: undefined, url: undefined } : cl)) })) }));
    toast.success("Przywrócono oryginalne nagranie");
  };

  // ── Klipy: przeciąganie, usuwanie, kopiowanie, cięcie ─────────────────────
  const dragRef = useRef<{ clipId: string; trackId: string; x0: number; start0: number } | null>(null);
  const onClipDown = (e: React.PointerEvent, t: Track, c: Clip) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { clipId: c.id, trackId: t.id, x0: e.clientX, start0: c.start };
    setSelClip(c.id);
    setSelTrack(t.id);
  };
  const onClipMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const start = snap(d.start0 + (e.clientX - d.x0) / pps, beat);
    edit((p) => ({ ...p, tracks: p.tracks.map((t) => (t.id !== d.trackId ? t : { ...t, clips: t.clips.map((c) => (c.id === d.clipId ? { ...c, start } : c)) })) }));
  };
  const onClipUp = () => { dragRef.current = null; };

  const clipOp = (op: "delete" | "duplicate" | "split") => {
    if (!selClip) return;
    edit((p) => ({
      ...p,
      tracks: p.tracks.map((t) => {
        const c = t.clips.find((x) => x.id === selClip);
        if (!c) return t;
        if (op === "delete") return { ...t, clips: t.clips.filter((x) => x.id !== c.id) };
        if (op === "duplicate") return { ...t, clips: [...t.clips, { ...c, id: uid(), start: snap(c.start + c.duration, beat) }] };
        const cut = position - c.start;
        if (cut <= 0.05 || cut >= c.duration - 0.05) return t;
        return { ...t, clips: [...t.clips.filter((x) => x.id !== c.id), { ...c, duration: cut }, { ...c, id: uid(), start: position, offset: c.offset + cut, duration: c.duration - cut }] };
      }),
    }));
    if (op === "delete") setSelClip(null);
  };

  // Skróty: spacja, Delete, Ctrl+D, Ctrl+S.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (e.code === "Space") { e.preventDefault(); togglePlay(); }
      else if (!active) return;
      else if (e.key === "Delete" || e.key === "Backspace") clipOp("delete");
      else if ((e.ctrlKey || e.metaKey) && e.key === "d") { e.preventDefault(); clipOp("duplicate"); }
      else if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); void doSaveProject(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ── Instrumenty, AI, import, katalog ──────────────────────────────────────
  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : "Coś poszło nie tak"); } finally { setBusy(""); }
  };
  const atBar = () => snap(position, bar);

  const insertDrums = (pattern = drums, bars = instBars, label = "") => run("Renderuję perkusję…", async () => {
    addTrackWithBuffer(`Perkusja${label ? ` ${label}` : ""} (${bars} t.)`, "instrument", await renderDrums(pattern, projectRef.current.bpm, bars), atBar());
  });
  const insertHarmony = (part: "bass" | "chords", key = keyRoot, prog = progId, bars = instBars) => run(part === "bass" ? "Renderuję bas…" : "Renderuję akordy…", async () => {
    const buf = await renderHarmony(part, key, prog, projectRef.current.bpm, bars);
    addTrackWithBuffer(`${part === "bass" ? "Bas" : "Akordy"} ${NOTE_NAMES[key]}`, "instrument", buf, atBar());
  });
  const previewDrums = () => run("Podgląd…", async () => {
    const b = await renderDrums(drums, project.bpm, 1);
    const ctx = getCtx(); await ctx.resume();
    const s = ctx.createBufferSource(); s.buffer = b; s.connect(master().gain); s.start();
  });

  const aiBacking = (prompt = aiPrompt) => run("Suno komponuje podkład… (1–3 min)", async () => {
    if (prompt.trim().length < 3) throw new Error("Opisz podkład, np. „spokojny hip-hop, pianino, 90 BPM”");
    const r = await generateTrack({ engine: "suno", prompt: prompt.trim(), instrumental: true });
    const buf = await decodeUrl(r.audioUrl);
    if (!projectRef.current.tracks.some((t) => t.clips.length)) edit((p) => ({ ...p, bpm: estimateBpm(buf.getChannelData(0), buf.sampleRate) }));
    addTrackWithBuffer(`Podkład AI: ${r.title}`, "audio", buf, 0, isPersistentAudioUrl(r.audioUrl) ? r.audioUrl : undefined);
    toast.success("Podkład AI wstawiony — nagraj na nim swój głos");
  });

  /** Wstawia utwór (cały albo rozłożony na ścieżki); `source` = utwór z katalogu (do opisu remiksu). */
  const insertSong = (title: string, url: string, split: boolean, source?: TrackSource) => run(split ? "Rozkładam utwór na ścieżki… (1–3 min)" : "Wczytuję utwór…", async () => {
    if (!split) { addTrackWithBuffer(title, "audio", await decodeUrl(url), 0, url, source); return; }
    const map = await waitForStems(await startStems(url, "4"), "daw", (s) => setBusy(`Rozkładam utwór na ścieżki… ${s}s`));
    for (const [name, stemUrl] of Object.entries(map)) {
      addTrackWithBuffer(`${STEM_LABELS[name] ?? name} · ${title}`, name === "vocals" ? "vocal" : "audio", await decodeUrl(stemUrl), 0, isPersistentAudioUrl(stemUrl) ? stemUrl : undefined, source);
    }
    toast.success("Ścieżki wstawione");
  });

  const searchCatalog = () => run("Szukam w katalogu GrouAI Stream…", async () => {
    const q = query.replace(/[,()%*\\]/g, " ").trim();
    if (q.length < 2) throw new Error("Wpisz co najmniej 2 znaki");
    const { data, error } = await supabase.from("tracks").select("id, title, artist, audio_url, user_id")
      .or(`title.ilike.%${q}%,artist.ilike.%${q}%`).not("audio_url", "is", null).order("created_at", { ascending: false }).limit(25);
    if (error) throw new Error(error.message);
    const found = ((data || []) as CatalogHit[]).filter((h) => isPersistentAudioUrl(h.audio_url) && !h.audio_url.includes(LOST_HOST));
    setHits(found);
    if (!found.length) toast.info("Nic nie znaleziono — spróbuj innej nazwy utworu albo wykonawcy");
  });

  /** Pliki z dysku (piosenki, melodie, sample, ścieżki) — każdy na nowej ścieżce; dekodowane lokalnie, bez wysyłania. */
  const importFiles = (files: File[]) => run(files.length > 1 ? `Wczytuję ${files.length} pliki…` : "Wczytuję plik…", async () => {
    const ctx = getCtx();
    let ok = 0;
    for (const f of files) {
      let buf: AudioBuffer;
      try { buf = await ctx.decodeAudioData(await f.arrayBuffer()); } catch { toast.error(`Nie umiem odczytać „${f.name}” — użyj MP3, WAV, M4A, OGG albo FLAC.`); continue; }
      addTrackWithBuffer(f.name.replace(/\.[^.]+$/, ""), /vocal|wokal|voice|głos/i.test(f.name) ? "vocal" : "audio", buf, atBar());
      ok++;
    }
    if (ok) toast.success(ok === 1 ? `Dodano ścieżkę: ${files[0].name.replace(/\.[^.]+$/, "")}` : `Dodano ${ok} ${ok % 10 >= 2 && ok % 10 <= 4 && (ok % 100 < 12 || ok % 100 > 14) ? "ścieżki" : "ścieżek"}`);
  });
  const [dragOver, setDragOver] = useState(false);

  // ── Projekt: zapis, otwieranie, nowy ──────────────────────────────────────
  const doSaveProject = () => run("Zapisuję projekt…", async () => {
    if (!user) throw new Error("Zaloguj się, aby zapisać projekt");
    if (!projectRef.current.tracks.some((t) => t.clips.length)) throw new Error("Projekt jest pusty");
    const r = await saveProject(projectRef.current, projectTitle.trim() || "Projekt", user.id, projectId, (s) => setBusy(s));
    setProject(r.project);
    setProjectId(r.id);
    setDirty(false);
    setProjects(await listProjects());
    toast.success(`Projekt „${projectTitle}” zapisany`);
  });

  const openProject = (id: string) => {
    if (!id) return;
    if (dirty && !window.confirm("Masz niezapisane zmiany. Otworzyć inny projekt i je porzucić?")) return;
    void run("Otwieram projekt…", async () => {
      stopPlayback();
      const r = await loadProject(id, decodeUrl, (s) => setBusy(s));
      setProject(r.project);
      setProjectTitle(r.title);
      setProjectId(id);
      setDirty(false);
      setSelTrack(r.project.tracks[0]?.id ?? "");
      setPosition(0);
    });
  };

  const newProject = () => {
    if (dirty && !window.confirm("Masz niezapisane zmiany. Zacząć nowy projekt i je porzucić?")) return;
    stopPlayback();
    setProject({ bpm: 100, tracks: [newTrack("Wokal", "vocal", 0, VOCAL_PRESETS[1].fx)] });
    setProjectId(null);
    setProjectTitle("Mój projekt");
    setDirty(false);
    setPosition(0);
  };

  // ── Eksport ───────────────────────────────────────────────────────────────
  const renderWav = async () => {
    const out = await mixdown(projectRef.current);
    return new Blob([encodeWav16([out.getChannelData(0), out.getChannelData(1)], out.sampleRate)], { type: "audio/wav" });
  };
  const exportWav = () => run("Miksuję projekt…", async () => {
    if (!projectEnd(projectRef.current)) throw new Error("Projekt jest pusty");
    const url = URL.createObjectURL(await renderWav());
    const a = document.createElement("a"); a.href = url; a.download = `${exportTitle || "projekt"}.wav`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  });
  const saveAndRelease = () => run("Miksuję i zapisuję…", async () => {
    if (!user) throw new Error("Zaloguj się, aby zapisać");
    if (!projectEnd(projectRef.current)) throw new Error("Projekt jest pusty");
    // Przeróbka cudzego utworu z katalogu: oznaczamy jako remiks z podaniem oryginału i bez pakietu Spotify.
    const foreign = projectRef.current.tracks.map((t) => t.source).find((s): s is TrackSource => !!s && s.userId !== user.id);
    const base = exportTitle.trim() || "Mój utwór";
    const title = foreign ? `${base} (remiks: ${foreign.title} – ${foreign.artist})` : base;
    const { publicUrl } = await uploadToR2({ file: new File([await renderWav()], `${base.replace(/[^\p{L}\p{N}]+/gu, "_")}.wav`, { type: "audio/wav" }), folder: `studio/${user.id}` });
    const artist = user.user_metadata?.display_name || user.email?.split("@")[0] || "GrouAI Studio";
    const { data: gen } = await supabase.from("generations").insert({
      user_id: user.id, title, genre: foreign ? "Remiks" : "Studio DAW",
      prompt: foreign ? `Remiks utworu „${foreign.title}” (${foreign.artist}) w GrouAI Studio DAW` : "GrouAI Studio DAW",
      instrumental: false, status: "completed", audio_url: publicUrl,
    }).select("id").maybeSingle();
    const { data: tr } = await supabase.from("tracks").insert({
      user_id: user.id, title, artist, album: foreign ? "Remiksy" : "GrouAI Studio", duration: Math.round(projectEnd(projectRef.current)), audio_url: publicUrl, genre: "AI",
    }).select("id").maybeSingle();
    window.dispatchEvent(new CustomEvent("grouai:generations-changed"));
    if (foreign) {
      toast.success(`„${title}” zapisany jako nowy utwór (remiks) i jest w „Nowe”.`);
      toast.info("Remiks cudzego utworu nie dostaje pakietu Spotify — do wydania potrzebna jest zgoda autora oryginału.", { duration: 9000 });
    } else {
      certifyWithToasts({ audioUrl: publicUrl, title, artist, instrumental: false, userId: user.id, generationId: gen?.id, trackId: tr?.id });
      toast.success(`„${title}” zapisany i w „Nowe” — studio przygotowuje go do Spotify`);
    }
  });

  // ── Asystent ──────────────────────────────────────────────────────────────
  const dawState: DawState = {
    bpm: project.bpm,
    tracks: project.tracks.map((t) => ({
      name: t.name, kind: t.kind, clips: t.clips.length, muted: t.mute,
      recorded: t.clips.some((c) => c.name === "Nagranie"), processed: processed.includes(t.id), autotuned: t.clips.some((c) => !!c.original),
    })),
    selectedTrack: track?.name, micOn, monitor, speakers, armed: !!armed, clipping, saved: !!projectId && !dirty,
  };

  const execute = async (a: DawAction): Promise<string | null> => {
    const t = "track" in a ? findTrack(a.track) : track;
    switch (a.type) {
      case "fx": if (t) updateTrack(t.id, { fx: applyFxChange(t.fx, a.set, a.add) }); return null;
      case "preset": {
        const p = a.preset === "flat" ? { fx: FLAT_FX } : VOCAL_PRESETS.find((x) => x.id === a.preset);
        if (t && p) updateTrack(t.id, { fx: { ...p.fx } });
        return null;
      }
      case "smart": { if (!t) return null; const n = smartProcess(t); return n ? `Obróbka „${t.name}”: ${n.join(", ")}.` : null; }
      case "autotune": {
        if (!t) return null;
        const k = parseKey(a.key);
        return applyAutotune(t, { key: k >= 0 ? k : atKey, scale: a.scale ?? (k >= 0 ? "major" : "chromatic"), strength: a.strength, speedMs: a.speedMs });
      }
      case "bpm": edit((p) => ({ ...p, bpm: Math.max(50, Math.min(220, Math.round(a.value))) })); return null;
      case "drums": { const style = a.style && DRUM_PRESETS[a.style] ? a.style : "Pop"; await insertDrums(DRUM_PRESETS[style], a.bars ?? instBars, style); return null; }
      case "harmony": {
        const k = parseKey(a.key);
        const prog = a.progression && PROGRESSIONS.some((p) => p.id === a.progression) ? a.progression : progId;
        await insertHarmony(a.part, k >= 0 ? k : keyRoot, prog, a.bars ?? instBars);
        return null;
      }
      case "mix": {
        if (!t) return null;
        const patch: Partial<Track> = {};
        if (typeof a.volumeDb === "number") patch.volume = Math.max(0, Math.min(1.2, t.volume * Math.pow(10, a.volumeDb / 20)));
        if (typeof a.pan === "number") patch.pan = Math.max(-1, Math.min(1, a.pan));
        if (typeof a.mute === "boolean") patch.mute = a.mute;
        if (typeof a.solo === "boolean") patch.solo = a.solo;
        updateTrack(t.id, patch);
        return null;
      }
      case "transport":
        if (a.action === "play" && !playRef.current) void startPlayback(position);
        if (a.action === "stop") { if (recRef.current) await stopRecording(); else stopPlayback(); }
        if (a.action === "record") await startRecording();
        return null;
      case "backing": await aiBacking(a.prompt); return null;
      case "save": await doSaveProject(); return null;
      case "export": setPanel("export"); return "Otworzyłem „Eksport” — wybierz tytuł i zapisz utwór.";
    }
    return null;
  };

  const onAssistant = async (text: string) => {
    const r = await askDawAssistant(text, dawState);
    const extra: string[] = [];
    for (const a of r.actions) {
      try { const m = await execute(a); if (m) extra.push(m); } catch (e) { extra.push(`Nie udało się: ${e instanceof Error ? e.message : "błąd"}`); }
    }
    return [r.reply, ...extra].join(" ");
  };

  // ── Widok ─────────────────────────────────────────────────────────────────
  const fxSliders: { key: keyof StripFx; label: string; min: number; max: number; step: number; unit: string }[] = [
    { key: "gate", label: "Bramka szumów", min: -90, max: -30, step: 1, unit: "dB" },
    { key: "hpf", label: "Filtr dołu", min: 20, max: 400, step: 5, unit: "Hz" },
    { key: "deEss", label: "De-esser (syczenie)", min: 0, max: 100, step: 1, unit: "%" },
    { key: "eqLow", label: "Bas", min: -12, max: 12, step: 0.5, unit: "dB" },
    { key: "eqMid", label: "Środek", min: -12, max: 12, step: 0.5, unit: "dB" },
    { key: "eqHigh", label: "Góra", min: -12, max: 12, step: 0.5, unit: "dB" },
    { key: "presence", label: "Obecność (czytelność)", min: -6, max: 10, step: 0.5, unit: "dB" },
    { key: "air", label: "Powietrze", min: -6, max: 10, step: 0.5, unit: "dB" },
    { key: "compress", label: "Kompresja", min: 0, max: 100, step: 1, unit: "%" },
    { key: "reverb", label: "Pogłos", min: 0, max: 100, step: 1, unit: "%" },
    { key: "delay", label: "Echo", min: 0, max: 100, step: 1, unit: "%" },
  ];
  const PANELS: { id: Panel; label: string; Icon: typeof Mic }[] = [
    { id: "sound", label: "Brzmienie i wokal", Icon: Mic },
    { id: "mixer", label: "Mikser", Icon: SlidersHorizontal },
    { id: "instruments", label: "Instrumenty", Icon: Drum },
    { id: "ai", label: "Katalog, AI i import", Icon: Sparkles },
    { id: "export", label: "Eksport", Icon: Download },
  ];
  const bars = Math.ceil(totalSec / bar);
  const btn = "inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-gray-200 hover:border-[#FF6B00]/50 disabled:opacity-40";
  const sel = "rounded-md border border-white/10 bg-[#1a1a2e] px-2 py-1 text-xs text-white";
  const hasTuned = !!track?.clips.some((c) => c.original);

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border bg-[#0e0e17] text-white shadow-2xl ${dragOver ? "border-[#FFD400] ring-2 ring-[#FFD400]/50" : "border-white/10"}`}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); const fs = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|aiff?|webm)$/i.test(f.name)); if (fs.length) void importFiles(fs); else toast.error("Upuść pliki audio (MP3, WAV, M4A, OGG, FLAC)"); }}
    >
      {dragOver && <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/60 text-lg font-bold text-[#FFD400]">Upuść pliki — każdy trafi na nową ścieżkę</div>}
      <input ref={fileRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.oga,.opus,.flac,.aif,.aiff,.webm" multiple hidden onChange={(e) => { const fs = Array.from(e.target.files ?? []); if (fs.length) void importFiles(fs); e.target.value = ""; }} />
      {/* Projekt */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-[#101019] px-3 py-1.5 text-xs">
        <span className="font-extrabold">GrouAI Studio <span className="text-[#FF9500]">DAW</span></span>
        <input value={projectTitle} onChange={(e) => { setProjectTitle(e.target.value); setDirty(true); }} className="w-40 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-white" aria-label="Nazwa projektu" />
        {dirty && <span className="text-amber-300" title="Niezapisane zmiany">●</span>}
        <button type="button" onClick={() => void doSaveProject()} disabled={!!busy} className={btn}><Save className="h-3.5 w-3.5" /> Zapisz projekt</button>
        <label className="flex items-center gap-1 text-gray-400"><FolderOpen className="h-3.5 w-3.5" />
          <select value="" onChange={(e) => openProject(e.target.value)} className={sel} aria-label="Otwórz projekt">
            <option value="">Otwórz…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title} · {new Date(p.updated_at).toLocaleDateString("pl-PL")}</option>)}
          </select>
        </label>
        <button type="button" onClick={newProject} className={btn}><FilePlus2 className="h-3.5 w-3.5" /> Nowy</button>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={!!busy} className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-[#FFD400] px-2.5 py-1 font-bold text-black hover:bg-[#ffe066]" title="Piosenki, melodie, sample, ścieżki — możesz też przeciągnąć pliki na DAW">
          <Upload className="h-3.5 w-3.5" /> Wgraj pliki audio
        </button>
      </div>

      {/* Pasek transportu */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-[#15151f] px-3 py-2">
        <Button size="sm" onClick={togglePlay} disabled={recording} className="h-8 w-9 p-0 text-white" style={{ background: playing ? "#334155" : "#16a34a" }} aria-label={playing ? "Stop" : "Odtwarzaj (spacja)"}>
          {playing ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button size="sm" onClick={recording ? stopRecording : startRecording} className="h-8 w-9 p-0 text-white" style={{ background: recording ? "#dc2626" : "#3f1d1d" }} aria-label={recording ? "Zatrzymaj nagrywanie" : "Nagrywaj"}>
          <Circle className={`h-4 w-4 ${recording ? "animate-pulse fill-white" : "fill-red-500 text-red-500"}`} />
        </Button>
        <button type="button" onClick={() => { stopPlayback(); setPosition(0); }} className={btn}>⏮ Początek</button>
        <span className={`rounded-md px-2 py-1 font-mono text-sm tabular-nums ${clipping ? "bg-red-600/40 text-white" : "bg-black/50 text-[#FFD400]"}`} title={clipping ? "Przester na wyjściu!" : undefined}>
          {Math.floor(position / bar) + 1}.{Math.floor((position % bar) / beat) + 1} · {fmtTime(position)}
        </span>
        <label className="flex items-center gap-1 text-xs text-gray-400">BPM
          <input type="number" min={50} max={220} value={project.bpm} onChange={(e) => edit((p) => ({ ...p, bpm: Math.max(50, Math.min(220, +e.target.value || 100)) }))} className="w-14 rounded-md border border-white/10 bg-black/40 px-1 py-1 text-white" />
        </label>
        <button type="button" onClick={() => setMetronome((v) => !v)} className={`${btn} ${metronome ? "border-[#FF6B00] text-white" : ""}`}><Timer className="h-3.5 w-3.5" /> Metronom</button>
        <button type="button" onClick={() => setLoop((v) => !v)} className={`${btn} ${loop ? "border-[#FF6B00] text-white" : ""}`}><Repeat className="h-3.5 w-3.5" /> Pętla</button>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => setPps((v) => Math.max(10, v / 1.4))} className={btn} aria-label="Oddal"><ZoomOut className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => setPps((v) => Math.min(200, v * 1.4))} className={btn} aria-label="Przybliż"><ZoomIn className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => { const t = newTrack(`Ścieżka ${project.tracks.length + 1}`, "audio", project.tracks.length); edit((p) => ({ ...p, tracks: [...p.tracks, t] })); setSelTrack(t.id); }} className={btn}><Plus className="h-3.5 w-3.5" /> Ścieżka</button>
        </div>
      </div>

      {busy && <p className="flex items-center gap-2 bg-amber-500/10 px-3 py-1 text-xs text-amber-300"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {busy}</p>}

      {/* Oś czasu */}
      <div className="relative max-h-[360px] overflow-auto" onPointerMove={onClipMove} onPointerUp={onClipUp}>
        <div className="relative" style={{ width: HEADER_W + totalSec * pps }}>
          <div className="sticky top-0 z-20 flex h-6 border-b border-white/10 bg-[#15151f]">
            <div className="sticky left-0 z-30 shrink-0 bg-[#15151f]" style={{ width: HEADER_W }} />
            <div className="relative flex-1 cursor-pointer" onClick={(e) => { const x = e.clientX - e.currentTarget.getBoundingClientRect().left; if (!playing) setPosition(snap(x / pps, beat)); }}>
              {Array.from({ length: bars }, (_, i) => (
                <span key={i} className="absolute top-0 h-full border-l border-white/15 pl-1 text-[10px] tabular-nums text-gray-500" style={{ left: i * bar * pps }}>{i + 1}</span>
              ))}
            </div>
          </div>
          {project.tracks.map((t) => (
            <div key={t.id} className={`flex border-b border-white/5 ${t.id === track?.id ? "bg-white/[0.03]" : ""}`} style={{ height: ROW_H }}>
              <div className="sticky left-0 z-10 flex shrink-0 flex-col justify-center gap-1 border-r border-white/10 bg-[#13131c] px-2" style={{ width: HEADER_W, borderLeft: `4px solid ${t.color}` }} onClick={() => setSelTrack(t.id)}>
                <input value={t.name} onChange={(e) => updateTrack(t.id, { name: e.target.value })} className="w-full truncate bg-transparent text-xs font-semibold text-white outline-none" aria-label="Nazwa ścieżki" title={t.source ? `Z katalogu: ${t.source.title} – ${t.source.artist}` : undefined} />
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => updateTrack(t.id, { mute: !t.mute })} className={`h-5 w-5 rounded text-[10px] font-bold ${t.mute ? "bg-amber-500 text-black" : "bg-white/10"}`} title="Wycisz">M</button>
                  <button type="button" onClick={() => updateTrack(t.id, { solo: !t.solo })} className={`h-5 w-5 rounded text-[10px] font-bold ${t.solo ? "bg-[#FFD400] text-black" : "bg-white/10"}`} title="Solo">S</button>
                  <button type="button" onClick={() => edit((p) => ({ ...p, tracks: p.tracks.map((x) => ({ ...x, armed: x.id === t.id ? !x.armed : false })) }))} className={`h-5 w-5 rounded text-[10px] font-bold ${t.armed ? "bg-red-600 text-white" : "bg-white/10"}`} title="Uzbrój do nagrywania">R</button>
                  <input type="range" min={0} max={1.2} step={0.01} value={t.volume} onChange={(e) => updateTrack(t.id, { volume: +e.target.value })} className="w-16 accent-[#FF6B00]" aria-label={`Głośność ${t.name}`} />
                  <button type="button" onClick={() => edit((p) => ({ ...p, tracks: p.tracks.filter((x) => x.id !== t.id) }))} className="ml-auto text-gray-500 hover:text-red-400" title="Usuń ścieżkę"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              <div className="relative flex-1" onClick={(e) => { setSelTrack(t.id); setSelClip(null); const x = e.clientX - e.currentTarget.getBoundingClientRect().left; if (!playing) setPosition(snap(x / pps, beat)); }}>
                {Array.from({ length: bars }, (_, i) => <div key={i} className="absolute top-0 h-full border-l border-white/[0.04]" style={{ left: i * bar * pps }} />)}
                {t.clips.map((c) => (
                  <div
                    key={c.id}
                    onPointerDown={(e) => onClipDown(e, t, c)}
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute top-1 bottom-1 cursor-grab overflow-hidden rounded-md border ${c.id === selClip ? "border-white" : "border-black/40"}`}
                    style={{ left: c.start * pps, width: Math.max(6, c.duration * pps), background: `${t.color}33` }}
                    title={`${c.name} — przeciągnij, aby przesunąć`}
                  >
                    <span className="absolute left-1 top-0 z-10 truncate text-[10px] font-semibold" style={{ color: t.color }}>{c.name}{c.original ? " · autotune" : ""}</span>
                    <ClipWave clip={c} color={t.color} />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div ref={playheadRef} className="pointer-events-none absolute left-0 top-0 z-30 h-full w-px bg-[#FFD400]" />
        </div>
      </div>

      {/* Edycja klipu */}
      <div className="flex flex-wrap items-center gap-2 border-y border-white/10 bg-[#15151f] px-3 py-1.5 text-xs text-gray-400">
        <span>Klip:</span>
        <button type="button" disabled={!selClip} onClick={() => clipOp("split")} className={btn}><Scissors className="h-3.5 w-3.5" /> Podziel w miejscu wskaźnika</button>
        <button type="button" disabled={!selClip} onClick={() => clipOp("duplicate")} className={btn}><Copy className="h-3.5 w-3.5" /> Powiel (Ctrl+D)</button>
        <button type="button" disabled={!selClip} onClick={() => clipOp("delete")} className={btn}><Trash2 className="h-3.5 w-3.5" /> Usuń (Del)</button>
        <span className="ml-auto hidden text-[11px] sm:inline">Spacja = graj/stop · Ctrl+S = zapisz projekt · przeciągaj klipy</span>
      </div>

      {/* Asystent i podpowiedzi */}
      <DawAssistant state={dawState} onCommand={onAssistant} />

      {/* Panele dolne */}
      <nav className="flex gap-1 overflow-x-auto border-y border-white/10 px-2 pt-2" role="tablist" aria-label="Panele studia">
        {PANELS.map(({ id, label, Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={panel === id} onClick={() => setPanel(id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-t-md px-3 py-1.5 text-xs font-semibold ${panel === id ? "bg-[#FF6B00]/20 text-white" : "text-gray-400 hover:bg-white/5"}`}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </nav>

      <div className="p-3">
        {panel === "sound" && track && (
          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-semibold" style={{ color: track.color }}>{track.name}:</span>
                {VOCAL_PRESETS.map((p) => (
                  <button key={p.id} type="button" onClick={() => updateTrack(track.id, { fx: { ...p.fx } })} className={btn}>{p.label}</button>
                ))}
                <button type="button" onClick={() => updateTrack(track.id, { fx: { ...FLAT_FX } })} className={btn}>Bez efektów</button>
                <button type="button" onClick={() => smartProcess(track)} disabled={!track.clips.length} className={`${btn} border-emerald-400/40 text-emerald-300`}>
                  <Wand2 className="h-3.5 w-3.5" /> Inteligentna obróbka nagrania
                </button>
              </div>
              {smartNotes?.trackId === track.id && <p className="text-[11px] text-emerald-300/90">Ustawiono: {smartNotes.notes.join(" · ")}</p>}
              <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                {fxSliders.map((s) => (
                  <label key={s.key} className="text-[11px] text-gray-400">
                    {s.label}: <span className="tabular-nums text-white">{s.key === "gate" && track.fx.gate <= -89 ? "wył." : `${track.fx[s.key]} ${s.unit}`}</span>
                    <input type="range" min={s.min} max={s.max} step={s.step} value={track.fx[s.key]}
                      onChange={(e) => updateTrack(track.id, { fx: { ...track.fx, [s.key]: +e.target.value } })} className="w-full accent-[#FF6B00]" />
                  </label>
                ))}
              </div>
              <div className="space-y-2 rounded-xl border border-[#a78bfa]/30 bg-[#a78bfa]/[0.06] p-3 text-xs">
                <p className="font-semibold text-[#c4b5fd]">Autotune — korekta wysokości nagrania (bez opóźnień odsłuchu)</p>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1 text-gray-400">Tonacja
                    <select value={atKey} onChange={(e) => setAtKey(+e.target.value)} className={sel}>{NOTE_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}</select>
                  </label>
                  <label className="flex items-center gap-1 text-gray-400">Skala
                    <select value={atScale} onChange={(e) => setAtScale(e.target.value as Scale)} className={sel}>{(Object.keys(SCALE_LABELS) as Scale[]).map((s) => <option key={s} value={s}>{SCALE_LABELS[s]}</option>)}</select>
                  </label>
                  <label className="flex items-center gap-1 text-gray-400">Siła {atStrength}%
                    <input type="range" min={0} max={100} value={atStrength} onChange={(e) => setAtStrength(+e.target.value)} className="w-24 accent-[#a78bfa]" />
                  </label>
                  <label className="flex items-center gap-1 text-gray-400" title="0 ms = efekt „robota”, 40–80 ms = naturalnie">Szybkość {atSpeed} ms
                    <input type="range" min={0} max={200} step={5} value={atSpeed} onChange={(e) => setAtSpeed(+e.target.value)} className="w-24 accent-[#a78bfa]" />
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={!track.clips.length || !!busy} onClick={() => void applyAutotune(track)} className={`${btn} border-[#a78bfa]/50`}><Wand2 className="h-3.5 w-3.5" /> Zastosuj do {selClip && track.clips.some((c) => c.id === selClip) ? "zaznaczonego klipu" : "nagrania"}</button>
                  <button type="button" disabled={!hasTuned} onClick={() => undoAutotune(track)} className={btn}><Undo2 className="h-3.5 w-3.5" /> Cofnij autotune</button>
                </div>
              </div>
              <p className="text-[11px] text-gray-500">Zmiany słychać od razu — podczas odtwarzania i w odsłuchu mikrofonu. Nagranie zostaje surowe, więc brzmienie można poprawić w każdej chwili.</p>
            </div>
            <div className="space-y-2 rounded-xl border border-white/10 bg-[#15151f] p-3 text-xs">
              <p className="flex items-center gap-1 font-semibold"><Mic className="h-4 w-4 text-[#FF9500]" /> Mikrofon na żywo</p>
              <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)} onFocus={() => void refreshDevices()} className={`${sel} w-full`} aria-label="Wejście audio">
                <option value="">Domyślne wejście</option>
                {devices.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || "Wejście audio"}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-1" role="radiogroup" aria-label="Odsłuch przez">
                <button type="button" role="radio" aria-checked={!speakers} onClick={() => void switchOutput(false)} className={`${btn} justify-center ${!speakers ? "border-[#FF6B00] text-white" : ""}`}><Headphones className="h-3.5 w-3.5" /> Słuchawki</button>
                <button type="button" role="radio" aria-checked={speakers} onClick={() => void switchOutput(true)} className={`${btn} justify-center ${speakers ? "border-[#FF6B00] text-white" : ""}`}><Speaker className="h-3.5 w-3.5" /> Głośniki</button>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={micOn ? micOff : () => void micOnFn()} className="flex-1 text-white" style={{ background: micOn ? "#334155" : "linear-gradient(135deg,#FF6B00,#FF9500)" }}>
                  {micOn ? "Wyłącz mikrofon" : "Włącz mikrofon"}
                </Button>
                <button type="button" onClick={() => setMonitor((v) => !v)} className={`${btn} ${monitor ? "border-[#FF6B00] text-white" : ""}`} title="Słyszysz siebie z efektami">
                  <Volume2 className="h-3.5 w-3.5" /> Odsłuch
                </button>
              </div>
              <div className="h-2 w-full overflow-hidden rounded bg-black/50"><div ref={(el) => { if (el) meterRefs.current.set("mic", el); }} className="h-full w-0 bg-gradient-to-r from-emerald-400 via-yellow-300 to-red-500" /></div>
              <p className="text-gray-400">Nagrywasz na: <span className="text-white">{armed?.name ?? "— uzbrój ścieżkę (R)"}</span></p>
              <p className="text-[11px] text-gray-500">
                {speakers
                  ? "Tryb głośników: przeglądarka tłumi echo, odsłuch jest ciszej, a wykryte sprzężenie wycinam automatycznie. Trzymaj mikrofon z dala od głośników."
                  : "Tryb słuchawek: czysty, surowy głos i pełny odsłuch z efektami."}
              </p>
            </div>
          </div>
        )}

        {panel === "mixer" && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[...project.tracks, null].map((t) => (
              <div key={t?.id ?? "master"} className="flex w-20 shrink-0 flex-col items-center gap-1 rounded-lg border border-white/10 bg-[#15151f] p-1.5" style={{ borderTop: `3px solid ${t?.color ?? "#fff"}` }}>
                <span className="w-full truncate text-center text-[10px] font-semibold">{t?.name ?? "MASTER"}</span>
                {t && <input type="range" min={-1} max={1} step={0.05} value={t.pan} onChange={(e) => updateTrack(t.id, { pan: +e.target.value })} className="w-16 accent-[#22d3ee]" aria-label={`Panorama ${t.name}`} title="Panorama L–P" />}
                <div className="flex h-32 items-end gap-1">
                  <input type="range" min={0} max={1.2} step={0.01} value={t ? t.volume : masterVol}
                    onChange={(e) => (t ? updateTrack(t.id, { volume: +e.target.value }) : setMasterVol(+e.target.value))}
                    className="h-32 accent-[#FF6B00]" style={{ writingMode: "vertical-lr", direction: "rtl" }} aria-label={`Suwak ${t?.name ?? "master"}`} />
                  <div className="relative h-32 w-2 overflow-hidden rounded bg-black/60">
                    <div ref={(el) => { if (el) meterRefs.current.set(t?.id ?? "master", el); }} className="absolute bottom-0 w-full bg-gradient-to-t from-emerald-400 via-yellow-300 to-red-500" style={{ height: 0 }} />
                  </div>
                </div>
                <span className="text-[10px] tabular-nums text-gray-400">{Math.round(20 * Math.log10(Math.max(0.001, t ? t.volume : masterVol)))} dB</span>
                {t && (
                  <div className="flex gap-0.5">
                    <button type="button" onClick={() => updateTrack(t.id, { mute: !t.mute })} className={`rounded px-1 text-[10px] ${t.mute ? "bg-amber-500 text-black" : "bg-white/10"}`}>{t.mute ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}</button>
                    <button type="button" onClick={() => updateTrack(t.id, { solo: !t.solo })} className={`rounded px-1 text-[10px] ${t.solo ? "bg-[#FFD400] text-black" : "bg-white/10"}`}>S</button>
                    <button type="button" onClick={() => { setSelTrack(t.id); setPanel("sound"); }} className="rounded bg-white/10 px-1 text-[10px]">FX</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {panel === "instruments" && (
          <div className="space-y-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Drum className="h-4 w-4 text-[#FF9500]" /> <span className="font-semibold">Automat perkusyjny</span>
              {Object.keys(DRUM_PRESETS).map((k) => <button key={k} type="button" onClick={() => setDrums(structuredClone(DRUM_PRESETS[k]))} className={btn}>{k}</button>)}
              <button type="button" onClick={previewDrums} className={btn}><Play className="h-3.5 w-3.5" /> Podgląd taktu</button>
            </div>
            <div className="overflow-x-auto">
              <table className="border-separate border-spacing-0.5">
                <tbody>
                  {DRUM_ROWS.map((row) => (
                    <tr key={row}>
                      <th scope="row" className="pr-2 text-left font-normal text-gray-400">{DRUM_LABELS[row]}</th>
                      {drums[row].map((on, i) => (
                        <td key={i}>
                          <button type="button" aria-pressed={on} aria-label={`${DRUM_LABELS[row]} krok ${i + 1}`}
                            onClick={() => setDrums((d) => ({ ...d, [row]: d[row].map((v, j) => (j === i ? !v : v)) }))}
                            className={`h-6 w-6 rounded ${on ? "bg-[#FF6B00]" : i % 4 === 0 ? "bg-white/15" : "bg-white/5"}`} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1 text-gray-400">Długość
                <select value={instBars} onChange={(e) => setInstBars(+e.target.value)} className={sel}>{[1, 2, 4, 8, 16, 32].map((b) => <option key={b} value={b}>{b} takt.</option>)}</select>
              </label>
              <button type="button" onClick={() => void insertDrums()} className={`${btn} border-[#FF6B00]/60`}><Plus className="h-3.5 w-3.5" /> Wstaw perkusję we wskaźniku</button>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
              <Piano className="h-4 w-4 text-[#a78bfa]" /> <span className="font-semibold">Harmonia</span>
              <label className="flex items-center gap-1 text-gray-400">Tonacja
                <select value={keyRoot} onChange={(e) => setKeyRoot(+e.target.value)} className={sel}>{NOTE_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}</select>
              </label>
              <label className="flex items-center gap-1 text-gray-400">Progresja
                <select value={progId} onChange={(e) => setProgId(e.target.value)} className={sel}>{PROGRESSIONS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
              </label>
              <button type="button" onClick={() => void insertHarmony("chords")} className={btn}><Plus className="h-3.5 w-3.5" /> Akordy (pad)</button>
              <button type="button" onClick={() => void insertHarmony("bass")} className={btn}><Plus className="h-3.5 w-3.5" /> Linia basu</button>
            </div>
            <p className="text-[11px] text-gray-500">Instrumenty grają w tempie projektu ({project.bpm} BPM) i wstawiają się jako nowe ścieżki od wskaźnika (zaokrąglone do taktu).</p>
          </div>
        )}

        {panel === "ai" && (
          <div className="grid gap-4 text-xs lg:grid-cols-2">
            <div className="space-y-2 rounded-xl border border-white/10 bg-[#15151f] p-3 lg:col-span-2">
              <p className="flex items-center gap-1 font-semibold"><Search className="h-4 w-4 text-[#22d3ee]" /> Szukaj w całym katalogu GrouAI Stream</p>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void searchCatalog(); }}>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="tytuł utworu albo wykonawca" className="flex-1 rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-white" aria-label="Szukaj utworu" />
                <button type="submit" disabled={!!busy} className={btn}><Search className="h-3.5 w-3.5" /> Szukaj</button>
              </form>
              {hits.length > 0 && (
                <ul className="max-h-48 space-y-1 overflow-y-auto">
                  {hits.map((h) => (
                    <li key={h.id} className="flex items-center gap-2 rounded-md bg-black/30 px-2 py-1">
                      <span className="flex-1 truncate"><span className="text-white">{h.title}</span> <span className="text-gray-500">— {h.artist}</span>{h.user_id === user?.id && <span className="ml-1 text-emerald-300">(Twój)</span>}</span>
                      <button type="button" disabled={!!busy} onClick={() => void insertSong(h.title, h.audio_url, false, { trackId: h.id, title: h.title, artist: h.artist, userId: h.user_id })} className={btn}><Plus className="h-3.5 w-3.5" /> Wstaw</button>
                      <button type="button" disabled={!!busy} onClick={() => void insertSong(h.title, h.audio_url, true, { trackId: h.id, title: h.title, artist: h.artist, userId: h.user_id })} className={btn}><Scissors className="h-3.5 w-3.5" /> Rozłóż</button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[11px] text-gray-500">Przerób dowolny utwór i zapisz jako nowy w „Eksporcie”. Przeróbka cudzego utworu zapisze się jako remiks z podaniem oryginału — pakiet Spotify tylko dla własnej muzyki.</p>
            </div>
            <div className="space-y-2 rounded-xl border border-white/10 bg-[#15151f] p-3">
              <p className="flex items-center gap-1 font-semibold"><Sparkles className="h-4 w-4 text-[#FFD400]" /> Podkład AI (Suno, bez wokalu)</p>
              <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} rows={2} placeholder="np. melancholijny hip-hop, pianino i smyczki, 90 BPM" className="w-full rounded-md border border-white/10 bg-black/40 p-2 text-white" />
              <Button size="sm" onClick={() => void aiBacking()} disabled={!!busy} className="text-white" style={{ background: "linear-gradient(135deg,#FF6B00,#FFD400)" }}>Stwórz podkład</Button>
              <p className="text-[11px] text-gray-500">Podkład trafia na nową ścieżkę, a tempo projektu dopasowuje się samo. Potem nagraj na nim swój głos.</p>
            </div>
            <div className="space-y-2 rounded-xl border border-white/10 bg-[#15151f] p-3">
              <p className="font-semibold">Twoje utwory i pliki</p>
              <select value={songUrl} onChange={(e) => setSongUrl(e.target.value)} className={`${sel} w-full`}>
                <option value="">— wybierz —</option>
                {mySongs.map((s) => <option key={s.url} value={s.url}>{s.title}</option>)}
              </select>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={!songUrl || !!busy} onClick={() => void insertSong(mySongs.find((s) => s.url === songUrl)?.title ?? "Utwór", songUrl, false)} className={btn}><Plus className="h-3.5 w-3.5" /> Wstaw cały</button>
                <button type="button" disabled={!songUrl || !!busy} onClick={() => void insertSong(mySongs.find((s) => s.url === songUrl)?.title ?? "Utwór", songUrl, true)} className={btn}><Scissors className="h-3.5 w-3.5" /> Rozłóż na 4 ścieżki</button>
              </div>
              <button type="button" onClick={() => fileRef.current?.click()} className={btn}><Upload className="h-3.5 w-3.5" /> Wstaw plik z dysku (próbka, bit, nagranie)</button>
            </div>
          </div>
        )}

        {panel === "export" && (
          <div className="flex flex-wrap items-end gap-3 text-xs">
            <label className="text-gray-400">Tytuł
              <input value={exportTitle} onChange={(e) => setExportTitle(e.target.value)} className="mt-1 block w-60 rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-white" />
            </label>
            <button type="button" onClick={() => void exportWav()} disabled={!!busy} className={btn}><Download className="h-3.5 w-3.5" /> Pobierz miks WAV</button>
            <Button size="sm" onClick={() => void saveAndRelease()} disabled={!!busy} className="text-white" style={{ background: "linear-gradient(135deg,#16a34a,#22c55e)" }}>
              <Save className="mr-1 h-4 w-4" /> Zapisz jako nowy utwór (+ Spotify dla własnej muzyki)
            </Button>
            <p className="w-full text-[11px] text-gray-500">Miks liczony jest z pełną jakością (44,1 kHz) ze wszystkimi efektami. Utwór trafia do historii i do „Nowe”; własna muzyka przechodzi mastering GrouAI Studio (−14 LUFS) ze znaczkiem. Projekt (ścieżki do dalszej edycji) zapisujesz osobno: „Zapisz projekt” u góry.</p>
          </div>
        )}
      </div>
    </section>
  );
}
