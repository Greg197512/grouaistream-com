import { useEffect, useState } from "react";
import { Play, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { HQCover } from "@/components/ui/HQCover";
import { useLanguage } from "@/contexts/LanguageContext";

const SEL = "id,title,artist,album,duration,cover_url,audio_url,video_url,genre,mood";
const KW = [
  "hip-hop", "hip hop", "rap", "trap", "boom", "disco", "funk", "nu-disco",
  "dance", "house", "techno", "electro", "r&b", "rnb", "soul",
];

// „Na czasie": JEDNA duża karta hip-hop/disco, przewijanie lewo/prawo
// (bieżąca zanika i zaokrągla się, wchodzi następna). Do 40 utworów, live.
export const NaCzasieHits = () => {
  const { playPlaylist } = usePlayer();
  const { language } = useLanguage();
  const L = (pl: string, en: string, nl: string, ua: string) =>
    language === "en" ? en : language === "nl" ? nl : language === "ua" ? ua : pl;

  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [[index, dir], setIndexDir] = useState<[number, number]>([0, 0]);

  useEffect(() => {
    let alive = true;
    const matches = (g?: string | null) => !!g && KW.some((k) => g.toLowerCase().includes(k));
    (async () => {
      try {
        const orFilter = KW.map((k) => `genre.ilike.%${k}%`).join(",");
        const { data } = await supabase
          .from("tracks")
          .select(SEL)
          .or(orFilter)
          .not("audio_url", "is", null)
          .order("created_at", { ascending: false })
          .limit(40);
        if (alive) setTracks(Array.isArray(data) ? (data as unknown as Track[]).slice(0, 40) : []);
      } catch {
        if (alive) setTracks([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    // Live: nowe disco/hip-hop pojawia się od razu, gdy ktoś je doda.
    const channel = supabase
      .channel("na-czasie-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tracks" }, (payload) => {
        const row = payload.new as any;
        if (!alive || !row?.audio_url || !matches(row.genre)) return;
        setTracks((prev) => [row as Track, ...prev.filter((t) => t.id !== row.id)].slice(0, 40));
      })
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, []);

  if (!loading && tracks.length === 0) return null;

  const total = tracks.length;
  const safe = total ? ((index % total) + total) % total : 0;
  const tk = tracks[safe];
  const go = (d: number) => setIndexDir(([i]) => [i + d, d]);

  return (
    <section className="px-4 sm:px-6 max-w-6xl mx-auto mt-8 mb-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg sm:text-xl font-bold flex items-center gap-2">
          <span>🔥</span> {L("Na czasie", "Trending", "Trending", "У тренді")}
        </h3>
        {total > 0 && (
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {safe + 1}/{total} · Hip-Hop / Disco
          </span>
        )}
      </div>

      {loading ? (
        <div className="h-[300px] sm:h-[360px] rounded-3xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> {L("Ładuję…", "Loading…", "Laden…", "Завантаження…")}
        </div>
      ) : (
        <div className="relative h-[300px] sm:h-[360px] select-none">
          <AnimatePresence initial={false} custom={dir} mode="popLayout">
            <motion.div
              key={tk?.id || safe}
              custom={dir}
              initial={{ opacity: 0, scale: 0.9, x: dir >= 0 ? 130 : -130, borderRadius: 44 }}
              animate={{ opacity: 1, scale: 1, x: 0, borderRadius: 24 }}
              exit={{ opacity: 0, scale: 0.8, x: dir >= 0 ? -130 : 130, borderRadius: 64 }}
              transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              onDragEnd={(_e, info) => {
                if (info.offset.x < -60) go(1);
                else if (info.offset.x > 60) go(-1);
              }}
              className="absolute inset-0 overflow-hidden border border-white/12 shadow-[0_24px_50px_-20px_rgba(0,0,0,0.85)] cursor-grab active:cursor-grabbing"
            >
              <HQCover
                src={tk?.cover_url}
                alt={tk?.title}
                genre={tk?.genre}
                artist={tk?.artist}
                className="absolute inset-0 w-full h-full"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/35" />

              <span className="absolute top-4 left-4 text-[11px] font-bold px-2.5 py-1 rounded-full bg-black/50 backdrop-blur text-white/85">
                #{safe + 1}
              </span>

              <button
                onClick={() => playPlaylist(tracks, safe, "na-czasie")}
                aria-label={L("Odtwórz", "Play", "Afspelen", "Відтворити")}
                className="group absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-20 w-20 rounded-full text-white flex items-center justify-center shadow-[0_14px_34px_-8px_hsl(331_100%_62%/0.7)] hover:scale-110 active:scale-95 transition-transform"
              >
                {/* fioletowa warstwa (domyślnie) */}
                <span aria-hidden className="absolute inset-0 rounded-full groove-gradient-bg transition-opacity duration-150 group-active:opacity-0" />
                {/* przezroczyste szkło (po wciśnięciu) */}
                <span aria-hidden className="absolute inset-0 rounded-full bg-white/10 backdrop-blur-md border border-white/40 opacity-0 group-active:opacity-100 transition-opacity duration-150" />
                <Play className="relative z-10 h-9 w-9 fill-current ml-1" />
              </button>

              <div className="absolute left-5 right-5 bottom-5">
                <div className="font-display text-2xl sm:text-3xl font-extrabold text-white drop-shadow truncate">
                  {tk?.title}
                </div>
                <div className="text-sm text-white/80 mt-0.5 truncate">
                  {tk?.artist} · {total} {L("utworów", "tracks", "nummers", "треків")}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {total > 1 && (
            <>
              <button
                onClick={() => go(-1)}
                aria-label="Poprzedni"
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/45 backdrop-blur border border-white/15 text-white flex items-center justify-center hover:bg-black/65 transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => go(1)}
                aria-label="Następny"
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/45 backdrop-blur border border-white/15 text-white flex items-center justify-center hover:bg-black/65 transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
};
