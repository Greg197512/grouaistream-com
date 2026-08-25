import { useEffect, useState } from "react";
import { Zap, Brain, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const TAGS = [
  { icon: Zap, label: "Verified Human Streams", short: "Verified" },
  { icon: Brain, label: "AI Anti-Fraud", short: "Anti-Fraud" },
  { icon: Sparkles, label: "Mood-Based Playlists", short: "Mood-Based" },
];

const VISIBLE_MS = 2 * 60 * 1000; // widoczne 2 minuty
const CYCLE_MS = 30 * 60 * 1000; // wracają co 30 minut

// Tagi hero: jeden rząd na telefonie, widoczne 2 min i znów co 30 min,
// przez które przechodzi półprzezroczysty, realistyczny płomień („jak w butelce").
export const HeroTags = () => {
  const [visible, setVisible] = useState(true);

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

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="hero-tags"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8, transition: { duration: 0.6 } }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden flex flex-nowrap sm:flex-wrap items-stretch gap-2 sm:gap-3 mb-8"
        >
          {TAGS.map((tag, i) => (
            <motion.div
              key={tag.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.1 }}
              className="flex-1 sm:flex-none min-w-0 inline-flex items-center justify-center gap-1 sm:gap-1.5 rounded-full border border-white/20 bg-white/[0.06] backdrop-blur-md px-2.5 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-medium text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_0_0_1px_hsl(315_100%_72%/0.18),0_0_18px_-8px_hsl(300_100%_66%/0.5)] hover:border-white/40 transition-colors"
            >
              <tag.icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                <span className="sm:hidden">{tag.short}</span>
                <span className="hidden sm:inline">{tag.label}</span>
              </span>
            </motion.div>
          ))}

          {/* Realistyczny, półprzezroczysty płomień przechodzący przez tagi */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div className="hero-flame">
              <span className="hero-flame__core" />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
