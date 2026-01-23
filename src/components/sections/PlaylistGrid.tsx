import { useState } from "react";
import { motion } from "framer-motion";
import { PlaylistCard } from "@/components/cards/PlaylistCard";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/contexts/PlayerContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface PlaylistGridProps {
  title: string;
  subtitle?: string;
  showAll?: boolean;
}

interface AIPlaylist {
  id: string;
  title: string;
  description: string;
  isAI: boolean;
  gradient: string;
  mood: string;
  genre: string;
}

const aiPlaylists: AIPlaylist[] = [
  { 
    id: "1", 
    title: "Morning Energy", 
    description: "AI curated based on your wake-up patterns",
    isAI: true,
    gradient: "from-yellow-400 via-orange-500 to-red-500",
    mood: "energetic",
    genre: "Pop"
  },
  { 
    id: "2", 
    title: "Focus Flow", 
    description: "Deep work music adapted to your productivity peaks",
    isAI: true,
    gradient: "from-blue-400 via-indigo-500 to-purple-500",
    mood: "focused",
    genre: "Electronic"
  },
  { 
    id: "3", 
    title: "Evening Unwind", 
    description: "Relaxing vibes learned from your wind-down sessions",
    isAI: true,
    gradient: "from-purple-400 via-pink-500 to-rose-500",
    mood: "relaxed",
    genre: "Ambient"
  },
  { 
    id: "4", 
    title: "Workout Beats", 
    description: "High-energy tracks synced to your exercise routine",
    isAI: true,
    gradient: "from-green-400 via-cyan-500 to-blue-500",
    mood: "energetic",
    genre: "Rock"
  },
];

const trendingPlaylists = [
  { 
    id: "5", 
    title: "Global Top 50", 
    description: "The most played tracks worldwide",
    gradient: "from-groove-green to-groove-cyan"
  },
  { 
    id: "6", 
    title: "Viral Hits", 
    description: "Trending songs from across the internet",
    gradient: "from-groove-cyan to-groove-purple"
  },
  { 
    id: "7", 
    title: "New Releases Radar", 
    description: "Fresh drops from your favorite artists",
    gradient: "from-groove-purple to-pink-500"
  },
  { 
    id: "8", 
    title: "Indie Discoveries", 
    description: "Underground gems you'll love",
    gradient: "from-orange-400 to-red-500"
  },
  { 
    id: "9", 
    title: "Chill Vibes", 
    description: "Laid-back beats for any moment",
    gradient: "from-teal-400 to-blue-500"
  },
  { 
    id: "10", 
    title: "Late Night Sessions", 
    description: "Music for the after hours",
    gradient: "from-slate-500 to-slate-700"
  },
];

export const PlaylistGrid = ({ title, subtitle, showAll = true }: PlaylistGridProps) => {
  const isAISection = title.toLowerCase().includes("ai");
  const playlists = isAISection ? aiPlaylists : trendingPlaylists;
  const { playPlaylist } = usePlayer();
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const handleAIPlaylistClick = async (playlist: AIPlaylist) => {
    if (generatingId) return;
    
    setGeneratingId(playlist.id);
    toast.loading(`🤖 AI DJ generating "${playlist.title}"...`, { id: "ai-playlist" });

    try {
      // Call AI to generate playlist recommendations
      const { data: aiData, error: aiError } = await supabase.functions.invoke("ai-playlist", {
        body: {
          action: "generate_playlist",
          mood: playlist.mood,
          genre: playlist.genre,
          context: `User wants a ${playlist.title} playlist. Mood: ${playlist.mood}, preferred genre: ${playlist.genre}`
        }
      });

      if (aiError) throw aiError;

      // Fetch tracks matching the mood/genre
      const { data: tracks, error: tracksError } = await supabase
        .from("tracks")
        .select("*")
        .or(`genre.ilike.%${playlist.genre}%,mood.ilike.%${playlist.mood}%`)
        .limit(20);

      if (tracksError) throw tracksError;

      if (!tracks || tracks.length === 0) {
        // Fallback: get any tracks
        const { data: fallbackTracks } = await supabase
          .from("tracks")
          .select("*")
          .limit(20);
        
        if (fallbackTracks && fallbackTracks.length > 0) {
          // Shuffle for variety
          const shuffled = fallbackTracks.sort(() => Math.random() - 0.5);
          playPlaylist(shuffled);
          
          toast.success(
            `🎵 "${playlist.title}" ready! ${shuffled.length} tracks curated by AI`,
            { id: "ai-playlist" }
          );
        } else {
          toast.error("No tracks available. Add some tracks first!", { id: "ai-playlist" });
        }
        return;
      }

      // Shuffle tracks for variety
      const shuffledTracks = tracks.sort(() => Math.random() - 0.5);
      
      // Play the generated playlist
      playPlaylist(shuffledTracks);

      const aiInsight = aiData?.data?.explanation || "Personalized for your listening style";
      toast.success(
        `🎵 "${playlist.title}" ready! ${shuffledTracks.length} tracks • ${aiInsight}`,
        { id: "ai-playlist", duration: 4000 }
      );

    } catch (error) {
      console.error("AI playlist generation error:", error);
      toast.error("Failed to generate playlist. Trying fallback...", { id: "ai-playlist" });
      
      // Fallback: just play random tracks
      try {
        const { data: fallbackTracks } = await supabase
          .from("tracks")
          .select("*")
          .limit(15);
        
        if (fallbackTracks && fallbackTracks.length > 0) {
          const shuffled = fallbackTracks.sort(() => Math.random() - 0.5);
          playPlaylist(shuffled);
          toast.success(`Playing ${shuffled.length} tracks`, { id: "ai-playlist" });
        }
      } catch {
        toast.error("Could not load tracks", { id: "ai-playlist" });
      }
    } finally {
      setGeneratingId(null);
    }
  };

  const handleTrendingClick = async (playlistId: string) => {
    toast.loading("Loading playlist...", { id: "trending-playlist" });
    
    try {
      const { data: tracks } = await supabase
        .from("tracks")
        .select("*")
        .limit(20);
      
      if (tracks && tracks.length > 0) {
        const shuffled = tracks.sort(() => Math.random() - 0.5);
        playPlaylist(shuffled);
        toast.success(`Playing ${shuffled.length} tracks`, { id: "trending-playlist" });
      } else {
        toast.error("No tracks available", { id: "trending-playlist" });
      }
    } catch {
      toast.error("Failed to load playlist", { id: "trending-playlist" });
    }
  };

  return (
    <section className="px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl font-bold">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {showAll && (
          <button className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
            Show all
          </button>
        )}
      </div>

      <motion.div 
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
          }
        }}
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
      >
        {playlists.map((playlist) => (
          <motion.div
            key={playlist.id}
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 }
            }}
            className="relative"
          >
            {/* Loading overlay for AI generation */}
            {generatingId === playlist.id && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 rounded-lg">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            
            <PlaylistCard
              title={playlist.title}
              description={playlist.description}
              isAI={(playlist as AIPlaylist).isAI}
              gradient={playlist.gradient}
              onClick={() => 
                isAISection 
                  ? handleAIPlaylistClick(playlist as AIPlaylist)
                  : handleTrendingClick(playlist.id)
              }
            />
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
};
