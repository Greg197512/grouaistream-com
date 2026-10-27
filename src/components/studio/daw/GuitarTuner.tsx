// Okno „Stroik”: mikrofon → wykrywanie wysokości (YIN) → wskazówka, centy, stroboskop i historia strojenia.
// Tryby: automatyczny (najbliższa struna), wybrana struna, chromatyczny. Kalibracja A4 i dźwięki wzorcowe.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Mic, MicOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { yinPitch } from "@/lib/daw/autotune";
import { midiToHz, noteName, pluckString, TUNINGS, tunerReading } from "@/lib/daw/guitar";
import { getCtx, studioBus } from "@/lib/daw/context";
import { isLowPowerDevice } from "@/lib/perf";

type Mode = "auto" | "string" | "chromatic";
type Props = { active: boolean; tuningId: string; onTuning: (id: string) => void };
type Reading = { hz: number; note: string; cents: number; string: number; targetCents: number };

const IN_TUNE = 4; // ±centów uznawane za nastrojone
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

export function GuitarTuner({ active, tuningId, onTuning }: Props) {
  const [on, setOn] = useState(false);
  const [mode, setMode] = useState<Mode>("auto");
  const [target, setTarget] = useState(0);
  const [a4, setA4] = useState(440);
  const [reading, setReading] = useState<Reading | null>(null);
  const [tuned, setTuned] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const low = useMemo(() => isLowPowerDevice(), []);
  const tuning = (TUNINGS.find((t) => t.id === tuningId) ?? TUNINGS[0]).strings;

  const micRef = useRef<{ stream: MediaStream; analyser: AnalyserNode; src: MediaStreamAudioSourceNode } | null>(null);
  const rafRef = useRef<number | null>(null);
  const histRef = useRef<number[]>([]);
  const traceRef = useRef<{ t: number; c: number | null }[]>([]);
  const holdRef = useRef({ string: -1, since: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strobe = useRef(0);
  const live = useRef({ mode, target, a4, tuning });
  live.current = { mode, target, a4, tuning };

  useEffect(() => { setTuned(new Set()); setTarget(0); }, [tuningId]);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    const m = micRef.current;
    if (m) { m.stream.getTracks().forEach((t) => t.stop()); m.src.disconnect(); }
    micRef.current = null;
    setOn(false);
    setReading(null);
  }, []);

  const loop = useCallback(() => {
    const m = micRef.current;
    if (!m) return;
    const ctx = getCtx();
    const buf = new Float32Array(m.analyser.fftSize);
    let last = performance.now();
    const frame = (now: number) => {
      if (!micRef.current) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      m.analyser.getFloatTimeDomainData(buf);
      let rms = 0;
      for (let i = 0; i < 2048; i++) rms += buf[i] * buf[i];
      rms = Math.sqrt(rms / 2048);
      const L = live.current;
      const hz = rms > 0.008 ? yinPitch(buf, 0, 2048, ctx.sampleRate, 27, 1400) : 0;
      let cents: number | null = null;
      if (hz > 0) {
        const h = histRef.current;
        h.push(hz);
        if (h.length > 7) h.shift();
        const f = median(h);
        const r = tunerReading(f, L.tuning, L.a4);
        const sIdx = L.mode === "string" ? L.target : r.string;
        const targetMidi = L.tuning[sIdx];
        const targetHz = L.a4 * Math.pow(2, (targetMidi - 69) / 12);
        const tc = L.mode === "chromatic" ? r.cents : Math.round(1200 * Math.log2(f / targetHz));
        cents = tc;
        setReading({ hz: f, note: r.note, cents: r.cents, string: sIdx, targetCents: tc });
        // ✓ po 0,6 s utrzymania w strefie ±4 ct
        if (L.mode !== "chromatic" && Math.abs(tc) <= IN_TUNE) {
          if (holdRef.current.string !== sIdx) holdRef.current = { string: sIdx, since: now };
          else if (now - holdRef.current.since > 600) setTuned((s) => (s.has(sIdx) ? s : new Set(s).add(sIdx)));
        } else holdRef.current = { string: -1, since: 0 };
      } else {
        histRef.current = [];
      }
      // Stroboskop + ślad strojenia
      const cv = canvasRef.current;
      if (cv) {
        const g = cv.getContext("2d")!;
        const w = cv.width, hgt = cv.height;
        g.clearRect(0, 0, w, hgt);
        const tr = traceRef.current;
        tr.push({ t: now, c: cents });
        while (tr.length && now - tr[0].t > 5000) tr.shift();
        // pasy stroboskopu: przesuw ∝ odchyłka (stoją w miejscu, gdy dźwięk jest czysty)
        if (cents !== null && !low) strobe.current += Math.max(-50, Math.min(50, cents)) * dt * 6;
        const band = 34;
        const okNow = cents !== null && Math.abs(cents) <= IN_TUNE;
        for (let x = -40; x < w + 40; x += 20) {
          g.fillStyle = cents === null ? "rgba(255,255,255,0.06)" : okNow ? "rgba(52,211,153,0.75)" : "rgba(255,149,0,0.65)";
          g.fillRect(((x + strobe.current) % (w + 40) + w + 40) % (w + 40) - 20, 0, 10, band);
        }
        // siatka i ślad
        const mid = band + (hgt - band) / 2;
        g.strokeStyle = "rgba(52,211,153,0.35)";
        g.fillStyle = "rgba(52,211,153,0.08)";
        const zone = ((hgt - band) / 2) * (IN_TUNE / 50);
        g.fillRect(0, mid - zone, w, zone * 2);
        g.beginPath(); g.moveTo(0, mid); g.lineTo(w, mid); g.stroke();
        g.lineWidth = 2.5;
        g.strokeStyle = "#FFB040";
        g.beginPath();
        let pen = false;
        tr.forEach((p) => {
          const x = w - ((now - p.t) / 5000) * w;
          if (p.c === null) { pen = false; return; }
          const y = mid - (Math.max(-50, Math.min(50, p.c)) / 50) * ((hgt - band) / 2 - 4);
          if (pen) g.lineTo(x, y); else { g.moveTo(x, y); pen = true; }
        });
        g.stroke();
        g.lineWidth = 1;
      }
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
  }, [low]);

  const start = async () => {
    setError("");
    try {
      const ctx = getCtx();
      await ctx.resume();
      // Bez przetwarzania mowy — inaczej przeglądarka „wygładza” dźwięk struny i stroik kłamie.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      src.connect(analyser);
      micRef.current = { stream, analyser, src };
      setOn(true);
      loop();
    } catch {
      setError("Brak dostępu do mikrofonu — zezwól przeglądarce na mikrofon i spróbuj ponownie.");
    }
  };

  useEffect(() => { if (!active && micRef.current) stop(); }, [active, stop]);
  useEffect(() => stop, [stop]);

  const reference = async (midi: number) => {
    const ctx = getCtx();
    await ctx.resume();
    const hz = midiToHz(midi) * (a4 / 440);
    const data = pluckString(hz, ctx.sampleRate, 3, { brightness: 0.55, pickPos: 0.2, sustain: 0.8, palmMute: false }, 3);
    const b = ctx.createBuffer(1, data.length, ctx.sampleRate);
    b.copyToChannel(data, 0);
    const s = ctx.createBufferSource(); s.buffer = b;
    const g = ctx.createGain(); g.gain.value = 0.45;
    s.connect(g).connect(studioBus().input);
    s.start();
  };

  const cents = reading ? (mode === "chromatic" ? reading.cents : reading.targetCents) : 0;
  const clamped = Math.max(-50, Math.min(50, cents));
  const ok = reading && Math.abs(cents) <= IN_TUNE;
  const far = reading && Math.abs(cents) > 50;
  const color = !reading ? "#6b7280" : ok ? "#34D399" : Math.abs(cents) < 15 ? "#FFD400" : "#FF6B00";
  const targetNote = reading && mode !== "chromatic" ? noteName(tuning[reading.string]) : null;
  const shown = reading ? (mode === "chromatic" ? reading.note : targetNote) : null;
  const allDone =mode !== "chromatic" && tuning.every((_, i) => tuned.has(i));

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(ellipse_at_top,#1d2236_0%,#0b0b14_70%)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#7CFFB2]">Stroik GrouAI</p>
            <p className="text-xs text-gray-400">Zagraj jedną strunę, blisko mikrofonu. Gdy wskazówka stanie na środku i zrobi się zielona — struna jest nastrojona.</p>
          </div>
          {on
            ? <Button onClick={stop} variant="outline" className="gap-2 border-white/15 text-gray-200"><MicOff className="h-4 w-4" /> Wyłącz stroik</Button>
            : <Button onClick={() => void start()} className="gap-2 bg-gradient-to-r from-emerald-400 to-teal-500 font-bold text-black"><Mic className="h-4 w-4" /> Włącz stroik</Button>}
        </div>
        {error && <p className="mt-2 text-xs text-red-300">{error}</p>}

        {/* Wskaźnik */}
        <div className="relative mx-auto mt-4 max-w-xl">
          <svg viewBox="0 0 400 230" className="w-full" role="meter" aria-valuemin={-50} aria-valuemax={50} aria-valuenow={reading ? cents : undefined} aria-label="Odchyłka w centach">
            <defs>
              <linearGradient id="tunerArc" x1="0" x2="1">
                <stop offset="0%" stopColor="#FF3D00" /><stop offset="38%" stopColor="#FFD400" /><stop offset="50%" stopColor="#34D399" /><stop offset="62%" stopColor="#FFD400" /><stop offset="100%" stopColor="#FF3D00" />
              </linearGradient>
            </defs>
            <path d="M 40 200 A 160 160 0 0 1 360 200" fill="none" stroke="url(#tunerArc)" strokeWidth={10} strokeLinecap="round" opacity={0.85} />
            {Array.from({ length: 21 }, (_, i) => i * 5 - 50).map((c) => {
              const a = ((c / 50) * 70 - 90) * (Math.PI / 180);
              const r1 = c % 25 === 0 ? 132 : 142;
              return <line key={c} x1={200 + r1 * Math.cos(a)} y1={200 + r1 * Math.sin(a)} x2={200 + 150 * Math.cos(a)} y2={200 + 150 * Math.sin(a)} stroke={c === 0 ? "#34D399" : "#9ca3af"} strokeWidth={c % 25 === 0 ? 2.5 : 1.2} />;
            })}
            {[-50, -25, 0, 25, 50].map((c) => {
              const a = ((c / 50) * 70 - 90) * (Math.PI / 180);
              return <text key={c} x={200 + 115 * Math.cos(a)} y={204 + 115 * Math.sin(a)} textAnchor="middle" fontSize={11} fill="#9ca3af">{c > 0 ? `+${c}` : c}</text>;
            })}
            <g style={{ transform: `rotate(${reading ? (clamped / 50) * 70 : 0}deg)`, transformOrigin: "200px 200px", transition: low ? undefined : "transform 90ms linear" }}>
              <line x1={200} y1={200} x2={200} y2={56} stroke={color} strokeWidth={4} strokeLinecap="round" style={{ filter: low ? undefined : `drop-shadow(0 0 6px ${color})` }} />
            </g>
            <circle cx={200} cy={200} r={10} fill="#1f2937" stroke={color} strokeWidth={3} />
          </svg>
          <div className="pointer-events-none absolute inset-x-0 top-[38%] text-center">
            <p className="text-6xl font-black leading-none transition-colors" style={{ color, textShadow: low ? undefined : `0 0 30px ${color}88` }}>
              {shown ? <>{shown.replace(/-?\d+$/, "")}<sub className="text-xl">{shown.match(/-?\d+$/)?.[0]}</sub></> : "—"}
            </p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-gray-300">
              {reading ? <>{reading.hz.toFixed(1)} Hz · {cents > 0 ? "+" : ""}{cents} ct</> : on ? "Słucham…" : "Włącz stroik"}
            </p>
            <p className="text-xs font-bold" style={{ color }}>
              {!reading ? "" : ok ? "✓ Czysto!" : far ? (cents > 0 ? `Za wysoko o ${Math.round(cents / 100)} półt. — popuść strunę` : `Za nisko o ${Math.round(-cents / 100)} półt. — dokręć strunę`) : cents > 0 ? "Trochę za wysoko — popuść" : "Trochę za nisko — dokręć"}
            </p>
          </div>
        </div>

        <canvas ref={canvasRef} width={720} height={120} className="mx-auto mt-2 block h-[90px] w-full max-w-xl rounded-xl bg-black/40" aria-hidden />
      </div>

      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <section className="space-y-3 rounded-2xl border border-white/10 bg-[#141420]/80 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <select className="h-9 rounded-lg border border-white/10 bg-[#0f0f1e] px-2 text-xs text-white" value={tuningId} onChange={(e) => onTuning(e.target.value)} aria-label="Strój">
              {TUNINGS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <div className="flex rounded-lg bg-white/5 p-0.5 text-xs" role="radiogroup" aria-label="Tryb stroika">
              {([["auto", "Automatyczny"], ["string", "Wybrana struna"], ["chromatic", "Chromatyczny"]] as const).map(([id, label]) => (
                <button key={id} type="button" role="radio" aria-checked={mode === id} onClick={() => setMode(id)} className={`rounded-md px-2.5 py-1.5 font-semibold ${mode === id ? "bg-emerald-400 text-black" : "text-gray-300"}`}>{label}</button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {tuning.map((m, i) => {
              const isCur = reading && mode !== "chromatic" && reading.string === i;
              return (
                <button key={`${tuningId}-${i}`} type="button" onClick={() => { setMode("string"); setTarget(i); void reference(m); }}
                  className={`relative flex h-16 w-14 flex-col items-center justify-center rounded-xl border text-white transition ${isCur ? "border-[#FFD400] bg-[#FFD400]/15 shadow-[0_0_18px_rgba(255,212,0,0.35)]" : mode === "string" && target === i ? "border-emerald-400/70 bg-emerald-400/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
                  <span className="text-lg font-black leading-none">{noteName(m).replace(/-?\d+$/, "")}</span>
                  <span className="text-[10px] text-gray-400">{noteName(m).match(/-?\d+$/)?.[0]} · {(midiToHz(m) * (a4 / 440)).toFixed(1)}</span>
                  <span className="text-[9px] text-gray-500">struna {tuning.length - i}</span>
                  {tuned.has(i) && <Check className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-emerald-400 p-0.5 text-black" />}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-gray-500">Kliknij strunę, aby usłyszeć dźwięk wzorcowy i stroić tylko ją.{allDone && <span className="ml-1 font-bold text-emerald-300">Wszystkie struny nastrojone — można grać!</span>}</p>
        </section>

        <section className="space-y-3 rounded-2xl border border-white/10 bg-[#141420]/80 p-4">
          <label className="block space-y-1 text-[11px] text-gray-400">Kalibracja A4: <span className="font-bold text-white">{a4} Hz</span>
            <input type="range" min={430} max={450} value={a4} onChange={(e) => setA4(Number(e.target.value))} className="block w-full accent-emerald-400" />
          </label>
          <div className="flex flex-wrap gap-1">
            {[432, 440, 442, 444].map((v) => <button key={v} type="button" onClick={() => setA4(v)} className={`rounded-full px-2.5 py-1 text-[11px] ${a4 === v ? "bg-emerald-400 text-black" : "bg-white/5 text-gray-300"}`}>{v} Hz</button>)}
          </div>
          <Button size="sm" variant="outline" onClick={() => void reference(69)} className="gap-2 border-white/15 text-gray-200"><Volume2 className="h-4 w-4" /> Dźwięk A4 ({a4} Hz)</Button>
          <p className="text-[11px] leading-relaxed text-gray-500">Stroik działa też dla basu (od B0 ≈ 31 Hz), ukulele, skrzypiec i głosu — w trybie chromatycznym pokazuje każdą nutę.</p>
        </section>
      </div>
    </div>
  );
}
