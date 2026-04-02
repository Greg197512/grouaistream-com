import { useState, forwardRef } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { TrackOptionsMenu, LikeButton } from "@/components/menus/TrackOptionsMenu";
import { HQCover } from "@/components/ui/HQCover";
import { TrackBadges } from "@/components/ui/TrackBadges";

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
  genre?: string | null;
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
  genre,
  onPlay
}, ref) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      ref={ref}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onPlay}
      role={onPlay ? "button" : undefined}
      tabIndex={onPlay ? 0 : undefined}
      onKeyDown={(e) => {
        if (!onPlay) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPlay();
        }
      }}
      className={cn(
        "grid grid-cols-[16px_4fr_3fr_1fr] md:grid-cols-[16px_4fr_3fr_2fr_1fr] gap-4 px-4 py-2 rounded-md items-center group",
        onPlay && "cursor-pointer",
        isHovered && "bg-secondary/50",
        isPlaying && "bg-secondary"
      )}
    >
      {/* Index / Play */}
      <div className="flex items-center justify-center w-4">
        {isHovered || isPlaying ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay?.();
            }}
            className="text-foreground"
          >
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
        {(
          <div className="h-10 w-10 rounded overflow-hidden flex-shrink-0">
            <HQCover src={imageUrl || null} alt={title} genre={genre} artist={artist} className="h-full w-full" />
          </div>
        )}
        <div className="min-w-0">
          <p className={cn(
            "font-medium text-sm truncate",
            isPlaying && "text-primary"
          )}>
            {title}
          </p>
          <div className="flex items-center gap-1.5">
            <p className="text-xs text-muted-foreground truncate hover:underline cursor-pointer">
              {artist}
            </p>
            <span className="text-[8px] font-bold text-primary/70 whitespace-nowrap">Grouarock®</span>
          </div>
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
      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
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
