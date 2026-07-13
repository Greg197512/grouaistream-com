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

// iOS 13+ wymaga ZGODY na żyroskop, i to wywołanej gestem użytkownika (tap na przełączniku).
// Bez tego `deviceorientation` na iPhonie nigdy nie odpala i przechył „nie działa".
async function requestMotionPermission() {
  try {
    const DOE: any = typeof window !== "undefined" ? (window as any).DeviceOrientationEvent : undefined;
    if (DOE && typeof DOE.requestPermission === "function") {
      await DOE.requestPermission();
    }
  } catch {
    /* użytkownik odmówił lub brak czujnika — mamy łagodny dryf jako fallback */
  }
}

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
    if (v) void requestMotionPermission(); // wołane z gestu (Switch/przycisk) — iOS to zaakceptuje
    setIs3DState(v);
  }, []);

  const toggle = useCallback(() => {
    setIs3DState((prev) => {
      const next = !prev;
      persist(next);
      if (next) void requestMotionPermission();
      return next;
    });
  }, []);

  // Znacznik na <html> — globalny hak dla CSS (html[data-threed="on"] …)
  useEffect(() => {
    document.documentElement.setAttribute("data-threed", is3D ? "on" : "off");
  }, [is3D]);

  // Globalny parallax -> zmienne CSS --tilt-x/--tilt-y (-1..1). Sterowane myszką (desktop)
  // i żyroskopem (telefon/tablet). Gdy przez chwilę nie ma ruchu, włącza się delikatny
  // „żywy" dryf — dzięki temu na telefonie EFEKT WIDAĆ nawet bez ruszania (i gdy iOS nie da
  // zgody na żyroskop). Pętla pauzuje, gdy karta jest schowana; szanuje prefers-reduced-motion.
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
    let lastInput = 0;
    let lastWrite = 0;
    const start = performance.now();

    const onMouse = (e: MouseEvent) => {
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
      lastInput = performance.now();
    };
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.gamma == null && e.beta == null) return;
      // gamma: lewo-prawo, beta: przód-tył (telefon/tablet)
      tx = Math.max(-45, Math.min(45, e.gamma ?? 0)) / 45;
      ty = Math.max(-45, Math.min(45, (e.beta ?? 40) - 40)) / 45;
      lastInput = performance.now();
    };

    const loop = () => {
      const now = performance.now();
      let x = tx;
      let y = ty;
      // Brak ruchu przez ~1,6 s → łagodny dryf (sinus), żeby okładki „żyły".
      if (now - lastInput > 1600) {
        const t = (now - start) / 1000;
        x = Math.sin(t * 0.45) * 0.55;
        y = Math.sin(t * 0.32 + 1.1) * 0.4;
      }
      // Throttle zapisu do ~30 fps — mniej obciąża słabe telefony.
      if (now - lastWrite > 33) {
        lastWrite = now;
        root.style.setProperty("--tilt-x", x.toFixed(3));
        root.style.setProperty("--tilt-y", y.toFixed(3));
      }
      raf = requestAnimationFrame(loop);
    };

    const onVis = () => {
      if (document.hidden) {
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
      } else if (!raf) {
        raf = requestAnimationFrame(loop);
      }
    };

    window.addEventListener("mousemove", onMouse, { passive: true });
    window.addEventListener("deviceorientation", onOrient, { passive: true });
    document.addEventListener("visibilitychange", onVis);
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("deviceorientation", onOrient);
      document.removeEventListener("visibilitychange", onVis);
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
