// Lekki wrapper 3D: karta przechyla się pod kursorem (rotateX/Y + połysk),
// wyłącznie transformami GPU. Automatycznie WYŁĄCZONY na słabym sprzęcie
// (<html data-lowpower> z lib/perf.ts), przy prefers-reduced-motion oraz na
// ekranach dotykowych (pointer: coarse) — wtedy renderuje dzieci bez efektu.
// Dzięki temu „wow" na mocnych urządzeniach, zero zacinania na starych telefonach.
import { useEffect, useRef, useState, type ReactNode } from "react";

interface Tilt3DProps {
  children: ReactNode;
  className?: string;
  max?: number;      // maksymalny przechył w stopniach
  glare?: boolean;   // delikatny połysk podążający za kursorem
  scale?: number;    // subtelne powiększenie przy najechaniu
  radius?: string;   // zaokrąglenie (żeby połysk pasował do karty), np. "1rem"
}

function effectsDisabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (document.documentElement.getAttribute("data-lowpower") !== null) return true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
    if (window.matchMedia("(pointer: coarse)").matches) return true;
  } catch { /* */ }
  return false;
}

export function Tilt3D({ children, className, max = 12, glare = true, scale = 1.03, radius = "1rem" }: Tilt3DProps) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const raf = useRef<number | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => { setEnabled(!effectsDisabled()); }, []);

  if (!enabled) {
    // Wersja lite: bez nasłuchów i transformów — po prostu przepuszcza dzieci.
    return <div className={className}>{children}</div>;
  }

  const onMove = (e: React.PointerEvent) => {
    const el = outer.current, card = inner.current;
    if (!el || !card) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;   // 0..1
    const py = (e.clientY - r.top) / r.height;   // 0..1
    const rx = (0.5 - py) * (max * 2);
    const ry = (px - 0.5) * (max * 2);
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      card.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${scale})`;
      if (glareRef.current) {
        glareRef.current.style.opacity = "1";
        glareRef.current.style.background =
          `radial-gradient(600px circle at ${(px * 100).toFixed(1)}% ${(py * 100).toFixed(1)}%, rgba(255,255,255,0.22), transparent 42%)`;
      }
    });
  };

  const reset = () => {
    const card = inner.current;
    if (raf.current) cancelAnimationFrame(raf.current);
    if (card) card.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)";
    if (glareRef.current) glareRef.current.style.opacity = "0";
  };

  return (
    <div ref={outer} className={className} onPointerMove={onMove} onPointerLeave={reset} style={{ perspective: "900px" }}>
      <div
        ref={inner}
        style={{ transformStyle: "preserve-3d", transition: "transform 220ms cubic-bezier(.2,.6,.2,1)", willChange: "transform", height: "100%", position: "relative", borderRadius: radius }}
      >
        {children}
        {glare && (
          <div
            ref={glareRef}
            aria-hidden
            style={{
              position: "absolute", inset: 0, borderRadius: radius, pointerEvents: "none",
              opacity: 0, transition: "opacity 220ms ease", mixBlendMode: "soft-light", zIndex: 5,
            }}
          />
        )}
      </div>
    </div>
  );
}
