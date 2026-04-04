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
  imageUrl?: string;
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
    const { data } = await supabase
      .from('tracks')
      .select('*')
      .ilike('artist', `%${artistName}%`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data && data.length > 0) {
      playPlaylist(data as Track[], 0);
    }
    navigate(`/search?q=${encodeURIComponent(artistName)}`);
  };

  // Fetch avatar URLs for artist names by matching display_name in profiles
  const fetchArtistAvatars = async (artistNames: string[]): Promise<Record<string, string>> => {
    const avatarMap: Record<string, string> = {};
    if (artistNames.length === 0) return avatarMap;

    // Try to match artist names to profiles via tracks.user_id -> profiles
    const { data: tracksWithUsers } = await supabase
      .from('tracks')
      .select('artist, user_id')
      .in('artist', artistNames)
      .not('user_id', 'is', null);

    if (tracksWithUsers && tracksWithUsers.length > 0) {
      const userIds = [...new Set(tracksWithUsers.filter(t => t.user_id).map(t => t.user_id!))];
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, avatar_url, display_name')
        .in('user_id', userIds);

      if (profiles) {
        // Map user_id to avatar
        const userAvatarMap: Record<string, string> = {};
        profiles.forEach(p => {
          if (p.avatar_url) userAvatarMap[p.user_id] = p.avatar_url;
        });

        // Map artist name to avatar via tracks
        tracksWithUsers.forEach(track => {
          if (track.user_id && userAvatarMap[track.user_id] && !avatarMap[track.artist]) {
            avatarMap[track.artist] = userAvatarMap[track.user_id];
          }
        });
      }
    }

    // Also try matching by cover_url from tracks as fallback
    for (const name of artistNames) {
      if (!avatarMap[name]) {
        const { data: trackWithCover } = await supabase
          .from('tracks')
          .select('cover_url')
          .ilike('artist', name)
          .not('cover_url', 'is', null)
          .limit(1)
          .single();

        if (trackWithCover?.cover_url) {
          avatarMap[name] = trackWithCover.cover_url;
        }
      }
    }

    return avatarMap;
  };

  useEffect(() => {
    const fetchTopArtists = async () => {
      setIsLoading(true);
      try {
        let artistEntries: { name: string; playCount: number }[] = [];

        if (user) {
          const { data: historyData, error } = await supabase
            .from('listening_history')
            .select('track_id')
            .eq('user_id', user.id)
            .order('played_at', { ascending: false })
            .limit(500);

          if (!error && historyData && historyData.length > 0) {
            const trackIds = historyData.map(h => h.track_id);
            
            const { data: tracksData } = await supabase
              .from('tracks')
              .select('artist')
              .in('id', trackIds);

            if (tracksData && tracksData.length > 0) {
              const artistCounts: Record<string, number> = {};
              tracksData.forEach(track => {
                artistCounts[track.artist] = (artistCounts[track.artist] || 0) + 1;
              });

              artistEntries = Object.entries(artistCounts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 8)
                .map(([name, playCount]) => ({ name, playCount }));
            }
          }
        }

        // Fallback: popular artists from all tracks
        if (artistEntries.length === 0) {
          const { data: tracksData } = await supabase
            .from('tracks')
            .select('artist')
            .limit(200);

          if (tracksData && tracksData.length > 0) {
            const artistCounts: Record<string, number> = {};
            tracksData.forEach(track => {
              artistCounts[track.artist] = (artistCounts[track.artist] || 0) + 1;
            });

            artistEntries = Object.entries(artistCounts)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 8)
              .map(([name, playCount]) => ({ name, playCount: playCount * 1000 }));
          }
        }

        // Fetch avatars for all artist names
        const avatarMap = await fetchArtistAvatars(artistEntries.map(a => a.name));

        const finalArtists: ArtistData[] = artistEntries.map((entry, index) => ({
          id: `${index}`,
          name: entry.name,
          playCount: entry.playCount,
          gradient: gradients[index % gradients.length],
          imageUrl: avatarMap[entry.name],
        }));

        setArtists(finalArtists);
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
      <section className="px-4 sm:px-6 py-8">
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
    <section className="px-4 sm:px-6 py-8">
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
            transition: { staggerChildren: 0.08 }
          }
        }}
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4"
      >
        {artists.map((artist) => (
          <motion.div
            key={artist.id}
            variants={{
              hidden: { opacity: 0, y: 24, scale: 0.95 },
              visible: { opacity: 1, y: 0, scale: 1 }
            }}
          >
            <ArtistCard
              name={artist.name}
              followers={formatPlayCount(artist.playCount)}
              gradient={artist.gradient}
              imageUrl={artist.imageUrl}
              onClick={() => handleArtistClick(artist.name)}
            />
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
};
