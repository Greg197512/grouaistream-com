import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Play, Pause, Mic2, Drum, Guitar, Music2, Volume2, VolumeX, Headphones } from "lucide-react";
import { startStems, waitForStems, isSubscriptionError } from "@/lib/hubStudio";
import { toast } from "sonner";

// Odtwarzacz ŚCIEŻEK (stems) — Web Audio: 4 stemy grają sample-dokładnie
// zsynchronizowane (jeden AudioContext), solo/wycisz per ścieżka na żywo.
// Otwierany zdarzeniem "grouai:open-stems" {audioUrl,title} — z menu utworu i głosu.
const STEM_META: Record<string, { label: string; Icon: typeof Mic2; color: string }> = {
  vocals: { label: "Wokal", Icon: Mic2, color: "#FF6B00" },
  drums: { label: "Perkusja", Icon: Drum, color: "#22d3ee" },
  bass: { label: "Bas", Icon: Guitar, color: "#9333EA" },
  other: { label: "Reszta", Icon: Music2, color: "#f59e0b" },
};

export function StemsModal() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [decoding, setDecoding] = useState(false);
  const [names, setNames] = useState<string[]>([]);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState<Record<string, boolean>>({});
  const [solo, setSolo] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const ctxRef = useRef<AudioContext | null>(null);
  const buffersRef = useRef<Record<string, AudioBuffer>>({});
  const sourcesRef = useRef<Record<string, AudioBufferSourceNode>>({});
  const gainsRef = useRef<Record<string, GainNode>>({});
  const startTimeRef = useRef(0);
  const offsetRef = useRef(0);
  const durationRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    Object.values(sourcesRef.current).forEach((s) => { try { s.stop(); } catch { /* */ } });
    sourcesRef.current = {}; gainsRef.current = {};
    try { ctxRef.current?.close(); } catch { /* */ }
    ctxRef.current = null; buffersRef.current = {};
    setPlaying(false); setNames([]); setProgress(0); setSolo(null); setMuted({});
    offsetRef.current = 0; durationRef.current = 0;
  }, []);

  const applyGains = useCallback(() => {
    names.forEach((n) => {
      const g = gainsRef.current[n];
      if (!g) return;
      const on = solo ? n === solo : !muted[n];
      g.gain.value = on ? 1 : 0;
    });
  }, [names, solo, muted]);

  useEffect(() => { applyGains(); }, [applyGains]);

  const startAt = useCallback((offset: number) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    Object.values(sourcesRef.current).forEach((s) => { try { s.stop(); } catch { /* */ } });
    sourcesRef.current = {}; gainsRef.current = {};
    names.forEach((n) => {
      const src = ctx.createBufferSource();
      src.buffer = buffersRef.current[n];
      const g = ctx.createGain();
      src.connect(g).connect(ctx.destination);
      sourcesRef.current[n] = src; gainsRef.current[n] = g;
    });
    applyGains();
    const when = ctx.currentTime + 0.02;
    names.forEach((n) => { try { sourcesRef.current[n].start(when, Math.min(offset, durationRef.current)); } catch { /* */ } });
    startTimeRef.current = when - offset;
    offsetRef.current = offset;
  }, [names, applyGains]);

  const tick = useCallback(() => {
    rafRef.current = requestAnimationFrame(tick);
    const ctx = ctxRef.current;
    if (!ctx || !durationRef.current) return;
    const t = ctx.currentTime - startTimeRef.current;
    setProgress(Math.max(0, Math.min(100, (t / durationRef.current) * 100)));
    if (t >= durationRef.current) { pause(); offsetRef.current = 0; setProgress(0); }
  }, []);

  const play = useCallback(async () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    await ctx.resume().catch(() => {});
    startAt(offsetRef.current >= durationRef.current ? 0 : offsetRef.current);
    setPlaying(true);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, [startAt, tick]);

  const pause = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    offsetRef.current = Math.max(0, ctx.currentTime - startTimeRef.current);
    Object.values(sourcesRef.current).forEach((s) => { try { s.stop(); } catch { /* */ } });
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setPlaying(false);
  }, []);

  // Odbiór zdarzenia otwarcia + separacja + dekodowanie do buforów.
  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail as { audioUrl?: string; title?: string };
      if (!detail?.audioUrl) return;
      cleanup();
      setOpen(true); setTitle(detail.title || "Utwór"); setLoading(true); setElapsed(0);
      try {
        const taskId = await startStems(detail.audioUrl);
        const stems = await waitForStems(taskId, "live", (s) => setElapsed(s));
        setLoading(false); setDecoding(true);
        const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
        const ctx: AudioContext = new AC();
        ctxRef.current = ctx;
        const stemNames = Object.keys(stems).filter((n) => STEM_META[n]);
        const bufs: Record<string, AudioBuffer> = {};
        for (const n of stemNames) {
          const r = await fetch(stems[n]);
          const ab = await r.arrayBuffer();
          const buf = await ctx.decodeAudioData(ab);
          bufs[n] = buf;
          durationRef.current = Math.max(durationRef.current, buf.duration);
        }
        buffersRef.current = bufs;
        setNames(stemNames);
        setDecoding(false);
      } catch (err: any) {
        setLoading(false); setDecoding(false);
        if (isSubscriptionError(err)) toast.error("Rozdzielanie na ścieżki wymaga planu Pro lub Ultimate");
        else toast.error("Nie udało się rozdzielić: " + (err?.message || "błąd"));
        setOpen(false);
      }
    };
    window.addEventListener("grouai:open-stems", handler);
    return () => window.removeEventListener("grouai:open-stems", handler);
  }, [cleanup]);

  const onOpenChange = (o: boolean) => { if (!o) { cleanup(); setOpen(false); } };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Headphones className="h-5 w-5 text-primary" /> Ścieżki: {title}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">AI rozdziela utwór na ścieżki… {elapsed}s</p>
          </div>
        ) : decoding ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Ładuję ścieżki…</p>
          </div>
        ) : names.length ? (
          <div className="space-y-3">
            {/* transport */}
            <div className="flex items-center gap-3">
              <button onClick={() => (playing ? pause() : play())}
                className="h-12 w-12 rounded-full grid place-items-center text-white shadow-lg"
                style={{ background: "linear-gradient(135deg,#FF6B00,#9333EA)" }}>
                {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
              </button>
              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#FF6B00] to-[#9333EA]" style={{ width: `${progress}%` }} />
              </div>
              {solo && <button onClick={() => setSolo(null)} className="text-[11px] text-primary hover:underline">wyłącz solo</button>}
            </div>

            {/* ścieżki */}
            {names.map((n) => {
              const meta = STEM_META[n]; const Icon = meta.Icon;
              const isMuted = muted[n]; const isSolo = solo === n;
              return (
                <div key={n} className={`flex items-center gap-3 rounded-xl border p-2.5 ${isSolo ? "border-primary/60 bg-primary/10" : "border-white/10 bg-white/5"}`}>
                  <Icon className="h-5 w-5" style={{ color: meta.color }} />
                  <span className="flex-1 text-sm font-medium text-white">{meta.label}</span>
                  <button onClick={() => setSolo(isSolo ? null : n)}
                    className={`text-[11px] font-bold px-2 py-1 rounded ${isSolo ? "bg-primary text-white" : "text-white/60 hover:text-white"}`}>SOLO</button>
                  <button onClick={() => setMuted((m) => ({ ...m, [n]: !m[n] }))}
                    className="p-1.5 rounded hover:bg-white/10">
                    {isMuted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4 text-white/70" />}
                  </button>
                </div>
              );
            })}
            <p className="text-[10px] text-white/40 text-center">Wokal / Bas / Perkusja / Reszta — graj razem, wyciszaj albo słuchaj solo.</p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
