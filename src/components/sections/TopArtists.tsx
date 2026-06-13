import { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, TrendingUp, Zap } from "lucide-react";
import { ArtistCard } from "@/components/cards/ArtistCard";
import { withTimeout } from "@/lib/withTimeout";

interface ArtistData {
  id: string;
  userId: string;
  name: string;
  trackCount: number;
  gradient: string;
  imageUrl?: string;
}

const generateUniqueAvatar = (name: string): string => {
  const styles = ["bottts-neutral", "shapes", "thumbs", "rings", "glass", "identicon"];
  const seed = encodeURIComponent(name.trim().toLowerCase());
  const style = styles[name.length % styles.length];
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}&backgroundType=gradientLinear&backgroundColor=ff6b35,f7931e,ffd23f,06ffa5,118ab2,7209b7,b5179e&radius=50`;
};

const gradients = [
  "from-pink-500 to-rose-500",
  "from-blue-500 to-cyan-500",
  "from-purple-500 to-pink-500",
  "from-green-500 to-emerald-500",
  "from-orange-500 to-yellow-500",
  "from-indigo-500 to-blue-500",
  "from-red-500 to-orange-500",
  "from-teal-500 to-green-500",
];

const RANK_CONFIG = [
  { emoji: "👑", label: "gold",   ring: "ring-yellow-400",  glow: "shadow-[0_0_28px_rgba(250,204,21,0.55)]",  bg: "from-yellow-500/20 to-amber-500/10" },
  { emoji: "🥈", label: "silver", ring: "ring-slate-300",   glow: "shadow-[0_0_22px_rgba(148,163,184,0.5)]",  bg: "from-slate-400/20 to-slate-300/10" },
  { emoji: "🥉", label: "bronze", ring: "ring-orange-400",  glow: "shadow-[0_0_20px_rgba(251,146,60,0.45)]",  bg: "from-orange-500/15 to-amber-400/10" },
];

export const TopArtists = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { playPlaylist } = usePlayer();
  const [artists, setArtists] = useState<ArtistData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-80px" });

  const handleArtistClick = async (artist: ArtistData) => {
    const { data } = await supabase
      .from("tracks")
      .select("*")
      .eq("user_id", artist.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data && data.length > 0) playPlaylist(data as Track[], 0);
    navigate(`/search?q=${encodeURIComponent(artist.name)}`);
  };

  const fetchTopArtists = async ({ retryOnEmpty = true }: { retryOnEmpty?: boolean } = {}) => {
    setIsLoading(true);
    try {
      const { data: tracksData } = await withTimeout(
        supabase
          .from("tracks")
          .select("user_id, artist")
          .not("user_id", "is", null)
          .limit(500),
        15_000,
        "TopArtists tracks"
      );

      if (!tracksData || tracksData.length === 0) {
        // Pusto może oznaczać przejściowy problem (timeout sesji auth / sieć),
        // a nie faktyczny brak twórców — spróbuj jeszcze raz po chwili.
        // NIE czyścimy już pokazanych twórców, żeby sekcja nie "znikała".
        if (retryOnEmpty) setTimeout(() => fetchTopArtists({ retryOnEmpty: false }), 2500);
        return;
      }

      const userTrackMap: Record<string, { count: number; artistName: string }> = {};
      tracksData.forEach(t => {
        if (!t.user_id) return;
        if (!userTrackMap[t.user_id]) userTrackMap[t.user_id] = { count: 0, artistName: t.artist };
        userTrackMap[t.user_id].count += 1;
      });

      const userIds = Object.keys(userTrackMap);
      if (userIds.length === 0) {
        if (retryOnEmpty) setTimeout(() => fetchTopArtists({ retryOnEmpty: false }), 2500);
        return;
      }

      const { data: profiles } = await withTimeout(
        supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url")
          .in("user_id", userIds),
        8_000,
        "TopArtists profiles"
      );

      const profileMap: Record<string, { name: string | null; avatar: string | null }> = {};
      profiles?.forEach(p => { profileMap[p.user_id] = { name: p.display_name, avatar: p.avatar_url }; });

      const finalArtists: ArtistData[] = userIds
        .map((uid, index) => {
          const profile = profileMap[uid];
          const name = userTrackMap[uid].artistName || profile?.name || "Artist";
          return {
            id: uid, userId: uid, name,
            trackCount: userTrackMap[uid].count,
            gradient: gradients[index % gradients.length],
            imageUrl: profile?.avatar || generateUniqueAvatar(name),
          };
        })
        .sort((a, b) => b.trackCount - a.trackCount)
        .slice(0, 16);

      setArtists(finalArtists);
    } catch (error) {
      console.error("Error fetching top artists:", error);
      // Błąd (np. abort/timeout) — ponów raz; nie czyścimy już pokazanych twórców.
      if (retryOnEmpty) setTimeout(() => fetchTopArtists({ retryOnEmpty: false }), 2500);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTopArtists();
    const channel = supabase
      .channel("trending-artists-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tracks" }, () => fetchTopArtists({ retryOnEmpty: false }))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => fetchTopArtists({ retryOnEmpty: false }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const maxTracks = artists[0]?.trackCount || 1;

  // Spinner tylko przy pierwszym ładowaniu — gdy twórcy są już pokazani,
  // odświeżanie w tle ich nie chowa (sekcja nie "miga" i nie znika).
  if (isLoading && artists.length === 0) return (
    <section className="px-4 sm:px-6 py-8">
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </section>
  );

  if (artists.length === 0) return null;

  return (
    <section ref={sectionRef} className="px-4 sm:px-6 py-8 overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={isInView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <div className="flex items-center gap-3 mb-1">
            {/* Animated LIVE dot */}
            <div className="relative flex items-center gap-2">
              <motion.span
                className="inline-block h-2.5 w-2.5 rounded-full bg-primary"
                animate={{ scale: [1, 1.6, 1], opacity: [1, 0.4, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.span
                className="absolute h-2.5 w-2.5 rounded-full bg-primary/40"
                animate={{ scale: [1, 2.8, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
            <h2 className="font-display text-2xl font-bold bg-gradient-to-r from-foreground via-primary to-foreground bg-[length:200%_auto] animate-[shimmer_3s_linear_infinite] bg-clip-text">
              Trending Artists
            </h2>
            <motion.div
              animate={{ rotate: [0, 15, -10, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 3 }}
            >
              <Zap className="h-5 w-5 text-primary fill-primary/30" />
            </motion.div>
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            Twórcy z utworami w GrouAI Stream
          </p>
        </div>

        {/* Top-3 mini legend */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="hidden sm:flex gap-2 text-xs text-muted-foreground"
        >
          {RANK_CONFIG.map((r, i) => (
            <span key={i} className="flex items-center gap-1">
              {r.emoji} #{i + 1}
            </span>
          ))}
        </motion.div>
      </motion.div>

      {/* ── Grid ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4">
        {artists.map((artist, index) => {
          const rank = index + 1;
          const rankCfg = rank <= 3 ? RANK_CONFIG[index] : null;

          // staggered spring entrance
          const colCount = 4; // approximate
          const row = Math.floor(index / colCount);
          const col = index % colCount;
          const fromLeft = col % 2 === 0;

          return (
            <motion.div
              key={artist.id}
              initial={{
                opacity: 0,
                x: rank <= 3 ? 0 : fromLeft ? -40 : 40,
                y: rank <= 3 ? -30 : 20,
                scale: rank <= 3 ? 0.75 : 0.9,
                rotate: rank <= 3 ? (index === 0 ? -4 : index === 1 ? 0 : 4) : (fromLeft ? -3 : 3),
              }}
              animate={isInView ? { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 } : {}}
              transition={{
                delay: index * 0.055,
                type: "spring",
                stiffness: rank <= 3 ? 220 : 280,
                damping: rank <= 3 ? 18 : 22,
              }}
              className="relative"
            >
              {/* Top-3 outer glow ring */}
              {rankCfg && (
                <motion.div
                  className={`absolute -inset-1 rounded-3xl bg-gradient-to-br ${rankCfg.bg} blur-sm`}
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: index * 0.4 }}
                />
              )}

              {/* Rank badge */}
              <motion.div
                initial={{ scale: 0, rotate: -30 }}
                animate={isInView ? { scale: 1, rotate: 0 } : {}}
                transition={{ delay: index * 0.055 + 0.25, type: "spring", stiffness: 400, damping: 15 }}
                className={`absolute -top-2 -right-2 z-30 flex items-center justify-center h-7 w-7 rounded-full text-xs font-black shadow-lg
                  ${rankCfg
                    ? `bg-gradient-to-br ${rank === 1 ? "from-yellow-400 to-amber-500 text-yellow-900" : rank === 2 ? "from-slate-300 to-slate-400 text-slate-800" : "from-orange-400 to-orange-500 text-white"}`
                    : "bg-secondary/90 text-muted-foreground border border-border/50 text-[10px]"
                  }`}
              >
                {rankCfg ? rankCfg.emoji : `#${rank}`}
              </motion.div>

              {/* Track count progress bar */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={isInView ? { scaleX: 1 } : {}}
                transition={{ delay: index * 0.055 + 0.4, duration: 0.6, ease: "easeOut" }}
                className="absolute -bottom-1 left-2 right-2 h-0.5 rounded-full bg-border/40 overflow-hidden z-20"
                style={{ transformOrigin: "left" }}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60"
                  style={{ width: `${(artist.trackCount / maxTracks) * 100}%` }}
                />
              </motion.div>

              <ArtistCard
                name={artist.name}
                followers={artist.trackCount === 1 ? "1 utwór" : `${artist.trackCount} utworów`}
                gradient={artist.gradient}
                imageUrl={artist.imageUrl}
                isTrending={true}
                trackCount={artist.trackCount}
                onClick={() => handleArtistClick(artist)}
              />
            </motion.div>
          );
        })}
      </div>

      {/* Bottom shimmer line */}
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={isInView ? { scaleX: 1, opacity: 1 } : {}}
        transition={{ delay: artists.length * 0.055 + 0.2, duration: 0.8, ease: "easeOut" }}
        className="mt-8 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
        style={{ transformOrigin: "left" }}
      />
    </section>
  );
};
