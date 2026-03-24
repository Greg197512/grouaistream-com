import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArtistCard } from "@/components/cards/ArtistCard";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ArtistData {
  id: string;
  name: string;
  playCount: number;
  gradient: string;
}

const gradients = [
  "from-pink-500 to-rose-500",
  "from-blue-500 to-cyan-500",
  "from-purple-500 to-pink-500",
  "from-green-500 to-emerald-500",
  "from-orange-500 to-yellow-500",
  "from-indigo-500 to-blue-500",
  "from-red-500 to-orange-500",
  "from-teal-500 to-green-500",
];

const formatPlayCount = (count: number): string => {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M plays`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K plays`;
  return `${count} plays`;
};

export const TopArtists = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { playPlaylist } = usePlayer();
  const [artists, setArtists] = useState<ArtistData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const handleArtistClick = async (artistName: string) => {
    // Fetch tracks by this artist and play them
    const { data } = await supabase
      .from('tracks')
      .select('*')
      .ilike('artist', `%${artistName}%`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data && data.length > 0) {
      playPlaylist(data as Track[], 0);
    }
    // Also navigate to search with artist name
    navigate(`/search?q=${encodeURIComponent(artistName)}`);
  };

  useEffect(() => {
    const fetchTopArtists = async () => {
      setIsLoading(true);
      try {
        if (user) {
          // Fetch from user's listening history
          const { data: historyData, error } = await supabase
            .from('listening_history')
            .select('track_id')
            .eq('user_id', user.id)
            .order('played_at', { ascending: false })
            .limit(500);

          if (error) throw error;

          if (historyData && historyData.length > 0) {
            const trackIds = historyData.map(h => h.track_id);
            
            const { data: tracksData } = await supabase
              .from('tracks')
              .select('artist')
              .in('id', trackIds);

            if (tracksData && tracksData.length > 0) {
              // Count plays per artist
              const artistCounts: Record<string, number> = {};
              tracksData.forEach(track => {
                const artist = track.artist;
                artistCounts[artist] = (artistCounts[artist] || 0) + 1;
              });

              // Sort by play count and take top 6
              const sortedArtists = Object.entries(artistCounts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 6)
                .map(([name, playCount], index) => ({
                  id: `${index}`,
                  name,
                  playCount,
                  gradient: gradients[index % gradients.length],
                }));

              setArtists(sortedArtists);
              setIsLoading(false);
              return;
            }
          }
        }

        // Fallback: fetch popular artists from all tracks
        const { data: tracksData } = await supabase
          .from('tracks')
          .select('artist')
          .limit(200);

        if (tracksData && tracksData.length > 0) {
          const artistCounts: Record<string, number> = {};
          tracksData.forEach(track => {
            artistCounts[track.artist] = (artistCounts[track.artist] || 0) + 1;
          });

          const sortedArtists = Object.entries(artistCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 6)
            .map(([name, playCount], index) => ({
              id: `${index}`,
              name,
              playCount: playCount * 1000, // Scale up for display
              gradient: gradients[index % gradients.length],
            }));

          setArtists(sortedArtists);
        }
      } catch (error) {
        console.error('Error fetching top artists:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTopArtists();
  }, [user]);

  if (isLoading) {
    return (
      <section className="px-6 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  if (artists.length === 0) {
    return null;
  }

  return (
    <section className="px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl font-bold">Popular Artists</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {user ? "Based on your listening history" : "Trending artists"}
          </p>
        </div>
        <button className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
          Show all
        </button>
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
        {artists.map((artist) => (
          <motion.div
            key={artist.id}
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 }
            }}
          >
            <ArtistCard
              name={artist.name}
              followers={formatPlayCount(artist.playCount)}
              gradient={artist.gradient}
              onClick={() => handleArtistClick(artist.name)}
            />
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
};
