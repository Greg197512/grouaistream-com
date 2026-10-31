import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

const SESSION_KEY = "grouai-intro-premium-v3";
/** To samo nagranie, które było w intro.mp4. Odtwarzanie nie woła płatnego TTS. */
const AUDIO_SRC = "/intro-audio.m4a";

const AMBER = "32 92% 62%";
const IVORY = "#f4efe6";

export const IntroSplash = () => {
  const [show, setShow] = useState(() => {
    try { return sessionStorage.getItem(SESSION_KEY) !== "1"; } catch { return true; }
  });
  const [closing, setClosing] = useState(false);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const stageRef = useRef<HTMLCanvasElement>(null);
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const close = useCallback(() => {
    if (closing) return;
    setClosing(true);
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* private browsing */ }
    window.setTimeout(() => setShow(false), 700);
  }, [closing]);

  useEffect(() => {
    if (!show) return;
    if (reduced) { close(); return; }
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", escape);
    const fallback = window.setTimeout(close, 12000);
    return () => { window.removeEventListener("keydown", escape); clearTimeout(fallback); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, reduced]);

  useEffect(() => {
    if (!show || reduced) return;
    const audio = audioRef.current;
    const canvas = stageRef.current;
    if (!audio || !canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    let raf = 0;
    let alive = true;
    let analyser: AnalyserNode | null = null;
    const bins = new Uint8Array(32);
    const lowPower = document.documentElement.dataset.lowpower === "on";

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const draw = (now: number) => {
      if (!alive) return;
      raf = requestAnimationFrame(draw);
      const w = canvas.width;
      const h = canvas.height;
      ctx2d.setTransform(1, 0, 0, 1, 0, 0);
      ctx2d.clearRect(0, 0, w, h);

      if (analyser) {
        analyser.getByteFrequencyData(bins);
      }

      const base = h * 0.72;
      const count = 28;
      const gap = w * 0.018;
      const total = w * 0.42;
      const barW = (total - gap * (count - 1)) / count;
      const x0 = (w - total) / 2;

      for (let i = 0; i < count; i++) {
        const energy = analyser ? (bins[i % bins.length] || 0) / 255 : 0.18 + Math.sin(now / 700 + i * 0.45) * 0.08;
        const center = 1 - Math.abs(i - (count - 1) / 2) / (count / 2);
        const barH = Math.max(h * 0.008, energy * h * 0.16 * (0.45 + center * 0.7));
        const x = x0 + i * (barW + gap);
        const grd = ctx2d.createLinearGradient(0, base - barH, 0, base);
        grd.addColorStop(0, `hsla(${AMBER} / ${0.15 + energy * 0.85})`);
        grd.addColorStop(1, `hsla(${AMBER} / 0.02)`);
        ctx2d.fillStyle = grd;
        ctx2d.fillRect(x, base - barH, barW, barH);
      }

      const glow = ctx2d.createLinearGradient(w * 0.2, 0, w * 0.8, 0);
      glow.addColorStop(0, "hsla(32 90% 60% / 0)");
      glow.addColorStop(0.5, "hsla(36 95% 68% / 0.55)");
      glow.addColorStop(1, "hsla(32 90% 60% / 0)");
      ctx2d.fillStyle = glow;
      ctx2d.fillRect(0, base, w, Math.max(1.5, h * 0.002));
    };

    audio.volume = 0.62;
    const boot = async () => {
      try {
        await audio.play();
      } catch {
        if (!alive) return;
        audio.muted = true;
        setMuted(true);
        await audio.play().catch(() => {});
      }
      if (!alive || lowPower || audio.muted) return;
      try {
        const AC = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        const actx = new AC();
        if (actx.state === "suspended") {
          await actx.resume().catch(() => {});
        }
        if (actx.state !== "running") {
          void actx.close();
          return;
        }
        const source = actx.createMediaElementSource(audio);
        const node = actx.createAnalyser();
        node.fftSize = 64;
        node.smoothingTimeConstant = 0.82;
        source.connect(node);
        node.connect(actx.destination);
        analyser = node;
      } catch {
        /* element gra dalej bez analizera */
      }
    };
    void boot();
    raf = requestAnimationFrame(draw);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [show, reduced]);

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = !muted;
    audio.muted = next;
    setMuted(next);
    if (!next) audio.play().catch(() => {});
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      {!closing && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Witaj w GrouAI Stream"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, filter: "blur(22px)" }}
          transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
          className="fixed inset-0 z-[9999] overflow-hidden bg-[#090807] text-[#f4efe6]"
        >
          <audio ref={audioRef} src={AUDIO_SRC} preload="auto" onEnded={close} onError={close} />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(232,161,90,0.16),transparent_58%)]" />
          <canvas ref={stageRef} className="pointer-events-none absolute inset-0 h-full w-full" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.72)_100%)]" />

          <div
            className="relative flex h-full flex-col"
            style={{ paddingTop: "max(1rem, env(safe-area-inset-top))", paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-center justify-between gap-2 px-4 py-4 sm:px-10">
              <span className="text-[10px] font-medium uppercase tracking-[0.42em] text-[#f4efe6]/55">GrouAI</span>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={toggleMute}
                  aria-label={muted ? "Włącz dźwięk" : "Wycisz"}
                  className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
                <Button autoFocus variant="ghost" onClick={close} size="sm" className="gap-1.5 px-3 text-xs text-white/80 hover:bg-white/10 hover:text-white focus-visible:ring-[#e7a45a] focus-visible:ring-offset-0 sm:text-sm">
                  Przejdź do strony<ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center px-6 pb-16">
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              >
                <StationMark />
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="font-display mt-8 text-center text-[clamp(3.4rem,11vw,7.4rem)] font-medium leading-none tracking-[-0.045em]"
                style={{ color: IVORY }}
              >
                Grou<span style={{ color: "#e7a45a" }}>AI</span>
              </motion.h1>

              <motion.div
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className="mt-6 h-px w-28 origin-center"
                style={{ background: "linear-gradient(90deg, transparent, #e7a45a, transparent)" }}
              />

              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="mt-4 pl-[0.58em] text-[12px] font-medium uppercase tracking-[0.58em] text-[#e7a45a]"
              >
                Stream
              </motion.p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const StationMark = () => (
  <svg width="92" height="92" viewBox="0 0 120 120" aria-hidden className="drop-shadow-[0_0_28px_rgba(231,164,90,0.35)]">
    <defs>
      <linearGradient id="introRing" x1="20" y1="16" x2="100" y2="108" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#f3d7a4" />
        <stop offset="0.55" stopColor="#e7a45a" />
        <stop offset="1" stopColor="#a8642c" />
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="52" fill="none" stroke="url(#introRing)" strokeWidth="1.25" opacity="0.9" />
    <circle cx="60" cy="60" r="46" fill="none" stroke="#e7a45a" strokeWidth="0.4" opacity="0.35" />
    {[22, 36, 50, 36, 22].map((h, i) => (
      <rect key={i} x={32 + i * 12} y={82 - h} width="6.5" height={h} rx="3.25" fill="url(#introRing)" />
    ))}
  </svg>
);
