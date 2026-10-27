// Warsztat ścieżek (Studio Pro): rozkładanie utworu na ścieżki, mikser, układanie
// kafelków (aranżacja takt po takcie), tworzenie sampli i padów, eksport do WAV.
// Całe przetwarzanie dźwięku w przeglądarce (Web Audio); rozdzielanie — funkcja studio-stems.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Scissors, Play, Square, Download, Upload, Loader2, Grid3x3, Wand2, Settings2, Save, Volume2, VolumeX, Headphones,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { uploadToR2 } from "@/lib/r2Upload";
import { startStems, waitForStems, type StemsMode } from "@/lib/hubStudio";
import { viaProxy } from "@/lib/releasePipeline";
import { encodeWav16 } from "@/lib/releasePrep";
import { isPersistentAudioUrl } from "@/lib/mirrorAudio";
import { barSeconds, cutSample, estimateBpm, peaks, runsOf, STEM_LABELS } from "@/lib/stemsWorkbench";

type Layer = {
  id: string;
  name: string;
  kind: "stem" | "sample";
  buffer: AudioBuffer;
  url?: string;
  gain: number;
  pan: number;
  mute: boolean;
  solo: boolean;
};
type Source = { title: string; url: string };
type Tab = "split" | "tiles" | "samples" | "settings";

const MODES: { id: StemsMode; label: string; hint: string }[] = [
  { id: "2", label: "2 ścieżki", hint: "wokal + akompaniament" },
  { id: "4", label: "4 ścieżki", hint: "wokal, perkusja, bas, reszta" },
  { id: "6", label: "6 ścieżek", hint: "+ gitara i pianino" },
];
const SAMPLE_BEATS = [0.25, 0.5, 1, 2, 4, 8];
const PAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8"];
const ROW_COLORS = ["#FF6B00", "#FFD400", "#22d3ee", "#a78bfa", "#34d399", "#f472b6", "#f87171", "#60a5fa"];
const LOST_HOST = "bmwtydwpevzhbdplilbr";

let sharedCtx: AudioContext | null = null;
const audioCtx = () => (sharedCtx ??= new AudioContext());

async function decode(url: string): Promise<AudioBuffer> {
  const r = await fetch(viaProxy(url));
  if (!r.ok) throw new Error(`Nie udało się pobrać ścieżki (HTTP ${r.status})`);
  return audioCtx().decodeAudioData(await r.arrayBuffer());
}

const channelsOf = (b: AudioBuffer) => Array.from({ length: b.numberOfChannels }, (_, c) => b.getChannelData(c));

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function StemsWorkbench({ active = true }: { active?: boolean } = {}) {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("split");
  const [sources, setSources] = useState<Source[]>([]);
  const [source, setSource] = useState<Source | null>(null);
  const [mode, setMode] = useState<StemsMode>("4");
  const [busy, setBusy] = useState<string>("");
  const [layers, setLayers] = useState<Layer[]>([]);
  const [cells, setCells] = useState<Record<string, boolean[]>>({});
  // Ustawienia
  const [bpm, setBpm] = useState(120);
  const [bars, setBars] = useState(16);
  const [startBar, setStartBar] = useState(0);
  const [offsetSec, setOffsetSec] = useState(0);
  const [loop, setLoop] = useState(true);
  const [metronome, setMetronome] = useState(false);
  const [master, setMaster] = useState(0.9);
  // Odtwarzanie
  const [playing, setPlaying] = useState(false);
  const [playCol, setPlayCol] = useState(-1);
  const nodesRef = useRef<AudioScheduledSourceNode[]>([]);
  const loopTimer = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  // Sample
  const [sampleFrom, setSampleFrom] = useState<string>("");
  const [sStart, setSStart] = useState(0);
  const [sBeats, setSBeats] = useState(1);
  const [sReverse, setSReverse] = useState(false);
  const [sPitch, setSPitch] = useState(0);
  const [sFadeIn, setSFadeIn] = useState(5);
  const [sFadeOut, setSFadeOut] = useState(30);
  const [sGain, setSGain] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const bar = barSeconds(bpm);
  const stems = layers.filter((l) => l.kind === "stem");
  const samples = layers.filter((l) => l.kind === "sample");
  const sampleSource = layers.find((l) => l.id === sampleFrom) ?? stems[0];

  // Utwory użytkownika z trwałym plikiem (R2) — do rozłożenia.
  useEffect(() => {
    if (!user) return;
    void supabase.from("generations").select("title, audio_url").eq("user_id", user.id)
      .eq("status", "completed").order("created_at", { ascending: false }).limit(40)
      .then(({ data }) => {
        setSources((data || [])
          .filter((g) => isPersistentAudioUrl(g.audio_url) && !g.audio_url!.includes(LOST_HOST))
          .map((g) => ({ title: g.title, url: g.audio_url! })));
      });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Siatka kafelków dopasowana do liczby taktów (nowe ścieżki włączone, sample — tylko 1. takt).
  useEffect(() => {
    setCells((prev) => {
      const next: Record<string, boolean[]> = {};
      for (const l of layers) {
        const old = prev[l.id] ?? [];
        next[l.id] = Array.from({ length: bars }, (_, i) => old[i] ?? (l.kind === "stem" || i === 0));
      }
      return next;
    });
  }, [layers, bars]);

  // ── Rozdzielanie ────────────────────────────────────────────────────────────
  const uploadOwn = async (file: File) => {
    if (!user) { toast.error("Zaloguj się, aby wgrać plik"); return; }
    setBusy("Wgrywam plik…");
    try {
      const { publicUrl } = await uploadToR2({ file, folder: `studio/${user.id}` });
      const s = { title: file.name.replace(/\.[^.]+$/, ""), url: publicUrl };
      setSources((p) => [s, ...p]);
      setSource(s);
    } catch (e) {
      toast.error(`Nie udało się wgrać pliku: ${e instanceof Error ? e.message : "błąd"}`);
    } finally {
      setBusy("");
    }
  };

  const setStemLayers = async (map: Record<string, string>) => {
    const entries = Object.entries(map);
    const loaded: Layer[] = [];
    for (const [i, [name, url]] of entries.entries()) {
      setBusy(`Wczytuję ścieżki ${i + 1}/${entries.length}…`);
      loaded.push({ id: `stem-${name}`, name: STEM_LABELS[name] ?? name, kind: "stem", buffer: await decode(url), url, gain: 1, pan: 0, mute: false, solo: false });
    }
    const forTempo = loaded.find((l) => l.id === "stem-drums") ?? loaded[0];
    if (forTempo) setBpm(estimateBpm(forTempo.buffer.getChannelData(0), forTempo.buffer.sampleRate));
    setLayers((prev) => [...loaded, ...prev.filter((l) => l.kind === "sample")]);
    setSampleFrom(loaded[0]?.id ?? "");
    setTab("tiles");
  };

  const split = async () => {
    if (!source) return;
    stop();
    try {
      setBusy("Rozkładam utwór na ścieżki… (zwykle 1–3 min)");
      const taskId = await startStems(source.url, mode);
      const map = await waitForStems(taskId, "workbench", (s) => setBusy(`Rozkładam utwór na ścieżki… ${s}s`));
      await setStemLayers(map);
      toast.success(`Gotowe: ${Object.keys(map).length} ścieżek`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rozdzielanie nie powiodło się");
    } finally {
      setBusy("");
    }
  };

  /** Bez rozdzielania (za darmo): cały utwór jako jedna ścieżka — do kafelków i sampli. */
  const useWhole = async () => {
    if (!source) return;
    try {
      await setStemLayers({ mix: source.url });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się wczytać utworu");
    } finally {
      setBusy("");
    }
  };

  // ── Aranżacja (wspólna dla odtwarzania i eksportu) ──────────────────────────
  const schedule = useCallback((ctx: BaseAudioContext, dest: AudioNode, t0: number, click: boolean) => {
    const out = ctx.createGain();
    out.gain.value = master;
    out.connect(dest);
    const anySolo = layers.some((l) => l.solo);
    const nodes: AudioScheduledSourceNode[] = [];
    for (const l of layers) {
      if (l.mute || (anySolo && !l.solo)) continue;
      const g = ctx.createGain();
      g.gain.value = l.gain;
      const p = ctx.createStereoPanner();
      p.pan.value = l.pan;
      g.connect(p).connect(out);
      const row = cells[l.id] ?? [];
      if (l.kind === "stem") {
        for (const [s, len] of runsOf(row)) {
          const from = offsetSec + (startBar + s) * bar;
          if (from >= l.buffer.duration) continue;
          const src = ctx.createBufferSource();
          src.buffer = l.buffer;
          src.connect(g);
          src.start(t0 + s * bar, from, len * bar);
          nodes.push(src);
        }
      } else {
        row.forEach((on, j) => {
          if (!on) return;
          const src = ctx.createBufferSource();
          src.buffer = l.buffer;
          src.connect(g);
          src.start(t0 + j * bar);
          nodes.push(src);
        });
      }
    }
    if (click) {
      for (let beat = 0; beat < bars * 4; beat++) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = beat % 4 === 0 ? 1500 : 1000;
        const t = t0 + beat * (bar / 4);
        g.gain.setValueAtTime(0.25, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 0.06);
        nodes.push(o);
      }
    }
    return nodes;
  }, [layers, cells, master, offsetSec, startBar, bar, bars]);

  const stop = useCallback(() => {
    for (const n of nodesRef.current) { try { n.stop(); } catch { /* już zatrzymany */ } }
    nodesRef.current = [];
    if (loopTimer.current) window.clearTimeout(loopTimer.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setPlaying(false);
    setPlayCol(-1);
  }, []);

  const play = useCallback(() => {
    if (!layers.length) return;
    stop();
    const ctx = audioCtx();
    void ctx.resume();
    const run = () => {
      const t0 = ctx.currentTime + 0.08;
      nodesRef.current = schedule(ctx, ctx.destination, t0, metronome);
      const tick = () => {
        const col = Math.floor((ctx.currentTime - t0) / bar);
        setPlayCol(col >= 0 && col < bars ? col : -1);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      loopTimer.current = window.setTimeout(() => (loop ? run() : stop()), (bars * bar + 0.08) * 1000);
    };
    setPlaying(true);
    run();
  }, [layers.length, stop, schedule, metronome, bar, bars, loop]);

  useEffect(() => () => stop(), [stop]);

  const renderArrangement = async (): Promise<Blob> => {
    const sr = 44_100;
    const off = new OfflineAudioContext(2, Math.ceil(bars * bar * sr), sr);
    schedule(off, off.destination, 0, false);
    const out = await off.startRendering();
    return new Blob([encodeWav16([out.getChannelData(0), out.getChannelData(1)], sr)], { type: "audio/wav" });
  };

  const exportWav = async () => {
    setBusy("Renderuję aranżację…");
    try {
      downloadBlob(await renderArrangement(), `${source?.title || "aranzacja"}_kafelki.wav`);
    } finally {
      setBusy("");
    }
  };

  const saveToStudio = async () => {
    if (!user) { toast.error("Zaloguj się, aby zapisać"); return; }
    setBusy("Zapisuję w Twoich utworach…");
    try {
      const title = `${source?.title || "Aranżacja"} (remiks)`;
      const blob = await renderArrangement();
      const { publicUrl } = await uploadToR2({ file: new File([blob], `${title.replace(/[^\p{L}\p{N}]+/gu, "_")}.wav`, { type: "audio/wav" }), folder: `studio/${user.id}` });
      await supabase.from("generations").insert({
        user_id: user.id, title, genre: "Remiks", prompt: "Warsztat ścieżek (kafelki)", instrumental: false,
        status: "completed", audio_url: publicUrl,
      });
      window.dispatchEvent(new CustomEvent("grouai:generations-changed"));
      toast.success(`„${title}” zapisany w Twoich utworach`);
    } catch (e) {
      toast.error(`Nie udało się zapisać: ${e instanceof Error ? e.message : "błąd"}`);
    } finally {
      setBusy("");
    }
  };

  const updateLayer = (id: string, patch: Partial<Layer>) =>
    setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const toggleCell = (id: string, j: number) =>
    setCells((c) => ({ ...c, [id]: (c[id] ?? []).map((v, i) => (i === j ? !v : v)) }));
  const setRow = (id: string, on: boolean) =>
    setCells((c) => ({ ...c, [id]: (c[id] ?? []).map(() => on) }));

  // ── Sample ─────────────────────────────────────────────────────────────────
  const sampleLength = sBeats * (60 / bpm);

  /** Wycinek z obróbką; wysokość (półtony) renderowana od razu, więc plik = to, co słychać. */
  const buildSample = async (): Promise<AudioBuffer | null> => {
    if (!sampleSource) return null;
    const b = sampleSource.buffer;
    const ch = cutSample(channelsOf(b), b.sampleRate, {
      start: sStart, length: sampleLength, reverse: sReverse, fadeInMs: sFadeIn, fadeOutMs: sFadeOut, gain: sGain,
    });
    const raw = audioCtx().createBuffer(ch.length, ch[0].length, b.sampleRate);
    ch.forEach((d, c) => raw.copyToChannel(d, c));
    if (sPitch === 0) return raw;
    const rate = Math.pow(2, sPitch / 12);
    const off = new OfflineAudioContext(raw.numberOfChannels, Math.ceil(raw.length / rate), raw.sampleRate);
    const src = off.createBufferSource();
    src.buffer = raw;
    src.playbackRate.value = rate;
    src.connect(off.destination);
    src.start();
    return off.startRendering();
  };

  const playBuffer = (b: AudioBuffer, gain = 1) => {
    const ctx = audioCtx();
    void ctx.resume();
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    g.gain.value = gain * master;
    src.buffer = b;
    src.connect(g).connect(ctx.destination);
    src.start();
  };

  const previewSample = async () => { const b = await buildSample(); if (b) playBuffer(b); };

  const addSample = async () => {
    const b = await buildSample();
    if (!b) return;
    if (samples.length >= PAD_KEYS.length) { toast.error("Masz już 8 padów — usuń któryś sampel"); return; }
    const n = samples.length + 1;
    setLayers((ls) => [...ls, { id: `sample-${Date.now()}`, name: `Sampel ${n}`, kind: "sample", buffer: b, gain: 1, pan: 0, mute: false, solo: false }]);
    toast.success(`Sampel ${n} dodany do padów i kafelków (klawisz ${n})`);
  };

  const downloadSample = async (b?: AudioBuffer, name = "sampel") => {
    const buf = b ?? (await buildSample());
    if (!buf) return;
    downloadBlob(new Blob([encodeWav16(channelsOf(buf), buf.sampleRate)], { type: "audio/wav" }), `${name}.wav`);
  };

  // Pady pod klawiszami 1–8 (poza polami tekstowymi).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (!active) return;
      const i = PAD_KEYS.indexOf(e.key);
      if (i >= 0 && samples[i]) playBuffer(samples[i].buffer, samples[i].gain);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samples, master, active]);

  // Fala źródła sampla z zaznaczonym wycinkiem.
  const wave = useMemo(() => (sampleSource ? peaks(sampleSource.buffer.getChannelData(0), 600) : null), [sampleSource]);
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !wave || !sampleSource) return;
    const g = cv.getContext("2d")!;
    const w = cv.width, h = cv.height, dur = sampleSource.buffer.duration;
    g.clearRect(0, 0, w, h);
    g.fillStyle = "rgba(255,107,0,0.12)";
    g.fillRect((sStart / dur) * w, 0, Math.max(2, (sampleLength / dur) * w), h);
    g.fillStyle = "#FF9500";
    wave.forEach((v, x) => { const y = v * h * 0.48; g.fillRect(x, h / 2 - y, 1, Math.max(1, y * 2)); });
  }, [wave, sampleSource, sStart, sampleLength, tab]);

  const TABS: { id: Tab; label: string; Icon: typeof Scissors }[] = [
    { id: "split", label: "Rozdziel", Icon: Scissors },
    { id: "tiles", label: "Kafelki", Icon: Grid3x3 },
    { id: "samples", label: "Sample", Icon: Wand2 },
    { id: "settings", label: "Ustawienia", Icon: Settings2 },
  ];
  const range = "w-full accent-[#FF6B00]";

  return (
    <section className="space-y-4 rounded-2xl border border-[#FF6B00]/25 bg-[#12121c]/80 p-4">
      <header className="flex flex-wrap items-center gap-2">
        <Scissors className="h-5 w-5 text-[#FF9500]" />
        <h3 className="text-lg font-extrabold text-white">Warsztat ścieżek</h3>
        <span className="text-xs text-gray-400">rozkładanie · kafelki · sample · eksport WAV</span>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" onClick={playing ? stop : play} disabled={!layers.length} className="font-bold text-white" style={{ background: "linear-gradient(135deg, #FF6B00, #FF9500)" }}>
            {playing ? <Square className="mr-1 h-4 w-4" /> : <Play className="mr-1 h-4 w-4" />}
            {playing ? "Stop" : "Graj aranżację"}
          </Button>
        </div>
      </header>

      <nav className="grid grid-cols-4 gap-1 border-b border-white/10 pb-2" role="tablist" aria-label="Warsztat ścieżek">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${tab === id ? "bg-[#FF6B00]/20 text-white" : "text-gray-400 hover:bg-white/5"}`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </nav>

      {busy && <p className="flex items-center gap-2 text-xs text-amber-300"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {busy}</p>}

      {tab === "split" && (
        <div className="space-y-3">
          <label className="block text-xs text-gray-400">
            Utwór
            <select
              value={source?.url ?? ""}
              onChange={(e) => setSource(sources.find((s) => s.url === e.target.value) ?? null)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#1a1a2e] px-2 py-2 text-sm text-white"
            >
              <option value="">— wybierz z Twoich utworów —</option>
              {sources.map((s) => <option key={s.url} value={s.url}>{s.title}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="audio/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadOwn(f); e.target.value = ""; }} />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={!!busy}>
              <Upload className="mr-1 h-4 w-4" /> Wgraj własny plik
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {MODES.map((m) => (
              <button
                key={m.id} type="button" onClick={() => setMode(m.id)}
                className={`rounded-xl border p-2 text-left text-xs transition-colors ${mode === m.id ? "border-[#FF6B00] bg-[#FF6B00]/15 text-white" : "border-white/10 text-gray-400 hover:border-[#FF6B00]/40"}`}
              >
                <span className="block font-bold">{m.label}</span>
                <span className="text-[11px]">{m.hint}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={split} disabled={!source || !!busy} className="font-bold text-white" style={{ background: "linear-gradient(135deg, #FF6B00, #FFD400)" }}>
              <Scissors className="mr-1 h-4 w-4" /> Rozłóż na ścieżki
            </Button>
            <Button variant="outline" onClick={useWhole} disabled={!source || !!busy}>
              Użyj całego utworu (bez rozkładania)
            </Button>
          </div>
          <p className="text-[11px] text-gray-500">Rozkładanie robi model Demucs (1–3 min). Gotowe ścieżki zapisują się na stałe i można je pobrać osobno.</p>
          {stems.length > 0 && (
            <ul className="space-y-1">
              {stems.map((l) => (
                <li key={l.id} className="flex items-center gap-2 text-xs text-gray-300">
                  <span className="flex-1 truncate">{l.name} · {l.buffer.duration.toFixed(0)} s</span>
                  {l.url && <a href={l.url} download className="inline-flex items-center gap-1 text-[#FF9500] hover:underline"><Download className="h-3.5 w-3.5" /> MP3</a>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "tiles" && (
        <div className="space-y-3">
          {!layers.length ? (
            <p className="text-sm text-gray-400">Najpierw rozłóż utwór albo wczytaj go w zakładce „Rozdziel”.</p>
          ) : (
            <>
              <p className="text-[11px] text-gray-500">
                Kafelek = 1 takt ({bar.toFixed(2)} s przy {bpm} BPM). Włącz/wyłącz kafelki, aby ułożyć własną wersję: np. wycisz wokal w refrenie
                albo dołóż sample. Siatka zaczyna się od taktu {startBar + 1} utworu (zmień w „Ustawieniach”).
              </p>
              <div className="overflow-x-auto">
                <table className="border-separate border-spacing-1 text-xs">
                  <tbody>
                    {layers.map((l, r) => (
                      <tr key={l.id}>
                        <th scope="row" className="sticky left-0 z-10 min-w-[150px] bg-[#12121c] pr-2 text-left font-semibold text-white">
                          <div className="flex items-center gap-1">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: ROW_COLORS[r % ROW_COLORS.length] }} />
                            <span className="truncate">{l.name}</span>
                            <button type="button" title={l.mute ? "Włącz" : "Wycisz"} onClick={() => updateLayer(l.id, { mute: !l.mute })} className="ml-auto text-gray-400 hover:text-white">
                              {l.mute ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                            </button>
                            <button type="button" title="Solo" onClick={() => updateLayer(l.id, { solo: !l.solo })} className={l.solo ? "text-[#FFD400]" : "text-gray-400 hover:text-white"}>
                              <Headphones className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="mt-1 flex items-center gap-1 text-[10px] font-normal text-gray-500">
                            <input aria-label={`Głośność: ${l.name}`} type="range" min={0} max={1.5} step={0.01} value={l.gain} onChange={(e) => updateLayer(l.id, { gain: +e.target.value })} className="w-16 accent-[#FF6B00]" />
                            <input aria-label={`Panorama: ${l.name}`} type="range" min={-1} max={1} step={0.05} value={l.pan} onChange={(e) => updateLayer(l.id, { pan: +e.target.value })} className="w-12 accent-[#22d3ee]" />
                            <button type="button" onClick={() => setRow(l.id, !(cells[l.id] ?? []).some(Boolean))} className="hover:text-white">
                              {(cells[l.id] ?? []).some(Boolean) ? "wył." : "wł."} wszystko
                            </button>
                          </div>
                        </th>
                        {(cells[l.id] ?? []).map((on, j) => (
                          <td key={j}>
                            <button
                              type="button" aria-label={`${l.name}, takt ${startBar + j + 1}`} aria-pressed={on}
                              onClick={() => toggleCell(l.id, j)}
                              className={`h-8 w-8 rounded-md border transition-all ${playCol === j ? "ring-2 ring-white/70" : ""}`}
                              style={on
                                ? { background: ROW_COLORS[r % ROW_COLORS.length], borderColor: "transparent", opacity: l.mute ? 0.35 : 0.9 }
                                : { background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr>
                      <td />
                      {Array.from({ length: bars }, (_, j) => (
                        <td key={j} className={`text-center text-[10px] tabular-nums ${playCol === j ? "text-white" : "text-gray-600"}`}>{startBar + j + 1}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={exportWav} disabled={!!busy}><Download className="mr-1 h-4 w-4" /> Pobierz WAV</Button>
                <Button size="sm" variant="outline" onClick={saveToStudio} disabled={!!busy}><Save className="mr-1 h-4 w-4" /> Zapisz w moich utworach</Button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "samples" && (
        <div className="space-y-3">
          {!stems.length ? (
            <p className="text-sm text-gray-400">Najpierw rozłóż utwór albo wczytaj go w zakładce „Rozdziel”.</p>
          ) : (
            <>
              <label className="block text-xs text-gray-400">
                Źródło sampla
                <select value={sampleSource?.id ?? ""} onChange={(e) => setSampleFrom(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#1a1a2e] px-2 py-2 text-sm text-white">
                  {stems.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </label>
              <canvas ref={canvasRef} width={600} height={80} className="h-20 w-full rounded-lg bg-black/40" />
              <label className="block text-xs text-gray-400">
                Początek: {sStart.toFixed(2)} s
                <input type="range" min={0} max={Math.max(0, (sampleSource?.buffer.duration ?? 0) - 0.05)} step={0.01} value={sStart} onChange={(e) => setSStart(+e.target.value)} className={range} />
              </label>
              <div className="flex flex-wrap items-center gap-1 text-xs text-gray-400">
                Długość:
                {SAMPLE_BEATS.map((b) => (
                  <button key={b} type="button" onClick={() => setSBeats(b)} className={`rounded-md border px-2 py-1 ${sBeats === b ? "border-[#FF6B00] text-white" : "border-white/10 hover:border-[#FF6B00]/40"}`}>
                    {b < 1 ? `1/${1 / b}` : b} {b === 1 ? "uderzenie" : b < 1 ? "" : b < 5 ? "uderzenia" : "uderzeń"}
                  </button>
                ))}
                <span className="tabular-nums text-gray-500">= {sampleLength.toFixed(2)} s</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-gray-400">Wysokość: {sPitch > 0 ? "+" : ""}{sPitch} półt.
                  <input type="range" min={-12} max={12} step={1} value={sPitch} onChange={(e) => setSPitch(+e.target.value)} className={range} />
                </label>
                <label className="text-xs text-gray-400">Głośność: {Math.round(sGain * 100)}%
                  <input type="range" min={0} max={2} step={0.05} value={sGain} onChange={(e) => setSGain(+e.target.value)} className={range} />
                </label>
                <label className="text-xs text-gray-400">Narastanie: {sFadeIn} ms
                  <input type="range" min={0} max={500} step={5} value={sFadeIn} onChange={(e) => setSFadeIn(+e.target.value)} className={range} />
                </label>
                <label className="text-xs text-gray-400">Wybrzmiewanie: {sFadeOut} ms
                  <input type="range" min={0} max={1000} step={10} value={sFadeOut} onChange={(e) => setSFadeOut(+e.target.value)} className={range} />
                </label>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-300">
                <input type="checkbox" checked={sReverse} onChange={(e) => setSReverse(e.target.checked)} className="accent-[#FF6B00]" /> Odwróć (reverse)
              </label>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={previewSample}><Play className="mr-1 h-4 w-4" /> Odsłuchaj</Button>
                <Button size="sm" onClick={addSample} className="font-bold text-white" style={{ background: "linear-gradient(135deg, #FF6B00, #FF9500)" }}>
                  <Wand2 className="mr-1 h-4 w-4" /> Dodaj do padów i kafelków
                </Button>
                <Button size="sm" variant="outline" onClick={() => void downloadSample()}><Download className="mr-1 h-4 w-4" /> Pobierz WAV</Button>
              </div>
            </>
          )}
          {samples.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-gray-400">Pady — kliknij albo naciśnij klawisz 1–8:</p>
              <div className="grid grid-cols-4 gap-2">
                {samples.map((s, i) => (
                  <div key={s.id} className="rounded-xl border border-white/10 bg-[#1a1a2e] p-2 text-center">
                    <button type="button" onClick={() => playBuffer(s.buffer, s.gain)} className="h-12 w-full rounded-lg font-extrabold text-white" style={{ background: ROW_COLORS[(stems.length + i) % ROW_COLORS.length] }}>
                      {PAD_KEYS[i]}
                    </button>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-gray-400">
                      <span className="truncate">{s.name}</span>
                      <button type="button" title="Pobierz" onClick={() => void downloadSample(s.buffer, s.name)} className="hover:text-white"><Download className="h-3 w-3" /></button>
                      <button type="button" title="Usuń" onClick={() => setLayers((ls) => ls.filter((x) => x.id !== s.id))} className="hover:text-red-300">×</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "settings" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-gray-400">Tempo: {bpm} BPM
            <input type="range" min={60} max={200} step={1} value={bpm} onChange={(e) => setBpm(+e.target.value)} className={range} />
          </label>
          <label className="text-xs text-gray-400">Liczba kafelków (taktów): {bars}
            <input type="range" min={4} max={32} step={4} value={bars} onChange={(e) => setBars(+e.target.value)} className={range} />
          </label>
          <label className="text-xs text-gray-400">Siatka od taktu: {startBar + 1}
            <input type="range" min={0} max={Math.max(0, Math.floor(((stems[0]?.buffer.duration ?? bar) - offsetSec) / bar) - 1)} step={1} value={startBar} onChange={(e) => setStartBar(+e.target.value)} className={range} />
          </label>
          <label className="text-xs text-gray-400">Przesunięcie początku (pierwsze uderzenie): {offsetSec.toFixed(2)} s
            <input type="range" min={0} max={Math.min(4, bar)} step={0.01} value={offsetSec} onChange={(e) => setOffsetSec(+e.target.value)} className={range} />
          </label>
          <label className="text-xs text-gray-400">Głośność główna: {Math.round(master * 100)}%
            <input type="range" min={0} max={1.2} step={0.01} value={master} onChange={(e) => setMaster(+e.target.value)} className={range} />
          </label>
          <div className="flex flex-col gap-2 text-xs text-gray-300">
            <label className="flex items-center gap-2"><input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} className="accent-[#FF6B00]" /> Zapętlaj aranżację</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={metronome} onChange={(e) => setMetronome(e.target.checked)} className="accent-[#FF6B00]" /> Metronom</label>
            <button
              type="button" disabled={!stems.length}
              onClick={() => { const l = stems.find((s) => s.id === "stem-drums") ?? stems[0]; if (l) setBpm(estimateBpm(l.buffer.getChannelData(0), l.buffer.sampleRate)); }}
              className="w-fit rounded-md border border-white/10 px-2 py-1 text-left hover:border-[#FF6B00]/40 disabled:opacity-40"
            >
              Wykryj tempo ponownie
            </button>
          </div>
          <p className="text-[11px] text-gray-500 sm:col-span-2">Zmiany działają od następnego odtworzenia aranżacji.</p>
        </div>
      )}
    </section>
  );
}
