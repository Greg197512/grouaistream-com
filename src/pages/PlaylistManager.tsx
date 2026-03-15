import { useState, useEffect } from "react";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { motion } from "framer-motion";
import { Music, ArrowLeftRight, Loader2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { DraggableTrackList } from "@/components/dnd/DraggableTrackList";
import { PlaylistDropZone } from "@/components/dnd/PlaylistDropZone";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Track } from "@/contexts/PlayerContext";
import { useUnlock } from "@/contexts/UnlockContext";
import { toast } from "sonner";

interface Playlist {
  id: string;
  title: string;
  gradient: string | null;
  tracks: Track[];
}

const PlaylistManager = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { filterTracks } = useUnlock();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [allTracks, setAllTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    loadData();
  }, [user, navigate]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    // Load user playlists with their tracks
    const { data: playlistsData } = await supabase
      .from("playlists")
      .select("id, title, gradient")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    // Load all tracks
    const { data: tracksData } = await supabase
      .from("tracks")
      .select("*")
      .order("title");

    const tracks: Track[] = filterTracks((tracksData || []).map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      album: t.album,
      duration: t.duration,
      audio_url: t.audio_url,
      video_url: t.video_url,
      cover_url: t.cover_url,
      genre: t.genre,
      mood: t.mood,
    })));

    // Load playlist tracks for each playlist
    const playlistsWithTracks: Playlist[] = [];
    for (const pl of playlistsData || []) {
      const { data: playlistTracks } = await supabase
        .from("playlist_tracks")
        .select("track_id, position")
        .eq("playlist_id", pl.id)
        .order("position");

      const trackIds = (playlistTracks || []).map((pt) => pt.track_id);
      const playlistTrackItems = tracks.filter((t) => trackIds.includes(t.id));

      playlistsWithTracks.push({
        id: pl.id,
        title: pl.title,
        gradient: pl.gradient,
        tracks: playlistTrackItems,
      });
    }

    setPlaylists(playlistsWithTracks);
    setAllTracks(tracks);
    setLoading(false);
  };

  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    // Get track ID from draggableId
    const trackId = draggableId.includes("-") ? draggableId.split("-").pop()! : draggableId;

    // Find source and destination playlists
    const sourcePlaylist = playlists.find((p) => p.id === source.droppableId);
    const destPlaylist = playlists.find((p) => p.id === destination.droppableId);

    // Moving between playlists
    if (sourcePlaylist && destPlaylist && source.droppableId !== destination.droppableId) {
      const track = allTracks.find((t) => t.id === trackId);
      if (!track) return;

      // Check if already in destination
      if (destPlaylist.tracks.some((t) => t.id === trackId)) {
        toast.error("Ten utwór już jest w tej playliście");
        return;
      }

      // Update database
      try {
        // Remove from source playlist
        await supabase
          .from("playlist_tracks")
          .delete()
          .eq("playlist_id", source.droppableId)
          .eq("track_id", trackId);

        // Add to destination playlist
        await supabase.from("playlist_tracks").insert({
          playlist_id: destination.droppableId,
          track_id: trackId,
          position: destination.index,
        });

        // Update local state
        setPlaylists((prev) =>
          prev.map((p) => {
            if (p.id === source.droppableId) {
              return { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) };
            }
            if (p.id === destination.droppableId) {
              const newTracks = [...p.tracks];
              newTracks.splice(destination.index, 0, track);
              return { ...p, tracks: newTracks };
            }
            return p;
          })
        );

        toast.success(`"${track.title}" przeniesiony do "${destPlaylist.title}"`);
      } catch (error) {
        console.error("Failed to move track:", error);
        toast.error("Nie udało się przenieść utworu");
      }
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="groove-gradient-bg h-12 w-12 rounded-xl flex items-center justify-center">
            <ArrowLeftRight className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold">Zarządzaj Playlistami</h1>
            <p className="text-muted-foreground">Przeciągnij utwory między playlistami</p>
          </div>
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          {playlists.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {playlists.map((playlist) => (
                <motion.div
                  key={playlist.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="groove-card p-4"
                >
                  <PlaylistDropZone
                    playlistId={playlist.id}
                    playlistName={playlist.title}
                    tracks={playlist.tracks}
                    gradient={playlist.gradient || "from-primary to-accent"}
                  />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <Music className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h2 className="font-display text-xl font-bold mb-2">Brak playlist</h2>
              <p className="text-muted-foreground mb-4">
                Utwórz playlistę, aby rozpocząć zarządzanie utworami
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate("/create-playlist")}
                className="groove-gradient-bg text-primary-foreground px-6 py-3 rounded-full font-medium"
              >
                Utwórz Playlistę
              </motion.button>
            </div>
          )}
        </DragDropContext>

        {/* All Tracks Section */}
        {allTracks.length > 0 && (
          <div className="mt-8">
            <DraggableTrackList
              tracks={allTracks.slice(0, 20)}
              title="Wszystkie Utwory (przeciągnij do playlisty)"
            />
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default PlaylistManager;
