import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Play, Flame, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import { HQCover } from "@/components/ui/HQCover";
import { LikeButton, TrackOptionsMenu } from "@/components/menus/TrackOptionsMenu";
import { cn } from "@/lib/utils";

const PINNED_TRACK_ID = "043749a5-1e86-4d2d-8846-a41a90cc5a38";
const FETCH_TIMEOUT_MS = 10_000;

interface ServerTrack extends Track {
  created_at: string;
}

export const NewOnServer = () => {
  const [tracks, setTracks] = useState<ServerTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const { playPlaylist, currentTrack, isPlaying } = usePlayer();
  const navigate = useNavigate();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const fetchLatest = async () => {
      try {
        if (mountedRef.current) {
          setLoading(true);
          setHasError(false);
        }

        const [latestRes, pinnedRes] = await Promise.all([
          supabase
            .from("tracks")
            .select("*")
            .or("audio_url.not.is.null,video_url.not.is.null")
            .order("created_at", { ascending: false })
            .limit(12),
          supabase
            .from("tracks")
            .select("*")
            .eq("id", PINNED_TRACK_ID)
            .maybeSingle(),
        ]);

        if (!mountedRef.current) return;

        if (latestRes.error) throw latestRes.error;

        const latest = (latestRes.data || []) as ServerTrack[];
        const pinned = pinnedRes.data as ServerTrack | null;

        const rest = latest.filter(t => t.id !== PINNED_TRACK_ID);
        const combined = pinned ? [pinned, ...rest] : rest;
        setTracks(combined.slice(0, 8));
      } catch (err) {
        console.error("[NewOnServer] fetch error:", err);
        if (mountedRef.current) setHasError(true);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };

    // Safety timeout — force-stop loader after FETCH_TIMEOUT_MS
    const timeout = setTimeout(() => {
      if (mountedRef.current && loading) {
        console.warn("[NewOnServer] fetch timed out after", FETCH_TIMEOUT_MS, "ms");
        setLoading(false);
        setHasError(true);
      }
    }, FETCH_TIMEOUT_MS);

    fetchLatest().finally(() => clearTimeout(timeout));

    const channel = supabase
      .channel("new-tracks-home")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tracks" }, () => {
        if (mountedRef.current) fetchLatest();
      })
      .subscribe((status, err) => {
        if (err) console.error("[NewOnServer] realtime error:", err);
      });

    return () => {
      mountedRef.current = false;
      clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, []);

  const handlePlay = (track: Track, index: number) => {
    playPlaylist(tracks, index);
  };

  const handleRetry = () => {
    setLoading(true);
    setHasError(false);
    // Re-mount effect by forcing state change — simpler: just refetch inline
    const refetch = async () => {
      try {
        const { data, error } = await supabase
          .from("tracks")
          .select("*")
          .or("audio_url.not.is.null,video_url.not.is.null")
          .order("created_at", { ascending: false })
          .limit(12);

        if (error) throw error;
        setTracks((data || []) as ServerTrack[]);
      } catch (err) {
        console.error("[NewOnServer] retry error:", err);
        setHasError(true);
      } finally {
        setLoading(false);
      }
    };
    refetch();
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

  if (hasError) {
    return (
      <section className="px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Flame className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl font-bold">🔥 Nowe na serwerze</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <p className="text-sm text-muted-foreground">Nie udało się załadować — spróbuj ponownie</p>
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Ponów
          </button>
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
            <div className="relative aspect-square overflow-hidden">
              <HQCover
                src={track.cover_url}
                alt={track.title}
                genre={track.genre}
                artist={track.artist}
                className="h-full w-full object-cover"
              />
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

              <div className="absolute top-2 left-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground uppercase tracking-wider">
                  New
                </span>
              </div>

              <div className="absolute bottom-2 right-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white/80 backdrop-blur-sm">
                  {formatDistanceToNow(new Date(track.created_at), { addSuffix: true, locale: pl })}
                </span>
              </div>
            </div>

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