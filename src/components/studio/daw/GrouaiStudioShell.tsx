// GrouAI Studio — jedno studio z przełączaniem okien (DAW, Gitara, Instrumenty MIDI, Stroik, Warsztat ścieżek,
// Nagrania), trybem pełnoekranowym i widmem na żywo wszystkiego, co gra w studiu. Okna po otwarciu zostają
// zamontowane (ukryte), więc przełączanie nie gubi projektu, nagrań ani ustawień.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioWaveform, Crown, Gauge, Guitar, LayoutGrid, Maximize2, Mic, Minimize2, Piano, Scissors } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { DAW_INSERT_EVENT, studioAnalyser, type DawInsert } from "@/lib/daw/context";
import { isLowPowerDevice } from "@/lib/perf";
import { StudioDAW } from "./StudioDAW";
import { GuitarStudio } from "./GuitarStudio";
import { GuitarTuner } from "./GuitarTuner";
import { MidiInstruments } from "./MidiInstruments";
import { StemsWorkbench } from "@/components/studio/StemsWorkbench";
import { RecordingStudioPro } from "@/components/studio/RecordingStudioPro";

const VIEWS = [
  { id: "daw", label: "DAW", hint: "Ścieżki, wokal, mikser, AI", icon: LayoutGrid },
  { id: "guitar", label: "Gitara", hint: "Akordy, rytmy, wzmacniacz", icon: Guitar },
  { id: "midi", label: "Instrumenty MIDI", hint: "Klawisze, syntezator, perkusja", icon: Piano },
  { id: "tuner", label: "Stroik", hint: "Strojenie z mikrofonu", icon: Gauge },
  { id: "stems", label: "Warsztat ścieżek", hint: "Rozkładanie, kafelki, sample", icon: Scissors },
  { id: "record", label: "Nagrania", hint: "Warstwy nad podkładem", icon: Mic },
] as const;
type ViewId = (typeof VIEWS)[number]["id"];
const VIEW_KEY = "grouai-studio-view";

/** Widmo na żywo z szyny studia (lustrzane słupki); w trybie oszczędnym rzadziej i bez poświaty. */
function LiveSpectrum({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const low = isLowPowerDevice();
    let raf = 0, last = 0;
    const data = new Uint8Array(1024);
    const BARS = low ? 40 : 72;
    const smooth = new Float32Array(BARS);
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (low && now - last < 66) return;
      last = now;
      const cv = ref.current;
      if (!cv) return;
      const g = cv.getContext("2d")!;
      const w = cv.width, h = cv.height;
      g.clearRect(0, 0, w, h);
      const an = studioAnalyser();
      if (an) an.getByteFrequencyData(data);
      const bins = an ? an.frequencyBinCount : 1024;
      const bw = w / BARS;
      const grad = g.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, "#FF3D00"); grad.addColorStop(0.45, "#FF9500"); grad.addColorStop(0.75, "#C026D3"); grad.addColorStop(1, "#6366F1");
      g.fillStyle = grad;
      if (!low) { g.shadowColor = "#FF9500"; g.shadowBlur = 12; }
      for (let i = 0; i < BARS; i++) {
        // skala logarytmiczna 40 Hz – 16 kHz
        const a = Math.floor(Math.pow(i / BARS, 2.2) * bins * 0.7), b = Math.max(a + 1, Math.floor(Math.pow((i + 1) / BARS, 2.2) * bins * 0.7));
        let m = 0;
        for (let k = a; k < b; k++) m = Math.max(m, data[k] ?? 0);
        const v = an ? m / 255 : 0.04 + 0.03 * Math.sin(now / 900 + i / 4);
        smooth[i] = Math.max(v, smooth[i] * 0.88);
        const bh = Math.max(2, smooth[i] * h * 0.48);
        g.fillRect(i * bw + 1, h / 2 - bh, bw - 2, bh * 2);
      }
      g.shadowBlur = 0;
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} width={900} height={120} className={className} aria-hidden />;
}

export function GrouaiStudioShell() {
  const { isVip, isUltimate, showUpgradeFor } = useSubscription();
  const unlocked = isVip || isUltimate;
  const [view, setViewState] = useState<ViewId>(() => {
    try { const v = localStorage.getItem(VIEW_KEY) as ViewId | null; if (v && VIEWS.some((x) => x.id === v)) return v; } catch { /* brak pamięci */ }
    return "daw";
  });
  const [visited, setVisited] = useState<Set<ViewId>>(() => new Set<ViewId>(["daw", view]));
  const [tuningId, setTuningId] = useState("standard");
  const [full, setFull] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  const setView = useCallback((v: ViewId) => {
    setViewState(v);
    setVisited((s) => (s.has(v) ? s : new Set(s).add(v)));
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* brak pamięci */ }
  }, []);

  // Nagranie z gitary/instrumentów trafiło do DAW → potwierdzenie z przejściem.
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<DawInsert>).detail;
      toast.success(`Dodano do DAW: ${d.name}`, viewRef.current === "daw" ? undefined : { action: { label: "Pokaż w DAW", onClick: () => setView("daw") } });
    };
    window.addEventListener(DAW_INSERT_EVENT, on);
    return () => window.removeEventListener(DAW_INSERT_EVENT, on);
  }, [setView]);

  // Pełny ekran: cały dokument (żeby listy rozwijane i powiadomienia były widoczne) + studio na wierzchu.
  const exitFull = useCallback(() => {
    setFull(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, []);
  const toggleFull = () => {
    if (full) { exitFull(); return; }
    setFull(true);
    void document.documentElement.requestFullscreen?.().catch(() => { /* iPhone: zostaje tryb nakładki */ });
  };
  useEffect(() => {
    if (!full) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onFs = () => { if (!document.fullscreenElement) setFull(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.fullscreenElement) setFull(false); };
    document.addEventListener("fullscreenchange", onFs);
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("fullscreenchange", onFs); window.removeEventListener("keydown", onKey); };
  }, [full]);

  // Alt+1…6 — szybkie przełączanie okien.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const i = Number(e.key) - 1;
      if (i >= 0 && i < VIEWS.length) { e.preventDefault(); setView(VIEWS[i].id); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setView]);

  const current = useMemo(() => VIEWS.find((v) => v.id === view)!, [view]);

  if (!unlocked) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-[#FFD400]/30 bg-gradient-to-br from-[#1a1a2e]/80 to-[#12121c]/80 p-8 text-center">
        <Crown className="mx-auto mb-3 h-10 w-10 text-[#FFD400]" />
        <h3 className="mb-2 text-lg font-extrabold text-white">GrouAI Studio Pro — tylko VIP</h3>
        <p className="mx-auto mb-5 max-w-md text-sm text-gray-400">
          Pełne studio w przeglądarce: wielościeżkowy DAW z wokalem na żywo i asystentem AI, gitara z akordami i wzmacniaczem,
          instrumenty MIDI, stroik, rozkładanie utworów na ścieżki i sample.
        </p>
        <Button onClick={() => showUpgradeFor("Studio Nagrań Pro")} className="border-0 font-bold text-white" style={{ background: "linear-gradient(135deg, #FFD400, #FF6B00)" }}>
          <Crown className="mr-1.5 h-4 w-4" /> Odblokuj VIP
        </Button>
      </div>
    );
  }

  const panel = (id: ViewId, node: React.ReactNode) =>
    visited.has(id) ? <div key={id} hidden={view !== id} role="tabpanel" aria-label={VIEWS.find((v) => v.id === id)!.label}>{node}</div> : null;

  return (
    <div
      ref={rootRef}
      className={full ? "fixed inset-0 z-[60] overflow-y-auto bg-[#07070d] px-3 pb-6 pt-3 sm:px-5" : "space-y-0"}
    >
      {full && <style>{"[data-radix-popper-content-wrapper]{z-index:80!important}"}</style>}
      {/* Nagłówek studia */}
      <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#160d1f] via-[#0e0e19] to-[#1a0f07] ${full ? "sticky top-0 z-30" : ""}`}>
        <LiveSpectrum className="pointer-events-none absolute inset-0 h-full w-full opacity-35" />
        <div className="relative flex flex-wrap items-center gap-3 px-4 pb-2 pt-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF9500] via-[#FF3D00] to-[#9333EA] shadow-[0_0_24px_rgba(255,90,0,0.45)]">
            <AudioWaveform className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-lg font-black tracking-tight text-white">
              GrouAI Studio
              <span className="inline-flex items-center gap-1 rounded-full border border-[#FFD400]/40 bg-[#FFD400]/10 px-2 py-0.5 text-[10px] font-bold text-[#FFD400]"><Crown className="h-3 w-3" /> PRO</span>
            </h3>
            <p className="text-[11px] text-gray-400">{current.label} · {current.hint}</p>
          </div>
          <Button size="sm" variant="outline" onClick={toggleFull} className="ml-auto gap-1.5 border-white/15 bg-black/30 text-gray-100 hover:bg-white/10" aria-pressed={full}>
            {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span className="hidden sm:inline">{full ? "Zamknij pełny ekran" : "Pełny ekran"}</span>
          </Button>
        </div>
        <div className="relative flex gap-1 overflow-x-auto px-3 pb-3" role="tablist" aria-label="Okna studia">
          {VIEWS.map((v, i) => {
            const Icon = v.icon;
            const on = v.id === view;
            return (
              <button key={v.id} type="button" role="tab" aria-selected={on} title={`${v.hint} (Alt+${i + 1})`} onClick={() => setView(v.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all ${on ? "bg-gradient-to-r from-[#FF9500] to-[#FF3D00] text-white shadow-[0_0_18px_rgba(255,110,0,0.45)]" : "bg-black/30 text-gray-300 hover:bg-white/10 hover:text-white"}`}>
                <Icon className="h-4 w-4" />{v.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        {panel("daw", <StudioDAW active={view === "daw"} />)}
        {panel("guitar", <GuitarStudio active={view === "guitar"} tuningId={tuningId} onTuning={setTuningId} />)}
        {panel("midi", <MidiInstruments active={view === "midi"} />)}
        {panel("tuner", <GuitarTuner active={view === "tuner"} tuningId={tuningId} onTuning={setTuningId} />)}
        {panel("stems", <StemsWorkbench active={view === "stems"} />)}
        {panel("record", <RecordingStudioPro />)}
      </div>
    </div>
  );
}
