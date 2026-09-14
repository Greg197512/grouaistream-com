import { useEffect, useMemo, useRef, useState } from "react";

const LOGO = "/logo-grouaistream.svg";
const VIDEO = "/intro.mp4";
const N = 6; // siatka 6×6 = 36 kawałków

type Phase = "video" | "flash" | "assemble" | "hold" | "land";
type Box = { top: number; left: number; w: number; h: number };

const LOCK = "/logo-grouaistream-full.svg";
const ASPECT = 1180 / 512; // proporcje lockupu (szer:wys)

function centeredBox(): Box {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  let w = Math.min(0.86 * vw, 680);
  let h = w / ASPECT;
  if (h > 0.42 * vh) { h = 0.42 * vh; w = h * ASPECT; }
  return { top: (vh - h) / 2, left: (vw - w) / 2, w, h };
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
      return sessionStorage.getItem("grouai-intro-v8") !== "1";
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
    if (show) { try { sessionStorage.setItem("grouai-intro-v8", "1"); } catch { /* */ } }
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
    // Celuj w lockup z nazwą na stronie (rozwinięty sidebar); potem sam emblemat.
    const sel = 'img[src*="logo-grouaistream-full"], img[src*="logo-grouaistream"]';
    const imgs = Array.from(document.querySelectorAll(sel)) as HTMLImageElement[];
    const vis = imgs.find((i) => { const r = i.getBoundingClientRect(); return r.width > 8 && r.height > 8; });
    if (vis) { const r = vis.getBoundingClientRect(); target = { top: r.top, left: r.left, w: r.width, h: r.height }; }
    if (!target) { const w = Math.min(300, 0.7 * window.innerWidth); target = { top: 16, left: 16, w, h: w / ASPECT }; }
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

          {/* Pulsujące pierścienie (koła) — wkomponowane za napisem */}
          {[0, 0.45, 0.9, 1.35].map((d, i) => (
            <div
              key={i}
              className="absolute left-1/2 top-1/2 rounded-full -translate-x-1/2 -translate-y-1/2"
              style={{
                width: "min(58vmin, 520px)", height: "min(58vmin, 520px)",
                border: "1.5px solid hsl(" + (i % 2 ? "268" : "331") + " 100% 70% / .5)",
                boxShadow: "0 0 44px hsl(268 100% 66% / .3)",
                animation: `introRing 3s ease-out ${d}s infinite`,
              }}
            />
          ))}

          {/* Miękki rdzeń światła pod napisem */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: "min(60vmin, 520px)", height: "min(30vmin, 220px)",
              background: "radial-gradient(ellipse, hsl(331 100% 66% / .35), hsl(268 100% 66% / .18) 45%, transparent 72%)",
              filter: "blur(20px)",
            }}
          />

          {/* Nazwa wpada litera po literze */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="font-display font-extrabold whitespace-nowrap text-[10vw] sm:text-6xl leading-none flex">
              {"GrouAIstream".split("").map((ch, i) => {
                const isAI = i === 4 || i === 5; // "A","I" — akcent cyan
                return (
                  <span
                    key={i}
                    className="inline-block"
                    style={{
                      color: isAI ? "#6fe4ff" : "#ffffff",
                      textShadow: isAI
                        ? "0 0 26px hsl(189 100% 60% / .8)"
                        : "0 0 26px hsl(331 100% 62% / .7), 0 0 44px hsl(268 100% 66% / .5)",
                      animation: `introLetterIn .62s cubic-bezier(.2,.75,.2,1) ${0.12 + i * 0.085}s both`,
                    }}
                  >
                    {ch}
                  </span>
                );
              })}
            </div>
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

      {/* 3–5) CAŁY LOCKUP (logo + „GrouAIstream") — pojawia się, czeka, zjeżdża
              na swoje miejsce na stronie (rozwinięty sidebar) jako jedna całość. */}
      {onLogo && (
        <div
          className="fixed"
          style={{
            top: box.top, left: box.left, width: box.w, height: box.h,
            transition: landing
              ? "top 1.9s cubic-bezier(.6,0,.1,1), left 1.9s cubic-bezier(.6,0,.1,1), width 1.9s cubic-bezier(.6,0,.1,1), height 1.9s cubic-bezier(.6,0,.1,1)"
              : "none",
            animation: phase === "assemble" ? "introLockIn .8s cubic-bezier(.2,.7,.2,1) both" : undefined,
          }}
        >
          <img
            src={LOCK}
            alt=""
            className="w-full h-full object-contain"
            style={{ filter: "drop-shadow(0 0 34px hsl(268 100% 66% / .5))" }}
          />

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
