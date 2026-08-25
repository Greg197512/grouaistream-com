import { useEffect, useMemo, useState } from "react";

const LOGO = "/logo-grouaistream.png";
const N = 6; // siatka 6×6 = 36 kawałków

// Intro na starcie: na czarnym tle logo składa się z kawałków,
// błyszczy, po chwili powoli się rozpływa i odsłania stronę.
export const IntroSplash = () => {
  const reduce =
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const [show, setShow] = useState(() => {
    try {
      return sessionStorage.getItem("grouai-intro-v1") !== "1";
    } catch {
      return true;
    }
  });
  const [phase, setPhase] = useState<"assemble" | "shine" | "dissolve">("assemble");

  // Losowe pozycje kawałków liczone raz (stabilne między renderami).
  const tiles = useMemo(
    () =>
      Array.from({ length: N * N }, (_, idx) => {
        const r = Math.floor(idx / N);
        const c = idx % N;
        return {
          r,
          c,
          dx: (Math.random() - 0.5) * 300,
          dy: (Math.random() - 0.5) * 300,
          rot: (Math.random() - 0.5) * 100,
          delay: (r + c) * 0.045 + Math.random() * 0.06,
        };
      }),
    []
  );

  useEffect(() => {
    if (!show) return;
    try {
      sessionStorage.setItem("grouai-intro-v1", "1");
    } catch {
      /* ignore */
    }
    if (reduce) {
      const t = setTimeout(() => setShow(false), 1200);
      return () => clearTimeout(t);
    }
    const t1 = setTimeout(() => setPhase("shine"), 1650);
    const t2 = setTimeout(() => setPhase("dissolve"), 2950);
    const t3 = setTimeout(() => setShow(false), 14950); // powolne rozmycie/zanik ~12 s
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [show, reduce]);

  if (!show) return null;

  return (
    <div
      aria-hidden
      className={
        "fixed inset-0 z-[9999] bg-black flex items-center justify-center transition-opacity ease-in duration-[12000ms] " +
        (phase === "dissolve" ? "opacity-0 pointer-events-none" : "opacity-100")
      }
    >
      <div
        className="relative"
        style={{
          width: "min(86vw, 560px)",
          aspectRatio: "1 / 1",
          transition: "filter 12s ease-in, transform 12s ease-in",
          filter: phase === "dissolve" ? "blur(26px)" : "none",
          transform: phase === "dissolve" ? "scale(1.14)" : "scale(1)",
          animation: phase === "shine" ? "introGlow 1.2s ease-in-out" : undefined,
        }}
      >
        {/* Kawałki logo składające się w całość */}
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
              animation: `introAssemble .95s cubic-bezier(.2,.7,.2,1) ${t.delay}s both`,
            }}
          />
        ))}

        {/* Przesuwający się błysk (mieni się), obcięty do kształtu logo */}
        {phase !== "assemble" && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(110deg, transparent 42%, rgba(255,255,255,.7) 50%, rgba(255,225,150,.5) 54%, transparent 62%)",
              backgroundSize: "250% 100%",
              mixBlendMode: "screen",
              animation: "introShineBg 1.2s ease-in-out",
              WebkitMaskImage: `url('${LOGO}')`,
              maskImage: `url('${LOGO}')`,
              WebkitMaskSize: "contain",
              maskSize: "contain",
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
              maskPosition: "center",
            }}
          />
        )}
      </div>
    </div>
  );
};
