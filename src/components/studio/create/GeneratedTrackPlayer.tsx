import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Pause, Play, RotateCcw, Save, Volume2, VolumeX } from "lucide-react";
import { viaProxy } from "@/lib/releasePipeline";
import { peaks as computePeaks } from "@/lib/stemsWorkbench";

type Props = {
  audioUrl: string;
  title: string;
  autoPlay?: boolean;
  L: (pl: string, en: string, nl: string, ua: string) => string;
  onTime?: (t: number, playing: boolean) => void;
  onSave?: () => void;
  onDownload?: () => void;
};

const fmt = (s: number) => (Number.isFinite(s) ? `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "00:00");
const BARS = 180;

/** Pseudo-fala (gdy pliku nie da się zdekodować) — stała dla danego adresu. */
function fallbackPeaks(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Float32Array.from({ length: BARS }, (_, i) => {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    const env = 0.35 + 0.65 * Math.sin((Math.PI * i) / BARS) ** 0.6;
    return env * (0.35 + 0.65 * (h / 0x7fffffff));
  });
}

/** Mini-odtwarzacz z dużą falą: odegrana część złota, reszta niebieska; klik w falę przewija. */
export function GeneratedTrackPlayer({ audioUrl, title, autoPlay, L, onTime, onSave, onDownload }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<Float32Array | null>(null);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [vol, setVol] = useState(0.9);
  const [muted, setMuted] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  // Fala z prawdziwego pliku (przez proxy — R2 nie wysyła CORS); w razie błędu pseudo-fala.
  useEffect(() => {
    let cancelled = false;
    setData(null);
    (async () => {
      try {
        const r = await fetch(viaProxy(audioUrl));
        if (!r.ok) throw new Error(String(r.status));
        const ctx = new OfflineAudioContext(1, 1, 44_100);
        const buf = await ctx.decodeAudioData(await r.arrayBuffer());
        const p = computePeaks(buf.getChannelData(0), BARS);
        const max = Math.max(...p, 1e-6);
        if (!cancelled) setData(p.map((v) => v / max));
      } catch {
        if (!cancelled) setData(fallbackPeaks(audioUrl));
      }
    })();
    return () => { cancelled = true; };
  }, [audioUrl]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a || !autoPlay) return;
    a.play().catch(() => { /* przeglądarka wymaga kliknięcia — zostaje przycisk */ });
  }, [audioUrl, autoPlay]);

  useEffect(() => { if (audioRef.current) audioRef.current.volume = muted ? 0 : vol; }, [vol, muted]);

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const mid = h / 2;
    // delikatna siatka
    g.strokeStyle = "rgba(59,130,246,0.08)";
    for (let y = 8; y < h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    const p = data ?? fallbackPeaks(audioUrl).map(() => 0.05);
    const frac = dur ? t / dur : 0;
    const bw = w / p.length;
    const gold = g.createLinearGradient(0, 0, 0, h); gold.addColorStop(0, "#FFE08A"); gold.addColorStop(0.5, "#F5B73B"); gold.addColorStop(1, "#FFE08A");
    const blue = g.createLinearGradient(0, 0, 0, h); blue.addColorStop(0, "#93C5FD"); blue.addColorStop(0.5, "#3B82F6"); blue.addColorStop(1, "#93C5FD");
    for (let i = 0; i < p.length; i++) {
      const played = i / p.length < frac;
      const amp = Math.max(1.5, p[i] * (h * 0.46));
      g.fillStyle = played ? gold : blue;
      g.shadowColor = played ? "rgba(245,183,59,0.6)" : "rgba(59,130,246,0.5)";
      g.shadowBlur = 6;
      g.fillRect(i * bw + bw * 0.2, mid - amp, Math.max(1, bw * 0.6), amp * 2);
    }
    g.shadowBlur = 0;
    const x = frac * w;
    g.strokeStyle = "#7DD3FC"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, 6); g.lineTo(x, h); g.stroke();
    g.fillStyle = "#7DD3FC"; g.beginPath(); g.arc(x, 6, 5, 0, Math.PI * 2); g.fill();
    if (hover !== null) { g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 1; g.beginPath(); g.moveTo(hover * w, 0); g.lineTo(hover * w, h); g.stroke(); }
  }, [data, t, dur, hover, audioUrl]);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    const on = () => draw();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [draw]);

  const seekTo = (f: number) => {
    const a = audioRef.current;
    if (a && dur) a.currentTime = Math.max(0, Math.min(dur, f * dur));
  };
  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play(); else a.pause();
  };
  const ticks = dur ? Array.from({ length: 7 }, (_, i) => (dur * i) / 6) : [];

  return (
    <div className="space-y-3">
      <audio
        ref={audioRef} src={audioUrl} preload="metadata"
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onTimeUpdate={(e) => { setT(e.currentTarget.currentTime); onTime?.(e.currentTarget.currentTime, !e.currentTarget.paused); }}
        onPlay={() => { setPlaying(true); onTime?.(audioRef.current?.currentTime ?? 0, true); }}
        onPause={() => { setPlaying(false); onTime?.(audioRef.current?.currentTime ?? 0, false); }}
        onEnded={() => { setPlaying(false); onTime?.(0, false); }}
      />
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="block h-36 w-full cursor-pointer rounded-xl bg-[#060A14] sm:h-44"
          role="slider" aria-label={L("Pozycja odtwarzania", "Playback position", "Afspeelpositie", "Позиція відтворення")}
          aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(t)} tabIndex={0}
          onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); seekTo((e.clientX - r.left) / r.width); }}
          onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover((e.clientX - r.left) / r.width); }}
          onMouseLeave={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") seekTo((t + 5) / (dur || 1));
            if (e.key === "ArrowLeft") seekTo((t - 5) / (dur || 1));
            if (e.key === " ") { e.preventDefault(); toggle(); }
          }}
        />
        {!data && <span className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">{L("Rysuję falę dźwięku…", "Drawing the waveform…", "Golfvorm tekenen…", "Малюю хвилю…")}</span>}
        {hover !== null && dur > 0 && <span className="pointer-events-none absolute -top-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] tabular-nums text-white" style={{ left: `calc(${hover * 100}% - 18px)` }}>{fmt(hover * dur)}</span>}
      </div>
      {ticks.length > 0 && (
        <div className="flex justify-between px-0.5 text-[10px] tabular-nums text-gray-500" aria-hidden>{ticks.map((s, i) => <span key={i}>{fmt(s)}</span>)}</div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={toggle} aria-label={playing ? L("Pauza", "Pause", "Pauze", "Пауза") : L("Odtwórz", "Play", "Afspelen", "Грати")}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#FFE08A] to-[#F5B73B] text-[#1a1203] shadow-[0_0_22px_rgba(245,183,59,0.45)] transition-transform hover:scale-105">
          {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
        </button>
        <button type="button" onClick={() => seekTo(0)} aria-label={L("Od początku", "Restart", "Opnieuw", "Спочатку")} className="rounded-full p-2 text-gray-300 hover:bg-white/10 hover:text-white"><RotateCcw className="h-4 w-4" /></button>
        <span className="text-xs tabular-nums text-gray-300">{fmt(t)} / {fmt(dur)}</span>
        <input type="range" min={0} max={1000} value={dur ? (t / dur) * 1000 : 0} onChange={(e) => seekTo(Number(e.target.value) / 1000)}
          aria-label={title} className="min-w-[120px] flex-1 accent-[#F5B73B]" />
        <button type="button" onClick={() => setMuted((m) => !m)} aria-label={L("Wycisz", "Mute", "Dempen", "Без звуку")} className="text-gray-300 hover:text-white">
          {muted || vol === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
        <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : vol} onChange={(e) => { setMuted(false); setVol(Number(e.target.value)); }} aria-label={L("Głośność", "Volume", "Volume", "Гучність")} className="w-20 accent-[#3B82F6]" />
        {onDownload && <button type="button" onClick={onDownload} aria-label={L("Pobierz", "Download", "Downloaden", "Завантажити")} className="rounded-full p-2 text-gray-300 hover:bg-white/10 hover:text-white"><Download className="h-4 w-4" /></button>}
        {onSave && (
          <button type="button" onClick={onSave} className="inline-flex items-center gap-1.5 rounded-full border border-[#F5B73B]/50 px-3 py-1.5 text-xs font-bold text-[#F5B73B] hover:bg-[#F5B73B]/10">
            <Save className="h-3.5 w-3.5" /> {L("Zapisz do biblioteki", "Save to library", "Opslaan in bibliotheek", "Зберегти в бібліотеку")}
          </button>
        )}
      </div>
    </div>
  );
}
