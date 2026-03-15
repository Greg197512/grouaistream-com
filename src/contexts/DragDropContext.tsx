import { createContext, useContext, useState, ReactNode } from "react";
import { DragDropContext as DndContext, DropResult } from "@hello-pangea/dnd";
import { Track } from "@/contexts/PlayerContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Playlist {
  id: string;
  title: string;
  gradient?: string;
}

interface DragDropContextType {
  isDragging: boolean;
  draggedTrack: Track | null;
  playlists: Playlist[];
  showDropZones: boolean;
  setShowDropZones: (show: boolean) => void;
  refreshPlaylists: () => Promise<void>;
  onMixerDrop: ((slot: "A" | "B", track: Track) => void) | null;
  setOnMixerDrop: (cb: ((slot: "A" | "B", track: Track) => void) | null) => void;
}

const DragDropContext = createContext<DragDropContextType | undefined>(undefined);

export const useDragDrop = () => {
  const context = useContext(DragDropContext);
  if (!context) {
    throw new Error("useDragDrop must be used within DragDropProvider");
  }
  return context;
};

interface DragDropProviderProps {
  children: ReactNode;
}

export const DragDropProvider = ({ children }: DragDropProviderProps) => {
  const { user } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [draggedTrack, setDraggedTrack] = useState<Track | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showDropZones, setShowDropZones] = useState(false);

  const refreshPlaylists = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("playlists")
      .select("id, title, gradient")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    
    if (!error && data) {
      setPlaylists(data);
    }
  };

  const handleDragStart = (start: any) => {
    setIsDragging(true);
    setShowDropZones(true);
    
    // Extract track data from draggableId
    const trackData = start.draggableId;
    if (trackData.startsWith("track-")) {
      try {
        const jsonStr = trackData.replace("track-", "");
        const track = JSON.parse(decodeURIComponent(jsonStr));
        setDraggedTrack(track);
      } catch (e) {
        console.error("Error parsing track data:", e);
      }
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    setIsDragging(false);
    setShowDropZones(false);
    setDraggedTrack(null);

    if (!result.destination) return;
    
    const { source, destination, draggableId } = result;
    
    // Handle dropping to playlist
    if (destination.droppableId.startsWith("playlist-")) {
      const playlistId = destination.droppableId.replace("playlist-", "");
      
      if (!user) {
        toast.error("Zaloguj się, aby dodać do playlisty");
        return;
      }

      try {
        // Extract track data
        let trackId: string;
        if (draggableId.startsWith("track-")) {
          const jsonStr = draggableId.replace("track-", "");
          const track = JSON.parse(decodeURIComponent(jsonStr));
          trackId = track.id;
        } else {
          trackId = draggableId;
        }

        // Check if track already exists in playlist
        const { data: existing } = await supabase
          .from("playlist_tracks")
          .select("id")
          .eq("playlist_id", playlistId)
          .eq("track_id", trackId)
          .single();

        if (existing) {
          toast.info("Utwór już jest na tej playliście");
          return;
        }

        // Get max position
        const { data: maxPos } = await supabase
          .from("playlist_tracks")
          .select("position")
          .eq("playlist_id", playlistId)
          .order("position", { ascending: false })
          .limit(1);

        const nextPosition = maxPos && maxPos.length > 0 ? maxPos[0].position + 1 : 0;

        // Add track to playlist
        const { error } = await supabase
          .from("playlist_tracks")
          .insert({
            playlist_id: playlistId,
            track_id: trackId,
            position: nextPosition,
          });

        if (error) throw error;

        const playlist = playlists.find(p => p.id === playlistId);
        toast.success(`Dodano do "${playlist?.title || 'playlisty'}"`);
      } catch (error) {
        console.error("Error adding track to playlist:", error);
        toast.error("Nie udało się dodać utworu");
      }
    }
  };

  return (
    <DragDropContext.Provider
      value={{
        isDragging,
        draggedTrack,
        playlists,
        showDropZones,
        setShowDropZones,
        refreshPlaylists,
      }}
    >
      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {children}
      </DndContext>
    </DragDropContext.Provider>
  );
};
