import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Loader2, Plus } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { FeedReels } from "@/components/sections/FeedReels";
import { loadYT } from "@/lib/youtubeIframe";

// Playlista YouTube „bez końca" z teledyskami AI (sama pomija martwe filmy).
const AI_PLAYLIST = "PLmUquWDI4xqs33YgwDAAF5s5MK_a5S0sk";

// „Na czasie": okno z odtwarzaczem teledysków AI. Na komputerze oglądasz w oknie
// (widać tytuł „co jest co"), przewijasz strzałkami lewo/prawo. Na telefonie
// tapnięcie otwiera pełny ekran (rolki). ➕ dodawanie w rolkach.
export const NaCzasieHits = () => {
  const { language } = useLanguage();
  const L = (pl: string, en: string, nl: string, ua: string) =>
    language === "en" ? en : language === "nl" ? nl : language === "ua" ? ua : pl;

  const mountRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [vid, setVid] = useState<{ title?: string; author?: string }>({});
  const [reels, setReels] = useState(false);

  const refreshMeta = () => {
    try { const d = playerRef.current?.getVideoData?.(); if (d?.title) setVid({ title: d.title, author: d.author }); } catch { /* */ }
  };

  useEffect(() => {
    let cancelled = false;
    loadYT().then((YT) => {
      if (cancelled || !mountRef.current) return;
      playerRef.current = new YT.Player(mountRef.current, {
        width: "100%", height: "100%",
        playerVars: {
          listType: "playlist", list: AI_PLAYLIST,
          autoplay: 0, controls: 1, rel: 0, modestbranding: 1, playsinline: 1,
        },
        events: {
          onReady: () => { setReady(true); setTimeout(refreshMeta, 400); },
          onStateChange: () => refreshMeta(),
        },
      });
    });
    return () => { cancelled = true; try { playerRef.current?.destroy?.(); } catch { /* */ } };
  }, []);

  const go = (d: number) => { try { if (d > 0) playerRef.current?.nextVideo?.(); else playerRef.current?.previousVideo?.(); } catch { /* */ } setTimeout(refreshMeta, 500); };

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

      <div className="relative h-[300px] sm:h-[380px] rounded-3xl overflow-hidden border border-white/12 shadow-[0_24px_50px_-20px_rgba(0,0,0,0.85)] bg-black select-none">
        {/* Odtwarzacz YouTube (oglądanie w oknie na komputerze) */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-full" style={{ aspectRatio: "16 / 9", maxHeight: "100%" }}>
            <div ref={mountRef} className="w-full h-full" />
          </div>
        </div>

        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-white/70 gap-2 pointer-events-none">
            <Loader2 className="h-5 w-5 animate-spin" /> {L("Ładuję…", "Loading…", "Laden…", "Завантаження…")}
          </div>
        )}

        {/* Telefon: tapnięcie otwiera pełny ekran (rolki). Na komputerze oglądasz w oknie. */}
        <button
          type="button"
          aria-label={L("Otwórz na pełny ekran", "Open fullscreen", "Volledig scherm", "На весь екран")}
          onClick={() => setReels(true)}
          className="sm:hidden absolute inset-0 z-[5]"
        />

        {/* Tytuł — „co jest co" */}
        <div className="absolute left-3 right-24 bottom-3 z-[8] pointer-events-none">
          <div className="text-sm font-bold text-white drop-shadow truncate">{vid.title || "…"}</div>
          {vid.author && <div className="text-[12px] text-white/75 drop-shadow truncate">{vid.author}</div>}
        </div>

        {/* Przewijanie lewo / prawo */}
        <button onClick={() => go(-1)} aria-label={L("Poprzedni", "Previous", "Vorige", "Попередній")}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/50 backdrop-blur border border-white/15 text-white flex items-center justify-center hover:bg-black/70 transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button onClick={() => go(1)} aria-label={L("Następny", "Next", "Volgende", "Наступний")}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/50 backdrop-blur border border-white/15 text-white flex items-center justify-center hover:bg-black/70 transition-colors">
          <ChevronRight className="h-5 w-5" />
        </button>

        {/* Pełny ekran / rolki (działa też na komputerze) */}
        <button onClick={() => setReels(true)} aria-label={L("Pełny ekran", "Fullscreen", "Volledig", "Повний екран")}
          className="absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-black/50 backdrop-blur border border-white/15 text-white text-xs font-semibold hover:bg-black/70 transition-colors">
          <Maximize2 className="h-4 w-4" /> {L("Rolki", "Reels", "Reels", "Ролики")}
        </button>

        {/* Plakietka: dodaj do playlisty (w rolkach) */}
        <span className="absolute top-3 left-3 z-[8] inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/10 backdrop-blur border border-white/20 text-white/90 pointer-events-none">
          <Plus className="h-3.5 w-3.5" /> {L("w rolkach", "in reels", "in reels", "у роликах")}
        </span>
      </div>

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
