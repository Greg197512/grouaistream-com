import { useEffect, useState } from "react";
import { Play, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { HQCover } from "@/components/ui/HQCover";
import { useLanguage } from "@/contexts/LanguageContext";

const SEL = "id,title,artist,album,duration,cover_url,audio_url,video_url,genre,mood";
const KW = ["hip-hop", "hip hop", "rap", "trap", "disco", "funk", "nu-disco", "dance"];

// „Na czasie" pod przyciskami hero: 40 utworów hip-hop / disco,
// duże karty, poziome przewijanie, klik play odtwarza od danego utworu.
export const NaCzasieHits = () => {
  const { playPlaylist } = usePlayer();
  const { language } = useLanguage();
  const L = (pl: string, en: string, nl: string, ua: string) =>
    language === "en" ? en : language === "nl" ? nl : language === "ua" ? ua : pl;

  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
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
    return () => { alive = false; };
  }, []);

  if (!loading && tracks.length === 0) return null;

  return (
    <div className="mt-2 mb-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg sm:text-xl font-bold flex items-center gap-2">
          <span>🔥</span> {L("Na czasie", "Trending", "Trending", "У тренді")} · Hip-Hop / Disco
        </h3>
        {!loading && (
          <span className="text-[11px] text-muted-foreground">
            {tracks.length} {L("utworów", "tracks", "nummers", "треків")}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 h-44 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> {L("Ładuję…", "Loading…", "Laden…", "Завантаження…")}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-3" style={{ scrollbarWidth: "none", scrollSnapType: "x mandatory" }}>
          {tracks.map((tk, i) => (
            <div key={tk.id || i} className="flex-none w-[170px]" style={{ scrollSnapAlign: "start" }}>
              <div className="relative w-[170px] h-[170px] rounded-2xl overflow-hidden border border-white/12 shadow-[0_16px_34px_-16px_rgba(0,0,0,0.85),inset_0_0_0_1px_hsl(315_100%_72%/0.12)] group">
                <HQCover src={tk.cover_url} alt={tk.title} genre={tk.genre} artist={tk.artist} className="w-full h-full transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/50 backdrop-blur text-white/80">#{i + 1}</span>
                <button
                  onClick={() => playPlaylist(tracks, i, "na-czasie")}
                  aria-label={L("Odtwórz", "Play", "Afspelen", "Відтворити")}
                  className="absolute bottom-2 right-2 h-12 w-12 rounded-full groove-gradient-bg text-white flex items-center justify-center shadow-[0_10px_24px_-6px_hsl(331_100%_62%/0.7)] opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all"
                >
                  <Play className="h-6 w-6 fill-current ml-0.5" />
                </button>
              </div>
              <div className="mt-2">
                <div className="font-semibold text-sm truncate">{tk.title}</div>
                <div className="text-[12px] text-muted-foreground truncate">{tk.artist}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
