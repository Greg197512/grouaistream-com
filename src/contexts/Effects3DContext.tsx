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

    // KLUCZOWE dla płynności: przechył reaguje TYLKO na realny ruch (mysz/żyroskop),
    // płynnie dochodzi do celu i ZATRZYMUJE pętlę, gdy się ustabilizuje. Żadnego
    // wiecznego „dryfu" — to on repaintował cały ekran 30×/s i powodował miganie/skakanie.
    let raf = 0;
    let tx = 0, ty = 0;   // cel (z inputu)
    let cx = 0, cy = 0;   // aktualna, wygładzona wartość
    let idleTimer = 0;

    const write = () => {
      root.style.setProperty("--tilt-x", cx.toFixed(3));
      root.style.setProperty("--tilt-y", cy.toFixed(3));
    };

    const step = () => {
      cx += (tx - cx) * 0.12;
      cy += (ty - cy) * 0.12;
      write();
      // Ustabilizowane → zatrzymaj pętlę (brak repaintów w spoczynku).
      if (Math.abs(tx - cx) < 0.0015 && Math.abs(ty - cy) < 0.0015) {
        cx = tx; cy = ty; write();
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(step);
    };

    const kick = () => { if (!raf && !document.hidden) raf = requestAnimationFrame(step); };

    const armIdleReturn = () => {
      if (idleTimer) window.clearTimeout(idleTimer);
      // Po 2 s bez ruchu — spokojnie wróć do zera (bez dryfu) i zatrzymaj.
      idleTimer = window.setTimeout(() => { tx = 0; ty = 0; kick(); }, 2000);
    };

    const onMouse = (e: MouseEvent) => {
      tx = ((e.clientX / window.innerWidth) * 2 - 1) * 0.6;
      ty = ((e.clientY / window.innerHeight) * 2 - 1) * 0.6;
      kick(); armIdleReturn();
    };
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.gamma == null && e.beta == null) return;
      const nx = Math.max(-45, Math.min(45, e.gamma ?? 0)) / 45;
      const ny = Math.max(-45, Math.min(45, (e.beta ?? 40) - 40)) / 45;
      // Martwa strefa — ignoruj mikro-drgania trzymanego telefonu (koniec migania).
      if (Math.abs(nx - tx) < 0.06 && Math.abs(ny - ty) < 0.06) return;
      tx = nx; ty = ny;
      kick(); armIdleReturn();
    };
    const onVis = () => { if (document.hidden && raf) { cancelAnimationFrame(raf); raf = 0; } };

    window.addEventListener("mousemove", onMouse, { passive: true });
    window.addEventListener("deviceorientation", onOrient, { passive: true });
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("deviceorientation", onOrient);
      document.removeEventListener("visibilitychange", onVis);
      if (raf) cancelAnimationFrame(raf);
      if (idleTimer) window.clearTimeout(idleTimer);
      root.style.setProperty("--tilt-x", "0");
      root.style.setProperty("--tilt-y", "0");
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
