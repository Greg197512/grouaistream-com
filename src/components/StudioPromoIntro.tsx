import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { isStudioPromoActive } from "@/contexts/SubscriptionContext";

const SESSION_KEY = "grouai-studio-sticker-shown";
const SHOW_DELAY_MS = 900;    // po wejściu na stronę
const AUTO_DISMISS_MS = 40000; // po 40 s rozpływa się

// Punkty gwiazdy/pieczątki (starburst) — ząbkowany brzeg naklejki.
function starPoints(spikes: number, cx: number, cy: number, outer: number, inner: number) {
  const pts: string[] = [];
  const step = Math.PI / spikes;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = i * step - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

/**
 * Mała graficzna NAKLEJKA/pieczątka promocji GrouAI Studio przy playerze
 * (lewy-dolny róg). Wpada jak stempel, delikatnie się buja (przyciąga oko),
 * a po 40 s ROZPŁYWA SIĘ animacyjnie. Tylko w trakcie promocji, raz na sesję.
 */
export const StudioPromoIntro = () => {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const points = useMemo(() => starPoints(22, 100, 100, 98, 84), []);

  useEffect(() => {
    if (!isStudioPromoActive()) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");
    const id = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);

  const dismiss = useCallback(() => setVisible(false), []);

  useEffect(() => {
    if (!visible) return;
    const t = window.setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [visible, dismiss]);

  const goStudio = () => { dismiss(); setTimeout(() => navigate("/studio"), 200); };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="promo-sticker"
          initial={{ opacity: 0, scale: 0, rotate: -28 }}
          animate={{ opacity: 1, scale: 1, rotate: -8 }}
          exit={{ opacity: 0, scale: 1.35, filter: "blur(16px)", transition: { duration: 1.1, ease: "easeInOut" } }}
          transition={{ type: "spring", damping: 12, stiffness: 200 }}
          className="fixed bottom-28 left-3 z-[90] sm:left-4"
          style={{ width: 150, height: 150 }}
        >
          {/* delikatne bujanie — przyciąga oko */}
          <motion.button
            type="button"
            onClick={goStudio}
            animate={{ rotate: [0, 2.5, 0, -2.5, 0], scale: [1, 1.03, 1, 1.03, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="relative block h-full w-full cursor-pointer drop-shadow-[0_8px_24px_rgba(147,51,234,0.5)]"
            aria-label="Otwórz GrouAI Studio — cały tydzień za darmo"
          >
            <svg viewBox="0 0 200 200" className="h-full w-full">
              <defs>
                <linearGradient id="promoG" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#FF6B00" />
                  <stop offset="0.5" stopColor="#FF9500" />
                  <stop offset="1" stopColor="#9333EA" />
                </linearGradient>
                <radialGradient id="promoInner" cx="0.5" cy="0.4" r="0.75">
                  <stop offset="0" stopColor="#1b1630" />
                  <stop offset="1" stopColor="#0c0a16" />
                </radialGradient>
              </defs>
              <polygon points={points} fill="url(#promoG)" />
              <circle cx="100" cy="100" r="78" fill="url(#promoInner)" stroke="rgba(255,255,255,0.16)" strokeWidth="1.5" />
              <text x="100" y="58" textAnchor="middle" fontSize="12.5" fontWeight="800" letterSpacing="1.5" fill="#ffd9a8" fontFamily="system-ui, sans-serif">GrouAI STUDIO</text>
              <text x="100" y="104" textAnchor="middle" fontSize="42" fontWeight="900" fill="#ffffff" fontFamily="system-ui, sans-serif">FREE</text>
              <text x="100" y="128" textAnchor="middle" fontSize="14" fontWeight="800" letterSpacing="1.5" fill="#8affc9" fontFamily="system-ui, sans-serif">CAŁY TYDZIEŃ</text>
              <text x="100" y="149" textAnchor="middle" fontSize="10.5" fontWeight="600" fill="rgba(255,255,255,0.6)" fontFamily="system-ui, sans-serif">potem 9,90 zł Pro</text>
            </svg>
          </motion.button>

          <button
            onClick={dismiss}
            className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full border border-white/20 bg-[#12101c] text-white/60 hover:text-white hover:border-white/40 transition"
            aria-label="Zamknij reklamę"
          >
            <X className="h-3 w-3" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
