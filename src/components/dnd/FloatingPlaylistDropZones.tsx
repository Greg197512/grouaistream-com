import { useEffect } from "react";
import { Droppable } from "@hello-pangea/dnd";
import { motion, AnimatePresence } from "framer-motion";
import { ListMusic, Plus, FolderPlus } from "lucide-react";
import { useDragDrop } from "@/contexts/DragDropContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export const FloatingPlaylistDropZones = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isDragging, showDropZones, playlists, refreshPlaylists, draggedTrack } = useDragDrop();

  useEffect(() => {
    if (user) {
      refreshPlaylists();
    }
  }, [user]);

  if (!showDropZones || !isDragging) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 300 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 300 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed right-4 top-1/2 -translate-y-1/2 z-[100] flex flex-col gap-3 max-h-[70vh] overflow-y-auto groove-scrollbar p-2"
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-2"
        >
          <p className="text-sm font-medium text-white bg-accent/80 backdrop-blur-sm px-4 py-2 rounded-full">
            Upuść do playlisty
          </p>
        </motion.div>

        {/* Dragged track info */}
        {draggedTrack && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card/95 backdrop-blur-xl rounded-lg p-3 border border-border mb-2"
          >
            <p className="text-xs text-muted-foreground">Przeciągasz:</p>
            <p className="text-sm font-medium truncate">{draggedTrack.title}</p>
            <p className="text-xs text-muted-foreground truncate">{draggedTrack.artist}</p>
          </motion.div>
        )}

        {/* User playlists */}
        {user && playlists.length > 0 ? (
          playlists.map((playlist, index) => (
            <Droppable key={playlist.id} droppableId={`playlist-${playlist.id}`}>
              {(provided, snapshot) => (
                <motion.div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`
                    min-w-[200px] p-4 rounded-xl border-2 border-dashed transition-all cursor-pointer
                    ${snapshot.isDraggingOver
                      ? "border-accent bg-accent/20 scale-105"
                      : "border-border bg-card/90 backdrop-blur-xl hover:border-primary/50"
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${playlist.gradient || 'from-primary to-accent'} flex items-center justify-center`}>
                      <ListMusic className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{playlist.title}</p>
                      {snapshot.isDraggingOver && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="text-xs text-accent"
                        >
                          + Dodaj tutaj
                        </motion.p>
                      )}
                    </div>
                    <Plus className={`h-5 w-5 transition-colors ${
                      snapshot.isDraggingOver ? "text-accent" : "text-muted-foreground"
                    }`} />
                  </div>
                  {provided.placeholder}
                </motion.div>
              )}
            </Droppable>
          ))
        ) : user ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-card/90 backdrop-blur-xl rounded-xl p-4 border border-border text-center"
          >
            <FolderPlus className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">Brak playlist</p>
            <button
              onClick={() => navigate("/create-playlist")}
              className="text-xs text-accent hover:underline"
            >
              Stwórz pierwszą
            </button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-card/90 backdrop-blur-xl rounded-xl p-4 border border-border text-center"
          >
            <p className="text-sm text-muted-foreground">
              Zaloguj się, aby dodawać do playlist
            </p>
          </motion.div>
        )}

        {/* Create new playlist drop zone */}
        {user && (
          <Droppable droppableId="playlist-new">
            {(provided, snapshot) => (
              <motion.div
                ref={provided.innerRef}
                {...provided.droppableProps}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: playlists.length * 0.05 }}
                onClick={() => !snapshot.isDraggingOver && navigate("/create-playlist")}
                className={`
                  min-w-[200px] p-4 rounded-xl border-2 border-dashed transition-all cursor-pointer
                  ${snapshot.isDraggingOver
                    ? "border-primary bg-primary/20 scale-105"
                    : "border-primary/30 bg-card/50 hover:bg-card/80"
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Plus className="h-5 w-5 text-primary" />
                  </div>
                  <p className="font-medium text-sm">Nowa playlista</p>
                </div>
                {provided.placeholder}
              </motion.div>
            )}
          </Droppable>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
