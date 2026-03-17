import { Draggable } from "@hello-pangea/dnd";
import { motion } from "framer-motion";
import { Play, GripVertical } from "lucide-react";
import { Track, usePlayer } from "@/contexts/PlayerContext";
import { TrackOptionsMenu, LikeButton } from "@/components/menus/TrackOptionsMenu";
import { cn } from "@/lib/utils";

interface DraggableTrackCardProps {
  track: Track;
  index: number;
  tracks: Track[];
  showDragHandle?: boolean;
}

export const DraggableTrackCard = ({
  track,
  index,
  tracks,
  showDragHandle = true,
}: DraggableTrackCardProps) => {
  const { playPlaylist, currentTrack, isPlaying } = usePlayer();
  
  const draggableId = `track-${encodeURIComponent(JSON.stringify({
    id: track.id,
    title: track.title,
    artist: track.artist,
  }))}`;

  const handlePlay = () => {
    playPlaylist(tracks, index);
  };

  return (
    <Draggable draggableId={draggableId} index={index}>
      {(provided, snapshot) => (
        <motion.div
          ref={provided.innerRef}
          {...provided.draggableProps}
          initial={{ opacity: 0, y: 20 }}
          animate={{ 
            opacity: 1, 
            y: 0,
            scale: snapshot.isDragging ? 1.05 : 1,
            boxShadow: snapshot.isDragging 
              ? "0 20px 40px rgba(0,0,0,0.4)" 
              : "none",
            zIndex: snapshot.isDragging ? 1000 : 1,
          }}
          transition={{ delay: index * 0.03 }}
          className={cn(
            "relative group cursor-pointer rounded-lg overflow-hidden bg-secondary/50 hover:bg-secondary transition-all",
            currentTrack?.id === track.id && "ring-2 ring-primary",
            snapshot.isDragging && "ring-2 ring-accent rotate-2"
          )}
        >
          {/* Drag Handle */}
          {showDragHandle && (
            <div
              {...provided.dragHandleProps}
              className="absolute top-2 left-2 z-10 p-1 rounded bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4 text-white" />
            </div>
          )}

          {/* Cover */}
          <div 
            className="relative aspect-square"
            onClick={handlePlay}
          >
            {track.cover_url ? (
              <img
                src={track.cover_url}
                alt={track.title}
                className="w-full h-full object-cover"
                loading="lazy"
                draggable={false}
              />
            ) : (
              <div className="w-full h-full">
                <HQCoverInline title={track.title} genre={track.genre} />
              </div>
            )}

            {/* Play overlay */}
            <div className={cn(
              "absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity",
              currentTrack?.id === track.id && isPlaying 
                ? "opacity-100" 
                : "opacity-0 group-hover:opacity-100"
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
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="p-3 rounded-full bg-primary text-primary-foreground"
                >
                  <Play className="h-6 w-6 fill-current" />
                </motion.div>
              )}
            </div>

            {/* YouTube badge */}
            {track.video_url && (
              <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-red-600 text-[10px] text-white font-bold">
                YT
              </div>
            )}
            
            {/* Drag indicator */}
            {snapshot.isDragging && (
              <div className="absolute inset-0 flex items-center justify-center bg-accent/20 backdrop-blur-sm">
                <span className="text-sm font-medium text-white bg-accent px-3 py-1 rounded-full">
                  Przeciągnij do playlisty
                </span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-3" {...provided.dragHandleProps}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{track.title}</p>
                <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
              </div>
              <div 
                className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" 
                onClick={(e) => e.stopPropagation()}
              >
                <LikeButton trackId={track.id} />
                <TrackOptionsMenu
                  trackId={track.id}
                  trackTitle={track.title}
                  trackArtist={track.artist}
                  trackUrl={track.video_url || track.audio_url}
                  size="sm"
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </Draggable>
  );
};
