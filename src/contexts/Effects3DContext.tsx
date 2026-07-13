import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

interface Effects3DValue {
  is3D: boolean;
  toggle: () => void;
  setIs3D: (v: boolean) => void;
}

const Effects3DContext = createContext<Effects3DValue | undefined>(undefined);
const STORAGE_KEY = "grouai_3d";

const persist = (v: boolean) => {
  try {
    localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
  } catch {
    /* localStorage niedostępny (tryb prywatny) — trudno */
  }
};

export const Effects3DProvider = ({ children }: { children: ReactNode }) => {
  const [is3D, setIs3DState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === null ? true : saved === "1"; // domyślnie WŁĄCZONY
    } catch {
      return true;
    }
  });

  const setIs3D = useCallback((v: boolean) => {
    persist(v);
    setIs3DState(v);
  }, []);

  const toggle = useCallback(() => {
    setIs3DState((prev) => {
      const next = !prev;
      persist(next);
      return next;
    });
  }, []);

  // Znacznik na <html> — globalny hak dla CSS (html[data-threed="on"] …)
  useEffect(() => {
    document.documentElement.setAttribute("data-threed", is3D ? "on" : "off");
  }, [is3D]);

  // Globalny parallax: pozycja kursora / przechył telefonu -> zmienne CSS --tilt-x/--tilt-y (-1..1).
  // Dzięki temu „światło" i głębia idą za tym, na co patrzysz.
  useEffect(() => {
    const root = document.documentElement;
    if (!is3D) {
      root.style.setProperty("--tilt-x", "0");
      root.style.setProperty("--tilt-y", "0");
      return;
    }
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    let raf = 0;
    let tx = 0;
    let ty = 0;
    const apply = () => {
      raf = 0;
      root.style.setProperty("--tilt-x", tx.toFixed(3));
      root.style.setProperty("--tilt-y", ty.toFixed(3));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onMouse = (e: MouseEvent) => {
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
      schedule();
    };
    const onOrient = (e: DeviceOrientationEvent) => {
      // gamma: lewo-prawo, beta: przód-tył (telefon/tablet)
      const g = Math.max(-45, Math.min(45, e.gamma ?? 0)) / 45;
      const b = Math.max(-45, Math.min(45, (e.beta ?? 40) - 40)) / 45;
      tx = g;
      ty = b;
      schedule();
    };
    window.addEventListener("mousemove", onMouse, { passive: true });
    window.addEventListener("deviceorientation", onOrient, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("deviceorientation", onOrient);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [is3D]);

  return (
    <Effects3DContext.Provider value={{ is3D, toggle, setIs3D }}>
      {children}
    </Effects3DContext.Provider>
  );
};

// Bezpieczny fallback, gdyby ktoś użył hooka poza providerem — nie wywala apki.
export const useEffects3D = (): Effects3DValue => {
  const ctx = useContext(Effects3DContext);
  if (!ctx) return { is3D: false, toggle: () => {}, setIs3D: () => {} };
  return ctx;
};
