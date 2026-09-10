// Przestrzenny wrapper 3D. Na DESKTOPIE karta przechyla się pod kursorem (+ połysk),
// na TELEFONIE reaguje na ruch urządzenia (żyroskop) — realnie „przestrzenne" kafle.
// Tylko transformy GPU. WYŁĄCZONY (płaski passthrough) przy <html data-lowpower>
// i prefers-reduced-motion. Żyroskop na iOS wymaga zgody — łapiemy ją globalnie
// przy 1. dotknięciu (lib/deviceMotion).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { subscribeOrientation } from "@/lib/deviceMotion";

interface Tilt3DProps {
  children: ReactNode;
  className?: string;
  max?: number;
  glare?: boolean;
  scale?: number;
  radius?: string;
}

type Mode = "off" | "pointer" | "gyro";

function detectMode(): Mode {
  if (typeof window === "undefined") return "off";
  try {
    if (document.documentElement.getAttribute("data-lowpower") !== null) return "off";
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "off";
    if (window.matchMedia("(pointer: coarse)").matches) return "gyro";
  } catch { /* */ }
  return "pointer";
}

export function Tilt3D({ children, className, max = 12, glare = true, scale = 1.03, radius = "1rem" }: Tilt3DProps) {
  const inner = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const raf = useRef<number | null>(null);
  const [mode, setMode] = useState<Mode>("off");

  useEffect(() => { setMode(detectMode()); }, []);

  // Tryb żyroskopu (telefon): przechył wg ruchu urządzenia.
  useEffect(() => {
    if (mode !== "gyro") return;
    const card = inner.current; if (!card) return;
    const unsub = subscribeOrientation(({ gamma, beta }) => {
      const ry = gamma * max;      // lewo/prawo
      const rx = -beta * max;      // przód/tył
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        card.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(1.01)`;
      });
    });
    return () => { unsub(); if (raf.current) cancelAnimationFrame(raf.current); };
  }, [mode, max]);

  if (mode === "off") return <div className={className}>{children}</div>;

  const onMove = (e: React.PointerEvent) => {
    if (mode !== "pointer") return;
    const el = e.currentTarget as HTMLElement, card = inner.current;
    if (!card) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    const rx = (0.5 - py) * (max * 2), ry = (px - 0.5) * (max * 2);
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
    <div
      className={className}
      onPointerMove={mode === "pointer" ? onMove : undefined}
      onPointerLeave={mode === "pointer" ? reset : undefined}
      style={{ perspective: "900px" }}
    >
      <div ref={inner} style={{ transformStyle: "preserve-3d", transition: "transform 220ms cubic-bezier(.2,.6,.2,1)", willChange: "transform", height: "100%", position: "relative", borderRadius: radius }}>
        {children}
        {glare && mode === "pointer" && (
          <div ref={glareRef} aria-hidden style={{ position: "absolute", inset: 0, borderRadius: radius, pointerEvents: "none", opacity: 0, transition: "opacity 220ms ease", mixBlendMode: "soft-light", zIndex: 5 }} />
        )}
      </div>
    </div>
  );
}
