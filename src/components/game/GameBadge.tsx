import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { gt } from "@/lib/gameI18n";

const SESSION_KEY = "grouai-game-badge-shown-v1";
const SHOW_DELAY_MS = 1200;

/**
 * Profesjonalny, pływający znaczek gry „Wygraj swoją płytę" (prawy górny róg).
 * Kręcące się realistyczne mini-CD + hasło (tłumaczone) + CTA. Wpada z animacją,
 * delikatnie się buja, można zamknąć. Raz na sesję. Zawsze prowadzi na /wygraj.
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

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="game-badge"
          initial={{ opacity: 0, scale: 0.6, y: -14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.7, filter: "blur(8px)", transition: { duration: 0.5 } }}
          transition={{ type: "spring", damping: 15, stiffness: 220 }}
          className="fixed top-20 right-3 z-[90] sm:top-24 sm:right-6 w-[210px]"
        >
          <motion.button
            type="button"
            onClick={go}
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="relative block w-full overflow-hidden rounded-2xl border border-[#FF7A1A]/50 p-3.5 text-left cursor-pointer"
            style={{ background: "linear-gradient(135deg,#2a1409,#1a0f27 55%,#160d20)", boxShadow: "0 18px 44px -16px rgba(255,122,26,.55), 0 0 0 1px rgba(255,255,255,.03) inset" }}
            aria-label={L("badge.l1") + " " + L("badge.l2")}
          >
            {/* przesuwny połysk */}
            <span className="pointer-events-none absolute inset-0 opacity-60"
              style={{ background: "linear-gradient(115deg,transparent 42%,rgba(255,255,255,.12) 50%,transparent 58%)", animation: "gbshimmer 4.5s linear infinite" }} />
            <style>{`@keyframes gbspin{to{transform:rotate(360deg)}}@keyframes gbshimmer{0%{transform:translateX(-70%)}100%{transform:translateX(70%)}}
              @media (prefers-reduced-motion:reduce){[style*=gbspin],[style*=gbshimmer]{animation:none!important}}`}</style>

            <div className="relative flex items-center gap-2.5">
              {/* realistyczne mini-CD */}
              <span className="relative h-11 w-11 flex-none rounded-full overflow-hidden" style={{ boxShadow: "0 5px 14px -2px #000" }}>
                <span className="absolute inset-0 rounded-full" style={{
                  animation: "gbspin 5s linear infinite",
                  background: [
                    "radial-gradient(circle at 50% 50%, #160d20 0 13%, transparent 14%)",
                    "radial-gradient(circle at 50% 50%, #e6e9ef 14% 23%, transparent 24%)",
                    "repeating-radial-gradient(circle, rgba(255,255,255,.06) 0 1px, rgba(0,0,0,.08) 1px 2.5px)",
                    "conic-gradient(from 0deg,#ff5db1,#ffd24d,#7dff9e,#5de1ff,#a98bff,#ff5db1)",
                  ].join(","),
                }} />
                <span className="absolute inset-0 rounded-full pointer-events-none" style={{ background: "linear-gradient(120deg,transparent 40%,rgba(255,255,255,.4) 48%,transparent 56%)" }} />
              </span>
              <div className="min-w-0">
                <div className="text-[9px] font-extrabold tracking-[0.14em] uppercase text-[#FFB020]">🏆 {L("badge.tag")}</div>
                <div className="font-display text-[13px] font-extrabold leading-tight text-white">{L("badge.l1")}</div>
                <div className="font-display text-[13px] font-extrabold leading-tight bg-gradient-to-r from-[#FF7A1A] via-[#FFB020] to-[#B026FF] bg-clip-text text-transparent">{L("badge.l2")}</div>
              </div>
            </div>

            <div className="relative mt-3 rounded-full py-1.5 text-center text-[13px] font-extrabold text-black"
              style={{ background: "linear-gradient(135deg,#FF7A1A,#FFB020)", boxShadow: "0 4px 14px rgba(255,122,26,.5)" }}>
              {L("badge.cta")} ▶
            </div>
          </motion.button>

          <button onClick={dismiss}
            className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full border border-white/20 bg-[#12101c] text-white/60 hover:text-white hover:border-white/40 transition"
            aria-label="×">
            <X className="h-3 w-3" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
