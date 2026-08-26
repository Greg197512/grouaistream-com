import { useState } from "react";
import { Play, Clapperboard, Plus } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { FeedReels } from "@/components/sections/FeedReels";

// Playlista YouTube „bez końca" z teledyskami AI (sama pomija martwe filmy).
const AI_PLAYLIST = "PLmUquWDI4xqs33YgwDAAF5s5MK_a5S0sk";

// „Na czasie": karta otwierająca pełnoekranowe rolki teledysków AI (bez końca
// z YouTube — same dobre, martwe filmy są pomijane) + zakładka „Nasze utwory".
export const NaCzasieHits = () => {
  const { language } = useLanguage();
  const L = (pl: string, en: string, nl: string, ua: string) =>
    language === "en" ? en : language === "nl" ? nl : language === "ua" ? ua : pl;

  const [reels, setReels] = useState(false);

  return (
    <section className="px-4 sm:px-6 max-w-6xl mx-auto mt-8 mb-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg sm:text-xl font-bold flex items-center gap-2">
          <span>🔥</span> {L("Na czasie", "Trending", "Trending", "У тренді")}
        </h3>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {L("Teledyski AI · bez końca", "AI videos · endless", "AI-clips · eindeloos", "AI-кліпи · без кінця")}
        </span>
      </div>

      <button
        onClick={() => setReels(true)}
        className="group relative block w-full h-[300px] sm:h-[360px] rounded-3xl overflow-hidden border border-white/12 shadow-[0_24px_50px_-20px_rgba(0,0,0,0.85)] text-left"
      >
        {/* Tło */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(120% 120% at 20% 10%, hsl(331 100% 62% / 0.55), transparent 55%), radial-gradient(120% 120% at 90% 90%, hsl(268 100% 66% / 0.6), transparent 55%), linear-gradient(160deg, #17101f, #0b0a12)" }} />
        <div aria-hidden className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "repeating-linear-gradient(0deg, #fff 0, #fff 1px, transparent 2px, transparent 5px)" }} />

        {/* Duży przycisk play (fiolet → przezroczyste szkło po wciśnięciu) */}
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-20 w-20 rounded-full text-white flex items-center justify-center shadow-[0_14px_34px_-8px_hsl(331_100%_62%/0.7)] group-hover:scale-110 group-active:scale-95 transition-transform">
          <span aria-hidden className="absolute inset-0 rounded-full groove-gradient-bg transition-opacity duration-150 group-active:opacity-0" />
          <span aria-hidden className="absolute inset-0 rounded-full bg-white/10 backdrop-blur-md border border-white/40 opacity-0 group-active:opacity-100 transition-opacity duration-150" />
          <Play className="relative z-10 h-9 w-9 fill-current ml-1" />
        </span>

        {/* Plakietki */}
        <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-black/45 backdrop-blur text-white/90">
          <Clapperboard className="h-3.5 w-3.5" /> {L("Rolki", "Reels", "Reels", "Ролики")}
        </span>
        <span className="absolute top-4 right-4 inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/10 backdrop-blur border border-white/20 text-white/90">
          <Plus className="h-3.5 w-3.5" /> {L("Dodaj do playlisty", "Add to playlist", "Aan playlist", "До плейлиста")}
        </span>

        {/* Opis */}
        <div className="absolute left-5 right-5 bottom-5">
          <div className="font-display text-2xl sm:text-3xl font-extrabold text-white drop-shadow">
            {L("Teledyski AI", "AI music videos", "AI-videoclips", "AI-кліпи")}
          </div>
          <div className="text-sm text-white/80 mt-0.5">
            {L("Oglądaj jak rolki — przewijaj, dodawaj do playlisty", "Watch as reels — swipe, add to playlist", "Bekijk als reels — swipe, voeg toe", "Дивись як ролики — гортай, додавай")}
          </div>
        </div>
      </button>

      {/* Pełnoekranowe rolki: teledyski AI (bez końca) + nasze utwory */}
      <AnimatePresence>
        {reels && (
          <FeedReels
            ytTab={{ label: L("Na czasie", "Trending", "Trending", "У тренді"), playlistId: AI_PLAYLIST }}
            includeOurSongs
            lang={language}
            onClose={() => setReels(false)}
          />
        )}
      </AnimatePresence>
    </section>
  );
};
