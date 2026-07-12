import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Sparkles, X } from "lucide-react";
import { isStudioPromoActive, STUDIO_FREE_UNTIL } from "@/contexts/SubscriptionContext";

const SESSION_KEY = "grouai-studio-intro-shown";
const AUTO_DISMISS_MS = 6000;

/**
 * Intro-reklama GrouAI Studio na stronie głównej. Pojawia się raz na sesję,
 * chwilę stoi, po czym ROZPŁYWA SIĘ JAK MGŁA (blur + fade). Tylko w trakcie
 * promocji „tydzień free" (isStudioPromoActive) — potem sama znika z życia.
 */
export const StudioPromoIntro = () => {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isStudioPromoActive()) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");
    setVisible(true);
  }, []);

  const dismiss = useCallback(() => setVisible(false), []);

  // Auto-znikanie + zniknięcie przy scrollu.
  useEffect(() => {
    if (!visible) return;
    const t = window.setTimeout(dismiss, AUTO_DISMISS_MS);
    const onScroll = () => dismiss();
    window.addEventListener("scroll", onScroll, { passive: true, once: true });
    return () => { window.clearTimeout(t); window.removeEventListener("scroll", onScroll); };
  }, [visible, dismiss]);

  const goStudio = () => { dismiss(); setTimeout(() => navigate("/suno"), 150); };
  const dateStr = STUDIO_FREE_UNTIL.toLocaleDateString("pl-PL", { day: "2-digit", month: "long" });

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="studio-intro"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, filter: "blur(28px)", transition: { duration: 1.4, ease: "easeInOut" } }}
          transition={{ duration: 0.6 }}
          onClick={dismiss}
          className="fixed inset-0 z-[200] grid place-items-center px-4 cursor-pointer"
          style={{
            background:
              "radial-gradient(1000px 600px at 20% 0%, rgba(255,107,0,.22), transparent 60%)," +
              "radial-gradient(1000px 700px at 100% 10%, rgba(147,51,234,.28), transparent 55%)," +
              "rgba(8,6,15,.86)",
            backdropFilter: "blur(4px)",
          }}
          aria-label="Reklama GrouAI Studio"
        >
          {/* Warstwy mgły — dryfują i gasną, wzmacniają efekt rozpłynięcia */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              aria-hidden
              className="pointer-events-none absolute rounded-full"
              style={{
                width: 460, height: 460,
                left: `${10 + i * 32}%`, top: `${8 + i * 22}%`,
                background: i % 2 === 0
                  ? "radial-gradient(circle, rgba(255,255,255,.10), transparent 70%)"
                  : "radial-gradient(circle, rgba(147,51,234,.16), transparent 70%)",
                filter: "blur(40px)",
              }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 0.8, scale: 1, x: [0, 30, -10, 0], y: [0, -20, 10, 0] }}
              exit={{ opacity: 0, scale: 1.6 }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: i * 0.6 }}
            />
          ))}

          {/* Karta reklamy */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 18, filter: "blur(8px)" }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 1.06, filter: "blur(24px)", transition: { duration: 1.2, ease: "easeInOut" } }}
            transition={{ type: "spring", damping: 22, stiffness: 220 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg cursor-default overflow-hidden rounded-[26px] border border-white/12 bg-[#12101c]/85 p-8 text-center shadow-2xl"
            style={{ boxShadow: "0 30px 90px -20px rgba(147,51,234,.6)" }}
          >
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#FF6B00] via-[#FF9500] to-[#9333EA]" />

            <button
              onClick={dismiss}
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition"
              aria-label="Zamknij"
            >
              <X className="h-4 w-4" />
            </button>

            <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-white/50">
              <Sparkles className="h-3.5 w-3.5 text-[#FF9500]" /> GrouAI Stream
            </span>

            <h2 className="mt-4 text-3xl sm:text-4xl font-black leading-tight text-white" style={{ textWrap: "balance" } as any}>
              Twórz własną{" "}
              <span className="bg-gradient-to-r from-[#FF9500] via-[#FF6B00] to-[#9333EA] bg-clip-text text-transparent">
                muzykę AI
              </span>
            </h2>
            <p className="mt-3 text-base text-white/70">
              <b className="text-white">Suno? Już niepotrzebne.</b> Masz to u nas — opisz utwór jednym zdaniem, resztę robi AI.
            </p>

            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/12 px-4 py-2 text-sm font-extrabold text-emerald-200">
              🎁 CAŁY TYDZIEŃ ZA DARMO — do {dateStr}
            </div>

            <div className="mt-4 space-y-1 text-sm text-white/70">
              <p>Potem: <b className="text-white">Muzyka</b> — plan <b className="text-white">Pro 9,90 zł/mies</b></p>
              <p><b className="text-white">Wideo / teledyski</b> — plan <b className="text-white">VIP</b></p>
            </div>

            <button
              onClick={goStudio}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-lg font-black text-white transition hover:scale-[1.02]"
              style={{ background: "linear-gradient(135deg, #FF6B00, #FF9500 45%, #9333EA)", boxShadow: "0 16px 40px -12px rgba(255,107,0,.6)" }}
            >
              Twórz teraz →
            </button>
            <p className="mt-3 text-[11px] text-white/40">Kliknij gdziekolwiek, aby pominąć</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
