import { useEffect, useRef, useState } from "react";
import { Play, ChevronLeft, ChevronRight, Maximize2, Loader2, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { HQCover } from "@/components/ui/HQCover";
import { useLanguage } from "@/contexts/LanguageContext";
import { FeedReels } from "@/components/sections/FeedReels";
import { loadYT } from "@/lib/youtubeIframe";
import { AI_TELEDYSKI } from "@/lib/aiTeledyski";

const SEL = "id,title,artist,album,duration,cover_url,audio_url,video_url,genre,mood";

// „Na czasie / Teledyski AI": pokazuje NASZE teledyski (utwory z wideo, np. reset404)
// jako przewijaną karuzelę — na komputerze widać tytuł „co jest co", strzałki
// lewo/prawo, na telefonie/kliknięciu pełny ekran (rolki). Gdy brak własnych
// teledysków — fallback do playlisty YouTube.
export const NaCzasieHits = () => {
  const { language } = useLanguage();
  const { playPlaylist } = usePlayer();
  const L = (pl: string, en: string, nl: string, ua: string) =>
    language === "en" ? en : language === "nl" ? nl : language === "ua" ? ua : pl;

  const [clips, setClips] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [[index, dir], setIndexDir] = useState<[number, number]>([0, 0]);
  const [reels, setReels] = useState(false);

  // Nasze teledyski = utwory z video_url (najnowsze najpierw).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase
          .from("tracks").select(SEL)
          .not("video_url", "is", null)
          .order("created_at", { ascending: false }).limit(40);
        if (alive) setClips(Array.isArray(data) ? (data as unknown as Track[]) : []);
      } catch { if (alive) setClips([]); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const total = clips.length;
  const safe = total ? ((index % total) + total) % total : 0;
  const clip = clips[safe];
  const go = (d: number) => setIndexDir(([i]) => [i + d, d]);

  return (
    <section className="px-4 sm:px-6 max-w-6xl mx-auto mt-8 mb-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg sm:text-xl font-bold flex items-center gap-2">
          <span>🔥</span> {L("Na czasie", "Trending", "Trending", "У тренді")}
        </h3>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {total > 0 ? `${safe + 1}/${total} · ` : ""}{L("Teledyski AI", "AI videos", "AI-clips", "AI-кліпи")}
        </span>
      </div>

      {loading ? (
        <div className="h-[300px] sm:h-[380px] rounded-3xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> {L("Ładuję…", "Loading…", "Laden…", "Завантаження…")}
        </div>
      ) : total > 0 ? (
        <div className="relative h-[300px] sm:h-[380px] select-none">
          <AnimatePresence initial={false} custom={dir} mode="popLayout">
            <motion.div
              key={clip.id}
              custom={dir}
              initial={{ opacity: 0, scale: 0.92, x: dir >= 0 ? 120 : -120, borderRadius: 40 }}
              animate={{ opacity: 1, scale: 1, x: 0, borderRadius: 24 }}
              exit={{ opacity: 0, scale: 0.85, x: dir >= 0 ? -120 : 120, borderRadius: 56 }}
              transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              onDragEnd={(_e, info) => { if (info.offset.x < -60) go(1); else if (info.offset.x > 60) go(-1); }}
              className="absolute inset-0 overflow-hidden border border-white/12 shadow-[0_24px_50px_-20px_rgba(0,0,0,0.85)] cursor-grab active:cursor-grabbing bg-black"
            >
              <HQCover src={clip.cover_url} alt={clip.title} genre={clip.genre} artist={clip.artist} videoUrl={clip.video_url} className="absolute inset-0 w-full h-full" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/35" />

              <span className="absolute top-4 left-4 text-[11px] font-bold px-2.5 py-1 rounded-full bg-black/50 backdrop-blur text-white/85">#{safe + 1}</span>

              {/* Play — odtwórz nasze teledyski przez nasz player */}
              <button
                onClick={() => playPlaylist(clips, safe, "na-czasie")}
                aria-label={L("Odtwórz", "Play", "Afspelen", "Відтворити")}
                className="group absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-20 w-20 rounded-full text-white flex items-center justify-center shadow-[0_14px_34px_-8px_hsl(331_100%_62%/0.7)] hover:scale-110 active:scale-95 transition-transform"
              >
                <span aria-hidden className="absolute inset-0 rounded-full groove-gradient-bg transition-opacity duration-150 group-active:opacity-0" />
                <span aria-hidden className="absolute inset-0 rounded-full bg-white/10 backdrop-blur-md border border-white/40 opacity-0 group-active:opacity-100 transition-opacity duration-150" />
                <Play className="relative z-10 h-9 w-9 fill-current ml-1" />
              </button>

              {/* Tytuł „co jest co" */}
              <div className="absolute left-5 right-5 bottom-5">
                <div className="font-display text-2xl sm:text-3xl font-extrabold text-white drop-shadow truncate">{clip.title}</div>
                <div className="text-sm text-white/80 mt-0.5 truncate">{clip.artist}</div>
              </div>

              {/* Pełny ekran / rolki */}
              <button onClick={(e) => { e.stopPropagation(); setReels(true); }} aria-label={L("Pełny ekran", "Fullscreen", "Volledig", "Повний екран")}
                className="absolute top-4 right-4 z-10 inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-black/50 backdrop-blur border border-white/15 text-white text-xs font-semibold hover:bg-black/70 transition-colors">
                <Maximize2 className="h-4 w-4" /> {L("Rolki", "Reels", "Reels", "Ролики")}
              </button>
            </motion.div>
          </AnimatePresence>

          {total > 1 && (
            <>
              <button onClick={() => go(-1)} aria-label={L("Poprzedni", "Previous", "Vorige", "Попередній")}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/45 backdrop-blur border border-white/15 text-white flex items-center justify-center hover:bg-black/65 transition-colors">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button onClick={() => go(1)} aria-label={L("Następny", "Next", "Volgende", "Наступний")}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/45 backdrop-blur border border-white/15 text-white flex items-center justify-center hover:bg-black/65 transition-colors">
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
      ) : (
        <YouTubeFallback lang={language} onFullscreen={() => setReels(true)} L={L} />
      )}

      {/* Pełnoekranowe rolki: nasze utwory + teledyski AI (YouTube bez końca) */}
      <AnimatePresence>
        {reels && (
          <FeedReels
            ytTab={{ label: L("Teledyski AI", "AI videos", "AI-clips", "AI-кліпи"), videoIds: AI_TELEDYSKI }}
            includeOurSongs
            lang={language}
            onClose={() => setReels(false)}
          />
        )}
      </AnimatePresence>
    </section>
  );
};

// Fallback: okno z playlistą YouTube (gdy nie mamy własnych teledysków).
const YouTubeFallback = ({ lang, onFullscreen, L }: { lang: string; onFullscreen: () => void; L: (pl: string, en: string, nl: string, ua: string) => string }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [vid, setVid] = useState<{ title?: string; author?: string }>({});
  const refreshMeta = () => { try { const d = playerRef.current?.getVideoData?.(); if (d?.title) setVid({ title: d.title, author: d.author }); } catch { /* */ } };
  useEffect(() => {
    let cancelled = false;
    loadYT().then((YT) => {
      if (cancelled || !mountRef.current) return;
      playerRef.current = new YT.Player(mountRef.current, {
        width: "100%", height: "100%",
        playerVars: { autoplay: 0, controls: 1, rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => { try { playerRef.current?.cuePlaylist?.({ playlist: AI_TELEDYSKI, index: 0 }); } catch { /* */ } setReady(true); setTimeout(refreshMeta, 600); },
          onStateChange: () => refreshMeta(),
          onError: () => { try { playerRef.current?.nextVideo?.(); } catch { /* */ } },
        },
      });
    });
    return () => { cancelled = true; try { playerRef.current?.destroy?.(); } catch { /* */ } };
  }, []);
  const go = (d: number) => { try { if (d > 0) playerRef.current?.nextVideo?.(); else playerRef.current?.previousVideo?.(); } catch { /* */ } setTimeout(refreshMeta, 500); };
  return (
    <div className="relative h-[300px] sm:h-[380px] rounded-3xl overflow-hidden border border-white/12 shadow-[0_24px_50px_-20px_rgba(0,0,0,0.85)] bg-black select-none">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-full" style={{ aspectRatio: "16 / 9", maxHeight: "100%" }}><div ref={mountRef} className="w-full h-full" /></div>
      </div>
      {!ready && <div className="absolute inset-0 flex items-center justify-center text-white/70 gap-2 pointer-events-none"><Loader2 className="h-5 w-5 animate-spin" /> {L("Ładuję…", "Loading…", "Laden…", "Завантаження…")}</div>}
      <button type="button" aria-label={L("Otwórz na pełny ekran", "Open fullscreen", "Volledig scherm", "На весь екран")} onClick={onFullscreen} className="sm:hidden absolute inset-0 z-[5]" />
      <div className="absolute left-3 right-24 bottom-3 z-[8] pointer-events-none">
        <div className="text-sm font-bold text-white drop-shadow truncate">{vid.title || "…"}</div>
        {vid.author && <div className="text-[12px] text-white/75 drop-shadow truncate">{vid.author}</div>}
      </div>
      <button onClick={() => go(-1)} aria-label={L("Poprzedni", "Previous", "Vorige", "Попередній")} className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/50 backdrop-blur border border-white/15 text-white flex items-center justify-center hover:bg-black/70 transition-colors"><ChevronLeft className="h-5 w-5" /></button>
      <button onClick={() => go(1)} aria-label={L("Następny", "Next", "Volgende", "Наступний")} className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/50 backdrop-blur border border-white/15 text-white flex items-center justify-center hover:bg-black/70 transition-colors"><ChevronRight className="h-5 w-5" /></button>
      <button onClick={onFullscreen} aria-label={L("Pełny ekran", "Fullscreen", "Volledig", "Повний екран")} className="absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-black/50 backdrop-blur border border-white/15 text-white text-xs font-semibold hover:bg-black/70 transition-colors"><Maximize2 className="h-4 w-4" /> {L("Rolki", "Reels", "Reels", "Ролики")}</button>
      <span className="absolute top-3 left-3 z-[8] inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/10 backdrop-blur border border-white/20 text-white/90 pointer-events-none"><Plus className="h-3.5 w-3.5" /> {L("w rolkach", "in reels", "in reels", "у роликах")}</span>
    </div>
  );
};
