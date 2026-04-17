import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Play, Clock, Loader2, GripVertical } from "lucide-react";
import { Droppable, Draggable } from "@hello-pangea/dnd";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";

import { formatDistanceToNow } from "date-fns";
import { TrackOptionsMenu, LikeButton } from "@/components/menus/TrackOptionsMenu";
import { cn } from "@/lib/utils";
import { HQCover } from "@/components/ui/HQCover";
import { withTimeout } from "@/lib/withTimeout";

const FETCH_TIMEOUT_MS = 15_000;
const TRACK_SELECT = "id,title,artist,album,duration,cover_url,audio_url,video_url,genre,mood";

interface RecentTrack {
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
  played_at: string;
}

export const RecentlyPlayed = () => {
  const [recentTracks, setRecentTracks] = useState<RecentTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { playPlaylist, currentTrack, isPlaying } = usePlayer();

  useEffect(() => {
    let isMounted = true;

    const fetchLatestTracks = async () => {
      const { data, error } = await withTimeout(
        supabase
          .from("tracks")
          .select(TRACK_SELECT)
          .or("audio_url.not.is.null,video_url.not.is.null")
          .order("created_at", { ascending: false })
          .limit(6),
        FETCH_TIMEOUT_MS,
        "RecentlyPlayed fallback"
      );

      if (error) throw error;

      return (data || []).map((track) => ({
        ...track,
        played_at: new Date().toISOString(),
      })) as RecentTrack[];
    };

    const fetchRecentTracks = async () => {
      setIsLoading(true);

      try {
        if (user) {
          try {
            const { data, error } = await withTimeout(
              supabase
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
                    audio_url,
                    video_url,
                    genre,
                    mood
                  )
                `)
                .eq("user_id", user.id)
                .order("played_at", { ascending: false })
                .limit(30),
              FETCH_TIMEOUT_MS,
              "RecentlyPlayed history"
            );

            if (error) throw error;

            const uniqueTracks = (data || [])
              .filter((item) => item.tracks)
              .map((item) => ({
                id: item.tracks!.id,
                title: item.tracks!.title,
                artist: item.tracks!.artist,
                album: item.tracks!.album,
                duration: item.tracks!.duration,
                cover_url: item.tracks!.cover_url,
                audio_url: item.tracks!.audio_url,
                video_url: item.tracks!.video_url,
                genre: item.tracks!.genre,
                mood: item.tracks!.mood,
                played_at: item.played_at,
              }))
              .filter((track, index, array) => array.findIndex((candidate) => candidate.id === track.id) === index)
              .slice(0, 6);

            if (uniqueTracks.length > 0) {
              if (isMounted) setRecentTracks(uniqueTracks);
              return;
            }
          } catch (error) {
            console.warn("[RecentlyPlayed] history fetch failed, using latest tracks:", error);
          }
        }

        const fallbackTracks = await fetchLatestTracks();
        if (isMounted) setRecentTracks(fallbackTracks);
      } catch (error) {
        console.error("Error fetching recent tracks:", error);
        if (isMounted) setRecentTracks([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void fetchRecentTracks();

    const handler = () => {
      void fetchRecentTracks();
    };

    window.addEventListener("track-list-changed", handler);

    return () => {
      isMounted = false;
      window.removeEventListener("track-list-changed", handler);
    };
  }, [user]);

  const handlePlayTrack = (track: RecentTrack, index: number) => {
    const tracksForPlayer: Track[] = recentTracks.map((item) => ({
      id: item.id,
      title: item.title,
      artist: item.artist,
      album: item.album,
      duration: item.duration,
      cover_url: item.cover_url,
      audio_url: item.audio_url,
      video_url: item.video_url,
      genre: item.genre,
      mood: item.mood,
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

      <Droppable droppableId="recent-played" direction="horizontal">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 rounded-xl transition-colors p-1",
              snapshot.isDraggingOver && "bg-accent/10 ring-2 ring-accent/20"
            )}
          >
            {recentTracks.map((track, index) => {
              const draggableId = `track-${encodeURIComponent(JSON.stringify({
                id: track.id,
                title: track.title,
                artist: track.artist,
              }))}`;

              return (
                <Draggable key={`${track.id}-${index}`} draggableId={draggableId} index={index}>
                  {(provided, snapshot) => (
                    <motion.div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{
                        opacity: 1,
                        x: 0,
                        scale: snapshot.isDragging ? 1.05 : 1,
                        boxShadow: snapshot.isDragging ? "0 20px 40px rgba(0,0,0,0.4)" : "none",
                        zIndex: snapshot.isDragging ? 1000 : 1,
                      }}
                      transition={{ delay: index * 0.05 }}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-md bg-secondary/50 hover:bg-secondary group cursor-pointer transition-colors",
                        currentTrack?.id === track.id && "ring-1 ring-primary",
                        snapshot.isDragging && "ring-2 ring-accent rotate-1"
                      )}
                    >
                      <div
                        {...provided.dragHandleProps}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing hover:bg-muted"
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                      </div>

                      <div
                        className="relative h-12 w-12 rounded overflow-hidden flex-shrink-0"
                        onClick={() => handlePlayTrack(track, index)}
                      >
                        <HQCover src={track.cover_url} alt={track.title} genre={track.genre} artist={track.artist} className="h-full w-full" />
                        <div
                          className={`absolute inset-0 flex items-center justify-center transition-opacity bg-black/40 ${
                            currentTrack?.id === track.id && isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          }`}
                        >
                          {currentTrack?.id === track.id && isPlaying ? (
                            <div className="flex gap-0.5">
                              {[1, 2, 3].map((i) => (
                                <motion.div
                                  key={i}
                                  className="w-0.5 bg-primary-foreground rounded-full"
                                  animate={{ height: [4, 12, 4] }}
                                  transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                                />
                              ))}
                            </div>
                          ) : (
                            <Play className="h-4 w-4 text-primary-foreground fill-current" />
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0" onClick={() => handlePlayTrack(track, index)}>
                        <p className="font-medium text-sm truncate">{track.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        {user && (
                          <span className="text-xs text-muted-foreground mr-2">
                            {formatDistanceToNow(new Date(track.played_at), { addSuffix: true })}
                          </span>
                        )}
                        <LikeButton trackId={track.id} className="opacity-0 group-hover:opacity-100" />
                        <TrackOptionsMenu
                          trackId={track.id}
                          trackTitle={track.title}
                          trackArtist={track.artist}
                          trackUrl={track.video_url || track.audio_url}
                          className="opacity-0 group-hover:opacity-100"
                          size="sm"
                        />
                      </div>
                    </motion.div>
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </section>
  );
};
