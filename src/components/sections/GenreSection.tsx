import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Play, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { cn } from "@/lib/utils";

interface GenreSectionProps {
  genre: string;
  title: string;
  icon: string;
  color: string;
  limit?: number;
}

export const GenreSection = ({ genre, title, icon, color, limit = 8 }: GenreSectionProps) => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { playPlaylist, currentTrack, isPlaying } = usePlayer();

  useEffect(() => {
    const fetchTracks = async () => {
      setIsLoading(true);
      try {
        // Build genre filter based on base genre
        let query = supabase.from("tracks").select("*");
        
        if (genre === "Rock") {
          query = query.or("genre.eq.Rock,genre.eq.Pop-Rock,genre.ilike.%rock%");
        } else if (genre === "Punk") {
          query = query.or("genre.eq.Punk,genre.eq.Pop-Punk,genre.eq.Punk-Rock,genre.ilike.%punk%");
        } else if (genre === "Pop") {
          query = query.or("genre.eq.Pop,genre.ilike.%pop%").not("genre", "ilike", "%punk%").not("genre", "ilike", "%rock%");
        } else {
          query = query.or(`genre.ilike.%${genre}%,genre.eq.${genre}`);
        }
        
        const { data, error } = await query
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) throw error;
        setTracks(data || []);
      } catch (error) {
        console.error(`Error fetching ${genre} tracks:`, error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTracks();
  }, [genre, limit]);

  const handlePlayTrack = (track: Track, index: number) => {
    playPlaylist(tracks, index);
  };

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      playPlaylist(tracks, 0);
    }
  };

  if (isLoading) {
    return (
      <section className="px-6 py-6">
        <div className="flex items-center gap-3 mb-4">
          <span className={cn("material-icons text-2xl", color)}>{icon}</span>
          <h2 className="font-display text-xl font-bold">{title}</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </section>
    );
  }

  if (tracks.length === 0) {
    return null;
  }

  return (
    <section className="px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <motion.span 
            className={cn("material-icons text-2xl", color)}
            whileHover={{ scale: 1.2, rotate: 10 }}
          >
            {icon}
          </motion.span>
          <h2 className="font-display text-xl font-bold">{title}</h2>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">
            {tracks.length} tracks
          </span>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handlePlayAll}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium",
            "bg-gradient-to-r from-primary to-accent text-primary-foreground"
          )}
        >
          <Play className="h-4 w-4 fill-current" />
          Play All
        </motion.button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {tracks.map((track, index) => (
          <motion.div
            key={track.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ scale: 1.02 }}
            onClick={() => handlePlayTrack(track, index)}
            className={cn(
              "relative group cursor-pointer rounded-lg overflow-hidden bg-secondary/50 hover:bg-secondary transition-all",
              currentTrack?.id === track.id && "ring-2 ring-primary"
            )}
          >
            {/* Cover */}
            <div className="relative aspect-square">
              {track.cover_url ? (
                <img
                  src={track.cover_url}
                  alt={track.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full groove-gradient-bg opacity-60" />
              )}

              {/* Play overlay */}
              <div className={cn(
                "absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity",
                currentTrack?.id === track.id && isPlaying 
                  ? "opacity-100" 
                  : "opacity-0 group-hover:opacity-100"
              )}>
                {currentTrack?.id === track.id && isPlaying ? (
                  <div className="flex gap-1">
                    {[1, 2, 3].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1 bg-primary rounded-full"
                        animate={{ height: [8, 24, 8] }}
                        transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                      />
                    ))}
                  </div>
                ) : (
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    className="p-3 rounded-full bg-primary text-primary-foreground"
                  >
                    <Play className="h-6 w-6 fill-current" />
                  </motion.div>
                )}
              </div>

              {/* YouTube badge */}
              {track.video_url && (
                <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-red-600 text-[10px] text-white font-bold">
                  YT
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-3">
              <p className="font-medium text-sm truncate">{track.title}</p>
              <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
