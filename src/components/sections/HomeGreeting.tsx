import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

// Górny pasek strony głównej: animowany status GrouAI + chipsy kategorii.
// Bez powitania/imienia (zależnego od logowania) — element ma być "super GrouAI".
export const HomeGreeting = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const L = (pl: string, en: string, nl: string, ua: string) =>
    language === "en" ? en : language === "nl" ? nl : language === "ua" ? ua : pl;

  // Cyklicznie zmieniający się stan AI — wrażenie, że GrouAI naprawdę pracuje.
  const states = [
    L("SŁUCHAM CIEBIE", "LISTENING TO YOU", "LUISTERT NAAR JOU", "СЛУХАЮ ТЕБЕ"),
    L("ANALIZUJĘ", "ANALYZING", "ANALYSEERT", "АНАЛІЗУЮ"),
    L("DOSTRAJAM", "ADAPTING", "PAST AAN", "АДАПТУЮ"),
    L("TWÓJ NASTRÓJ", "YOUR MOOD", "JOUW STEMMING", "ТВІЙ НАСТРІЙ"),
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % states.length), 2600);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [states.length]);

  const forYou = L("Dla Ciebie", "For You", "Voor jou", "Для тебе");
  const chips = [forYou, "Pop", "Hip-Hop", "Rock", "Electronic", "Chill", "GROUA ERA"];
  const [active, setActive] = useState(forYou);
  const onChip = (c: string) => {
    setActive(c);
    if (c === forYou) return;
    if (c === "GROUA ERA") { navigate("/era"); return; }
    navigate(`/search?q=${encodeURIComponent(c)}`);
  };

  return (
    <section className="px-4 sm:px-6 pt-5 max-w-6xl mx-auto">
      {/* Animowany status GrouAI */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="inline-flex items-center gap-2.5 rounded-full pl-2.5 pr-4 py-1.5 border border-white/12
                   bg-white/[0.04] backdrop-blur-md"
        style={{ boxShadow: "0 0 30px -12px hsl(268 100% 66% / 0.5)" }}
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </span>
        <span className="text-[11px] font-bold tracking-[0.18em] text-muted-foreground">GROUAI</span>
        <span className="text-white/30">·</span>
        <span className="relative h-4 min-w-[128px] overflow-hidden">
          <motion.span
            key={idx}
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -14, opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="absolute left-0 top-0 text-[11px] font-bold tracking-[0.14em] whitespace-nowrap
                       bg-gradient-to-r from-[hsl(331_100%_66%)] to-[hsl(268_100%_72%)] bg-clip-text text-transparent"
          >
            {states[idx]}
          </motion.span>
        </span>
      </motion.div>

      {/* Chipsy kategorii */}
      <div className="flex gap-2 overflow-x-auto pb-1 mt-3" style={{ scrollbarWidth: "none" }}>
        {chips.map((c) => {
          const on = c === active;
          return (
            <motion.button
              key={c}
              whileTap={{ scale: 0.94 }}
              onClick={() => onChip(c)}
              className={
                "flex-none px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all " +
                (on
                  ? "text-white border border-transparent groove-gradient-bg shadow-[0_8px_20px_-8px_hsl(331_100%_62%/0.6)]"
                  : "text-muted-foreground border border-white/10 bg-white/[0.03] hover:border-primary/40 hover:text-white")
              }
            >
              {c}
            </motion.button>
          );
        })}
      </div>
    </section>
  );
};
