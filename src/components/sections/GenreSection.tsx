import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Play, Loader2 } from "lucide-react";
import { Droppable } from "@hello-pangea/dnd";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { useLazyLoad } from "@/hooks/useLazyLoad";
import { cn } from "@/lib/utils";
import { DraggableTrackCard } from "@/components/dnd/DraggableTrackCard";

interface GenreSectionProps {
  genre: string;
  title: string;
  icon: string;
  color: string;
  limit?: number;
}

export const GenreSection = ({ genre, title, icon, color, limit = 8 }: GenreSectionProps) => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const { playPlaylist, currentTrack, isPlaying } = usePlayer();
  const { ref: lazyRef, isVisible } = useLazyLoad("300px");

  useEffect(() => {
    if (!isVisible) return;
    
    const fetchTracks = async () => {
      setIsLoading(true);
      setHasError(false);
      try {
        let query = supabase.from("tracks").select("*");
        
        if (genre === "Rock") {
          query = query.or("genre.eq.Rock,genre.eq.Pop-Rock,genre.ilike.%rock%");
        } else if (genre === "Punk") {
          query = query.or("genre.eq.Punk,genre.eq.Pop-Punk,genre.eq.Punk-Rock,genre.ilike.%punk%");
        } else if (genre === "Pop") {
          query = query.or("genre.eq.Pop,genre.ilike.%pop%").not("genre", "ilike", "%punk%").not("genre", "ilike", "%rock%");
        } else {
          query = query.or(`genre.ilike.%${genre}%,genre.eq.${genre}`);
        }
        
        const { data, error } = await query
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) throw error;
        setTracks(data || []);
      } catch (error) {
        console.error(`Error fetching ${genre} tracks:`, error);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    // Add timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      setIsLoading(false);
      setHasError(true);
    }, 10000);

    fetchTracks().finally(() => clearTimeout(timeout));
  }, [genre, limit, isVisible]);

  const visibleTracks = tracks;

  const handlePlayAll = () => {
    if (visibleTracks.length > 0) {
      playPlaylist(visibleTracks, 0);
    }
  };

  if (!isVisible || (isLoading && !hasError)) {
    return (
      <section ref={lazyRef} className="px-6 py-6">
        <div className="flex items-center gap-3 mb-4">
          <span className={cn("material-icons text-2xl", color)}>{icon}</span>
          <h2 className="font-display text-xl font-bold">{title}</h2>
        </div>
        {isVisible && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </section>
    );
  }

  if (visibleTracks.length === 0 && !hasError) {
    return null;
  }

  if (hasError && visibleTracks.length === 0) {
    return (
      <section className="px-6 py-6">
        <div className="flex items-center gap-3 mb-4">
          <span className={cn("material-icons text-2xl", color)}>{icon}</span>
          <h2 className="font-display text-xl font-bold">{title}</h2>
        </div>
        <p className="text-sm text-muted-foreground text-center py-4">
          Nie udało się załadować — odśwież stronę
        </p>
      </section>
    );
  }

  return (
    <section className="px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <motion.span 
            className={cn("material-icons text-2xl", color)}
            whileHover={{ scale: 1.2, rotate: 10 }}
          >
            {icon}
          </motion.span>
          <h2 className="font-display text-xl font-bold">{title}</h2>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">
            {visibleTracks.length} tracks
          </span>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handlePlayAll}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium",
            "bg-gradient-to-r from-primary to-accent text-primary-foreground"
          )}
        >
          <Play className="h-4 w-4 fill-current" />
          Play All
        </motion.button>
      </div>

      <Droppable droppableId={`genre-${genre}`} direction="horizontal">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 rounded-xl transition-colors p-1",
              snapshot.isDraggingOver && "bg-accent/10 ring-2 ring-accent/20"
            )}
          >
            {visibleTracks.map((track, index) => (
              <DraggableTrackCard
                key={track.id}
                track={track}
                index={index}
                tracks={visibleTracks}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </section>
  );
};
