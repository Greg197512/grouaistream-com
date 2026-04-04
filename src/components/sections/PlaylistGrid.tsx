import { useState } from "react";
import { motion } from "framer-motion";
import { PlaylistCard } from "@/components/cards/PlaylistCard";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAI } from "@/contexts/AIContext";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

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
  
  const { generateAIPlaylist, isProcessing, lastRecommendation } = useAI();
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const handleAIPlaylistClick = async (playlist: AIPlaylist) => {
    if (generatingId || isProcessing) return;
    
    setGeneratingId(playlist.id);
    toast.loading(`🤖 AI DJ generating "${playlist.title}"...`, { id: "ai-playlist" });

    try {
      const tracks = await generateAIPlaylist(
        playlist.mood,
        playlist.genre,
        `User clicked on "${playlist.title}" playlist card`
      );

      if (tracks && tracks.length > 0) {
        playPlaylist(tracks);
        
        const aiInsight = lastRecommendation?.explanation || "Personalized for your listening style";
        toast.success(
          `🎵 "${playlist.title}" ready! ${tracks.length} tracks • ${aiInsight}`,
          { id: "ai-playlist", duration: 4000 }
        );
      } else {
        toast.error("No tracks found for this mood", { id: "ai-playlist" });
      }
    } catch (error) {
      console.error("AI playlist generation error:", error);
      toast.error("Failed to generate playlist", { id: "ai-playlist" });
    } finally {
      setGeneratingId(null);
    }
  };

  const handleTrendingClick = async () => {
    toast.loading("Loading playlist...", { id: "trending-playlist" });
    
    try {
      let query = supabase
        .from("tracks")
        .select("*");
      query = applyUnlockFilter(query);
      const { data: tracks } = await query.limit(20);
      
      if (tracks && tracks.length > 0) {
        const shuffled = [...tracks].sort(() => Math.random() - 0.5);
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
        <div className="flex items-center gap-3">
          {isAISection && (
            <div className="groove-gradient-bg h-8 w-8 rounded-lg flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
          )}
          <div>
            <h2 className="font-display text-2xl font-bold">{title}</h2>
            {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
          </div>
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
                  : handleTrendingClick()
              }
            />
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
};
