import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

const SESSION_KEY = "grouai-intro-canva-v3"; // nowa wersja intro = każdy zobaczy ją raz

/** Intro wideo (plansze zaprojektowane w Canvie: znak, hasło, „Słuchaj · Twórz · Zarabiaj”, plansza
 *  końcowa; źródła w design/intro) — na końcu rozmywa się i odsłania stronę, która cały czas
 *  renderuje się pod spodem (overlay tylko na wierzchu). */
export const IntroSplash = () => {
  const [show, setShow] = useState(() => { try { return sessionStorage.getItem(SESSION_KEY) !== "1"; } catch { return true; } });
  const [closing, setClosing] = useState(false);
  const [muted, setMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const close = useCallback(() => {
    if (closing) return;
    setClosing(true);
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* private browsing */ }
    // Rozmycie + zanik trwa 700ms (patrz exit transition) — dopiero potem odmontuj.
    window.setTimeout(() => setShow(false), 700);
  }, [closing]);

  useEffect(() => {
    if (!show) return;
    if (reduced) { close(); return; }
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", escape);
    // Awaryjny limit — gdyby wideo się nie załadowało/onEnded nie odpalił.
    const fallback = window.setTimeout(close, 13000);
    return () => { window.removeEventListener("keydown", escape); clearTimeout(fallback); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, reduced]);

  useEffect(() => {
    if (!show || reduced) return;
    const video = videoRef.current;
    if (!video) return;
    video.volume = 0.55; // dodatkowy margines poza już ściszonym plikiem
    video.play().catch(() => {
      // Przeglądarka blokuje autoplay z dźwiękiem — gramy bez dźwięku, user może odblokować.
      setMuted(true);
      video.muted = true;
      video.play().catch(() => {});
    });
  }, [show, reduced]);

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const next = !muted;
    video.muted = next;
    setMuted(next);
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      {!closing && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Witaj w GrouAI Stream"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, filter: "blur(28px)", scale: 1.04 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] overflow-hidden bg-[#010209]"
        >
          <video
            ref={videoRef}
            src="/intro.mp4"
            playsInline
            onEnded={close}
            onError={close}
            // object-contain na każdym ekranie: nic nie jest przycinane (odznaka w rogu, napisy),
            // a tło kontenera ma kolor brzegów klatek (#010209), więc pasy są niewidoczne.
            className="absolute inset-0 h-full w-full object-contain"
          />
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/50 to-transparent" />

          <div
            className="relative flex h-full flex-col justify-between px-4 py-4 sm:px-10 sm:py-6"
            style={{ paddingTop: "max(1rem, env(safe-area-inset-top))", paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-center justify-between gap-2 sm:gap-4">
              <span className="font-display text-xs font-semibold text-white/90 sm:text-sm">GrouAI Stream</span>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={toggleMute}
                  aria-label={muted ? "Włącz dźwięk" : "Wycisz"}
                  className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-white/10 text-white/80 backdrop-blur-sm transition-colors hover:bg-white/20 active:bg-white/25"
                >
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
                <Button autoFocus variant="ghost" onClick={close} size="sm" className="gap-1.5 whitespace-nowrap px-3 text-xs text-white/90 hover:bg-white/10 hover:text-white sm:px-4 sm:text-sm">
                  Przejdź do strony<ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              </div>
            </div>
            <div />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
