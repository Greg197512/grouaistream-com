import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, Play, Loader2, RefreshCw, Heart, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { HQCover } from "@/components/ui/HQCover";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import top10Bg from "@/assets/library/top10-card.jpg";

interface TopTrack {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  duration: number;
  cover_url: string | null;
  audio_url: string | null;
  video_url: string | null;
  genre: string | null;
  mood: string | null;
  like_count: number;
}

export const Top10Chart = () => {
  const [tracks, setTracks] = useState<TopTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const { playPlaylist, currentTrack, isPlaying, togglePlay, playTrack } = usePlayer();

  const fetchTop10 = async () => {
    setLoading(true);
    try {
      // Get all liked_songs, group by track_id, count likes, join tracks
      const { data, error } = await supabase
        .from("liked_songs")
        .select("track_id, tracks(*)");

      if (error) throw error;

      // Count likes per track
      const likeCounts: Record<string, { count: number; track: any }> = {};
      (data || []).forEach((ls: any) => {
        if (!ls.tracks) return;
        const tid = ls.track_id;
        if (!likeCounts[tid]) {
          likeCounts[tid] = { count: 0, track: ls.tracks };
        }
        likeCounts[tid].count++;
      });

      // Sort by like count descending, take top 10
      const sorted = Object.entries(likeCounts)
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 10)
        .map(([id, { count, track }]) => ({
          ...track,
          like_count: count,
        }));

      setTracks(sorted);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Error fetching top 10:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTop10();
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchTop10, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handlePlayAll = () => {
    if (tracks.length === 0) return;
    const playerTracks: Track[] = tracks.map(t => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      album: t.album,
      duration: t.duration,
      cover_url: t.cover_url,
      audio_url: t.audio_url,
      video_url: t.video_url,
      genre: t.genre,
      mood: t.mood,
    }));
    playPlaylist(playerTracks, 0);
  };

  const medalColors = [
    "from-yellow-400 to-amber-500", // gold
    "from-gray-300 to-gray-400",    // silver
    "from-amber-600 to-orange-700", // bronze
  ];

  return (
    <section className="mb-8">
      <div className="relative rounded-2xl overflow-hidden border border-amber-500/30">
        {/* Background image */}
        <div className="absolute inset-0">
          <img src={top10Bg} alt="" className="w-full h-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/70" />
        </div>

        <div className="relative p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
                <Trophy className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold flex items-center gap-2">
                  🏆 Top 10 — Najczęściej Lubiane
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Radio className="h-3 w-3" /> Na antenie co godzinę
                  </Badge>
                </h2>
                <p className="text-xs text-muted-foreground">
                  Odświeża się automatycznie • Ostatnio: {lastRefresh.toLocaleTimeString("pl-PL")}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={fetchTop10} className="gap-1">
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Odśwież
              </Button>
              {tracks.length > 0 && (
                <Button size="sm" onClick={handlePlayAll} className="gap-1 groove-gradient-bg text-primary-foreground">
                  <Play className="h-3.5 w-3.5 fill-current" /> Odtwórz Top 10
                </Button>
              )}
            </div>
          </div>

          {/* Track list */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : tracks.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              Brak polubień — polub utwory, aby zobaczyć ranking! ❤️
            </p>
          ) : (
            <div className="space-y-1.5">
              {tracks.map((track, index) => {
                const isCurrent = currentTrack?.id === track.id;
                const isTop3 = index < 3;

                return (
                  <motion.div
                    key={track.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => isCurrent ? togglePlay() : playTrack({
                      id: track.id,
                      title: track.title,
                      artist: track.artist,
                      album: track.album,
                      duration: track.duration,
                      cover_url: track.cover_url,
                      audio_url: track.audio_url,
                      video_url: track.video_url,
                      genre: track.genre,
                      mood: track.mood,
                    })}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all group",
                      isCurrent ? "bg-primary/15 ring-1 ring-primary/40" : "hover:bg-secondary/60",
                      isTop3 && "bg-gradient-to-r from-amber-500/5 to-transparent"
                    )}
                  >
                    {/* Position */}
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg font-bold text-sm flex-shrink-0",
                      isTop3
                        ? `bg-gradient-to-br ${medalColors[index]} text-black`
                        : "bg-secondary text-muted-foreground"
                    )}>
                      {index + 1}
                    </div>

                    {/* Cover */}
                    <div className="h-12 w-12 rounded-lg overflow-hidden flex-shrink-0 relative">
                      <HQCover src={track.cover_url} alt={track.title} genre={track.genre} artist={track.artist} className="h-full w-full" />
                      <div className={cn(
                        "absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity",
                        isCurrent && isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      )}>
                        {isCurrent && isPlaying ? (
                          <div className="flex gap-0.5">
                            {[1, 2, 3].map(i => (
                              <motion.div key={i} className="w-0.5 bg-primary-foreground rounded-full"
                                animate={{ height: [4, 14, 4] }}
                                transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                              />
                            ))}
                          </div>
                        ) : (
                          <Play className="h-4 w-4 text-primary-foreground fill-current" />
                        )}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className={cn("font-medium text-sm truncate", isCurrent && "text-primary")}>
                        {track.title}
                      </p>
                      <div className="flex items-center gap-1">
                        <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                        <span className="text-[7px] font-bold text-primary/70 whitespace-nowrap">Grouarock®</span>
                      </div>
                    </div>

                    {/* Like count */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Heart className="h-3.5 w-3.5 text-red-400 fill-red-400" />
                      <span className="text-sm font-semibold text-red-400">{track.like_count}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
