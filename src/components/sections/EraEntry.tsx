import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { ERAS, eraArtUrl } from "@/lib/eraEngine";
import { eraTextFor, eraUi } from "@/lib/eraContent";
import { useLanguage } from "@/contexts/LanguageContext";

// Wejście do GROUA ERA na stronie głównej — dodatkowa sekcja, nie zmienia
// istniejącego układu. Zabiera użytkownika w podróż przez epoki.
export const EraEntry = () => {
  const { language } = useLanguage();
  return (
    <div className="px-4 max-w-6xl mx-auto">
      <div
        className="rounded-2xl border border-white/10 p-5 sm:p-7 relative overflow-hidden"
        style={{ background: "linear-gradient(150deg, rgba(169,139,255,.12), rgba(56,230,255,.08) 60%, transparent)" }}
      >
        <div className="absolute inset-0 bg-cover bg-center pointer-events-none" style={{ backgroundImage: "url('/bg/era.jpg')", opacity: 0.32 }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(180deg, rgba(4,4,8,.35), rgba(4,4,8,.75))" }} />
        <div className="relative z-10 flex items-center justify-between gap-3 flex-wrap mb-4">
          <div>
            <span className="font-mono text-[11px] tracking-[.2em] uppercase text-[#FF8A2A] flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> {eraUi(language, "brand")}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1" style={{ letterSpacing: "-.02em" }}>
              {eraUi(language, "enterTitle")}
            </h2>
            <p className="text-sm text-gray-400 mt-1">{eraUi(language, "entrySubtitle")}</p>
          </div>
          <Link
            to="/era"
            className="px-4 py-2 rounded-full text-sm font-semibold text-black transition-transform hover:scale-105 whitespace-nowrap"
            style={{ background: "#FF8A2A", boxShadow: "0 0 18px rgba(255,138,42,.4)" }}
          >
            {eraUi(language, "allEras")}
          </Link>
        </div>

        <div className="relative z-10 flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {ERAS.map((e, i) => {
            const et = eraTextFor(e, language);
            return (
              <motion.div key={e.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Link
                  to={`/era/${e.key}`}
                  className="group relative flex flex-col items-center justify-end overflow-hidden rounded-xl border shrink-0 w-[120px] h-[136px] transition-transform hover:-translate-y-1"
                  style={{ borderColor: `${e.palette.accent}55`, boxShadow: `0 0 16px ${e.palette.glow}` }}
                >
                  {/* Grafika AI epoki */}
                  <img
                    src={eraArtUrl(e, 240, 300)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    onError={(ev) => { (ev.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                  {/* Fallback gradient (widoczny zanim/gdy obraz się nie załaduje) */}
                  <div className="absolute inset-0 -z-10" style={{ background: `linear-gradient(160deg, ${e.palette.accentSoft}, ${e.palette.bg})` }} />
                  {/* Przyciemnienie pod tekst */}
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,.85) 0%, rgba(0,0,0,.35) 45%, rgba(0,0,0,.15) 100%)" }} />
                  <div className="relative z-10 flex flex-col items-center pb-2.5 px-1">
                    <span className="text-xl mb-0.5 drop-shadow-lg">{e.emoji}</span>
                    <span className="font-extrabold text-white text-lg leading-none drop-shadow-lg">{et.label}</span>
                    <span className="text-[10px] mt-1 font-semibold text-center leading-tight drop-shadow-lg" style={{ color: e.palette.accent }}>{et.tagline}</span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
