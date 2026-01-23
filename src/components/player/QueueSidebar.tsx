import { motion, AnimatePresence } from "framer-motion";
import { X, Play, GripVertical } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { cn } from "@/lib/utils";

interface QueueSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QueueSidebar = ({ isOpen, onClose }: QueueSidebarProps) => {
  const { queue, currentTrack, playTrack } = usePlayer();

  const handlePlayTrack = (index: number) => {
    if (queue[index]) {
      playTrack(queue[index]);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          
          {/* Sidebar */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-28 w-80 bg-card border-l border-border z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="font-semibold text-lg">Queue</h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-secondary transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Now Playing */}
            {currentTrack && (
              <div className="p-4 border-b border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  Now Playing
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded bg-secondary overflow-hidden flex-shrink-0">
                    {currentTrack.cover_url ? (
                      <img
                        src={currentTrack.cover_url}
                        alt={currentTrack.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full groove-gradient-bg" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{currentTrack.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{currentTrack.artist}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Queue List */}
            <div className="flex-1 overflow-y-auto groove-scrollbar p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                Up Next ({queue.length} tracks)
              </p>
              
              {queue.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground text-sm">Queue is empty</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Add some tracks to get started
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {queue.map((track, index) => (
                    <motion.div
                      key={`${track.id}-${index}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-lg group hover:bg-secondary/50 transition-colors cursor-pointer",
                        currentTrack?.id === track.id && "bg-primary/10 border border-primary/30"
                      )}
                      onClick={() => handlePlayTrack(index)}
                    >
                      <div className="text-muted-foreground group-hover:hidden">
                        <GripVertical className="h-4 w-4" />
                      </div>
                      <div className="hidden group-hover:block text-primary">
                        <Play className="h-4 w-4" />
                      </div>
                      
                      <div className="h-10 w-10 rounded bg-secondary overflow-hidden flex-shrink-0">
                        {track.cover_url ? (
                          <img
                            src={track.cover_url}
                            alt={track.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full groove-gradient-bg" />
                        )}
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{track.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                      </div>
                      
                      <span className="text-xs text-muted-foreground">
                        {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
