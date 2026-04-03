import { useState, useEffect, useMemo } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { motion } from "framer-motion";
import { Music, ArrowLeftRight, Loader2, Search, Plus, Play, GripVertical } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Track, usePlayer } from "@/contexts/PlayerContext";
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
  const { playTrack, currentTrack, isPlaying } = usePlayer();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [allTracks, setAllTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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

    const [playlistsRes, tracksRes] = await Promise.all([
      supabase.from("playlists").select("id, title, gradient").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("tracks").select("*").order("title").limit(500),
    ]);

    const tracks: Track[] = filterTracks((tracksRes.data || []).map((t) => ({
      id: t.id, title: t.title, artist: t.artist, album: t.album,
      duration: t.duration, audio_url: t.audio_url, video_url: t.video_url,
      cover_url: t.cover_url, genre: t.genre, mood: t.mood,
    })));

    const playlistsWithTracks: Playlist[] = [];
    for (const pl of playlistsRes.data || []) {
      const { data: playlistTracks } = await supabase
        .from("playlist_tracks")
        .select("track_id, position")
        .eq("playlist_id", pl.id)
        .order("position");

      const trackIds = new Set((playlistTracks || []).map((pt) => pt.track_id));
      const playlistTrackItems = tracks.filter((t) => trackIds.has(t.id));

      playlistsWithTracks.push({
        id: pl.id, title: pl.title, gradient: pl.gradient, tracks: playlistTrackItems,
      });
    }

    setPlaylists(playlistsWithTracks);
    setAllTracks(tracks);
    setLoading(false);
  };

  const filteredTracks = useMemo(() => {
    if (!search.trim()) return allTracks.slice(0, 50);
    const q = search.toLowerCase();
    return allTracks.filter(t => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)).slice(0, 50);
  }, [allTracks, search]);

  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const trackId = draggableId.replace(/^(pl-[^-]+-|all-)/, "").replace(/^.*-/, "");
    // Try to extract clean track ID (UUID format)
    const uuidMatch = draggableId.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    const cleanTrackId = uuidMatch ? uuidMatch[1] : trackId;

    const track = allTracks.find(t => t.id === cleanTrackId);
    if (!track) return;

    const destPlaylist = playlists.find(p => p.id === destination.droppableId);

    // From all-tracks to playlist
    if (source.droppableId === "all-tracks" && destPlaylist) {
      if (destPlaylist.tracks.some(t => t.id === cleanTrackId)) {
        toast.error("Ten utwór już jest w tej playliście");
        return;
      }
      try {
        await supabase.from("playlist_tracks").insert({
          playlist_id: destination.droppableId, track_id: cleanTrackId, position: destination.index,
        });
        setPlaylists(prev => prev.map(p =>
          p.id === destination.droppableId ? { ...p, tracks: [...p.tracks, track] } : p
        ));
        toast.success(`"${track.title}" dodano do "${destPlaylist.title}"`);
      } catch { toast.error("Błąd dodawania"); }
      return;
    }

    // Between playlists
    const sourcePlaylist = playlists.find(p => p.id === source.droppableId);
    if (sourcePlaylist && destPlaylist && source.droppableId !== destination.droppableId) {
      if (destPlaylist.tracks.some(t => t.id === cleanTrackId)) {
        toast.error("Ten utwór już jest w tej playliście");
        return;
      }
      try {
        await supabase.from("playlist_tracks").delete().eq("playlist_id", source.droppableId).eq("track_id", cleanTrackId);
        await supabase.from("playlist_tracks").insert({
          playlist_id: destination.droppableId, track_id: cleanTrackId, position: destination.index,
        });
        setPlaylists(prev => prev.map(p => {
          if (p.id === source.droppableId) return { ...p, tracks: p.tracks.filter(t => t.id !== cleanTrackId) };
          if (p.id === destination.droppableId) {
            const newTracks = [...p.tracks];
            newTracks.splice(destination.index, 0, track);
            return { ...p, tracks: newTracks };
          }
          return p;
        }));
        toast.success(`"${track.title}" → "${destPlaylist.title}"`);
      } catch { toast.error("Błąd przenoszenia"); }
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
      <div className="px-4 md:px-6 py-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="groove-gradient-bg h-12 w-12 rounded-xl flex items-center justify-center">
              <ArrowLeftRight className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold">Zarządzaj Playlistami</h1>
              <p className="text-sm text-muted-foreground">Przeciągnij utwory między playlistami</p>
            </div>
          </div>
          <Button onClick={() => navigate("/create-playlist")} className="gap-2 groove-gradient-bg text-primary-foreground">
            <Plus className="h-4 w-4" /> Nowa playlista
          </Button>
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: All tracks with search */}
            <div className="lg:col-span-1">
              <div className="groove-card p-4 sticky top-4">
                <h3 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
                  <Music className="h-5 w-5 text-primary" /> Wszystkie Utwory
                </h3>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Szukaj utworu..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Droppable droppableId="all-tracks">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1 max-h-[60vh] overflow-y-auto">
                      {filteredTracks.map((track, index) => (
                        <Draggable key={`all-${track.id}`} draggableId={`all-${track.id}`} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`flex items-center gap-2 p-2 rounded-lg text-sm transition-colors ${
                                snapshot.isDragging ? "bg-primary/20 shadow-lg" : "hover:bg-secondary/50"
                              } ${currentTrack?.id === track.id ? "bg-primary/10" : ""}`}
                            >
                              <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing p-0.5 opacity-50 hover:opacity-100">
                                <GripVertical className="h-3.5 w-3.5" />
                              </div>
                              <button onClick={() => playTrack(track)} className="flex-shrink-0">
                                {currentTrack?.id === track.id && isPlaying ? (
                                  <div className="flex items-center gap-0.5 w-4">
                                    {[1,2,3].map(i => (
                                      <motion.div key={i} className="w-0.5 bg-primary rounded-full"
                                        animate={{ height: [3, 10, 3] }}
                                        transition={{ repeat: Infinity, duration: 0.4, delay: i * 0.1 }} />
                                    ))}
                                  </div>
                                ) : (
                                  <Play className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                                )}
                              </button>
                              {track.cover_url ? (
                                <img src={track.cover_url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" loading="lazy" />
                              ) : (
                                <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center flex-shrink-0">
                                  <Music className="h-3.5 w-3.5 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="truncate font-medium text-xs">{track.title}</p>
                                <p className="truncate text-[10px] text-muted-foreground">{track.artist}</p>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {filteredTracks.length === 0 && (
                        <p className="text-center text-sm text-muted-foreground py-4">Brak wyników</p>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            </div>

            {/* Right: Playlists */}
            <div className="lg:col-span-2">
              {playlists.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {playlists.map(playlist => (
                    <motion.div key={playlist.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="groove-card p-4">
                      <Droppable droppableId={playlist.id}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`rounded-xl border-2 border-dashed transition-all p-3 min-h-[120px] ${
                              snapshot.isDraggingOver ? "bg-primary/10 border-primary" : "border-transparent"
                            }`}
                          >
                            <div className="flex items-center gap-3 mb-3">
                              <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${playlist.gradient || "from-primary to-accent"} flex items-center justify-center`}>
                                <Music className="h-5 w-5 text-white" />
                              </div>
                              <div className="flex-1">
                                <h4 className="font-semibold text-sm">{playlist.title}</h4>
                                <p className="text-xs text-muted-foreground">{playlist.tracks.length} utworów</p>
                              </div>
                              <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate(`/playlist/${playlist.id}`)}>
                                Otwórz
                              </Button>
                            </div>

                            {snapshot.isDraggingOver && (
                              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center gap-2 py-3 text-primary text-sm">
                                <Plus className="h-4 w-4" /> Upuść tutaj
                              </motion.div>
                            )}

                            {playlist.tracks.length > 0 && !snapshot.isDraggingOver && (
                              <div className="space-y-1 max-h-40 overflow-y-auto">
                                {playlist.tracks.map((track, idx) => (
                                  <Draggable key={`pl-${playlist.id}-${track.id}`} draggableId={`pl-${playlist.id}-${track.id}`} index={idx}>
                                    {(prov, snap) => (
                                      <div
                                        ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps}
                                        className={`flex items-center gap-2 p-1.5 rounded text-xs cursor-grab ${
                                          snap.isDragging ? "bg-primary/20 shadow-md" : "hover:bg-secondary/50"
                                        }`}
                                      >
                                        <GripVertical className="h-3 w-3 text-muted-foreground opacity-50" />
                                        <Music className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                        <span className="truncate flex-1">{track.title}</span>
                                        <span className="text-[10px] text-muted-foreground">{track.artist}</span>
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                              </div>
                            )}

                            {playlist.tracks.length === 0 && !snapshot.isDraggingOver && (
                              <div className="text-center py-3 text-muted-foreground">
                                <Music className="h-6 w-6 mx-auto mb-1 opacity-50" />
                                <p className="text-xs">Przeciągnij utwory tutaj</p>
                              </div>
                            )}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 groove-card">
                  <Music className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h2 className="font-display text-xl font-bold mb-2">Brak playlist</h2>
                  <p className="text-muted-foreground mb-4">Utwórz playlistę, aby rozpocząć</p>
                  <Button onClick={() => navigate("/create-playlist")} className="groove-gradient-bg text-primary-foreground">
                    Utwórz Playlistę
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DragDropContext>
      </div>
    </MainLayout>
  );
};

export default PlaylistManager;
