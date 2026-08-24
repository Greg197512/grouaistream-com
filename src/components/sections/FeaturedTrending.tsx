import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { HQCover } from "@/components/ui/HQCover";
import { useLanguage } from "@/contexts/LanguageContext";

const SEL = "id,title,artist,album,duration,cover_url,audio_url,video_url,genre,mood";

// Wielka karta "Top Trending" w stylu referencyjnym (Fock fest 2025).
// Reużywa istniejące dane (tracks) i player. Gdy brak danych → nic nie renderuje.
export const FeaturedTrending = () => {
  const { playPlaylist } = usePlayer();
  const { language } = useLanguage();
  const L = (pl: string, en: string, nl: string, ua: string) =>
    language === "en" ? en : language === "nl" ? nl : language === "ua" ? ua : pl;

  const [tracks, setTracks] = useState<Track[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase
          .from("tracks")
          .select(SEL)
          .not("audio_url", "is", null)
          .not("cover_url", "is", null)
          .order("created_at", { ascending: false })
          .limit(12);
        if (alive && Array.isArray(data)) setTracks(data as unknown as Track[]);
      } catch {
        /* cicho — sekcja po prostu się nie pokaże */
      }
    })();
    return () => { alive = false; };
  }, []);

  if (tracks.length === 0) return null;
  const feat = tracks[0];
  const count = tracks.length;

  return (
    <section className="px-4 sm:px-6 max-w-6xl mx-auto mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg sm:text-xl font-bold flex items-center gap-2">
          <span>🔥</span> {L("Na czasie", "Top Trending", "Trending nu", "У тренді")}
        </h2>
      </div>

      <button
        onClick={() => playPlaylist(tracks)}
        className="relative block w-full h-44 sm:h-52 rounded-2xl overflow-hidden group border border-white/10 text-left
                   shadow-[0_18px_40px_-18px_rgba(0,0,0,0.8)] hover:border-primary/40 transition-colors"
      >
        <HQCover
          src={feat.cover_url}
          alt={feat.title}
          genre={feat.genre}
          artist={feat.artist}
          className="absolute inset-0 w-full h-full transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(4,4,8,.15) 0%, rgba(4,4,8,.55) 55%, rgba(4,4,8,.92) 100%)" }} />

        {/* big play button */}
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-16 w-16 rounded-full
                         groove-gradient-bg flex items-center justify-center text-white
                         shadow-[0_10px_30px_-8px_hsl(331_100%_62%/0.7)] group-hover:scale-110 transition-transform">
          <Play className="h-7 w-7 fill-current ml-0.5" />
        </span>

        {/* meta */}
        <div className="absolute left-4 right-4 bottom-4">
          <h3 className="font-display text-xl sm:text-2xl font-extrabold text-white drop-shadow">{feat.title}</h3>
          <p className="text-sm text-white/80 mt-0.5">
            {feat.artist} · {count} {L("utworów", "songs", "nummers", "треків")}
          </p>
        </div>
      </button>
    </section>
  );
};
