import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Play, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

interface RecentTrack {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  duration: number;
  cover_url: string | null;
  audio_url: string | null;
  played_at: string;
}

export const RecentlyPlayed = () => {
  const [recentTracks, setRecentTracks] = useState<RecentTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { playPlaylist, currentTrack, isPlaying } = usePlayer();

  useEffect(() => {
    const fetchRecentTracks = async () => {
      setIsLoading(true);
      try {
        if (user) {
          // Fetch from listening history for logged-in users
          const { data, error } = await supabase
            .from("listening_history")
            .select(`
              id,
              played_at,
              tracks (
                id,
                title,
                artist,
                album,
                duration,
                cover_url,
                audio_url
              )
            `)
            .eq("user_id", user.id)
            .order("played_at", { ascending: false })
            .limit(6);

          if (error) throw error;

          if (data) {
            const tracks = data
              .filter(item => item.tracks)
              .map(item => ({
                id: item.tracks!.id,
                title: item.tracks!.title,
                artist: item.tracks!.artist,
                album: item.tracks!.album,
                duration: item.tracks!.duration,
                cover_url: item.tracks!.cover_url,
                audio_url: item.tracks!.audio_url,
                played_at: item.played_at,
              }));
            setRecentTracks(tracks);
          }
        } else {
          // Fetch sample tracks for non-logged users
          const { data, error } = await supabase
            .from("tracks")
            .select("*")
            .limit(6);

          if (error) throw error;

          if (data) {
            setRecentTracks(data.map(t => ({
              ...t,
              played_at: new Date().toISOString(),
            })));
          }
        }
      } catch (error) {
        console.error("Error fetching recent tracks:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecentTracks();
  }, [user]);

  const handlePlayTrack = (track: RecentTrack, index: number) => {
    // Play the recent tracks as a playlist starting at the clicked index
    const tracksForPlayer = recentTracks.map(t => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      album: t.album,
      duration: t.duration,
      cover_url: t.cover_url,
      audio_url: t.audio_url,
      genre: null,
      mood: null,
    }));
    playPlaylist(tracksForPlayer, index);
  };

  if (isLoading) {
    return (
      <section className="px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-display text-xl font-bold">Jump Back In</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </section>
    );
  }

  if (recentTracks.length === 0) {
    return (
      <section className="px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-display text-xl font-bold">Jump Back In</h2>
        </div>
        <p className="text-muted-foreground">Start listening to see your recent tracks here!</p>
      </section>
    );
  }

  return (
    <section className="px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Clock className="h-5 w-5 text-muted-foreground" />
        <h2 className="font-display text-xl font-bold">Jump Back In</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {recentTracks.map((track, index) => (
          <motion.div
            key={`${track.id}-${index}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ scale: 1.02 }}
            onClick={() => handlePlayTrack(track, index)}
            className={`flex items-center gap-3 p-3 rounded-md bg-secondary/50 hover:bg-secondary group cursor-pointer transition-colors ${
              currentTrack?.id === track.id ? "ring-1 ring-primary" : ""
            }`}
          >
            <div className="relative h-12 w-12 rounded overflow-hidden flex-shrink-0">
              {track.cover_url ? (
                <img src={track.cover_url} alt={track.title} className="h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 groove-gradient-bg opacity-70" />
              )}
              <div className={`absolute inset-0 flex items-center justify-center transition-opacity bg-black/40 ${
                currentTrack?.id === track.id && isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}>
                {currentTrack?.id === track.id && isPlaying ? (
                  <div className="flex gap-0.5">
                    {[1, 2, 3].map((i) => (
                      <motion.div
                        key={i}
                        className="w-0.5 bg-white rounded-full"
                        animate={{ height: [4, 12, 4] }}
                        transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                      />
                    ))}
                  </div>
                ) : (
                  <Play className="h-4 w-4 text-white fill-current" />
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{track.title}</p>
              <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
            </div>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {user ? formatDistanceToNow(new Date(track.played_at), { addSuffix: true }) : ""}
            </span>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
