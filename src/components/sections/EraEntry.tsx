import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, Shuffle } from "lucide-react";
import { ERAS, eraArtUrl, type Era } from "@/lib/eraEngine";
import { eraTextFor, eraUi } from "@/lib/eraContent";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tilt3D } from "@/components/ui/Tilt3D";
import { subscribeShake, ensureMotionPermission } from "@/lib/deviceMotion";

function shuffleEras(arr: Era[]): Era[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Delikatne ziarno filmowe (SVG feTurbulence jako data-URI) — nakładka „kinowa".
const GRAIN = `data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>"
)}`;

// Wejście do GROUA ERA na stronie głównej — dodatkowa sekcja, nie zmienia
// istniejącego układu. Zabiera użytkownika w podróż przez epoki.
export const EraEntry = () => {
  const { language } = useLanguage();
  const [order, setOrder] = useState<Era[]>(ERAS);
  const [waking, setWaking] = useState(0); // bump = przebudzenie/tasowanie

  const shuffleNow = () => {
    setOrder((prev) => shuffleEras(prev));
    setWaking((n) => n + 1);
  };

  // Potrząśnięcie telefonem → karty się budzą, mieszają i wracają w innej kolejności.
  useEffect(() => {
    ensureMotionPermission();
    return subscribeShake(() => shuffleNow());
  }, []);

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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={shuffleNow}
              title="Potrząśnij telefonem lub kliknij — przetasuj epoki"
              className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/5 text-white/80 transition hover:bg-white/10 hover:text-white active:scale-90"
              aria-label="Przetasuj epoki"
            >
              <Shuffle className="h-4 w-4" />
            </button>
            <Link
              to="/era"
              className="px-4 py-2 rounded-full text-sm font-semibold text-black transition-transform hover:scale-105 whitespace-nowrap"
              style={{ background: "#FF8A2A", boxShadow: "0 0 18px rgba(255,138,42,.4)" }}
            >
              {eraUi(language, "allEras")}
            </Link>
          </div>
        </div>

        <div className="relative z-10 flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {order.map((e, i) => {
            const et = eraTextFor(e, language);
            return (
              <motion.div
                key={e.key}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={waking ? { opacity: 1, y: 0, scale: [1, 0.88, 1.06, 1], rotate: [0, -5, 5, 0] } : { opacity: 1, y: 0 }}
                transition={waking ? { duration: 0.6, delay: (i % 8) * 0.05 } : { delay: i * 0.04, layout: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }}
                className="shrink-0"
              >
                <Tilt3D radius="0.9rem" max={14} className="w-[150px]">
                <Link
                  to={`/era/${e.key}`}
                  className="group relative flex h-[200px] w-[150px] flex-col items-center justify-end overflow-hidden rounded-[0.9rem] border"
                  style={{ borderColor: `${e.palette.accent}66`, boxShadow: `0 12px 32px -14px #000, 0 0 22px ${e.palette.glow}` }}
                >
                  {/* Filmowa grafika AI epoki (wyższa rozdzielczość) */}
                  <img
                    src={eraArtUrl(e, 512, 680)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.12]"
                    onError={(ev) => { (ev.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                  {/* Fallback gradient */}
                  <div className="absolute inset-0 -z-10" style={{ background: `linear-gradient(160deg, ${e.palette.accentSoft}, ${e.palette.bg})` }} />
                  {/* Color-grade epoki */}
                  <div className="absolute inset-0 mix-blend-soft-light" style={{ background: `linear-gradient(150deg, ${e.palette.accent}55, transparent 60%)` }} />
                  {/* Ziarno filmowe */}
                  <div className="absolute inset-0 opacity-[0.13] mix-blend-overlay" style={{ backgroundImage: `url("${GRAIN}")`, backgroundSize: "140px" }} />
                  {/* Winieta + scrim pod tekst */}
                  <div className="absolute inset-0" style={{ background: "radial-gradient(120% 90% at 50% 28%, transparent 42%, rgba(0,0,0,.55) 100%)" }} />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,.92) 0%, rgba(0,0,0,.28) 48%, transparent 100%)" }} />
                  {/* Światło u góry na hover */}
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `linear-gradient(to bottom, ${e.palette.accent}40, transparent)` }} />
                  <div className="relative z-10 flex flex-col items-center pb-3 px-1.5">
                    <span className="text-2xl mb-0.5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">{e.emoji}</span>
                    <span className="font-display font-extrabold text-white text-xl leading-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)] tracking-tight">{et.label}</span>
                    <span className="text-[10px] mt-1.5 font-semibold text-center leading-tight uppercase tracking-wide drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]" style={{ color: e.palette.accent }}>{et.tagline}</span>
                  </div>
                </Link>
                </Tilt3D>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
