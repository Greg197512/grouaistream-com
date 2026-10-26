// GrouAI Studio DAW — pełne okno studia: ścieżki na osi czasu, mikser, wokal na żywo
// (mikrofon + łańcuch studyjny regulowany w czasie rzeczywistym), instrumenty do tworzenia
// od zera, AI (podkład Suno, rozkładanie na ścieżki, inteligentna obróbka głosu) i eksport.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Play, Square, Circle, Repeat, Timer, Plus, Trash2, Copy, Scissors, Mic, Headphones, Volume2, VolumeX,
  Sparkles, Drum, Piano, Upload, Download, Save, Loader2, SlidersHorizontal, Wand2, ZoomIn, ZoomOut,
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
  type Clip, type Project, type Strip, type Track, type TrackKind,
} from "@/lib/daw/audio";

const COLORS = ["#FF6B00", "#a78bfa", "#22d3ee", "#34d399", "#f472b6", "#FFD400", "#60a5fa", "#f87171"];
const HEADER_W = 190;
const ROW_H = 64;
type Panel = "mixer" | "sound" | "instruments" | "ai" | "export";

let ctxSingleton: AudioContext | null = null;
const getCtx = () => (ctxSingleton ??= new AudioContext({ latencyHint: "interactive" }));
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

export function StudioDAW() {
  const { user } = useAuth();
  const [project, setProject] = useState<Project>(() => ({ bpm: 100, tracks: [newTrack("Wokal", "vocal", 0, VOCAL_PRESETS[1].fx)] }));
  const [selTrack, setSelTrack] = useState<string>(() => "");
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
  // Mikrofon
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [micOn, setMicOn] = useState(false);
  const [monitor, setMonitor] = useState(false);
  // Instrumenty
  const [drums, setDrums] = useState<DrumPattern>(() => structuredClone(DRUM_PRESETS["Pop"]));
  const [instBars, setInstBars] = useState(8);
  const [keyRoot, setKeyRoot] = useState(0);
  const [progId, setProgId] = useState(PROGRESSIONS[0].id);
  // AI / import
  const [aiPrompt, setAiPrompt] = useState("");
  const [mySongs, setMySongs] = useState<{ title: string; url: string }[]>([]);
  const [songUrl, setSongUrl] = useState("");
  const [exportTitle, setExportTitle] = useState("Mój utwór");
  const [smartNotes, setSmartNotes] = useState<{ trackId: string; notes: string[] } | null>(null);

  const projectRef = useRef(project);
  projectRef.current = project;
  const playRef = useRef<{ nodes: AudioScheduledSourceNode[]; strips: Map<string, Strip>; t0: number; from: number } | null>(null);
  const masterRef = useRef<{ gain: GainNode; analyser: AnalyserNode } | null>(null);
  const micRef = useRef<{ stream: MediaStream; source: MediaStreamAudioSourceNode; analyser: AnalyserNode; strip: Strip | null; monitorGain: GainNode } | null>(null);
  // startedAt = czas kontekstu startu nagrywania, t0 = start transportu (do wyrównania nagrania).
  const recRef = useRef<{ rec: MediaRecorder; chunks: Blob[]; startedAt: number; t0: number; trackId: string; from: number } | null>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const meterRefs = useRef(new Map<string, HTMLDivElement>());
  const rafRef = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const beat = 60 / project.bpm;
  const bar = beat * 4;
  const track = project.tracks.find((t) => t.id === selTrack) ?? project.tracks[0];
  const totalSec = Math.max(projectEnd(project) + bar * 4, bar * 16);

  // ── Pomocnicze zmiany projektu ────────────────────────────────────────────
  const updateTrack = useCallback((id: string, patch: Partial<Track>) => {
    setProject((p) => ({ ...p, tracks: p.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
    const live = playRef.current?.strips.get(id);
    const t = projectRef.current.tracks.find((x) => x.id === id);
    if (t && live) {
      const n = { ...t, ...patch };
      if (patch.fx) live.setFx(n.fx);
      if ("volume" in patch || "pan" in patch || "mute" in patch) live.setMix(n.mute ? 0 : n.volume, n.pan);
    }
    if (patch.fx && micRef.current?.strip && id === projectRef.current.tracks.find((x) => x.armed)?.id) micRef.current.strip.setFx(patch.fx);
  }, []);

  const addClip = useCallback((trackId: string, clip: Omit<Clip, "id">) => {
    const c = { ...clip, id: uid() };
    setProject((p) => ({ ...p, tracks: p.tracks.map((t) => (t.id === trackId ? { ...t, clips: [...t.clips, c] } : t)) }));
    setSelClip(c.id);
  }, []);

  /** Nowa ścieżka z klipem (import, podkład AI, ścieżki z rozkładania, instrumenty). */
  const addTrackWithBuffer = useCallback((name: string, kind: TrackKind, buffer: AudioBuffer, start = 0) => {
    const t = newTrack(name, kind, projectRef.current.tracks.length);
    t.clips = [{ id: uid(), name, buffer, start, offset: 0, duration: buffer.duration, gain: 1 }];
    setProject((p) => ({ ...p, tracks: [...p.tracks, t] }));
    setSelTrack(t.id);
    return t.id;
  }, []);

  // Moje utwory (do importu i rozkładania).
  useEffect(() => {
    if (!user?.id) return;
    void supabase.from("generations").select("title, audio_url").eq("user_id", user.id).eq("status", "completed")
      .order("created_at", { ascending: false }).limit(40)
      .then(({ data }) => setMySongs((data || []).filter((g) => isPersistentAudioUrl(g.audio_url) && !g.audio_url!.includes("bmwtydwpevzhbdplilbr"))
        .map((g) => ({ title: g.title, url: g.audio_url! }))));
  }, [user?.id]);

  // ── Transport ─────────────────────────────────────────────────────────────
  const master = () => {
    const ctx = getCtx();
    if (!masterRef.current) {
      const gain = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      gain.connect(analyser).connect(ctx.destination);
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

  // Wskaźnik odtwarzania, mierniki i pętla (rAF, bez re-renderów).
  useEffect(() => {
    const buf = new Float32Array(1024);
    const level = (a: AnalyserNode) => { a.getFloatTimeDomainData(buf); let m = 0; for (const v of buf) m = Math.max(m, Math.abs(v)); return m; };
    const tick = () => {
      const p = playRef.current;
      const ctx = ctxSingleton;
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
      if (masterRef.current) { const el = meterRefs.current.get("master"); if (el) el.style.height = `${Math.min(100, level(masterRef.current.analyser) * 100)}%`; }
      if (micRef.current) { const el = meterRefs.current.get("mic"); if (el) el.style.width = `${Math.min(100, level(micRef.current.analyser) * 140)}%`; }
      if (playheadRef.current) playheadRef.current.style.transform = `translateX(${HEADER_W + pos * pps}px)`;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [position, pps, loop, stopPlayback, startPlayback]);

  useEffect(() => { if (masterRef.current) masterRef.current.gain.gain.value = masterVol; }, [masterVol]);

  // ── Mikrofon i wokal na żywo ──────────────────────────────────────────────
  const armed = project.tracks.find((t) => t.armed);

  const refreshDevices = async () => {
    const list = await navigator.mediaDevices.enumerateDevices();
    setDevices(list.filter((d) => d.kind === "audioinput"));
  };

  const micOff = useCallback(() => {
    const m = micRef.current;
    if (m) { m.stream.getTracks().forEach((t) => t.stop()); m.source.disconnect(); }
    micRef.current = null;
    setMicOn(false);
  }, []);

  const micOnFn = async () => {
    try {
      const ctx = getCtx();
      await ctx.resume();
      const gate = await ensureWorklet(ctx);
      // Bez przetwarzania przeglądarki — surowy głos, brzmienie ustawiamy sami (jak w studiu).
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: deviceId ? { exact: deviceId } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const monitorGain = ctx.createGain();
      monitorGain.gain.value = monitor ? 1 : 0;
      monitorGain.connect(ctx.destination);
      const target = armed ?? track;
      const strip = target ? buildStrip(ctx, target.fx, 1, 0, monitorGain, gate) : null;
      if (strip) source.connect(strip.input);
      micRef.current = { stream, source, analyser, strip, monitorGain };
      setMicOn(true);
      void refreshDevices();
      if (target && !target.armed) updateTrack(target.id, { armed: true });
    } catch (e) {
      toast.error(`Brak dostępu do mikrofonu: ${e instanceof Error ? e.message : "błąd"}`);
    }
  };

  useEffect(() => { if (micRef.current) micRef.current.monitorGain.gain.value = monitor ? 1 : 0; }, [monitor]);
  useEffect(() => () => { micOff(); stopPlayback(); }, [micOff, stopPlayback]);

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
      const buffer = await ctx.decodeAudioData(await new Blob(r.chunks).arrayBuffer());
      // Wyrównanie: nagranie ruszyło przed transportem; dokładamy opóźnienie wyjścia/wejścia.
      const trim = Math.max(0, r.t0 - r.startedAt + (ctx.outputLatency || 0) + (ctx.baseLatency || 0));
      addClip(r.trackId, { name: "Nagranie", buffer, start: r.from, offset: Math.min(trim, buffer.duration - 0.01), duration: Math.max(0.01, buffer.duration - trim), gain: 1 });
      toast.success("Nagranie dodane — możesz je obrobić w „Brzmieniu” albo przez „Inteligentną obróbkę”");
    } catch (e) {
      toast.error(`Nie udało się odczytać nagrania: ${e instanceof Error ? e.message : "błąd"}`);
    }
  };

  /** Analiza nagrań ścieżki → ustawienia łańcucha + poziom klipów (jak realizator w studiu). */
  const smartProcess = (t: Track) => {
    const c = t.clips[0];
    if (!c) { toast.error("Na ścieżce nie ma nagrania"); return; }
    const sr = c.buffer.sampleRate;
    const mono = c.buffer.getChannelData(0).subarray(Math.floor(c.offset * sr), Math.floor((c.offset + c.duration) * sr));
    const s = smartVocalFx(analyzeVocal(mono, sr));
    const k = Math.pow(10, s.gainDb / 20);
    setProject((p) => ({ ...p, tracks: p.tracks.map((x) => (x.id === t.id ? { ...x, fx: s.fx, clips: x.clips.map((cl) => ({ ...cl, gain: cl.gain * k })) } : x)) }));
    playRef.current?.strips.get(t.id)?.setFx(s.fx);
    setSmartNotes({ trackId: t.id, notes: s.notes });
    toast.success("Głos obrobiony — sprawdź ustawienia w „Brzmieniu”");
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
    setProject((p) => ({ ...p, tracks: p.tracks.map((t) => (t.id !== d.trackId ? t : { ...t, clips: t.clips.map((c) => (c.id === d.clipId ? { ...c, start } : c)) })) }));
  };
  const onClipUp = () => { dragRef.current = null; };

  const clipOp = (op: "delete" | "duplicate" | "split") => {
    if (!selClip) return;
    setProject((p) => ({
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

  // Skróty: spacja, R, Delete, Ctrl+D.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (e.code === "Space") { e.preventDefault(); togglePlay(); }
      else if (e.key === "Delete" || e.key === "Backspace") clipOp("delete");
      else if ((e.ctrlKey || e.metaKey) && e.key === "d") { e.preventDefault(); clipOp("duplicate"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ── Instrumenty, AI, import ───────────────────────────────────────────────
  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : "Coś poszło nie tak"); } finally { setBusy(""); }
  };
  const atBar = () => snap(position, bar);

  const insertDrums = () => run("Renderuję perkusję…", async () => {
    addTrackWithBuffer(`Perkusja (${instBars} t.)`, "instrument", await renderDrums(drums, project.bpm, instBars), atBar());
  });
  const insertHarmony = (part: "bass" | "chords") => run(part === "bass" ? "Renderuję bas…" : "Renderuję akordy…", async () => {
    const buf = await renderHarmony(part, keyRoot, progId, project.bpm, instBars);
    addTrackWithBuffer(`${part === "bass" ? "Bas" : "Akordy"} ${NOTE_NAMES[keyRoot]}`, "instrument", buf, atBar());
  });
  const previewDrums = () => run("Podgląd…", async () => {
    const b = await renderDrums(drums, project.bpm, 1);
    const ctx = getCtx(); await ctx.resume();
    const s = ctx.createBufferSource(); s.buffer = b; s.connect(master().gain); s.start();
  });

  const aiBacking = () => run("Suno komponuje podkład… (1–3 min)", async () => {
    if (aiPrompt.trim().length < 3) throw new Error("Opisz podkład, np. „spokojny hip-hop, pianino, 90 BPM”");
    const r = await generateTrack({ engine: "suno", prompt: aiPrompt.trim(), instrumental: true });
    const buf = await decodeUrl(r.audioUrl);
    if (!projectRef.current.tracks.some((t) => t.clips.length)) setProject((p) => ({ ...p, bpm: estimateBpm(buf.getChannelData(0), buf.sampleRate) }));
    addTrackWithBuffer(`Podkład AI: ${r.title}`, "audio", buf, 0);
    toast.success("Podkład AI wstawiony — nagraj na nim swój głos");
  });

  const importSong = (split: boolean) => run(split ? "Rozkładam utwór na ścieżki… (1–3 min)" : "Wczytuję utwór…", async () => {
    const song = mySongs.find((s) => s.url === songUrl);
    if (!song) throw new Error("Wybierz utwór");
    if (!split) { addTrackWithBuffer(song.title, "audio", await decodeUrl(song.url), 0); return; }
    const map = await waitForStems(await startStems(song.url, "4"), "daw", (s) => setBusy(`Rozkładam utwór na ścieżki… ${s}s`));
    for (const [name, url] of Object.entries(map)) addTrackWithBuffer(STEM_LABELS[name] ?? name, name === "vocals" ? "vocal" : "audio", await decodeUrl(url), 0);
    toast.success("Ścieżki wstawione");
  });

  const importFile = (f: File) => run("Wczytuję plik…", async () => {
    addTrackWithBuffer(f.name.replace(/\.[^.]+$/, ""), "audio", await getCtx().decodeAudioData(await f.arrayBuffer()), atBar());
  });

  // ── Eksport ───────────────────────────────────────────────────────────────
  const renderWav = async () => {
    const out = await mixdown(projectRef.current);
    return new Blob([encodeWav16([out.getChannelData(0), out.getChannelData(1)], out.sampleRate)], { type: "audio/wav" });
  };
  const exportWav = () => run("Miksuję projekt…", async () => {
    if (!projectEnd(project)) throw new Error("Projekt jest pusty");
    const url = URL.createObjectURL(await renderWav());
    const a = document.createElement("a"); a.href = url; a.download = `${exportTitle || "projekt"}.wav`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  });
  const saveAndRelease = () => run("Miksuję i zapisuję…", async () => {
    if (!user) throw new Error("Zaloguj się, aby zapisać");
    if (!projectEnd(project)) throw new Error("Projekt jest pusty");
    const title = exportTitle.trim() || "Mój utwór";
    const { publicUrl } = await uploadToR2({ file: new File([await renderWav()], `${title.replace(/[^\p{L}\p{N}]+/gu, "_")}.wav`, { type: "audio/wav" }), folder: `studio/${user.id}` });
    const artist = user.user_metadata?.display_name || user.email?.split("@")[0] || "GrouAI Studio";
    const { data: gen } = await supabase.from("generations").insert({ user_id: user.id, title, genre: "Studio DAW", prompt: "GrouAI Studio DAW", instrumental: false, status: "completed", audio_url: publicUrl }).select("id").maybeSingle();
    const { data: tr } = await supabase.from("tracks").insert({ user_id: user.id, title, artist, album: "GrouAI Studio", duration: Math.round(projectEnd(project)), audio_url: publicUrl, genre: "AI" }).select("id").maybeSingle();
    window.dispatchEvent(new CustomEvent("grouai:generations-changed"));
    certifyWithToasts({ audioUrl: publicUrl, title, artist, instrumental: false, userId: user.id, generationId: gen?.id, trackId: tr?.id });
    toast.success(`„${title}” zapisany i w „Nowe” — studio przygotowuje go do Spotify`);
  });

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
    { id: "ai", label: "AI i import", Icon: Sparkles },
    { id: "export", label: "Eksport", Icon: Download },
  ];
  const bars = Math.ceil(totalSec / bar);
  const btn = "inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-gray-200 hover:border-[#FF6B00]/50 disabled:opacity-40";
  const sel = "rounded-md border border-white/10 bg-[#1a1a2e] px-2 py-1 text-xs text-white";

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0e0e17] text-white shadow-2xl">
      {/* Pasek transportu */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-[#15151f] px-3 py-2">
        <span className="mr-1 text-sm font-extrabold">GrouAI Studio <span className="text-[#FF9500]">DAW</span></span>
        <Button size="sm" onClick={togglePlay} disabled={recording} className="h-8 w-9 p-0 text-white" style={{ background: playing ? "#334155" : "#16a34a" }} aria-label={playing ? "Stop" : "Odtwarzaj (spacja)"}>
          {playing ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button size="sm" onClick={recording ? stopRecording : startRecording} className="h-8 w-9 p-0 text-white" style={{ background: recording ? "#dc2626" : "#3f1d1d" }} aria-label={recording ? "Zatrzymaj nagrywanie" : "Nagrywaj"}>
          <Circle className={`h-4 w-4 ${recording ? "animate-pulse fill-white" : "fill-red-500 text-red-500"}`} />
        </Button>
        <button type="button" onClick={() => { stopPlayback(); setPosition(0); }} className={btn}>⏮ Początek</button>
        <span className="rounded-md bg-black/50 px-2 py-1 font-mono text-sm tabular-nums text-[#FFD400]">
          {Math.floor(position / bar) + 1}.{Math.floor((position % bar) / beat) + 1} · {fmtTime(position)}
        </span>
        <label className="flex items-center gap-1 text-xs text-gray-400">BPM
          <input type="number" min={50} max={220} value={project.bpm} onChange={(e) => setProject((p) => ({ ...p, bpm: Math.max(50, Math.min(220, +e.target.value || 100)) }))} className="w-14 rounded-md border border-white/10 bg-black/40 px-1 py-1 text-white" />
        </label>
        <button type="button" onClick={() => setMetronome((v) => !v)} className={`${btn} ${metronome ? "border-[#FF6B00] text-white" : ""}`}><Timer className="h-3.5 w-3.5" /> Metronom</button>
        <button type="button" onClick={() => setLoop((v) => !v)} className={`${btn} ${loop ? "border-[#FF6B00] text-white" : ""}`}><Repeat className="h-3.5 w-3.5" /> Pętla</button>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => setPps((v) => Math.max(10, v / 1.4))} className={btn} aria-label="Oddal"><ZoomOut className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => setPps((v) => Math.min(200, v * 1.4))} className={btn} aria-label="Przybliż"><ZoomIn className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => { const t = newTrack(`Ścieżka ${project.tracks.length + 1}`, "audio", project.tracks.length); setProject((p) => ({ ...p, tracks: [...p.tracks, t] })); setSelTrack(t.id); }} className={btn}><Plus className="h-3.5 w-3.5" /> Ścieżka</button>
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
                <input value={t.name} onChange={(e) => updateTrack(t.id, { name: e.target.value })} className="w-full truncate bg-transparent text-xs font-semibold text-white outline-none" aria-label="Nazwa ścieżki" />
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => updateTrack(t.id, { mute: !t.mute })} className={`h-5 w-5 rounded text-[10px] font-bold ${t.mute ? "bg-amber-500 text-black" : "bg-white/10"}`} title="Wycisz">M</button>
                  <button type="button" onClick={() => updateTrack(t.id, { solo: !t.solo })} className={`h-5 w-5 rounded text-[10px] font-bold ${t.solo ? "bg-[#FFD400] text-black" : "bg-white/10"}`} title="Solo">S</button>
                  <button type="button" onClick={() => setProject((p) => ({ ...p, tracks: p.tracks.map((x) => ({ ...x, armed: x.id === t.id ? !x.armed : false })) }))} className={`h-5 w-5 rounded text-[10px] font-bold ${t.armed ? "bg-red-600 text-white" : "bg-white/10"}`} title="Uzbrój do nagrywania">R</button>
                  <input type="range" min={0} max={1.2} step={0.01} value={t.volume} onChange={(e) => updateTrack(t.id, { volume: +e.target.value })} className="w-16 accent-[#FF6B00]" aria-label={`Głośność ${t.name}`} />
                  <button type="button" onClick={() => setProject((p) => ({ ...p, tracks: p.tracks.filter((x) => x.id !== t.id) }))} className="ml-auto text-gray-500 hover:text-red-400" title="Usuń ścieżkę"><Trash2 className="h-3.5 w-3.5" /></button>
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
                    <span className="absolute left-1 top-0 z-10 truncate text-[10px] font-semibold" style={{ color: t.color }}>{c.name}</span>
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
        <span className="ml-auto hidden text-[11px] sm:inline">Spacja = graj/stop · przeciągaj klipy · klik na osi = ustaw wskaźnik</span>
      </div>

      {/* Panele dolne */}
      <nav className="flex gap-1 overflow-x-auto border-b border-white/10 px-2 pt-2" role="tablist" aria-label="Panele studia">
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
              <p className="text-[11px] text-gray-500">Zmiany słychać od razu — podczas odtwarzania i w odsłuchu mikrofonu. Nagranie zostaje surowe, więc brzmienie można poprawić w każdej chwili.</p>
            </div>
            <div className="space-y-2 rounded-xl border border-white/10 bg-[#15151f] p-3 text-xs">
              <p className="flex items-center gap-1 font-semibold"><Mic className="h-4 w-4 text-[#FF9500]" /> Mikrofon na żywo</p>
              <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)} onFocus={() => void refreshDevices()} className={`${sel} w-full`} aria-label="Wejście audio">
                <option value="">Domyślne wejście</option>
                {devices.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || "Wejście audio"}</option>)}
              </select>
              <div className="flex gap-2">
                <Button size="sm" onClick={micOn ? micOff : micOnFn} className="flex-1 text-white" style={{ background: micOn ? "#334155" : "linear-gradient(135deg,#FF6B00,#FF9500)" }}>
                  {micOn ? "Wyłącz mikrofon" : "Włącz mikrofon"}
                </Button>
                <button type="button" onClick={() => setMonitor((v) => !v)} className={`${btn} ${monitor ? "border-[#FF6B00] text-white" : ""}`} title="Słyszysz siebie z efektami — używaj słuchawek">
                  <Headphones className="h-3.5 w-3.5" /> Odsłuch
                </button>
              </div>
              <div className="h-2 w-full overflow-hidden rounded bg-black/50"><div ref={(el) => { if (el) meterRefs.current.set("mic", el); }} className="h-full w-0 bg-gradient-to-r from-emerald-400 via-yellow-300 to-red-500" /></div>
              <p className="text-gray-400">Nagrywasz na: <span className="text-white">{armed?.name ?? "— uzbrój ścieżkę (R)"}</span></p>
              <p className="text-[11px] text-gray-500">Odsłuch z efektami tylko w słuchawkach (inaczej będzie sprzężenie). Nagrywanie: ● — gra reszta projektu i metronom.</p>
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
              <button type="button" onClick={insertDrums} className={`${btn} border-[#FF6B00]/60`}><Plus className="h-3.5 w-3.5" /> Wstaw perkusję we wskaźniku</button>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
              <Piano className="h-4 w-4 text-[#a78bfa]" /> <span className="font-semibold">Harmonia</span>
              <label className="flex items-center gap-1 text-gray-400">Tonacja
                <select value={keyRoot} onChange={(e) => setKeyRoot(+e.target.value)} className={sel}>{NOTE_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}</select>
              </label>
              <label className="flex items-center gap-1 text-gray-400">Progresja
                <select value={progId} onChange={(e) => setProgId(e.target.value)} className={sel}>{PROGRESSIONS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
              </label>
              <button type="button" onClick={() => insertHarmony("chords")} className={btn}><Plus className="h-3.5 w-3.5" /> Akordy (pad)</button>
              <button type="button" onClick={() => insertHarmony("bass")} className={btn}><Plus className="h-3.5 w-3.5" /> Linia basu</button>
            </div>
            <p className="text-[11px] text-gray-500">Instrumenty grają w tempie projektu ({project.bpm} BPM) i wstawiają się jako nowe ścieżki od wskaźnika (zaokrąglone do taktu).</p>
          </div>
        )}

        {panel === "ai" && (
          <div className="grid gap-4 text-xs lg:grid-cols-2">
            <div className="space-y-2 rounded-xl border border-white/10 bg-[#15151f] p-3">
              <p className="flex items-center gap-1 font-semibold"><Sparkles className="h-4 w-4 text-[#FFD400]" /> Podkład AI (Suno, bez wokalu)</p>
              <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} rows={2} placeholder="np. melancholijny hip-hop, pianino i smyczki, 90 BPM" className="w-full rounded-md border border-white/10 bg-black/40 p-2 text-white" />
              <Button size="sm" onClick={aiBacking} disabled={!!busy} className="text-white" style={{ background: "linear-gradient(135deg,#FF6B00,#FFD400)" }}>Stwórz podkład</Button>
              <p className="text-[11px] text-gray-500">Podkład trafia na nową ścieżkę, a tempo projektu dopasowuje się samo. Potem nagraj na nim swój głos.</p>
            </div>
            <div className="space-y-2 rounded-xl border border-white/10 bg-[#15151f] p-3">
              <p className="font-semibold">Twoje utwory</p>
              <select value={songUrl} onChange={(e) => setSongUrl(e.target.value)} className={`${sel} w-full`}>
                <option value="">— wybierz —</option>
                {mySongs.map((s) => <option key={s.url} value={s.url}>{s.title}</option>)}
              </select>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={!songUrl || !!busy} onClick={() => importSong(false)} className={btn}><Plus className="h-3.5 w-3.5" /> Wstaw cały</button>
                <button type="button" disabled={!songUrl || !!busy} onClick={() => importSong(true)} className={btn}><Scissors className="h-3.5 w-3.5" /> Rozłóż na 4 ścieżki i wstaw</button>
              </div>
              <input ref={fileRef} type="file" accept="audio/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ""; }} />
              <button type="button" onClick={() => fileRef.current?.click()} className={btn}><Upload className="h-3.5 w-3.5" /> Wstaw plik z dysku (próbka, bit, nagranie)</button>
            </div>
          </div>
        )}

        {panel === "export" && (
          <div className="flex flex-wrap items-end gap-3 text-xs">
            <label className="text-gray-400">Tytuł
              <input value={exportTitle} onChange={(e) => setExportTitle(e.target.value)} className="mt-1 block w-60 rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-white" />
            </label>
            <button type="button" onClick={exportWav} disabled={!!busy} className={btn}><Download className="h-3.5 w-3.5" /> Pobierz miks WAV</button>
            <Button size="sm" onClick={saveAndRelease} disabled={!!busy} className="text-white" style={{ background: "linear-gradient(135deg,#16a34a,#22c55e)" }}>
              <Save className="mr-1 h-4 w-4" /> Zapisz w moich utworach + przygotuj do Spotify
            </Button>
            <p className="w-full text-[11px] text-gray-500">Miks liczony jest z pełną jakością (44,1 kHz) ze wszystkimi efektami. Zapisany utwór trafia do historii, do „Nowe” i przechodzi mastering GrouAI Studio (−14 LUFS) ze znaczkiem.</p>
          </div>
        )}
      </div>
    </section>
  );
}
