import { useEffect, useMemo, useRef, useState } from "react";

const LOGO = "/logo-grouaistream.png";
const VIDEO = "/intro.mp4";
const N = 6; // siatka 6×6 = 36 kawałków

type Phase = "video" | "flash" | "assemble" | "hold" | "land";
type Box = { top: number; left: number; w: number };

function centeredBox(): Box {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const w = Math.min(0.86 * vw, 0.72 * vh, 560);
  return { top: (vh - w) / 2, left: (vw - w) / 2, w };
}

// Intro na starcie:
// 1) wideo 3D (pełny ekran „jak rolka", całe widoczne),
// 2) w ostatniej sekundzie wideo rozświetla się w błysk,
// 3) z tego światła składa się logo i chwilę „czeka",
// 4) strona wchodzi we mgle, logo zjeżdża na swoje miejsce (mniejsze),
// 5) na koniec błysk — odbicie światła.
export const IntroSplash = () => {
  const reduce =
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const [show, setShow] = useState(() => {
    try {
      return sessionStorage.getItem("grouai-intro-v4") !== "1";
    } catch {
      return true;
    }
  });
  const [phase, setPhase] = useState<Phase>(reduce ? "assemble" : "video");
  const [box, setBox] = useState<Box>(() => centeredBox());
  const [glint, setGlint] = useState(false);

  const timers = useRef<number[]>([]);
  const logoStarted = useRef(false);
  const push = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  const tiles = useMemo(
    () =>
      Array.from({ length: N * N }, (_, idx) => {
        const r = Math.floor(idx / N);
        const c = idx % N;
        return {
          r, c,
          dx: (Math.random() - 0.5) * 300,
          dy: (Math.random() - 0.5) * 300,
          rot: (Math.random() - 0.5) * 100,
          delay: (r + c) * 0.05 + Math.random() * 0.06,
        };
      }),
    []
  );

  useEffect(() => {
    if (show) { try { sessionStorage.setItem("grouai-intro-v4", "1"); } catch { /* */ } }
    return () => { timers.current.forEach(clearTimeout); };
  }, [show]);

  // Reduced motion: krótko pokaż logo i zamknij.
  useEffect(() => {
    if (!show || !reduce || logoStarted.current) return;
    logoStarted.current = true;
    push(() => setShow(false), 1700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, reduce]);

  // Bezpiecznik wideo → przejdź do błysku.
  useEffect(() => {
    if (!show || reduce || phase !== "video") return;
    const t = window.setTimeout(() => setPhase("flash"), 20000);
    return () => clearTimeout(t);
  }, [show, reduce, phase]);

  // Błysk → logo.
  useEffect(() => {
    if (phase !== "flash") return;
    const t = window.setTimeout(() => setPhase("assemble"), 1000);
    return () => clearTimeout(t);
  }, [phase]);

  // Sekwencja logo: złożenie → „czekanie" → zjazd na miejsce → koniec (raz).
  useEffect(() => {
    if (phase !== "assemble" || logoStarted.current || reduce) return;
    logoStarted.current = true;
    push(() => setPhase("hold"), 1500);   // logo złożone → chwila oddechu
    push(() => setPhase("land"), 2700);   // „czekanie", potem powolny zjazd
    push(() => setGlint(true), 4550);     // błysk przy dojściu na miejsce
    push(() => setShow(false), 5000);     // koniec — odsłona strony
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Środek ekranu podczas składania/czekania (reaguje na obrót/resize).
  useEffect(() => {
    if (phase === "land") return;
    const set = () => setBox(centeredBox());
    set();
    window.addEventListener("resize", set);
    return () => window.removeEventListener("resize", set);
  }, [phase]);

  // „Land": zmierz, gdzie na stronie jest logo, i tam zjedź (trochę mniejsze).
  useEffect(() => {
    if (phase !== "land") return;
    let target: Box | null = null;
    const imgs = Array.from(document.querySelectorAll('img[src*="logo-grouaistream"]')) as HTMLImageElement[];
    const vis = imgs.find((i) => { const r = i.getBoundingClientRect(); return r.width > 8 && r.height > 8; });
    // Ląduje trochę MNIEJSZE niż logo na stronie (delikatniejszy akcent).
    if (vis) { const r = vis.getBoundingClientRect(); const w = Math.max(r.width, r.height) * 0.72; target = { top: r.top + (r.height - w) / 2, left: r.left + (r.width - w) / 2, w }; }
    if (!target) { const w = Math.min(90, 0.24 * window.innerWidth); target = { top: 18, left: 18, w }; }
    const raf = requestAnimationFrame(() => setBox(target as Box));
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  if (!show) return null;

  const onTime = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    if (phase === "video" && isFinite(v.duration) && v.duration > 0 && v.currentTime >= v.duration - 1) {
      setPhase("flash");
    }
  };
  const onEnded = () => { if (phase === "video") setPhase("flash"); };
  const onErr = () => { if (phase === "video" || phase === "flash") setPhase("assemble"); };

  const onLogo = phase === "assemble" || phase === "hold" || phase === "land";
  const landing = phase === "land";

  return (
    <div aria-hidden className="fixed inset-0 z-[9999] overflow-hidden pointer-events-none">
      {/* Czarne tło — znika przy „land", żeby odsłonić stronę */}
      <div
        className="absolute inset-0 bg-black transition-opacity duration-[1100ms] ease-in-out"
        style={{ opacity: landing ? 0 : 1 }}
      />

      {/* Mgła — strona „wchodzi we mgle" (rozmycie się rozwiewa) */}
      {landing && (
        <div
          className="absolute inset-0"
          style={{
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            background: "rgba(255,255,255,0.05)",
            animation: "introFog 1.25s ease-out forwards",
          }}
        />
      )}

      {/* 1–2) Wideo — pełny ekran, całe widoczne; na końcu rozświetlenie */}
      {(phase === "video" || phase === "flash") && (
        <div className="absolute inset-0 overflow-hidden">
          <video
            aria-hidden src={VIDEO} autoPlay muted playsInline loop
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              filter: "blur(40px) brightness(0.45)", transform: "scale(1.25)",
              animation: phase === "flash" ? "introBloom 1s ease-in forwards" : undefined,
            }}
          />
          <video
            src={VIDEO} autoPlay muted playsInline
            onTimeUpdate={onTime} onEnded={onEnded} onError={onErr}
            className="absolute inset-0 w-full h-full object-contain"
            style={{
              transformOrigin: "50% 50%",
              animation: phase === "flash" ? "introBloom 1s ease-in forwards" : undefined,
            }}
          />
        </div>
      )}

      {/* Błysk łączący wideo z logo */}
      {(phase === "flash" || phase === "assemble") && (
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(255,255,255,.95), rgba(200,180,255,.6) 24%, rgba(120,180,255,.25) 46%, transparent 66%)",
            mixBlendMode: "screen",
            animation: "introFlash 1.7s ease-out forwards",
          }}
        />
      )}

      {/* 3–5) Logo — składa się, czeka, zjeżdża na miejsce, błyska */}
      {onLogo && (
        <div
          className="fixed"
          style={{
            top: box.top, left: box.left, width: box.w, height: box.w,
            transition: landing
              ? "top 1.9s cubic-bezier(.6,0,.1,1), left 1.9s cubic-bezier(.6,0,.1,1), width 1.9s cubic-bezier(.6,0,.1,1), height 1.9s cubic-bezier(.6,0,.1,1)"
              : "none",
            animation: phase === "hold" ? "introGlow 1.2s ease-in-out" : undefined,
          }}
        >
          {tiles.map((t, idx) => (
            <div
              key={idx}
              className="intro-tile absolute"
              style={{
                left: `${(t.c / N) * 100}%`,
                top: `${(t.r / N) * 100}%`,
                width: `${100 / N}%`,
                height: `${100 / N}%`,
                backgroundImage: `url('${LOGO}')`,
                backgroundSize: `${N * 100}% ${N * 100}%`,
                backgroundPosition: `${(t.c / (N - 1)) * 100}% ${(t.r / (N - 1)) * 100}%`,
                backgroundRepeat: "no-repeat",
                ["--dx" as string]: `${t.dx}px`,
                ["--dy" as string]: `${t.dy}px`,
                ["--rot" as string]: `${t.rot}deg`,
                animation: `introAssemble 1.05s cubic-bezier(.2,.7,.2,1) ${t.delay}s both`,
              }}
            />
          ))}

          {/* Błysk „odbicie światła" po dojściu na miejsce */}
          {glint && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "linear-gradient(115deg, transparent 40%, rgba(255,255,255,.9) 49%, rgba(210,230,255,.7) 52%, transparent 62%)",
                backgroundSize: "250% 100%",
                mixBlendMode: "screen",
                animation: "introGlintSweep .7s ease-in-out forwards",
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};
