// Okno „Instrumenty MIDI”: syntezator z brzmieniami (fortepian, Rhodes, organy, smyczki, pady…), gitara i perkusja GM.
// Gra z kontrolera MIDI, klawiatury komputera albo palcem; pitch bend, modulacja, sustain, efekty i nagrywanie do DAW.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, Piano, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { noteName, noteToFret, TUNINGS } from "@/lib/daw/guitar";
import { AMP_PRESETS, GM_DRUMS, GuitarEngine, InstrumentRecorder, playDrum, PolySynth, SYNTH_PRESETS, type AmpSettings, type MidiEvent } from "@/lib/daw/instruments";
import { getCtx, sendToDaw, studioBus } from "@/lib/daw/context";
import { isLowPowerDevice } from "@/lib/perf";
import { Knob } from "./Knob";
import { useMidi } from "./useMidi";

const INSTRUMENTS = [...SYNTH_PRESETS.map((p) => ({ id: p.id, label: p.label })), { id: "guitar", label: "Gitara (struny)" }, { id: "drums", label: "Perkusja (General MIDI)" }];
const LOWER = ["z", "s", "x", "d", "c", "v", "g", "b", "h", "n", "j", "m", ",", "l", ".", ";", "/"];
const UPPER = ["q", "2", "w", "3", "e", "r", "5", "t", "6", "y", "7", "u", "i", "9", "o", "0", "p"];
const BLACK = [1, 3, 6, 8, 10];
const CHORD_MODES: Record<string, number[]> = { off: [0], major: [0, 4, 7], minor: [0, 3, 7], seventh: [0, 4, 7, 10], power: [0, 7, 12] };
const CHORD_LABELS: Record<string, string> = { off: "Pojedyncze nuty", major: "Akord dur", minor: "Akord moll", seventh: "Akord 7", power: "Power chord" };
const KEYS = 37; // 3 oktawy + C

type Fall = { note: number; t0: number; t1: number | null; vel: number };

export function MidiInstruments({ active }: { active: boolean }) {
  const [instId, setInstId] = useState("piano");
  const [octave, setOctave] = useState(0);
  const [velocity, setVelocity] = useState(85);
  const [sustain, setSustain] = useState(false);
  const [chordMode, setChordMode] = useState("off");
  const [fx, setFx] = useState<AmpSettings>({ ...AMP_PRESETS.clean.amp, drive: 0, cabinet: false, comp: 15, reverb: 25, delay: 0 });
  const [down, setDown] = useState<Set<number>>(new Set());
  const [bend, setBend] = useState(0);
  const [mod, setMod] = useState(0);
  const [recording, setRecording] = useState(false);
  const low = useMemo(() => isLowPowerDevice(), []);

  const synthRef = useRef<PolySynth | null>(null);
  const guitarRef = useRef<GuitarEngine | null>(null);
  const recRef = useRef<InstrumentRecorder | null>(null);
  const falls = useRef<Fall[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sounding = useRef(new Map<number, number[]>()); // klawisz → zagrane nuty (tryb akordów)
  const base = instId === "drums" ? 36 : 48 + octave * 12;
  const live = useRef({ instId, velocity, chordMode, base });
  live.current = { instId, velocity, chordMode, base };

  const engines = useCallback(async () => {
    const ctx = getCtx();
    if (ctx.state !== "running") await ctx.resume();
    if (!synthRef.current) {
      synthRef.current = new PolySynth(ctx, studioBus().input, fx);
      const p = SYNTH_PRESETS.find((x) => x.id === live.current.instId);
      if (p) synthRef.current.setPreset(p);
    }
    return synthRef.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const p = SYNTH_PRESETS.find((x) => x.id === instId);
    if (p) synthRef.current?.setPreset(p);
  }, [instId]);
  useEffect(() => { synthRef.current?.fx.set(fx); }, [fx]);
  useEffect(() => { synthRef.current?.setSustain(sustain); }, [sustain]);

  const noteOn = useCallback(async (key: number, vel: number, forceDrums = false) => {
    const synth = await engines();
    const ctx = getCtx();
    const L = live.current;
    const drums = forceDrums || L.instId === "drums";
    const notes = drums ? [key] : CHORD_MODES[L.chordMode].map((i) => key + i);
    sounding.current.set(key, notes);
    for (const n of notes) {
      if (drums) playDrum(ctx, synth.fx.input, n, vel);
      else if (L.instId === "guitar") {
        if (!guitarRef.current) guitarRef.current = new GuitarEngine(ctx, synth.fx.input, AMP_PRESETS.di.amp, { voice: { brightness: 0.62, pickPos: 0.14, sustain: 0.7, palmMute: false }, twelve: false, vibratoDepth: 0, vibratoRate: 5.5, strumMs: 20 });
        const pos = noteToFret(n, TUNINGS[0].strings, 0, 22);
        if (pos) guitarRef.current.pluck(pos.string, n, vel);
      } else synth.noteOn(n, vel);
      falls.current.push({ note: n, t0: performance.now(), t1: drums ? performance.now() + 90 : null, vel });
    }
    setDown((s) => new Set(s).add(key));
  }, [engines]);

  const noteOff = useCallback((key: number) => {
    const notes = sounding.current.get(key) ?? [key];
    sounding.current.delete(key);
    for (const n of notes) {
      synthRef.current?.noteOff(n);
      const f = [...falls.current].reverse().find((x) => x.note === n && x.t1 === null);
      if (f) f.t1 = performance.now();
    }
    setDown((s) => { const c = new Set(s); c.delete(key); return c; });
  }, []);

  const allOff = useCallback(() => {
    for (const k of [...sounding.current.keys()]) noteOff(k);
    synthRef.current?.allOff();
  }, [noteOff]);
  useEffect(() => { if (!active) allOff(); }, [active, allOff]);

  // MIDI z kontrolera (kanał 10 = perkusja wg General MIDI)
  const midi = useMidi(active, (ev: MidiEvent) => {
    if (ev.type === "on") void noteOn(ev.note, ev.velocity, ev.channel === 10);
    else if (ev.type === "off") noteOff(ev.note);
    else if (ev.type === "bend") { setBend(ev.value); synthRef.current?.setBend(ev.value * 200); guitarRef.current?.setBend(ev.value * 200); }
    else if (ev.type === "cc" && ev.cc === 64) setSustain(ev.value >= 0.5);
    else if (ev.type === "cc" && ev.cc === 1) { setMod(ev.value); synthRef.current?.setMod(ev.value); }
    else if (ev.type === "cc" && (ev.cc === 120 || ev.cc === 123)) allOff();
  });

  // Klawiatura komputera: dolny rząd Z…/ od C, górny Q…P oktawę wyżej
  useEffect(() => {
    if (!active) return;
    const keyToNote = (k: string) => {
      const lo = LOWER.indexOf(k), up = UPPER.indexOf(k);
      return lo >= 0 ? live.current.base + lo : up >= 0 ? live.current.base + 12 + up : null;
    };
    const onDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable))) return;
      if (e.key === "ArrowLeft") { setOctave((o) => Math.max(-2, o - 1)); return; }
      if (e.key === "ArrowRight") { setOctave((o) => Math.min(2, o + 1)); return; }
      if (e.key === "Tab") { e.preventDefault(); setSustain((v) => !v); return; }
      const n = keyToNote(e.key.toLowerCase());
      if (n !== null) void noteOn(n, live.current.velocity / 100);
    };
    const onUp = (e: KeyboardEvent) => { const n = keyToNote(e.key.toLowerCase()); if (n !== null) noteOff(n); };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, [active, noteOn, noteOff]);

  // Wodospad nut nad klawiaturą
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const draw = () => {
      const cv = canvasRef.current;
      if (cv) {
        const g = cv.getContext("2d")!;
        const w = cv.width, h = cv.height, now = performance.now();
        g.clearRect(0, 0, w, h);
        const whites = Array.from({ length: KEYS }, (_, i) => base + i).filter((m) => !BLACK.includes(m % 12)).length;
        const kw = w / whites;
        const xOf = (m: number) => {
          const rel = m - base;
          let wi = 0;
          for (let i = 0; i < rel; i++) if (!BLACK.includes((base + i) % 12)) wi++;
          return BLACK.includes(m % 12) ? wi * kw - kw * 0.3 : wi * kw + kw * 0.08;
        };
        const speed = 0.12; // px/ms
        falls.current = falls.current.filter((f) => f.t1 === null || h - (now - f.t1) * speed > -20);
        for (const f of falls.current) {
          if (f.note < base || f.note >= base + KEYS) continue;
          const top = h - (now - f.t0) * speed;
          const bottom = f.t1 === null ? h : h - (now - f.t1) * speed;
          const bw = BLACK.includes(f.note % 12) ? kw * 0.6 : kw * 0.84;
          const hue = 28 + (1 - f.vel) * 240;
          const grad = g.createLinearGradient(0, top, 0, bottom);
          grad.addColorStop(0, `hsla(${hue},100%,62%,0.15)`);
          grad.addColorStop(1, `hsla(${hue},100%,58%,0.95)`);
          g.fillStyle = grad;
          g.shadowColor = `hsl(${hue},100%,60%)`;
          g.shadowBlur = low ? 0 : 14;
          g.beginPath();
          g.roundRect(xOf(f.note), Math.max(-10, top), bw, Math.max(4, bottom - Math.max(-10, top)), 4);
          g.fill();
        }
        g.shadowBlur = 0;
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [active, base, low]);

  const toggleRecord = async () => {
    if (recRef.current) {
      const buf = recRef.current.stop();
      recRef.current = null;
      setRecording(false);
      if (!buf) { toast.error("Nic nie zostało nagrane — zagraj coś na klawiaturze."); return; }
      sendToDaw({ name: INSTRUMENTS.find((i) => i.id === instId)?.label ?? "Instrument", buffer: buf, kind: "instrument" });
      return;
    }
    const synth = await engines();
    const r = new InstrumentRecorder(getCtx(), synth.fx.output);
    await r.start();
    recRef.current = r;
    setRecording(true);
  };

  const setF = (patch: Partial<AmpSettings>) => setFx((p) => ({ ...p, ...patch }));
  const keys = Array.from({ length: KEYS }, (_, i) => base + i);
  const whites = keys.filter((m) => !BLACK.includes(m % 12));
  const keyLabel = (m: number) => {
    const rel = m - base;
    const lo = rel >= 0 && rel < LOWER.length ? LOWER[rel] : null;
    const up = rel >= 12 && rel - 12 < UPPER.length ? UPPER[rel - 12] : null;
    return (up ?? lo)?.toUpperCase();
  };
  const press = (m: number) => (e: React.PointerEvent) => { e.preventDefault(); (e.target as Element).releasePointerCapture?.(e.pointerId); void noteOn(m, velocity / 100); };
  const sel = "h-9 rounded-lg border border-white/10 bg-[#0f0f1e] px-2 text-xs text-white";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#9333EA] to-[#4F46E5] shadow-[0_0_26px_rgba(147,51,234,0.5)]"><Piano className="h-6 w-6 text-white" /></div>
        <label className="space-y-1 text-[11px] text-gray-400">Instrument
          <select className={`${sel} block w-56`} value={instId} onChange={(e) => { allOff(); setInstId(e.target.value); }}>
            {INSTRUMENTS.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-[11px] text-gray-400">Tryb
          <select className={`${sel} block w-40`} value={chordMode} onChange={(e) => setChordMode(e.target.value)} disabled={instId === "drums"}>
            {Object.entries(CHORD_LABELS).map(([id, l]) => <option key={id} value={id}>{l}</option>)}
          </select>
        </label>
        <div className="space-y-1 text-[11px] text-gray-400">Oktawa
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" className="h-9 w-9 border-white/15 p-0 text-gray-200" onClick={() => setOctave((o) => Math.max(-2, o - 1))} disabled={instId === "drums"}>−</Button>
            <span className="w-14 text-center text-xs font-bold tabular-nums text-white">{noteName(base)}</span>
            <Button size="sm" variant="outline" className="h-9 w-9 border-white/15 p-0 text-gray-200" onClick={() => setOctave((o) => Math.min(2, o + 1))} disabled={instId === "drums"}>+</Button>
          </div>
        </div>
        <label className="space-y-1 text-[11px] text-gray-400">Siła (mysz/klawisze): {velocity}%
          <input type="range" min={20} max={127} value={velocity} onChange={(e) => setVelocity(Number(e.target.value))} className="block w-36 accent-[#9333EA]" />
        </label>
        <button type="button" onClick={() => setSustain((v) => !v)} className={`h-9 rounded-lg px-3 text-xs font-bold ${sustain ? "bg-[#9333EA] text-white shadow-[0_0_14px_rgba(147,51,234,0.6)]" : "bg-white/5 text-gray-300"}`} aria-pressed={sustain}>Sustain (Tab)</button>
        <Button size="sm" onClick={() => void toggleRecord()} className={`h-9 gap-1.5 font-bold ${recording ? "bg-red-600 text-white hover:bg-red-500" : "bg-white/10 text-gray-100 hover:bg-white/15"}`}>
          {recording ? <Square className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5 fill-red-500 text-red-500" />}
          {recording ? "Zakończ i wstaw do DAW" : "Nagrywaj do DAW"}
        </Button>
      </div>

      <p className="text-[11px] text-gray-500">
        {midi.devices.length
          ? <span className="text-emerald-300">Podłączono MIDI: {midi.devices.join(", ")} — kanał 10 gra perkusję.</span>
          : midi.error || "Nie wykryto kontrolera MIDI — podłącz klawiaturę przez USB (wykryje się sama) albo graj klawiszami komputera: Z S X D C… i Q 2 W 3 E… · ← → zmienia oktawę."}
      </p>

      <div className="flex gap-3">
        {/* Pitch bend i modulacja */}
        <div className="flex shrink-0 gap-2 rounded-2xl border border-white/10 bg-[#141420]/80 p-2">
          {[
            { label: "Bend", value: bend, min: -1, max: 1, on: (v: number) => { setBend(v); synthRef.current?.setBend(v * 200); guitarRef.current?.setBend(v * 200); }, spring: true },
            { label: "Mod", value: mod, min: 0, max: 1, on: (v: number) => { setMod(v); synthRef.current?.setMod(v); }, spring: false },
          ].map((w) => (
            <label key={w.label} className="flex flex-col items-center gap-1 text-[10px] font-semibold uppercase text-gray-400">
              <input type="range" min={w.min} max={w.max} step={0.01} value={w.value} aria-label={w.label}
                onChange={(e) => w.on(Number(e.target.value))}
                onPointerUp={() => w.spring && w.on(0)}
                className="h-40 w-6 accent-[#9333EA] [writing-mode:vertical-lr] [direction:rtl]" />
              {w.label}
            </label>
          ))}
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto rounded-2xl border border-white/10 bg-gradient-to-b from-[#0c0a18] to-[#05050b] p-2">
          <div className="min-w-[720px]">
            <canvas ref={canvasRef} width={1400} height={260} className="block h-[150px] w-full" aria-hidden />
            {/* Klawiatura */}
            <div className="relative h-36 select-none touch-none" onPointerLeave={() => { /* puszczenie poza klawiszem obsługuje pointerup */ }}>
              <div className="flex h-full gap-[2px]">
                {whites.map((m) => {
                  const on = down.has(m);
                  const drum = instId === "drums" ? GM_DRUMS[m]?.label : null;
                  return (
                    <div key={m} onPointerDown={press(m)} onPointerUp={() => noteOff(m)} onPointerLeave={(e) => e.buttons && noteOff(m)} onPointerEnter={(e) => e.buttons && void noteOn(m, velocity / 100)}
                      className={`relative flex flex-1 flex-col items-center justify-end rounded-b-lg pb-1.5 text-[9px] font-bold transition-all duration-75 ${on ? "translate-y-[2px] bg-gradient-to-b from-[#f5e9ff] to-[#c084fc] text-[#4c1d95] shadow-[0_0_22px_rgba(192,132,252,0.9)]" : "bg-gradient-to-b from-white to-[#dcdce6] text-gray-500 hover:to-[#cfcfe0]"}`}>
                      {drum && <span className="mb-1 rotate-180 text-[8px] leading-none text-gray-600 [writing-mode:vertical-rl]">{drum}</span>}
                      <span>{keyLabel(m)}</span>
                      {m % 12 === 0 && <span className="text-[8px] text-gray-400">{noteName(m)}</span>}
                    </div>
                  );
                })}
              </div>
              {keys.filter((m) => BLACK.includes(m % 12)).map((m) => {
                const wi = keys.slice(0, m - base).filter((x) => !BLACK.includes(x % 12)).length;
                const on = down.has(m);
                return (
                  <div key={m} onPointerDown={press(m)} onPointerUp={() => noteOff(m)} onPointerLeave={(e) => e.buttons && noteOff(m)} onPointerEnter={(e) => e.buttons && void noteOn(m, velocity / 100)}
                    style={{ left: `calc(${(wi / whites.length) * 100}% - ${(100 / whites.length) * 0.3}%)`, width: `${(100 / whites.length) * 0.6}%` }}
                    className={`absolute top-0 z-10 flex h-[60%] items-end justify-center rounded-b-md pb-1 text-[8px] font-bold transition-all duration-75 ${on ? "bg-gradient-to-b from-[#7c3aed] to-[#c084fc] text-white shadow-[0_0_18px_rgba(167,139,250,0.9)]" : "bg-gradient-to-b from-[#2a2a36] to-[#0b0b10] text-gray-500"}`}>
                    {keyLabel(m)}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Efekty */}
      <section className="rounded-2xl border border-white/10 bg-[#141420]/80 p-4">
        <h4 className="mb-2 text-sm font-bold text-white">Efekty instrumentu</h4>
        <div className="flex flex-wrap justify-center gap-x-1 gap-y-3 rounded-xl bg-black/30 px-2 py-3 sm:justify-start">
          <Knob label="Przester" value={fx.drive} min={0} max={100} color="#FF3D00" defaultValue={0} onChange={(v) => setF({ drive: v })} />
          <Knob label="Bas" value={fx.bass} min={-12} max={12} unit=" dB" color="#C084FC" defaultValue={0} onChange={(v) => setF({ bass: v })} />
          <Knob label="Środek" value={fx.mid} min={-12} max={12} unit=" dB" color="#C084FC" defaultValue={0} onChange={(v) => setF({ mid: v })} />
          <Knob label="Góra" value={fx.treble} min={-12} max={12} unit=" dB" color="#C084FC" defaultValue={0} onChange={(v) => setF({ treble: v })} />
          <Knob label="Chorus" value={fx.chorus} min={0} max={100} color="#38BDF8" defaultValue={0} onChange={(v) => setF({ chorus: v })} />
          <Knob label="Delay" value={fx.delay} min={0} max={100} color="#A78BFA" defaultValue={0} onChange={(v) => setF({ delay: v })} />
          <Knob label="Czas" value={fx.delayTime} min={60} max={1000} step={10} unit=" ms" color="#A78BFA" defaultValue={380} onChange={(v) => setF({ delayTime: v })} />
          <Knob label="Pogłos" value={fx.reverb} min={0} max={100} color="#34D399" defaultValue={25} onChange={(v) => setF({ reverb: v })} />
          <Knob label="Głośność" value={fx.volume} min={0} max={100} color="#FFD400" defaultValue={75} onChange={(v) => setF({ volume: v })} />
        </div>
      </section>
    </div>
  );
}
