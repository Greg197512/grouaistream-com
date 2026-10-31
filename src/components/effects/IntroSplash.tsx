import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

const SESSION_KEY = "grouai-intro-premium-v4";
/** To samo nagranie, które było w intro.mp4. Odtwarzanie nie woła płatnego TTS. */
const AUDIO_SRC = "/intro-audio.m4a";
const IVORY = "#f4efe6";

export const IntroSplash = () => {
  const [show, setShow] = useState(() => {
    try { return sessionStorage.getItem(SESSION_KEY) !== "1"; } catch { return true; }
  });
  const [closing, setClosing] = useState(false);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rigRef = useRef<HTMLDivElement>(null);
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const close = useCallback(() => {
    if (closing) return;
    setClosing(true);
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* private browsing */ }
    window.setTimeout(() => setShow(false), 760);
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
    const canvas = canvasRef.current;
    const rig = rigRef.current;
    if (!audio || !canvas || !rig) return;
    const ctx2d = canvas.getContext("2d", { alpha: true });
    if (!ctx2d) return;

    let raf = 0;
    let alive = true;
    let analyser: AnalyserNode | null = null;
    const bins = new Uint8Array(32);
    const lowPower = document.documentElement.dataset.lowpower === "on";
    const narrow = () => canvas.clientWidth < 720;
    const started = performance.now();
    let last = 0;

    const grain = document.createElement("canvas");
    grain.width = 140;
    grain.height = 140;
    const gctx = grain.getContext("2d");
    if (gctx) {
      const img = gctx.createImageData(140, 140);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 80 + Math.random() * 80;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 28;
      }
      gctx.putImageData(img, 0, 0);
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, narrow() || lowPower ? 1.25 : 1.5);
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const draw = (now: number) => {
      if (!alive) return;
      raf = requestAnimationFrame(draw);
      if (lowPower && now - last < 48) return;
      last = now;
      const elapsed = (now - started) / 1000;
      const dolly = 1 - Math.pow(1 - Math.min(1, elapsed / 6.4), 3);
      const breathe = Math.sin(elapsed * 0.7) * 0.6;
      rig.style.transform = `rotateX(${18 - dolly * 13 + breathe * 0.35}deg) translateZ(${(dolly - 1) * 260}px) translateY(${(1 - dolly) * 28}px)`;
      rig.style.opacity = String(0.35 + dolly * 0.65);

      const dpr = canvas.width / Math.max(1, canvas.clientWidth);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx2d.clearRect(0, 0, w, h);

      let energy = 0.22;
      if (analyser) {
        analyser.getByteFrequencyData(bins);
        let sum = 0;
        for (let i = 0; i < bins.length; i++) sum += bins[i];
        energy = sum / (bins.length * 255);
      } else {
        energy = 0.22 + Math.sin(elapsed * 1.7) * 0.06;
      }

      drawBeams(ctx2d, w, h, elapsed);
      const pool = ctx2d.createRadialGradient(w * 0.5, h * 0.58, 0, w * 0.5, h * 0.62, w * 0.34);
      pool.addColorStop(0, "hsla(34 70% 52% / 0.13)");
      pool.addColorStop(1, "hsla(34 70% 40% / 0)");
      ctx2d.fillStyle = pool;
      ctx2d.fillRect(0, 0, w, h);
      drawWaves(ctx2d, w, h, elapsed, energy, narrow() || lowPower ? 9 : 15);

      if (!lowPower && gctx) {
        ctx2d.save();
        ctx2d.globalAlpha = 0.045;
        ctx2d.drawImage(grain, 0, 0, w, h);
        ctx2d.restore();
      }
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
        if (actx.state === "suspended") await actx.resume().catch(() => {});
        if (actx.state !== "running") { void actx.close(); return; }
        const source = actx.createMediaElementSource(audio);
        const node = actx.createAnalyser();
        node.fftSize = 64;
        node.smoothingTimeConstant = 0.84;
        source.connect(node);
        node.connect(actx.destination);
        analyser = node;
      } catch { /* element gra dalej bez analizera */ }
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
          exit={{ opacity: 0, filter: "blur(18px)", scale: 1.03 }}
          transition={{ duration: 0.75, ease: [0.4, 0, 0.2, 1] }}
          className="fixed inset-0 z-[9999] overflow-hidden bg-[#070605] text-[#f4efe6]"
        >
          <audio ref={audioRef} src={AUDIO_SRC} preload="auto" onEnded={close} onError={close} />
          <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.62)_100%)]" />

          <div
            className="relative flex h-full flex-col"
            style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          >
            <div className="z-10 flex items-center justify-between gap-2 px-4 py-4 sm:px-10">
              <span className="text-[10px] font-medium uppercase tracking-[0.42em] text-[#f4efe6]/50">GrouAI</span>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={toggleMute}
                  aria-label={muted ? "Włącz dźwięk" : "Wycisz"}
                  className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-black/30 text-white/70 backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-white"
                >
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
                <Button autoFocus variant="ghost" onClick={close} size="sm" className="gap-1.5 bg-black/25 px-3 text-xs text-white/80 backdrop-blur-sm hover:bg-white/10 hover:text-white focus-visible:ring-[#e7a45a] focus-visible:ring-offset-0 sm:text-sm">
                  Przejdź do strony<ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              </div>
            </div>

            <div className="intro-space relative flex flex-1 items-center justify-center" style={{ perspective: "1100px", perspectiveOrigin: "50% 42%" }}>
              <div ref={rigRef} className="intro-rig relative px-6 text-center will-change-transform" style={{ transformStyle: "preserve-3d", transform: "rotateX(18deg) translateZ(-260px)", opacity: 0.35 }}>
                <StationMark />
                <h1
                  className="font-display mt-7 text-[clamp(3.1rem,10vw,7rem)] font-medium leading-none tracking-[-0.05em]"
                  style={{ color: IVORY, textShadow: "0 18px 40px rgba(0,0,0,0.45)" }}
                >
                  Grou<span style={{ color: "#e7a45a" }}>AI</span>
                </h1>
                <div className="mx-auto mt-5 h-px w-28" style={{ background: "linear-gradient(90deg, transparent, #e7a45a, transparent)" }} />
                <p className="mt-4 pl-[0.58em] text-[12px] font-medium uppercase tracking-[0.58em] text-[#e7a45a]">Stream</p>
                <div aria-hidden className="pointer-events-none mt-1 h-14 overflow-hidden sm:h-16" style={{ WebkitMaskImage: "linear-gradient(#000, transparent 85%)", maskImage: "linear-gradient(#000, transparent 85%)" }}>
                  <h1 className="font-display text-[clamp(3.1rem,10vw,7rem)] font-medium leading-none tracking-[-0.05em]" style={{ color: IVORY, transform: "scaleY(-1)", opacity: 0.32 }}>
                    Grou<span style={{ color: "#e7a45a" }}>AI</span>
                  </h1>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

function drawBeams(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const originX = w * (0.5 + Math.sin(t * 0.12) * 0.03);
  const angles = [-0.42, 0.28];
  for (let b = 0; b < angles.length; b++) {
    ctx.save();
    ctx.translate(originX, -h * 0.08);
    ctx.rotate(angles[b] + Math.sin(t * 0.18 + b) * 0.03);
    const g = ctx.createLinearGradient(0, 0, 0, h * 1.25);
    g.addColorStop(0, "hsla(36 85% 72% / 0.10)");
    g.addColorStop(0.4, "hsla(32 70% 48% / 0.045)");
    g.addColorStop(1, "hsla(32 60% 30% / 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-w * 0.055, h * 1.3);
    ctx.lineTo(w * 0.055, h * 1.3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawWaves(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, energy: number, rows: number) {
  const vanishX = w * 0.5;
  const vanishY = h * 0.68;
  const floor = h * 0.99;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 0; i < rows; i++) {
    const depth = ((i / rows) + t * 0.09) % 1;
    const persp = Math.pow(depth, 1.45);
    const y = vanishY + persp * (floor - vanishY);
    const half = w * (0.06 + persp * 0.78);
    const amp = (7 + persp * (narrowAmp(w))) * (0.5 + energy * 1.25);
    const phase = t * 2.6 + i * 0.7;
    ctx.beginPath();
    const steps = w < 720 ? 32 : 48;
    for (let s = 0; s <= steps; s++) {
      const u = s / steps;
      const x = vanishX - half + u * half * 2;
      const envelope = Math.sin(u * Math.PI);
      const wave = (Math.sin(u * Math.PI * 2 + phase) * 0.72 + Math.sin(u * Math.PI * 4.5 + phase * 1.4) * 0.28) * amp * envelope;
      const yy = y - wave;
      if (s === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    const alpha = 0.04 + persp * 0.5;
    ctx.strokeStyle = `hsla(34 ${70 + persp * 12}% ${58 + persp * 16}% / ${alpha})`;
    ctx.lineWidth = 0.6 + persp * 1.8;
    ctx.stroke();
  }
}

function narrowAmp(w: number) {
  return w < 720 ? 16 : 26;
}

const StationMark = () => (
  <svg width="78" height="78" viewBox="0 0 120 120" aria-hidden className="mx-auto drop-shadow-[0_12px_28px_rgba(0,0,0,0.45)]">
    <defs>
      <linearGradient id="introRing" x1="18" y1="14" x2="102" y2="108" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#f6e2c4" />
        <stop offset="0.5" stopColor="#e7a45a" />
        <stop offset="1" stopColor="#8d5a2b" />
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="52" fill="none" stroke="url(#introRing)" strokeWidth="1.2" />
    <circle cx="60" cy="60" r="44" fill="none" stroke="#e7a45a" strokeWidth="0.35" opacity="0.45" />
    {[20, 34, 48, 34, 20].map((bar, i) => (
      <rect key={i} x={33 + i * 11.5} y={80 - bar} width="6" height={bar} rx="3" fill="url(#introRing)" />
    ))}
  </svg>
);
