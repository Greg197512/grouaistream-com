import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { gt } from "@/lib/gameI18n";

const SESSION_KEY = "grouai-game-badge-shown-v2";
const SHOW_DELAY_MS = 1200;

/**
 * Okrągły, kręcący się jak płyta znaczek gry „Wygraj swoją płytę".
 * Realistyczne CD (opalizacja + rowki) obraca się, a hasło biegnie wokół
 * krawędzi. Środek: stały hub z 🏆. Klik → /wygraj. Raz na sesję, zamykalny.
 * Na telefonie osadzony niżej, żeby nie zasłaniać equalizera.
 */
export const GameBadge = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const L = (k: string) => gt(language, k);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");
    const id = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);

  const dismiss = useCallback(() => setVisible(false), []);
  const go = () => { dismiss(); setTimeout(() => navigate("/wygraj"), 180); };

  // Hasło wokół krawędzi (dwie linie połączone kropkami, zapętlone).
  const ring = `${L("badge.l1")} · ${L("badge.l2")} · ${L("badge.cta")} ▸ · `;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="game-badge"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.7, filter: "blur(8px)", transition: { duration: 0.5 } }}
          transition={{ type: "spring", damping: 15, stiffness: 220 }}
          className="fixed right-3 top-[46%] z-[90] h-28 w-28 sm:top-24 sm:right-6 sm:h-32 sm:w-32"
        >
          <button
            type="button"
            onClick={go}
            className="relative block h-full w-full cursor-pointer rounded-full"
            style={{ filter: "drop-shadow(0 12px 30px rgba(255,122,26,.45))" }}
            aria-label={L("badge.l1") + " " + L("badge.l2")}
          >
            <style>{`@keyframes gbspin{to{transform:rotate(360deg)}}
              @media (prefers-reduced-motion:reduce){[data-gbspin]{animation:none!important}}`}</style>

            {/* warstwa wirująca: realistyczne CD */}
            <span data-gbspin className="absolute inset-0 rounded-full overflow-hidden" style={{
              animation: "gbspin 14s linear infinite",
              background: [
                "radial-gradient(circle at 50% 50%, hsl(var(--background)) 0 8%, transparent 8.5%)",
                "radial-gradient(circle at 50% 50%, #e6e9ef 8.5% 12%, #9aa0ab 12% 13%, transparent 13.3%)",
                "repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,.05) 0 1px, rgba(0,0,0,.08) 1px 2.6px)",
                "conic-gradient(from 0deg,#ff5db1,#ffd24d,#7dff9e,#5de1ff,#a98bff,#ff7ad9,#ffd24d,#ff5db1)",
              ].join(","),
            }} />

            {/* wirujący pierścień z hasłem (SVG textPath) */}
            <svg data-gbspin viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" style={{ animation: "gbspin 14s linear infinite" }}>
              <defs>
                <path id="gb-ring" d="M100,100 m-74,0 a74,74 0 1,1 148,0 a74,74 0 1,1 -148,0" />
              </defs>
              {/* ciemny pas pod tekstem dla czytelności */}
              <circle cx="100" cy="100" r="74" fill="none" stroke="rgba(8,4,14,.72)" strokeWidth="20" />
              <text fill="#fff" fontSize="12.5" fontWeight="800" letterSpacing="1.5"
                style={{ fontFamily: "system-ui, sans-serif", textTransform: "uppercase" }}>
                <textPath href="#gb-ring" startOffset="0">{ring}{ring}</textPath>
              </text>
            </svg>

            {/* nieruchomy refleks (jak na prawdziwej płycie) */}
            <span className="absolute inset-0 rounded-full pointer-events-none" style={{
              background: "linear-gradient(115deg, transparent 40%, rgba(255,255,255,.28) 48%, transparent 56%)",
              boxShadow: "inset 0 0 16px rgba(0,0,0,.5)",
            }} />

            {/* stały hub na środku */}
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 grid place-items-center rounded-full text-white"
              style={{ width: "26%", height: "26%", background: "radial-gradient(circle at 40% 35%, #FF7A1A, #B026FF)", boxShadow: "0 0 16px rgba(176,38,255,.6)" }}>
              <span className="text-base leading-none">🏆</span>
            </span>
          </button>

          <button onClick={dismiss}
            className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full border border-white/20 bg-[#12101c] text-white/60 hover:text-white hover:border-white/40 transition"
            aria-label="×">
            <X className="h-3 w-3" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
