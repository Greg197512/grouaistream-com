import { useState, forwardRef } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { TrackOptionsMenu, LikeButton } from "@/components/menus/TrackOptionsMenu";

interface TrackRowProps {
  id: string;
  index: number;
  title: string;
  artist: string;
  album: string;
  duration: string;
  plays?: string;
  isPlaying?: boolean;
  imageUrl?: string;
  trackUrl?: string | null;
  onPlay?: () => void;
}

const TrackRowComponent = forwardRef<HTMLDivElement, TrackRowProps>(({
  id,
  index,
  title,
  artist,
  album,
  duration,
  plays,
  isPlaying = false,
  imageUrl,
  trackUrl,
  onPlay
}, ref) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      ref={ref}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "grid grid-cols-[16px_4fr_3fr_1fr] md:grid-cols-[16px_4fr_3fr_2fr_1fr] gap-4 px-4 py-2 rounded-md items-center group",
        isHovered && "bg-secondary/50",
        isPlaying && "bg-secondary"
      )}
    >
      {/* Index / Play */}
      <div className="flex items-center justify-center w-4">
        {isHovered || isPlaying ? (
          <button onClick={onPlay} className="text-foreground">
            {isPlaying ? (
              <Pause className="h-4 w-4 fill-current" />
            ) : (
              <Play className="h-4 w-4 fill-current" />
            )}
          </button>
        ) : (
          <span className={cn(
            "text-sm",
            isPlaying ? "text-primary font-medium" : "text-muted-foreground"
          )}>
            {index}
          </span>
        )}
      </div>

      {/* Title & Artist */}
      <div className="flex items-center gap-3 min-w-0">
        {imageUrl && (
          <div className="h-10 w-10 rounded overflow-hidden flex-shrink-0">
            <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
          </div>
        )}
        <div className="min-w-0">
          <p className={cn(
            "font-medium text-sm truncate",
            isPlaying && "text-primary"
          )}>
            {title}
          </p>
          <p className="text-xs text-muted-foreground truncate hover:underline cursor-pointer">
            {artist}
          </p>
        </div>
      </div>

      {/* Album */}
      <p className="text-sm text-muted-foreground truncate hover:underline cursor-pointer hidden md:block">
        {album}
      </p>

      {/* Plays */}
      {plays && (
        <p className="text-sm text-muted-foreground hidden md:block">
          {plays}
        </p>
      )}

      {/* Actions & Duration */}
      <div className="flex items-center justify-end gap-2">
        <LikeButton trackId={id} className="opacity-0 group-hover:opacity-100" />
        <span className="text-sm text-muted-foreground w-12 text-right">{duration}</span>
        <TrackOptionsMenu
          trackId={id}
          trackTitle={title}
          trackArtist={artist}
          trackUrl={trackUrl}
          className="opacity-0 group-hover:opacity-100"
          size="sm"
        />
      </div>
    </motion.div>
  );
});

TrackRowComponent.displayName = "TrackRow";
export const TrackRow = TrackRowComponent;

export const TrackRowHeader = () => (
  <div className="grid grid-cols-[16px_4fr_3fr_1fr] md:grid-cols-[16px_4fr_3fr_2fr_1fr] gap-4 px-4 py-2 border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
    <div className="w-4 text-center">#</div>
    <div>Title</div>
    <div className="hidden md:block">Album</div>
    <div className="hidden md:block">Plays</div>
    <div className="flex justify-end pr-10">
      <Clock className="h-4 w-4" />
    </div>
  </div>
);
