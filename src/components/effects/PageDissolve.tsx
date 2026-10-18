import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

/** Płynna plama światła od miejsca kliknięcia, gdy zmienia się ścieżka. */
export const PageDissolve = () => {
  const { pathname } = useLocation();
  const first = useRef(true);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const mark = (e: PointerEvent) => {
      const root = document.documentElement;
      root.style.setProperty("--melt-x", `${e.clientX}px`);
      root.style.setProperty("--melt-y", `${e.clientY}px`);
    };
    window.addEventListener("pointerdown", mark, { passive: true });
    return () => window.removeEventListener("pointerdown", mark);
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const low = document.documentElement.dataset.lowpower === "on";
    if (reduced || low) return;
    setOn(true);
    const timer = window.setTimeout(() => setOn(false), 760);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  if (!on) return null;
  return (
    <div className="page-melt" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
};
