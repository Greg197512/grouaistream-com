// Okno „Gitara” w GrouAI Studio: gryf na żywo, akordy pod każdy strój i kapodaster, rytmy bicia i palcowania,
// brzmienie struny, wzmacniacz z efektami, gra z kontrolera MIDI i nagrywanie prosto na ścieżkę DAW.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Circle, Guitar, Loader2, Pause, Play, Square, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { chordShape, CHORD_TYPES, NOTE_NAMES, noteName, noteToFret, parseChord, STRUM_PATTERNS, TUNINGS, type StringVoice } from "@/lib/daw/guitar";
import { AMP_PRESETS, GUITAR_TYPES, GuitarEngine, InstrumentRecorder, type AmpSettings } from "@/lib/daw/instruments";
import { DAW_BPM_EVENT, dawBpm, getCtx, sendToDaw, studioBus } from "@/lib/daw/context";
import { isLowPowerDevice } from "@/lib/perf";
import { Knob } from "./Knob";
import { useMidi } from "./useMidi";

const FRETS = 15;
const W = 1000, NUT = 64, END = 984;
const INLAYS = [3, 5, 7, 9, 15];
const fretX = (f: number) => NUT + (END - NUT) * (1 - Math.pow(2, -f / 12)) / (1 - Math.pow(2, -FRETS / 12));
const cellX = (f: number) => (f === 0 ? NUT - 22 : (fretX(f - 1) + fretX(f)) / 2);

const PROGRESSION_PRESETS = [
  { label: "Pop", chords: "C G Am F" },
  { label: "Ballada", chords: "Am F C G" },
  { label: "Rock", chords: "E D A A" },
  { label: "Andaluzja", chords: "Am G F E" },
  { label: "Blues 12 taktów", chords: "A7 A7 A7 A7 D7 D7 A7 A7 E7 D7 A7 E7" },
  { label: "Jazz ii–V–I", chords: "Dm7 G7 Cmaj7 Cmaj7" },
  { label: "Reggae", chords: "C F G F" },
  { label: "Power metal", chords: "E5 C5 D5 B5" },
];

type Settings = {
  typeId: string; capo: number; voice: StringVoice; vibratoDepth: number; vibratoRate: number; strumMs: number; twelve: boolean;
  ampId: string; amp: AmpSettings; progression: string; patternId: string; swing: number; dynamics: number; syncBpm: boolean; showNotes: boolean;
};
const STORE_KEY = "grouai-guitar-v1";
const defaults = (): Settings => ({
  typeId: "acoustic", capo: 0, voice: { ...GUITAR_TYPES[0].voice }, vibratoDepth: 0, vibratoRate: 5.5, strumMs: 28, twelve: false,
  ampId: "acoustic", amp: { ...AMP_PRESETS.acoustic.amp }, progression: "C G Am F", patternId: "pop", swing: 0, dynamics: 80, syncBpm: true, showNotes: false,
});
function loadSettings(): Settings {
  try { const s = localStorage.getItem(STORE_KEY); if (s) return { ...defaults(), ...JSON.parse(s) }; } catch { /* brak dostępu do pamięci */ }
  return defaults();
}

type Props = { active: boolean; tuningId: string; onTuning: (id: string) => void };

export function GuitarStudio({ active, tuningId, onTuning }: Props) {
  const [s, setS] = useState<Settings>(loadSettings);
  const set = useCallback(<K extends keyof Settings>(k: K, v: Settings[K]) => setS((p) => ({ ...p, [k]: v })), []);
  const [root, setRoot] = useState(0);
  const [ctype, setCtype] = useState("");
  const [bpm, setBpm] = useState(dawBpm());
  const [playing, setPlaying] = useState(false);
  const [cursor, setCursor] = useState({ bar: -1, step: -1 });
  const [recording, setRecording] = useState(false);
  const [autoBars, setAutoBars] = useState(0); // >0 = nagrywanie N taktów progresji
  const [repeats, setRepeats] = useState(2);
  const low = useMemo(() => isLowPowerDevice(), []);

  const tuning = (TUNINGS.find((t) => t.id === tuningId) ?? TUNINGS[0]).strings;
  const n = tuning.length;
  const H = 46 + (n - 1) * 30;
  const yOf = (sIdx: number) => 24 + (n - 1 - sIdx) * 30; // wysoka struna u góry, jak w tabulaturze

  const chordName = `${NOTE_NAMES[root]}${ctype}`;
  const shape = useMemo(() => chordShape(chordName, tuning, s.capo), [chordName, tuning, s.capo]);
  const progression = useMemo(() => s.progression.split(/[\s,|]+/).filter(Boolean).map((c) => ({ name: c, shape: chordShape(c, tuning, s.capo) })), [s.progression, tuning, s.capo]);
  const pattern = STRUM_PATTERNS.find((p) => p.id === s.patternId) ?? STRUM_PATTERNS[0];

  const engineRef = useRef<GuitarEngine | null>(null);
  const recRef = useRef<InstrumentRecorder | null>(null);
  const seqRef = useRef<{ timer: number; next: number; step: number; stopAtStep: number } | null>(null);
  const stringRefs = useRef<(SVGGElement | null)[]>([]);
  const dotRefs = useRef<(SVGCircleElement | null)[]>([]);
  const padRefs = useRef<(HTMLDivElement | null)[]>([]);
  const live = useRef({ s, tuning, progression, pattern, bpm, shape, n });
  live.current = { s, tuning, progression, pattern, bpm, shape, n };

  useEffect(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch { /* tryb prywatny */ } }, [s]);
  useEffect(() => {
    if (!s.syncBpm) return;
    const on = (e: Event) => setBpm((e as CustomEvent<number>).detail);
    setBpm(dawBpm());
    window.addEventListener(DAW_BPM_EVENT, on);
    return () => window.removeEventListener(DAW_BPM_EVENT, on);
  }, [s.syncBpm]);

  // Animacja struny i punktu na gryfie (bez re-renderów Reacta).
  const animate = useCallback((stringIdx: number, fret: number, velocity: number) => {
    const g = stringRefs.current[stringIdx];
    if (g) { g.classList.remove("gs-ring"); void g.getBoundingClientRect(); g.style.setProperty("--gs-amp", `${0.6 + velocity * 1.6}px`); g.classList.add("gs-ring"); }
    const d = dotRefs.current[stringIdx];
    if (d) { d.setAttribute("cx", String(cellX(fret))); d.classList.remove("gs-pop"); void d.getBoundingClientRect(); d.classList.add("gs-pop"); }
    const p = padRefs.current[stringIdx];
    if (p) { p.classList.remove("gs-pad-ring"); void p.offsetWidth; p.classList.add("gs-pad-ring"); }
  }, []);

  const engine = useCallback(async () => {
    const ctx = getCtx();
    if (ctx.state !== "running") await ctx.resume();
    if (!engineRef.current) {
      const cur = live.current.s;
      engineRef.current = new GuitarEngine(ctx, studioBus().input, cur.amp, { voice: cur.voice, twelve: cur.twelve, vibratoDepth: cur.vibratoDepth, vibratoRate: cur.vibratoRate, strumMs: cur.strumMs });
      engineRef.current.onPluck = animate;
    }
    return engineRef.current;
  }, [animate]);

  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    e.opts = { ...e.opts, voice: s.voice, twelve: s.twelve, strumMs: s.strumMs };
    e.setVibrato(s.vibratoDepth, s.vibratoRate);
  }, [s.voice, s.twelve, s.strumMs, s.vibratoDepth, s.vibratoRate]);
  useEffect(() => { engineRef.current?.amp.set(s.amp); }, [s.amp]);

  const playNote = async (stringIdx: number, fret: number, velocity = 0.85) => {
    const e = await engine();
    const f = Math.max(fret, s.capo);
    e.pluck(stringIdx, tuning[stringIdx] + f, velocity, undefined, undefined, f, n);
  };
  const strum = async (dir: "D" | "U" | "X", frets: number[] | null = shape) => {
    if (!frets) return;
    const e = await engine();
    e.strum(frets, tuning, dir, s.dynamics / 100);
  };

  // ── Progresja (planowanie z wyprzedzeniem na zegarze audio) ────────────────
  const stopSeq = useCallback(() => {
    if (seqRef.current) window.clearInterval(seqRef.current.timer);
    seqRef.current = null;
    setPlaying(false);
    setCursor({ bar: -1, step: -1 });
  }, []);

  const finishRecording = useCallback(() => {
    const r = recRef.current;
    recRef.current = null;
    setRecording(false);
    setAutoBars(0);
    const buf = r?.stop();
    if (!buf) { toast.error("Nic nie zostało nagrane — zagraj coś na gitarze."); return; }
    const type = GUITAR_TYPES.find((t) => t.id === live.current.s.typeId);
    sendToDaw({ name: `Gitara — ${type?.label ?? "nagranie"}`, buffer: buf, kind: "instrument" });
  }, []);

  const startSeq = useCallback(async (stopAfterBars = 0) => {
    const e = await engine();
    const ctx = getCtx();
    stopSeq();
    const seq = { timer: 0, next: ctx.currentTime + 0.12, step: 0, stopAtStep: stopAfterBars * 8 };
    const tick = () => {
      const L = live.current;
      const eighth = 60 / L.bpm / 2;
      while (seq.next < ctx.currentTime + 0.15) {
        if (seq.stopAtStep && seq.step >= seq.stopAtStep) {
          const endAt = seq.next + 1.5;
          window.clearInterval(seq.timer);
          seqRef.current = null;
          window.setTimeout(() => { setPlaying(false); setCursor({ bar: -1, step: -1 }); finishRecording(); }, (endAt - ctx.currentTime) * 1000);
          return;
        }
        const bar = Math.floor(seq.step / 8), k = seq.step % 8;
        const chord = L.progression[bar % Math.max(1, L.progression.length)];
        const sym = L.pattern.steps[k];
        const when = seq.next + (k % 2 === 1 ? eighth * (L.s.swing / 100) * 0.66 : 0);
        if (chord?.shape) {
          const vel = (L.s.dynamics / 100) * (k === 0 ? 1 : k % 2 ? 0.78 : 0.9);
          if (k === 0 && /\d/.test(sym)) e.chokeAll(when);
          if (sym === "D" || sym === "U" || sym === "X") e.strum(chord.shape, L.tuning, sym, vel, when);
          else if (/\d/.test(sym)) {
            const played = chord.shape.map((f, i) => i).filter((i) => chord.shape![i] >= 0);
            const sIdx = played[Number(sym) % played.length];
            e.pluck(sIdx, L.tuning[sIdx] + chord.shape[sIdx], vel, when, undefined, chord.shape[sIdx], L.n);
          }
        }
        const delay = Math.max(0, (when - ctx.currentTime) * 1000);
        window.setTimeout(() => setCursor({ bar: bar % Math.max(1, L.progression.length), step: k }), delay);
        seq.step++;
        seq.next += eighth;
      }
    };
    seq.timer = window.setInterval(tick, 25);
    seqRef.current = seq;
    tick();
    setPlaying(true);
  }, [engine, stopSeq, finishRecording]);

  useEffect(() => () => { if (seqRef.current) window.clearInterval(seqRef.current.timer); }, []);
  useEffect(() => { if (!active && seqRef.current && !recRef.current) stopSeq(); }, [active, stopSeq]);

  const toggleRecord = async () => {
    if (recRef.current) { stopSeq(); finishRecording(); return; }
    const e = await engine();
    const r = new InstrumentRecorder(getCtx(), e.amp.output);
    await r.start();
    recRef.current = r;
    setRecording(true);
  };

  const recordProgression = async () => {
    if (!progression.some((c) => c.shape)) { toast.error("Wpisz akordy progresji, np. C G Am F"); return; }
    const e = await engine();
    const r = new InstrumentRecorder(getCtx(), e.amp.output);
    await r.start();
    recRef.current = r;
    setRecording(true);
    const bars = progression.length * repeats;
    setAutoBars(bars);
    await startSeq(bars);
  };

  // ── Typ gitary ────────────────────────────────────────────────────────────
  const chooseType = (id: string) => {
    const t = GUITAR_TYPES.find((x) => x.id === id)!;
    setS((p) => ({ ...p, typeId: id, voice: { ...t.voice }, twelve: !!t.twelve, ampId: t.amp, amp: { ...AMP_PRESETS[t.amp].amp } }));
    const isBass = (tid: string) => tid.startsWith("bass");
    if (t.tuning) onTuning(t.tuning);
    else if (isBass(tuningId) || tuningId === "seven") onTuning("standard");
  };
  const setVoice = (patch: Partial<StringVoice>) => setS((p) => ({ ...p, voice: { ...p.voice, ...patch } }));
  const setAmp = (patch: Partial<AmpSettings>) => setS((p) => ({ ...p, amp: { ...p.amp, ...patch } }));

  // ── MIDI: nuta → najwygodniejsza struna/próg; pitch bend = podciągnięcie; kółko = vibrato ──
  const midi = useMidi(active, (ev) => {
    void engine().then((e) => {
      const L = live.current;
      if (ev.type === "on") {
        const pos = noteToFret(ev.note, L.tuning, L.s.capo, 22);
        if (pos) e.pluck(pos.string, ev.note, ev.velocity, undefined, undefined, Math.min(pos.fret, FRETS), L.n);
      } else if (ev.type === "bend") e.setBend(ev.value * 200);
      else if (ev.type === "cc" && ev.cc === 1) e.setVibrato(ev.value * 45, L.s.vibratoRate);
    });
  });

  // ── Klawiatura komputera ──────────────────────────────────────────────────
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.repeat || (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable))) return;
      const k = e.key.toLowerCase();
      if (k === "arrowdown" || k === "j") { e.preventDefault(); void strum("D"); }
      else if (k === "arrowup" || k === "k") { e.preventDefault(); void strum("U"); }
      else if (k === "m") void strum("X");
      else if (/^[1-9]$/.test(k)) {
        const c = live.current.progression[Number(k) - 1];
        if (c?.shape) { const p = parseChord(c.name); if (p) { setRoot(p.root); setCtype(p.type); } void strum("D", c.shape); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ── Pad do bicia: przesuń palcem/myszą przez struny ───────────────────────
  const padLast = useRef<number | null>(null);
  const padTouch = (e: React.PointerEvent<HTMLDivElement>, down = false) => {
    if (!down && e.buttons === 0 && e.pointerType === "mouse") { padLast.current = null; return; }
    const r = e.currentTarget.getBoundingClientRect();
    const idx = n - 1 - Math.min(n - 1, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * n)));
    if (padLast.current === idx) return;
    const from = padLast.current;
    padLast.current = idx;
    if (!shape) return;
    const list = from === null ? [idx] : Array.from({ length: Math.abs(idx - from) }, (_, i) => (idx > from ? from + 1 + i : from - 1 - i));
    void engine().then((eng) => list.forEach((sIdx, i) => {
      if (shape[sIdx] >= 0) eng.pluck(sIdx, tuning[sIdx] + shape[sIdx], s.dynamics / 100, getCtx().currentTime + i * 0.006, undefined, shape[sIdx], n);
    }));
  };

  const type = GUITAR_TYPES.find((t) => t.id === s.typeId) ?? GUITAR_TYPES[0];
  const sel = "h-9 rounded-lg border border-white/10 bg-[#0f0f1e] px-2 text-xs text-white";

  return (
    <div className="space-y-4">
      <style>{`
        @keyframes gs-vibe { 0%{transform:translateY(0)} 10%{transform:translateY(var(--gs-amp))} 20%{transform:translateY(calc(var(--gs-amp)*-1))} 30%{transform:translateY(calc(var(--gs-amp)*.7))} 40%{transform:translateY(calc(var(--gs-amp)*-.6))} 55%{transform:translateY(calc(var(--gs-amp)*.35))} 70%{transform:translateY(calc(var(--gs-amp)*-.2))} 100%{transform:translateY(0)} }
        @keyframes gs-glow { 0%{opacity:1} 100%{opacity:0} }
        @keyframes gs-pop { 0%{opacity:1; r:11} 100%{opacity:0; r:20} }
        .gs-ring .gs-str { animation: gs-vibe .45s linear; }
        .gs-ring .gs-halo { animation: gs-glow 1.2s ease-out forwards; }
        .gs-pop { animation: gs-pop .7s ease-out forwards; }
        .gs-pad-ring { animation: gs-glow .9s ease-out; }
        [data-lowpower="on"] .gs-ring .gs-str { animation: none; }
      `}</style>

      {/* Nagłówek: aktualny akord, takt i krok rytmu */}
      <div className="relative overflow-hidden rounded-2xl border border-[#FF9500]/25 bg-gradient-to-br from-[#2a1608] via-[#16101a] to-[#0d0d18] p-4">
        <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-[#FF6B00]/20 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF9500] to-[#FF3D00] shadow-[0_0_30px_rgba(255,120,0,0.45)]">
            <Guitar className="h-8 w-8 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FFB060]">{type.label}{s.capo ? ` · kapodaster ${s.capo}` : ""}</p>
            <p className="text-4xl font-black leading-none text-white" style={{ textShadow: "0 0 24px rgba(255,149,0,0.55)" }}>
              {playing && cursor.bar >= 0 ? progression[cursor.bar]?.name : chordName}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1.5" aria-label="Krok rytmu">
            {pattern.steps.map((st, i) => (
              <div key={i} className={`flex h-9 w-7 items-center justify-center rounded-md text-xs font-black transition-colors ${cursor.step === i ? "bg-[#FFD400] text-black shadow-[0_0_14px_#FFD400]" : st === "-" ? "bg-white/5 text-gray-600" : "bg-white/10 text-gray-200"}`}>
                {st === "D" ? "↓" : st === "U" ? "↑" : st === "X" ? "×" : st === "-" ? "·" : Number(st) + 1}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Wybór gitary, stroju, kapodastera */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-[11px] text-gray-400">Gitara
          <select className={`${sel} block w-56`} value={s.typeId} onChange={(e) => chooseType(e.target.value)}>
            {GUITAR_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-[11px] text-gray-400">Strój
          <select className={`${sel} block w-56`} value={tuningId} onChange={(e) => onTuning(e.target.value)}>
            {TUNINGS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-[11px] text-gray-400">Kapodaster: {s.capo ? `próg ${s.capo}` : "brak"}
          <input type="range" min={0} max={12} value={s.capo} onChange={(e) => set("capo", Number(e.target.value))} className="block w-40 accent-[#FF9500]" />
        </label>
        <label className="flex items-center gap-2 pb-2 text-xs text-gray-300">
          <input type="checkbox" checked={s.showNotes} onChange={(e) => set("showNotes", e.target.checked)} className="accent-[#FF9500]" /> Nazwy dźwięków na gryfie
        </label>
        <p className="pb-2 text-[11px] text-gray-500">
          {midi.devices.length ? <span className="text-emerald-300">MIDI: {midi.devices.join(", ")}</span> : midi.error || "Podłącz klawiaturę MIDI albo graj myszą / palcem"}
        </p>
      </div>

      {/* Gryf */}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0b0b14] p-2 shadow-[inset_0_0_40px_rgba(0,0,0,0.6)]">
        <svg viewBox={`0 0 ${W} ${H}`} className="block min-w-[760px] w-full select-none" role="img" aria-label="Gryf gitary — kliknij próg, aby zagrać">
          <defs>
            <linearGradient id="gsWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4a2c17" /><stop offset="50%" stopColor="#3a2111" /><stop offset="100%" stopColor="#2b170b" /></linearGradient>
            <linearGradient id="gsWound" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f0c98a" /><stop offset="100%" stopColor="#9a6a2c" /></linearGradient>
            <linearGradient id="gsPlain" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffffff" /><stop offset="100%" stopColor="#9aa0ad" /></linearGradient>
            <filter id="gsBlur"><feGaussianBlur stdDeviation="3" /></filter>
          </defs>
          <rect x={NUT} y={8} width={END - NUT} height={H - 16} rx={4} fill="url(#gsWood)" />
          {INLAYS.map((f) => <circle key={f} cx={cellX(f)} cy={H / 2} r={7} fill="#e8dcc8" opacity={0.55} />)}
          <circle cx={cellX(12)} cy={H / 2 - 30} r={7} fill="#e8dcc8" opacity={0.55} />
          <circle cx={cellX(12)} cy={H / 2 + 30} r={7} fill="#e8dcc8" opacity={0.55} />
          <rect x={NUT - 7} y={6} width={9} height={H - 12} rx={2} fill="#efe6d2" />
          {Array.from({ length: FRETS }, (_, i) => i + 1).map((f) => (
            <g key={f}>
              <line x1={fretX(f)} y1={8} x2={fretX(f)} y2={H - 8} stroke="#c9ccd6" strokeWidth={3} />
              <text x={cellX(f)} y={H - 1} textAnchor="middle" fontSize={10} fill="#6b6b80">{f}</text>
            </g>
          ))}
          {s.capo > 0 && <rect x={fretX(s.capo) - 11} y={2} width={14} height={H - 4} rx={6} fill="#1d1d26" stroke="#FF9500" strokeWidth={2} />}
          {/* Struny */}
          {tuning.map((open, sIdx) => {
            const y = yOf(sIdx);
            const thick = 1.1 + (n - 1 - sIdx) * (n > 6 ? 0.45 : 0.55) + (open < 36 ? 1 : 0);
            return (
              <g key={`${tuningId}-${sIdx}`} ref={(el) => (stringRefs.current[sIdx] = el)}>
                <line className="gs-halo" x1={NUT} y1={y} x2={END} y2={y} stroke="#FFB040" strokeWidth={thick + 6} opacity={0} filter={low ? undefined : "url(#gsBlur)"} />
                <line className="gs-str" x1={NUT - 30} y1={y} x2={END} y2={y} stroke={sIdx < n - 2 || open < 50 ? "url(#gsWound)" : "url(#gsPlain)"} strokeWidth={thick} />
                <text x={10} y={y + 4} fontSize={12} fontWeight={700} fill="#FFB060">{noteName(open).replace(/\d+$/, "")}</text>
              </g>
            );
          })}
          {/* Chwyt bieżącego akordu */}
          {shape?.map((f, sIdx) => (
            f < 0
              ? <text key={sIdx} x={NUT - 22} y={yOf(sIdx) + 5} textAnchor="middle" fontSize={15} fontWeight={800} fill="#ff5a5a">×</text>
              : f === s.capo
                ? <circle key={sIdx} cx={s.capo ? cellX(s.capo) : NUT - 22} cy={yOf(sIdx)} r={7} fill="none" stroke="#7CFFB2" strokeWidth={2.5} />
                : <circle key={sIdx} cx={cellX(f)} cy={yOf(sIdx)} r={10} fill="#FF9500" stroke="#fff" strokeWidth={1.5} style={{ filter: low ? undefined : "drop-shadow(0 0 6px #FF9500)" }} />
          ))}
          {s.showNotes && tuning.map((open, sIdx) => Array.from({ length: FRETS + 1 }, (_, f) => (
            <text key={`${sIdx}-${f}`} x={cellX(f)} y={yOf(sIdx) - 6} textAnchor="middle" fontSize={8.5} fill="#cfd3ff" opacity={0.75} pointerEvents="none">
              {NOTE_NAMES[(open + f) % 12]}
            </text>
          )))}
          {/* Punkty uderzenia (animowane) */}
          {tuning.map((_, sIdx) => <circle key={`d${sIdx}`} ref={(el) => (dotRefs.current[sIdx] = el)} cx={-50} cy={yOf(sIdx)} r={11} fill="#FFD400" opacity={0} pointerEvents="none" />)}
          {/* Pola kliknięć */}
          {tuning.map((_, sIdx) => Array.from({ length: FRETS + 1 }, (_, f) => (
            <rect key={`h${sIdx}-${f}`} x={f === 0 ? 0 : fretX(f - 1)} y={yOf(sIdx) - 15} width={f === 0 ? NUT : fretX(f) - fretX(f - 1)} height={30}
              fill="transparent" className="cursor-pointer hover:fill-white/5" onPointerDown={() => void playNote(sIdx, f)}>
              <title>{`${noteName(tuning[sIdx] + Math.max(f, s.capo))} — struna ${n - sIdx}, próg ${f}`}</title>
            </rect>
          )))}
        </svg>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Akordy */}
        <section className="space-y-3 rounded-2xl border border-white/10 bg-[#141420]/80 p-4">
          <h4 className="text-sm font-bold text-white">Biblioteka akordów</h4>
          <div className="flex flex-wrap gap-1">
            {NOTE_NAMES.map((nm, i) => (
              <button key={nm} type="button" onClick={() => setRoot(i)} className={`h-8 min-w-9 rounded-lg px-2 text-xs font-bold transition ${root === i ? "bg-[#FF9500] text-black" : "bg-white/5 text-gray-300 hover:bg-white/10"}`}>{nm}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(CHORD_TYPES).map(([id, t]) => (
              <button key={id || "maj"} type="button" onClick={() => setCtype(id)} className={`h-8 rounded-lg px-2.5 text-xs font-semibold transition ${ctype === id ? "bg-[#9333EA] text-white" : "bg-white/5 text-gray-300 hover:bg-white/10"}`}>{t.label}</button>
            ))}
          </div>
          {!shape && <p className="text-xs text-amber-300">Tego akordu nie da się wygodnie chwycić w tym stroju — wybierz inny strój albo przesuń kapodaster.</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => void strum("D")} className="gap-1 bg-[#FF9500] font-bold text-black hover:bg-[#FFB040]"><ChevronDown className="h-4 w-4" /> W dół</Button>
            <Button size="sm" onClick={() => void strum("U")} variant="outline" className="gap-1 border-[#FF9500]/40 text-gray-200"><ChevronUp className="h-4 w-4" /> W górę</Button>
            <Button size="sm" onClick={() => void strum("X")} variant="outline" className="gap-1 border-white/15 text-gray-300"><X className="h-4 w-4" /> Stłumione</Button>
            <Button size="sm" variant="ghost" onClick={() => set("progression", `${s.progression} ${chordName}`.trim())} className="text-[#FFB060]">+ do progresji</Button>
          </div>
          {/* Pad do bicia */}
          <div
            className="relative h-32 touch-none cursor-crosshair overflow-hidden rounded-xl border border-[#FF9500]/25 bg-gradient-to-b from-[#1b1209] to-[#0f0a06]"
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); padLast.current = null; padTouch(e, true); }}
            onPointerMove={(e) => padTouch(e)}
            onPointerUp={() => { padLast.current = null; }}
            aria-label="Pad do bicia — przeciągnij przez struny"
          >
            {tuning.map((_, sIdx) => (
              <div key={sIdx} className="absolute left-0 right-0" style={{ top: `${((n - 1 - sIdx + 0.5) / n) * 100}%` }}>
                <div className="h-px w-full bg-gradient-to-r from-transparent via-[#e0b87a] to-transparent" style={{ height: 1 + (n - 1 - sIdx) * 0.4 }} />
                <div ref={(el) => (padRefs.current[sIdx] = el)} className="absolute inset-x-0 -top-1.5 h-3 bg-[#FFB040]/50 opacity-0 blur-[3px]" />
              </div>
            ))}
            <span className="pointer-events-none absolute bottom-1.5 right-2 text-[10px] text-gray-500">Przeciągnij przez struny · klawisze ↓ ↑ (J/K), M = stłumione, 1–9 = akord z progresji</span>
          </div>
        </section>

        {/* Progresja i rytm */}
        <section className="space-y-3 rounded-2xl border border-white/10 bg-[#141420]/80 p-4">
          <h4 className="text-sm font-bold text-white">Progresja i rytm</h4>
          <input value={s.progression} onChange={(e) => set("progression", e.target.value)} placeholder="np. C G Am F" className="h-10 w-full rounded-lg border border-white/10 bg-[#0f0f1e] px-3 font-mono text-sm text-white" aria-label="Akordy progresji" />
          <div className="flex flex-wrap gap-1">
            {PROGRESSION_PRESETS.map((p) => <button key={p.label} type="button" onClick={() => set("progression", p.chords)} className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-gray-300 hover:bg-white/10">{p.label}</button>)}
          </div>
          <div className="flex flex-wrap gap-1">
            {progression.map((c, i) => (
              <span key={i} className={`rounded-md px-2 py-1 font-mono text-xs font-bold ${!c.shape ? "bg-red-500/20 text-red-300" : cursor.bar === i ? "bg-[#FFD400] text-black" : "bg-white/10 text-gray-200"}`}>{c.name}</span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 text-[11px] text-gray-400">
            <label className="space-y-1">Rytm
              <select className={`${sel} block w-full`} value={s.patternId} onChange={(e) => set("patternId", e.target.value)}>
                {STRUM_PATTERNS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </label>
            <label className="space-y-1">Tempo: {bpm} BPM
              <input type="range" min={50} max={200} value={bpm} onChange={(e) => { set("syncBpm", false); setBpm(Number(e.target.value)); }} className="block w-full accent-[#FF9500]" />
            </label>
            <label className="space-y-1">Swing: {s.swing}%
              <input type="range" min={0} max={60} value={s.swing} onChange={(e) => set("swing", Number(e.target.value))} className="block w-full accent-[#FF9500]" />
            </label>
            <label className="space-y-1">Siła uderzenia: {s.dynamics}%
              <input type="range" min={20} max={100} value={s.dynamics} onChange={(e) => set("dynamics", Number(e.target.value))} className="block w-full accent-[#FF9500]" />
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-300">
            <input type="checkbox" checked={s.syncBpm} onChange={(e) => set("syncBpm", e.target.checked)} className="accent-[#FF9500]" /> Tempo jak w projekcie DAW
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => (playing ? stopSeq() : void startSeq())} disabled={!!autoBars} className="gap-1.5 bg-gradient-to-r from-[#FF9500] to-[#FF3D00] font-bold text-white">
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{playing ? "Stop" : "Graj progresję"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => void toggleRecord()} disabled={!!autoBars} className={`gap-1.5 ${recording && !autoBars ? "border-red-500 bg-red-500/20 text-red-200" : "border-white/15 text-gray-200"}`}>
              {recording && !autoBars ? <Square className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5 fill-red-500 text-red-500" />}
              {recording && !autoBars ? "Zakończ i wstaw do DAW" : "Nagrywaj grę"}
            </Button>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={() => void recordProgression()} disabled={recording} className="gap-1.5 border-[#9333EA]/50 text-gray-200">
                {autoBars ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Circle className="h-3.5 w-3.5 fill-[#9333EA] text-[#9333EA]" />}
                {autoBars ? `Nagrywam ${autoBars} t.…` : "Nagraj progresję do DAW"}
              </Button>
              <select className={`${sel} h-8`} value={repeats} onChange={(e) => setRepeats(Number(e.target.value))} aria-label="Powtórzenia">
                {[1, 2, 4, 8].map((r) => <option key={r} value={r}>{r}×</option>)}
              </select>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        {/* Brzmienie struny */}
        <section className="space-y-3 rounded-2xl border border-white/10 bg-[#141420]/80 p-4">
          <h4 className="text-sm font-bold text-white">Struny i technika</h4>
          {([
            ["Jasność (kostka ↔ palce)", "brightness", 0, 1, 0.05],
            ["Miejsce uderzenia (mostek ↔ gryf)", "pickPos", 0.05, 0.5, 0.01],
            ["Wybrzmienie (sustain)", "sustain", 0, 1, 0.05],
          ] as const).map(([label, key, min, max, step]) => (
            <label key={key} className="block space-y-1 text-[11px] text-gray-400">{label}
              <input type="range" min={min} max={max} step={step} value={s.voice[key]} onChange={(e) => setVoice({ [key]: Number(e.target.value) })} className="block w-full accent-[#FF9500]" />
            </label>
          ))}
          <label className="block space-y-1 text-[11px] text-gray-400">Szybkość ruchu ręki: {s.strumMs} ms
            <input type="range" min={5} max={90} value={s.strumMs} onChange={(e) => set("strumMs", Number(e.target.value))} className="block w-full accent-[#FF9500]" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1 text-[11px] text-gray-400">Vibrato: {s.vibratoDepth} ct
              <input type="range" min={0} max={50} value={s.vibratoDepth} onChange={(e) => set("vibratoDepth", Number(e.target.value))} className="block w-full accent-[#FF9500]" />
            </label>
            <label className="block space-y-1 text-[11px] text-gray-400">Szybkość vibrato: {s.vibratoRate.toFixed(1)} Hz
              <input type="range" min={2} max={9} step={0.5} value={s.vibratoRate} onChange={(e) => set("vibratoRate", Number(e.target.value))} className="block w-full accent-[#FF9500]" />
            </label>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-gray-300">
            <label className="flex items-center gap-2"><input type="checkbox" checked={s.voice.palmMute} onChange={(e) => setVoice({ palmMute: e.target.checked })} className="accent-[#FF9500]" /> Tłumienie dłonią (palm mute)</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={s.twelve} onChange={(e) => set("twelve", e.target.checked)} className="accent-[#FF9500]" /> 12 strun (pary)</label>
          </div>
        </section>

        {/* Wzmacniacz */}
        <section className="space-y-3 rounded-2xl border-2 border-[#c9a45c]/40 bg-[repeating-linear-gradient(45deg,#17140f_0px,#17140f_3px,#1c1812_3px,#1c1812_6px)] p-4 shadow-[inset_0_2px_0_rgba(255,255,255,0.05)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-black uppercase tracking-[0.25em] text-[#e8c987]">GrouAI Amp</h4>
            <select className={sel} value={s.ampId} onChange={(e) => setS((p) => ({ ...p, ampId: e.target.value, amp: { ...AMP_PRESETS[e.target.value].amp } }))} aria-label="Ustawienie wzmacniacza">
              {Object.entries(AMP_PRESETS).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap justify-center gap-x-1 gap-y-3 rounded-xl bg-black/40 px-2 py-3">
            <Knob label="Gain" value={s.amp.drive} min={0} max={100} color="#FF3D00" defaultValue={0} onChange={(v) => setAmp({ drive: v })} />
            <Knob label="Bas" value={s.amp.bass} min={-12} max={12} unit=" dB" defaultValue={0} onChange={(v) => setAmp({ bass: v })} />
            <Knob label="Środek" value={s.amp.mid} min={-12} max={12} unit=" dB" defaultValue={0} onChange={(v) => setAmp({ mid: v })} />
            <Knob label="Góra" value={s.amp.treble} min={-12} max={12} unit=" dB" defaultValue={0} onChange={(v) => setAmp({ treble: v })} />
            <Knob label="Presence" value={s.amp.presence} min={-12} max={12} unit=" dB" defaultValue={0} onChange={(v) => setAmp({ presence: v })} />
            <Knob label="Kompr." value={s.amp.comp} min={0} max={100} defaultValue={0} onChange={(v) => setAmp({ comp: v })} />
            <Knob label="Głośność" value={s.amp.volume} min={0} max={100} color="#FFD400" defaultValue={75} onChange={(v) => setAmp({ volume: v })} />
          </div>
          <div className="flex flex-wrap justify-center gap-x-1 gap-y-3 rounded-xl bg-black/40 px-2 py-3">
            <Knob label="Chorus" value={s.amp.chorus} min={0} max={100} color="#38BDF8" defaultValue={0} onChange={(v) => setAmp({ chorus: v })} />
            <Knob label="Delay" value={s.amp.delay} min={0} max={100} color="#A78BFA" defaultValue={0} onChange={(v) => setAmp({ delay: v })} />
            <Knob label="Czas" value={s.amp.delayTime} min={60} max={1000} step={10} unit=" ms" color="#A78BFA" defaultValue={380} onChange={(v) => setAmp({ delayTime: v })} />
            <Knob label="Powtórz." value={s.amp.feedback} min={0} max={90} unit="%" color="#A78BFA" defaultValue={25} onChange={(v) => setAmp({ feedback: v })} />
            <Knob label="Pogłos" value={s.amp.reverb} min={0} max={100} color="#34D399" defaultValue={20} onChange={(v) => setAmp({ reverb: v })} />
            <label className="flex w-[70px] flex-col items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              <input type="checkbox" checked={s.amp.cabinet} onChange={(e) => setAmp({ cabinet: e.target.checked })} className="h-4 w-4 accent-[#e8c987]" /> Kolumna
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}
