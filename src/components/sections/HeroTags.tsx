import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Zap, Brain, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const TAGS = [
  { icon: Zap, label: "Verified Human Streams", short: "Verified" },
  { icon: Brain, label: "AI Anti-Fraud", short: "Anti-Fraud" },
  { icon: Sparkles, label: "Mood-Based Playlists", short: "Mood-Based" },
];

const VISIBLE_MS = 2 * 60 * 1000; // widoczne 2 minuty
const CYCLE_MS = 30 * 60 * 1000; // wracają co 30 minut
const FLAME_W = 42;

// Tagi hero: jeden rząd na telefonie, widoczne 2 min i znów co 30 min,
// przez które przechodzi półprzezroczysty płomień („jak w butelce") —
// kula ognia kończy bieg dokładnie na końcu napisu „Mood-Based Playlists".
export const HeroTags = () => {
  const [visible, setVisible] = useState(true);
  const rowRef = useRef<HTMLDivElement>(null);
  const lastRef = useRef<HTMLDivElement>(null);
  const [span, setSpan] = useState<{ s: number; e: number }>({ s: 0, e: 0 });

  useEffect(() => {
    let hideTimer: number | undefined;
    const showBurst = () => {
      setVisible(true);
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setVisible(false), VISIBLE_MS);
    };
    showBurst(); // pokaż od razu na starcie
    const cycle = window.setInterval(showBurst, CYCLE_MS);
    return () => {
      window.clearTimeout(hideTimer);
      window.clearInterval(cycle);
    };
  }, []);

  // Zmierz, gdzie kończy się ostatni tag — tam kończy się lot kuli ognia.
  const measure = () => {
    const row = rowRef.current;
    const last = lastRef.current;
    if (!row || !last) return;
    const r = row.getBoundingClientRect();
    const l = last.getBoundingClientRect();
    setSpan({ s: -FLAME_W * 0.45, e: l.right - r.left - FLAME_W * 0.5 });
  };

  useLayoutEffect(() => {
    if (!visible) return;
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  useEffect(() => {
    const on = () => measure();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="hero-tags"
          ref={rowRef}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8, transition: { duration: 0.6 } }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden flex flex-nowrap sm:flex-wrap items-stretch gap-2 sm:gap-3 mb-8"
        >
          {TAGS.map((tag, i) => (
            <motion.div
              key={tag.label}
              ref={i === TAGS.length - 1 ? lastRef : undefined}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.1 }}
              onAnimationComplete={i === TAGS.length - 1 ? measure : undefined}
              className="flex-1 sm:flex-none min-w-0 inline-flex items-center justify-center gap-1 sm:gap-1.5 rounded-full border border-white/20 bg-white/[0.06] backdrop-blur-md px-2.5 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-medium text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_0_0_1px_hsl(315_100%_72%/0.18),0_0_18px_-8px_hsl(300_100%_66%/0.5)] hover:border-white/40 transition-colors"
            >
              <tag.icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                <span className="sm:hidden">{tag.short}</span>
                <span className="hidden sm:inline">{tag.label}</span>
              </span>
            </motion.div>
          ))}

          {/* Kula ognia — półprzezroczysta, kończy bieg na końcu ostatniego napisu */}
          {span.e > 0 && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
              <motion.div
                className="hero-flame"
                initial={{ x: span.s, opacity: 0 }}
                animate={{ x: [span.s, span.e], opacity: [0, 0.95, 0.95, 0] }}
                transition={{
                  x: { duration: 4.6, ease: "linear", repeat: Infinity, repeatType: "loop", repeatDelay: 1 },
                  opacity: { duration: 4.6, ease: "linear", times: [0, 0.08, 0.85, 1], repeat: Infinity, repeatDelay: 1 },
                }}
              >
                <span className="hero-flame__core" />
              </motion.div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
