import { useEffect, useMemo, useRef, useState } from "react";

const EMBLEM = "/logo-grouaistream.svg";

type Phase = "scene" | "hold" | "land";
type Xform = { x: number; y: number; s: number };

// Intro (v9): JEDEN złożony lockup (emblemat + „GrouAIstream") — nic dwa razy.
// 1) scena: aurora + pierścienie + rdzeń światła,
//    emblemat wskakuje, litery nazwy wpadają pojedynczo tworząc lockup,
// 2) chwila oddechu,
// 3) cały lockup zjeżdża na swoje miejsce (rozwinięty sidebar) jako całość,
// 4) błysk i odsłona strony.
export const IntroSplash = () => {
  const reduce =
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const [show, setShow] = useState(() => {
    try {
      return sessionStorage.getItem("grouai-intro-v9") !== "1";
    } catch {
      return true;
    }
  });
  const [phase, setPhase] = useState<Phase>("scene");
  const [xform, setXform] = useState<Xform>({ x: 0, y: 0, s: 1 });
  const [glint, setGlint] = useState(false);

  const timers = useRef<number[]>([]);
  const started = useRef(false);
  const lockRef = useRef<HTMLDivElement | null>(null);
  const push = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  const name = useMemo(() => "GrouAIstream".split(""), []);

  useEffect(() => {
    if (show) { try { sessionStorage.setItem("grouai-intro-v9", "1"); } catch { /* */ } }
    return () => { timers.current.forEach(clearTimeout); };
  }, [show]);

  // Sekwencja: scena → hold → zjazd → koniec (raz). Reduced motion: krócej.
  useEffect(() => {
    if (!show || started.current) return;
    started.current = true;
    if (reduce) { push(() => setShow(false), 1500); return; }
    push(() => setPhase("hold"), 1850);   // lockup złożony
    push(() => setPhase("land"), 2650);   // zjazd na miejsce
    push(() => setGlint(true), 4350);     // błysk przy dojściu
    push(() => setShow(false), 4900);     // odsłona strony
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  // Bezpiecznik — nigdy nie trzymaj strony pod nakładką dłużej niż 12 s.
  useEffect(() => {
    if (!show || reduce) return;
    const t = window.setTimeout(() => setShow(false), 12000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // „Land": zmierz lockup na stronie (rozwinięty sidebar) i policz transform
  // (translate + scale) z pozycji środka ekranu na miejsce docelowe.
  useEffect(() => {
    if (phase !== "land" || !lockRef.current) return;
    const from = lockRef.current.getBoundingClientRect();
    const sel = 'img[src*="logo-grouaistream-full"], img[src*="logo-grouaistream"]';
    const imgs = Array.from(document.querySelectorAll(sel)) as HTMLImageElement[];
    const vis = imgs.find((i) => { const r = i.getBoundingClientRect(); return r.width > 8 && r.height > 8; });
    let to: DOMRect | { top: number; left: number; width: number; height: number };
    if (vis) { to = vis.getBoundingClientRect(); }
    else { const w = Math.min(300, 0.7 * window.innerWidth); to = { top: 16, left: 16, width: w, height: w * 512 / 1080 }; }
    const s = Math.max(0.05, to.height / from.height);
    const fromCx = from.left + from.width / 2;
    const fromCy = from.top + from.height / 2;
    const toCx = to.left + to.width / 2;
    const toCy = to.top + to.height / 2;
    const raf = requestAnimationFrame(() => setXform({ x: toCx - fromCx, y: toCy - fromCy, s }));
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  if (!show) return null;

  const landing = phase === "land";

  return (
    <div aria-hidden className="fixed inset-0 z-[9999] overflow-hidden pointer-events-none">
      {/* Czarne tło — znika przy zjeździe, żeby odsłonić stronę */}
      <div
        className="absolute inset-0 bg-[#05030a] transition-opacity duration-[1100ms] ease-in-out"
        style={{ opacity: landing ? 0 : 1 }}
      />

      {/* Scena kinowa — aurora, pierścienie, rdzeń światła. Gaśnie przy zjeździe. */}
      <div
        className="absolute inset-0 transition-opacity duration-[900ms] ease-in-out"
        style={{ opacity: landing ? 0 : 1 }}
      >
        {/* Aurora — wolno wirujący, oddychający gradient marki */}
        <div
          className="absolute left-1/2 top-1/2 h-[140vmax] w-[140vmax] -translate-x-1/2 -translate-y-1/2"
          style={{
            background:
              "conic-gradient(from 0deg, hsl(331 100% 62% / .30), hsl(268 100% 66% / .28), hsl(189 100% 60% / .22), hsl(331 100% 62% / .30))",
            filter: "blur(80px)",
            animation: reduce ? undefined : "introAurora 6s ease-in-out infinite",
          }}
        />
        {/* Winieta, żeby środek był głęboki */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 50%, transparent 30%, rgba(5,3,10,.85) 78%)" }} />

        {/* Pulsujące pierścienie — wkomponowane za lockupem */}
        {!reduce && [0, 0.45, 0.9, 1.35].map((d, i) => (
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

        {/* Miękki rdzeń światła pod lockupem */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: "min(64vmin, 560px)", height: "min(30vmin, 220px)",
            background: "radial-gradient(ellipse, hsl(331 100% 66% / .35), hsl(268 100% 66% / .18) 45%, transparent 72%)",
            filter: "blur(20px)",
          }}
        />
      </div>

      {/* JEDEN lockup: emblemat (animowany equalizer w okręgu) + nazwa wpadająca
          literami. Startuje na środku, potem zjeżdża na miejsce jako całość. */}
      <div
        ref={lockRef}
        className="fixed left-1/2 top-1/2"
        style={{
          transform: `translate(-50%, -50%) translate(${xform.x}px, ${xform.y}px) scale(${xform.s})`,
          transformOrigin: "center center",
          transition: landing
            ? "transform 1.9s cubic-bezier(.6,0,.1,1)"
            : "none",
          willChange: "transform",
        }}
      >
        <div className="flex items-center gap-[2.2vmin]">
          <img
            src={EMBLEM}
            alt=""
            className="block"
            style={{
              width: "min(30vmin, 220px)", height: "min(30vmin, 220px)",
              filter: "drop-shadow(0 0 30px hsl(268 100% 66% / .55))",
              animation: reduce ? undefined : "introLockIn .8s cubic-bezier(.2,.7,.2,1) both",
            }}
          />
          <div className="font-display font-extrabold whitespace-nowrap leading-none flex" style={{ fontSize: "min(11vmin, 84px)" }}>
            {name.map((ch, i) => {
              const isAI = i === 4 || i === 5; // „A","I" — akcent cyan
              return (
                <span
                  key={i}
                  className="inline-block"
                  style={{
                    color: isAI ? "#6fe4ff" : "#ffffff",
                    textShadow: isAI
                      ? "0 0 26px hsl(189 100% 60% / .8)"
                      : "0 0 26px hsl(331 100% 62% / .7), 0 0 44px hsl(268 100% 66% / .5)",
                    animation: reduce ? undefined : `introLetterIn .58s cubic-bezier(.2,.75,.2,1) ${0.35 + i * 0.075}s both`,
                    opacity: reduce ? 1 : undefined,
                  }}
                >
                  {ch}
                </span>
              );
            })}
          </div>
        </div>

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
    </div>
  );
};
