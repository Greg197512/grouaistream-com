import { useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { motion } from "framer-motion";
import { GripVertical, Music, Play } from "lucide-react";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { TrackOptionsMenu } from "@/components/menus/TrackOptionsMenu";
import { toast } from "sonner";

interface DraggableTrackListProps {
  tracks: Track[];
  onReorder?: (tracks: Track[]) => void;
  playlistId?: string;
  title?: string;
}

export const DraggableTrackList = ({ 
  tracks: initialTracks, 
  onReorder,
  playlistId,
  title = "Utwory"
}: DraggableTrackListProps) => {
  const [tracks, setTracks] = useState(initialTracks);
  const { playTrack, currentTrack, isPlaying } = usePlayer();

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;

    if (sourceIndex === destIndex) return;

    const reorderedTracks = Array.from(tracks);
    const [movedTrack] = reorderedTracks.splice(sourceIndex, 1);
    reorderedTracks.splice(destIndex, 0, movedTrack);

    setTracks(reorderedTracks);
    onReorder?.(reorderedTracks);
    
    toast.success(`"${movedTrack.title}" przeniesiony na pozycję ${destIndex + 1}`);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const isCurrentTrack = (track: Track) => currentTrack?.id === track.id;

  return (
    <div className="w-full">
      <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
        <Music className="h-5 w-5 text-primary" />
        {title}
      </h3>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId={playlistId || "track-list"}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`space-y-1 rounded-xl transition-colors ${
                snapshot.isDraggingOver ? "bg-primary/5" : ""
              }`}
            >
              {tracks.map((track, index) => (
                <Draggable key={track.id} draggableId={track.id} index={index}>
                  {(provided, snapshot) => (
                    <motion.div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      initial={false}
                      animate={{
                        scale: snapshot.isDragging ? 1.02 : 1,
                        boxShadow: snapshot.isDragging
                          ? "0 10px 30px rgba(0,0,0,0.3)"
                          : "none",
                      }}
                      className={`group flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        snapshot.isDragging
                          ? "bg-primary/20 border border-primary/30"
                          : isCurrentTrack(track)
                          ? "bg-primary/10"
                          : "hover:bg-secondary/50"
                      }`}
                    >
                      {/* Drag Handle */}
                      <div
                        {...provided.dragHandleProps}
                        className="cursor-grab active:cursor-grabbing p-1 hover:bg-secondary rounded opacity-50 group-hover:opacity-100 transition-opacity"
                      >
                        <GripVertical className="h-4 w-4" />
                      </div>

                      {/* Track Number / Play */}
                      <button
                        onClick={() => playTrack(track)}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-primary/20 transition-colors"
                      >
                        {isCurrentTrack(track) && isPlaying ? (
                          <div className="flex items-center gap-0.5">
                            <span className="w-1 h-3 bg-primary rounded-full animate-pulse" />
                            <span className="w-1 h-4 bg-primary rounded-full animate-pulse delay-75" />
                            <span className="w-1 h-2 bg-primary rounded-full animate-pulse delay-150" />
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground group-hover:hidden">
                            {index + 1}
                          </span>
                        )}
                        <Play className="h-4 w-4 hidden group-hover:block text-primary" />
                      </button>

                      {/* Cover */}
                      <div className="relative h-10 w-10 rounded overflow-hidden bg-secondary flex-shrink-0">
                        {track.cover_url ? (
                          <img
                            src={track.cover_url}
                            alt={track.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <Music className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      {/* Track Info */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`font-medium truncate ${
                            isCurrentTrack(track) ? "text-primary" : ""
                          }`}
                        >
                          {track.title}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {track.artist}
                        </p>
                      </div>

                      {/* Duration */}
                      <span className="text-sm text-muted-foreground hidden sm:block">
                        {formatDuration(track.duration)}
                      </span>

                      {/* Options Menu */}
                      <TrackOptionsMenu
                        trackId={track.id}
                        trackTitle={track.title}
                        trackArtist={track.artist}
                        trackUrl={track.video_url || track.audio_url || ""}
                      />
                    </motion.div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {tracks.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Music className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Brak utworów. Przeciągnij tutaj, aby dodać.</p>
        </div>
      )}
    </div>
  );
};
