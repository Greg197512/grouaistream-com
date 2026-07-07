import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Play, ArrowLeft, Music, GripVertical, Trash2, MoreHorizontal, Loader2, Upload as UploadIcon } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer, Track } from "@/contexts/PlayerContext";

import { TrackOptionsMenu } from "@/components/menus/TrackOptionsMenu";
import { FileUploadModal } from "@/components/modals/FileUploadModal";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Playlist {
  id: string;
  title: string;
  description: string | null;
  gradient: string | null;
  is_ai_generated: boolean;
  user_id: string;
}

const PlaylistDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { playPlaylist, currentTrack, isPlaying } = usePlayer();
  
  
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [trackToRemove, setTrackToRemove] = useState<Track | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);


  useEffect(() => {
    if (id) loadPlaylist();
  }, [id]);

  // Listen for track changes from menus
  useEffect(() => {
    const handler = () => { if (id) loadPlaylist(); };
    window.addEventListener("track-list-changed", handler);
    return () => window.removeEventListener("track-list-changed", handler);
  }, [id]);

  const loadPlaylist = async () => {
    if (!id) return;
    setLoading(true);

    // Load playlist info
    const { data: playlistData, error: playlistError } = await supabase
      .from("playlists")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (playlistError || !playlistData) {
      toast.error("Playlist not found");
      navigate("/library");
      return;
    }

    setPlaylist(playlistData);

    // Load playlist tracks
    const { data: playlistTracks } = await supabase
      .from("playlist_tracks")
      .select("track_id, position")
      .eq("playlist_id", id)
      .order("position");

    if (playlistTracks && playlistTracks.length > 0) {
      const trackIds = playlistTracks.map((pt) => pt.track_id);
      const { data: tracksData } = await supabase
        .from("tracks")
        .select("*")
        .in("id", trackIds);

      // Sort tracks by position
      const sortedTracks = trackIds
        .map((trackId) => tracksData?.find((t) => t.id === trackId))
        .filter(Boolean) as Track[];

      setTracks(sortedTracks);
    }

    setLoading(false);
  };

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      playPlaylist(tracks, 0);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || !id) return;
    
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;
    
    if (sourceIndex === destIndex) return;

    const reorderedTracks = Array.from(tracks);
    const [movedTrack] = reorderedTracks.splice(sourceIndex, 1);
    reorderedTracks.splice(destIndex, 0, movedTrack);

    setTracks(reorderedTracks);

    // Update positions in database
    try {
      for (let i = 0; i < reorderedTracks.length; i++) {
        await supabase
          .from("playlist_tracks")
          .update({ position: i })
          .eq("playlist_id", id)
          .eq("track_id", reorderedTracks[i].id);
      }
      toast.success("Kolejność zaktualizowana");
    } catch (error) {
      toast.error("Failed to update order");
    }
  };

  const handleRemoveTrack = async () => {
    if (!trackToRemove || !id) return;

    const { error } = await supabase
      .from("playlist_tracks")
      .delete()
      .eq("playlist_id", id)
      .eq("track_id", trackToRemove.id);

    if (error) {
      console.error("Remove track error:", error);
      toast.error("Failed to remove track");
    } else {
      setTracks((prev) => prev.filter((t) => t.id !== trackToRemove.id));
      toast.success(`"${trackToRemove.title}" usunięty z playlisty`);
    }
    setTrackToRemove(null);
  };

  const handleDeletePlaylist = async () => {
    if (!id) return;

    // Delete playlist tracks first
    const r1 = await supabase.from("playlist_tracks").delete().eq("playlist_id", id);
    if (r1.error) console.warn("playlist_tracks cleanup:", r1.error.message);
    
    // Delete playlist
    const r2 = await supabase.from("playlists").delete().eq("id", id);
    if (r2.error) {
      console.error("Delete playlist error:", r2.error);
      toast.error("Failed to delete playlist");
      return;
    }
    
    toast.success("Playlista usunięta");
    navigate("/library");
  };

  const isOwner = user?.id === playlist?.user_id;

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!playlist) return null;

  return (
    <MainLayout>
      <div className="px-6 py-8">
        {/* Header */}
        <div className="flex items-start gap-6 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/library")}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          {/* Playlist Cover */}
          <div className={`h-40 w-40 rounded-xl bg-gradient-to-br ${playlist.gradient || "from-primary to-accent"} flex items-center justify-center shrink-0`}>
            <Music className="h-16 w-16 text-primary-foreground" />
          </div>

          {/* Playlist Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {playlist.is_ai_generated && (
                <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
                  AI Generated
                </span>
              )}
              <span className="text-sm text-muted-foreground">
                {tracks.length} tracks
              </span>
            </div>
            <h1 className="font-display text-3xl font-bold mb-2 truncate">{playlist.title}</h1>
            {playlist.description && (
              <p className="text-muted-foreground mb-4">{playlist.description}</p>
            )}
            <div className="flex items-center gap-3">
              <Button onClick={handlePlayAll} disabled={tracks.length === 0} className="gap-2">
                <Play className="h-4 w-4 fill-current" />
                Play All
              </Button>

              {isOwner && (
                <>
                  <Button
                    onClick={() => setShowUploadModal(true)}
                    variant="outline"
                    className="gap-2"
                  >
                    <UploadIcon className="h-4 w-4" />
                    Dodaj utwory
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem 
                        onClick={() => setDeleteDialogOpen(true)}
                        className="text-destructive cursor-pointer"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Playlist
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </div>
        </div>


        {/* Track List */}
        {tracks.length > 0 ? (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="playlist-tracks">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="space-y-1"
                >
                  {tracks.map((track, index) => (
                    <Draggable key={track.id} draggableId={track.id} index={index}>
                      {(provided, snapshot) => (
                        <motion.div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          animate={{
                            scale: snapshot.isDragging ? 1.02 : 1,
                            boxShadow: snapshot.isDragging
                              ? "0 10px 30px rgba(0,0,0,0.3)"
                              : "none",
                          }}
                          className={`group flex items-center gap-3 p-3 rounded-lg transition-colors ${
                            snapshot.isDragging
                              ? "bg-primary/20 border border-primary/30"
                              : currentTrack?.id === track.id
                              ? "bg-primary/10"
                              : "hover:bg-secondary/50"
                          }`}
                        >
                          {/* Drag Handle */}
                          {isOwner && (
                            <div
                              {...provided.dragHandleProps}
                              className="cursor-grab active:cursor-grabbing p-1 hover:bg-secondary rounded opacity-50 group-hover:opacity-100"
                            >
                              <GripVertical className="h-4 w-4" />
                            </div>
                          )}

                          {/* Track Number */}
                          <button
                            onClick={() => playPlaylist(tracks, index)}
                            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-primary/20"
                          >
                            {currentTrack?.id === track.id && isPlaying ? (
                              <div className="flex items-center gap-0.5">
                                <span className="w-1 h-3 bg-primary rounded-full animate-pulse" />
                                <span className="w-1 h-4 bg-primary rounded-full animate-pulse" />
                                <span className="w-1 h-2 bg-primary rounded-full animate-pulse" />
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground group-hover:hidden">
                                {index + 1}
                              </span>
                            )}
                            <Play className="h-4 w-4 hidden group-hover:block text-primary" />
                          </button>

                          {/* Cover */}
                          <div className="h-10 w-10 rounded overflow-hidden bg-secondary shrink-0">
                            {track.cover_url ? (
                              <img src={track.cover_url} alt={track.title} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center">
                                <Music className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                          </div>

                          {/* Track Info */}
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium truncate ${currentTrack?.id === track.id ? "text-primary" : ""}`}>
                              {track.title}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">{track.artist}</p>
                          </div>

                          {/* Duration */}
                          <span className="text-sm text-muted-foreground hidden sm:block">
                            {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, "0")}
                          </span>

                          {/* Actions */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                            {isOwner && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setTrackToRemove(track)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                            <TrackOptionsMenu
                              trackId={track.id}
                              trackTitle={track.title}
                              trackArtist={track.artist}
                              trackUrl={track.video_url || track.audio_url}
                              playlistId={id}
                              onDelete={() => setTracks(prev => prev.filter(t => t.id !== track.id))}
                            />
                          </div>
                        </motion.div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        ) : (
          <div className="text-center py-16">
            <Music className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No tracks in this playlist</p>
          </div>
        )}
      </div>

      {/* Remove Track Dialog */}
      <AlertDialog open={!!trackToRemove} onOpenChange={() => setTrackToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Track?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove "{trackToRemove?.title}" from this playlist?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveTrack} className="bg-destructive text-destructive-foreground">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Playlist Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Playlist?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{playlist.title}" and remove all tracks from it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePlaylist} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Upload tracks directly into this playlist */}
      <FileUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={loadPlaylist}
        playlistId={id}
      />
    </MainLayout>

  );
};

export default PlaylistDetail;
