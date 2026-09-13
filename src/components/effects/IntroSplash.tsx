import { useEffect, useMemo, useRef, useState } from "react";

const LOGO = "/logo-grouaistream.svg";
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
      return sessionStorage.getItem("grouai-intro-v5") !== "1";
    } catch {
      return true;
    }
  });
  const [phase, setPhase] = useState<Phase>(reduce ? "assemble" : "video");
  const [box, setBox] = useState<Box>(() => centeredBox());
  const [glint, setGlint] = useState(false);

  const timers = useRef<number[]>([]);
  const logoStarted = useRef(false);
  const videoPlaying = useRef(false);
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
    if (show) { try { sessionStorage.setItem("grouai-intro-v5", "1"); } catch { /* */ } }
    return () => { timers.current.forEach(clearTimeout); };
  }, [show]);

  // Reduced motion: krótko pokaż logo i zamknij.
  useEffect(() => {
    if (!show || !reduce || logoStarted.current) return;
    logoStarted.current = true;
    push(() => setShow(false), 1700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, reduce]);

  // Scena kinowa (renderowana w kodzie) trwa ~2,6 s, potem błysk → logo.
  useEffect(() => {
    if (!show || reduce || phase !== "video") return;
    const t = window.setTimeout(() => setPhase("flash"), 2600);
    return () => clearTimeout(t);
  }, [show, reduce, phase]);

  // OSTATECZNY bezpiecznik: cokolwiek się stanie, odsłoń stronę max po 12s od
  // startu (intro nigdy nie może „zawiesić" całej strony pod czarną nakładką).
  useEffect(() => {
    if (!show || reduce) return;
    const t = window.setTimeout(() => setShow(false), 12000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      {/* 1–2) Scena kinowa (renderowana w kodzie) — aurora, pulsujące pierścienie,
              equalizer i wordmark; na końcu rozświetlenie w błysk. Bez pliku wideo:
              zawsze się odpala (brak problemów z autoplay na mobile), profesjonalnie. */}
      {(phase === "video" || phase === "flash") && (
        <div
          className="intro-cine absolute inset-0 overflow-hidden bg-[#05030a]"
          style={{ animation: phase === "flash" ? "introBloom 1s ease-in forwards" : undefined }}
        >
          {/* Aurora — wolno wirujący, oddychający gradient marki */}
          <div
            className="absolute left-1/2 top-1/2 h-[140vmax] w-[140vmax] -translate-x-1/2 -translate-y-1/2"
            style={{
              background:
                "conic-gradient(from 0deg, hsl(331 100% 62% / .30), hsl(268 100% 66% / .28), hsl(189 100% 60% / .22), hsl(331 100% 62% / .30))",
              filter: "blur(80px)",
              animation: "introAurora 6s ease-in-out infinite",
            }}
          />
          {/* Winieta, żeby środek był głęboki */}
          <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 50%, transparent 30%, rgba(5,3,10,.85) 78%)" }} />

          {/* Pulsujące pierścienie z centrum */}
          {[0, 0.5, 1].map((d, i) => (
            <div
              key={i}
              className="absolute left-1/2 top-1/2 rounded-full -translate-x-1/2 -translate-y-1/2"
              style={{
                width: "min(46vmin, 420px)", height: "min(46vmin, 420px)",
                border: "1.5px solid hsl(331 100% 70% / .55)",
                boxShadow: "0 0 40px hsl(268 100% 66% / .35)",
                animation: `introRing 2.6s ease-out ${d}s infinite`,
              }}
            />
          ))}

          {/* Rdzeń światła */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: "min(30vmin, 240px)", height: "min(30vmin, 240px)",
              background: "radial-gradient(circle, rgba(255,255,255,.95), hsl(331 100% 66% / .7) 30%, hsl(268 100% 66% / .35) 55%, transparent 72%)",
              animation: "introCore 2.6s cubic-bezier(.4,0,.2,1) forwards",
            }}
          />

          {/* Equalizer wokół rdzenia */}
          <div className="absolute left-1/2 top-[calc(50%+min(20vmin,150px))] -translate-x-1/2 flex items-end gap-[5px] h-10">
            {Array.from({ length: 9 }).map((_, i) => (
              <span
                key={i}
                className="w-[4px] rounded-full h-full origin-bottom"
                style={{
                  background: "linear-gradient(to top, hsl(331 100% 62%), hsl(268 100% 72%))",
                  animation: `introEqBar ${0.7 + (i % 3) * 0.18}s ease-in-out ${i * 0.06}s infinite`,
                }}
              />
            ))}
          </div>

          {/* Wordmark */}
          <div
            className="absolute left-1/2 top-[calc(50%-min(26vmin,200px))] -translate-x-1/2 font-display font-bold text-white/95 text-2xl sm:text-4xl whitespace-nowrap"
            style={{ textShadow: "0 0 30px hsl(331 100% 62% / .6)", animation: "introWordIn 1.8s cubic-bezier(.2,.7,.2,1) forwards" }}
          >
            GrouAI Stream
          </div>
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
