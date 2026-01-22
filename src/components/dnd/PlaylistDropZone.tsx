import { useState } from "react";
import { Droppable, Draggable } from "@hello-pangea/dnd";
import { motion } from "framer-motion";
import { Music, FolderPlus, ListMusic } from "lucide-react";
import { Track } from "@/contexts/PlayerContext";

interface PlaylistDropZoneProps {
  playlistId: string;
  playlistName: string;
  tracks: Track[];
  gradient?: string;
  isActive?: boolean;
}

export const PlaylistDropZone = ({
  playlistId,
  playlistName,
  tracks,
  gradient = "from-primary to-accent",
  isActive = false,
}: PlaylistDropZoneProps) => {
  return (
    <Droppable droppableId={playlistId}>
      {(provided, snapshot) => (
        <motion.div
          ref={provided.innerRef}
          {...provided.droppableProps}
          animate={{
            scale: snapshot.isDraggingOver ? 1.02 : 1,
            borderColor: snapshot.isDraggingOver ? "hsl(var(--primary))" : "transparent",
          }}
          className={`p-4 rounded-xl border-2 border-dashed transition-all ${
            snapshot.isDraggingOver
              ? "bg-primary/10 border-primary"
              : isActive
              ? "bg-secondary/50 border-secondary"
              : "bg-card border-transparent hover:border-secondary"
          }`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className={`h-12 w-12 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center`}
            >
              <ListMusic className="h-6 w-6 text-white" />
            </div>
            <div>
              <h4 className="font-semibold">{playlistName}</h4>
              <p className="text-sm text-muted-foreground">
                {tracks.length} {tracks.length === 1 ? "utwór" : "utworów"}
              </p>
            </div>
          </div>

          {snapshot.isDraggingOver && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="flex items-center justify-center gap-2 py-4 text-primary"
            >
              <FolderPlus className="h-5 w-5" />
              <span className="text-sm font-medium">Upuść tutaj, aby dodać</span>
            </motion.div>
          )}

          {tracks.length > 0 && !snapshot.isDraggingOver && (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {tracks.slice(0, 3).map((track, index) => (
                <Draggable key={track.id} draggableId={`${playlistId}-${track.id}`} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`flex items-center gap-2 p-2 rounded text-sm transition-colors cursor-grab ${
                        snapshot.isDragging ? "bg-primary/20" : "hover:bg-secondary/50"
                      }`}
                    >
                      <Music className="h-3 w-3 text-muted-foreground" />
                      <span className="truncate flex-1">{track.title}</span>
                      <span className="text-xs text-muted-foreground">{track.artist}</span>
                    </div>
                  )}
                </Draggable>
              ))}
              {tracks.length > 3 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  +{tracks.length - 3} więcej...
                </p>
              )}
            </div>
          )}

          {tracks.length === 0 && !snapshot.isDraggingOver && (
            <div className="text-center py-4 text-muted-foreground">
              <Music className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">Przeciągnij utwory tutaj</p>
            </div>
          )}

          {provided.placeholder}
        </motion.div>
      )}
    </Droppable>
  );
};
