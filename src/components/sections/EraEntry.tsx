import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { ERAS } from "@/lib/eraEngine";

// Wejście do GROUA ERA na stronie głównej — dodatkowa sekcja, nie zmienia
// istniejącego układu. Zabiera użytkownika w podróż przez epoki.
export const EraEntry = () => {
  return (
    <div className="px-4 max-w-6xl mx-auto">
      <div
        className="rounded-2xl border border-white/10 p-5 sm:p-7 relative overflow-hidden"
        style={{ background: "linear-gradient(150deg, rgba(255,138,42,.10), rgba(169,139,255,.08) 60%, transparent)" }}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div>
            <span className="font-mono text-[11px] tracking-[.2em] uppercase text-[#FF8A2A] flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Groua Era · Nostalgia Engine
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1" style={{ letterSpacing: "-.02em" }}>
              Wejdź w epokę
            </h2>
            <p className="text-sm text-gray-400 mt-1">Wybierz czas, do którego chcesz wejść — muzyka zabierze Cię w podróż.</p>
          </div>
          <Link
            to="/era"
            className="px-4 py-2 rounded-full text-sm font-semibold text-black transition-transform hover:scale-105 whitespace-nowrap"
            style={{ background: "#FF8A2A", boxShadow: "0 0 18px rgba(255,138,42,.4)" }}
          >
            Wszystkie epoki →
          </Link>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {ERAS.map((e, i) => (
            <motion.div key={e.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Link
                to={`/era/${e.key}`}
                className="group flex flex-col items-center justify-center rounded-xl border shrink-0 w-[104px] h-[104px] transition-transform hover:-translate-y-1"
                style={{
                  background: `linear-gradient(160deg, ${e.palette.accentSoft}, ${e.palette.bg})`,
                  borderColor: `${e.palette.accent}40`,
                }}
              >
                <span className="text-2xl mb-1">{e.emoji}</span>
                <span className="font-extrabold text-white text-lg leading-none">{e.label}</span>
                <span className="text-[10px] mt-1 font-medium" style={{ color: e.palette.accent }}>{e.tagline}</span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
