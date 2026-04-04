import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Play, HardDrive, Loader2, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, Track } from "@/contexts/PlayerContext";


import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import { HQCover } from "@/components/ui/HQCover";
import { LikeButton, TrackOptionsMenu } from "@/components/menus/TrackOptionsMenu";
import { cn } from "@/lib/utils";

interface ServerTrack extends Track {
  created_at: string;
}

export const NewOnServer = () => {
  const [tracks, setTracks] = useState<ServerTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const { playPlaylist, currentTrack, isPlaying } = usePlayer();
  
  
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLatest = async () => {
      setLoading(true);
      let query = supabase
        .from("tracks")
        .select("*")
        .or("audio_url.not.is.null,video_url.not.is.null");
      
      const { data } = await query
        .order("created_at", { ascending: false })
        .limit(8);

      setTracks((data || []) as ServerTrack[]);
      setLoading(false);
    };

    fetchLatest();

    const channel = supabase
      .channel("new-tracks-home")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tracks" }, () => {
        fetchLatest();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [applyUnlockFilter]);

  const handlePlay = (track: Track, index: number) => {
    playPlaylist(tracks, index);
  };

  if (loading) {
    return (
      <section className="px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Flame className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl font-bold">🔥 Nowe na serwerze</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </section>
    );
  }

  if (tracks.length === 0) return null;

  return (
    <section className="px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Flame className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl font-bold">🔥 Nowe na serwerze</h2>
        </div>
        <button
          onClick={() => navigate("/server")}
          className="text-sm text-primary hover:underline"
        >
          Zobacz wszystkie →
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {tracks.map((track, index) => (
          <motion.div
            key={track.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="group relative rounded-xl overflow-hidden bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer"
            onClick={() => handlePlay(track, index)}
          >
            {/* Cover Art - Square aspect ratio like Suno/Facebook posts */}
            <div className="relative aspect-square overflow-hidden">
              <HQCover
                src={track.cover_url}
                alt={track.title}
                genre={track.genre}
                artist={track.artist}
                className="h-full w-full object-cover"
              />
              {/* Play overlay */}
              <div className={cn(
                "absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity",
                currentTrack?.id === track.id && isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
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
                  <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center shadow-lg">
                    <Play className="h-5 w-5 text-primary-foreground fill-current ml-0.5" />
                  </div>
                )}
              </div>

              {/* NEW badge */}
              <div className="absolute top-2 left-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground uppercase tracking-wider">
                  New
                </span>
              </div>

              {/* Time ago */}
              <div className="absolute bottom-2 right-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white/80 backdrop-blur-sm">
                  {formatDistanceToNow(new Date(track.created_at), { addSuffix: true, locale: pl })}
                </span>
              </div>
            </div>

            {/* Track info */}
            <div className="p-3">
              <p className="font-semibold text-sm truncate">{track.title}</p>
              <div className="flex items-center gap-1">
                <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                <span className="text-[7px] font-bold text-primary/70 whitespace-nowrap">Grouarock®</span>
              </div>
              {track.genre && (
                <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {track.genre}
                </span>
              )}
            </div>

            {/* Action buttons */}
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
              <LikeButton trackId={track.id} />
              <TrackOptionsMenu
                trackId={track.id}
                trackTitle={track.title}
                trackArtist={track.artist}
                trackUrl={track.video_url || track.audio_url}
                size="sm"
              />
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
