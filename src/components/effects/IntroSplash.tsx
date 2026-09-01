import { useEffect, useMemo, useRef, useState } from "react";

const LOGO = "/logo-grouaistream.png";
const VIDEO = "/intro.mp4";
const N = 6; // siatka 6×6 = 36 kawałków

type Phase = "video" | "flash" | "assemble" | "shine" | "dissolve";

// Intro na starcie:
// 1) leci wideo 3D (pełny ekran „jak rolka", całe widoczne),
// 2) w ostatniej sekundzie wideo „rozświetla się" w błysk,
// 3) z tego światła składa się logo z kawałków i błyszczy,
// 4) powoli się rozpływa i odsłania stronę.
export const IntroSplash = () => {
  const reduce =
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const [show, setShow] = useState(() => {
    try {
      return sessionStorage.getItem("grouai-intro-v2") !== "1";
    } catch {
      return true;
    }
  });
  const [phase, setPhase] = useState<Phase>(reduce ? "assemble" : "video");

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
          delay: (r + c) * 0.045 + Math.random() * 0.06,
        };
      }),
    []
  );

  // Zapamiętaj, że intro poszło (raz na sesję) + sprzątnij timery.
  useEffect(() => {
    if (show) { try { sessionStorage.setItem("grouai-intro-v2", "1"); } catch { /* */ } }
    return () => { timers.current.forEach(clearTimeout); };
  }, [show]);

  // Reduced motion: krótko pokaż logo i zamknij.
  useEffect(() => {
    if (!show || !reduce || logoStarted.current) return;
    logoStarted.current = true;
    push(() => setShow(false), 1600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, reduce]);

  // Bezpiecznik wideo (gdyby autoplay się zaciął) → przejdź do błysku.
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

  // Logo: błysk → rozpłynięcie → koniec (uruchamiane raz).
  useEffect(() => {
    if (phase !== "assemble" || logoStarted.current || reduce) return;
    logoStarted.current = true;
    push(() => setPhase("shine"), 1750);
    push(() => setPhase("dissolve"), 3050);
    push(() => setShow(false), 15050);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const onLogo = phase === "assemble" || phase === "shine" || phase === "dissolve";

  return (
    <div
      aria-hidden
      className={
        "fixed inset-0 z-[9999] bg-black overflow-hidden flex items-center justify-center transition-opacity ease-in duration-[12000ms] " +
        (phase === "dissolve" ? "opacity-0 pointer-events-none" : "opacity-100")
      }
    >
      {/* 1–2) Wideo — pełny ekran „jak rolka", całe widoczne; na końcu rozświetlenie */}
      {(phase === "video" || phase === "flash") && (
        <div className="absolute inset-0 overflow-hidden">
          {/* Rozmyte tło z tego samego wideo — wypełnia ekran (efekt rolki) */}
          <video
            aria-hidden
            src={VIDEO}
            autoPlay
            muted
            playsInline
            loop
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              filter: "blur(40px) brightness(0.45)",
              transform: "scale(1.25)",
              animation: phase === "flash" ? "introBloom 1s ease-in forwards" : undefined,
            }}
          />
          {/* Właściwe wideo — całe widoczne (contain), wyśrodkowane */}
          <video
            src={VIDEO}
            autoPlay
            muted
            playsInline
            onTimeUpdate={onTime}
            onEnded={onEnded}
            onError={onErr}
            className="absolute inset-0 w-full h-full object-contain"
            style={{
              transformOrigin: "50% 50%",
              animation: phase === "flash" ? "introBloom 1s ease-in forwards" : undefined,
            }}
          />
        </div>
      )}

      {/* Błysk łączący wideo z logo (ciągły przez flash → assemble) */}
      {(phase === "flash" || phase === "assemble") && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(255,255,255,.95), rgba(200,180,255,.6) 24%, rgba(120,180,255,.25) 46%, transparent 66%)",
            mixBlendMode: "screen",
            animation: "introFlash 1.7s ease-out forwards",
          }}
        />
      )}

      {/* 3–4) Logo z kawałków — wyłania się ze światła; dopasowane też w poziomie */}
      {onLogo && (
        <div
          className="relative"
          style={{
            width: "min(86vw, 72vh, 560px)",
            aspectRatio: "1 / 1",
            transition: "filter 12s ease-in, transform 12s ease-in",
            filter: phase === "dissolve" ? "blur(26px)" : "none",
            transform: phase === "dissolve" ? "scale(1.14)" : "scale(1)",
            animation: phase === "shine" ? "introGlow 1.2s ease-in-out" : undefined,
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
                animation: `introAssemble .95s cubic-bezier(.2,.7,.2,1) ${t.delay}s both`,
              }}
            />
          ))}

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
      )}
    </div>
  );
};
