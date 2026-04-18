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
  userId: string;
  name: string;
  trackCount: number;
  gradient: string;
  imageUrl?: string;
}

// Generate unique DiceBear avatar based on artist name (deterministic, fun, unique)
const generateUniqueAvatar = (name: string): string => {
  const styles = ["bottts-neutral", "shapes", "thumbs", "rings", "glass", "identicon"];
  const seed = encodeURIComponent(name.trim().toLowerCase());
  const style = styles[name.length % styles.length];
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}&backgroundType=gradientLinear&backgroundColor=ff6b35,f7931e,ffd23f,06ffa5,118ab2,7209b7,b5179e&radius=50`;
};

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

export const TopArtists = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { playPlaylist } = usePlayer();
  const [artists, setArtists] = useState<ArtistData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const handleArtistClick = async (artist: ArtistData) => {
    const { data } = await supabase
      .from('tracks')
      .select('*')
      .eq('user_id', artist.userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data && data.length > 0) {
      playPlaylist(data as Track[], 0);
    }
    navigate(`/search?q=${encodeURIComponent(artist.name)}`);
  };

  const fetchTopArtists = async () => {
    setIsLoading(true);
    try {
      const { data: tracksData } = await supabase
        .from('tracks')
        .select('user_id, artist')
        .not('user_id', 'is', null);

      if (!tracksData || tracksData.length === 0) {
        setArtists([]);
        return;
      }

      const userTrackMap: Record<string, { count: number; artistName: string }> = {};
      tracksData.forEach(t => {
        if (!t.user_id) return;
        if (!userTrackMap[t.user_id]) {
          userTrackMap[t.user_id] = { count: 0, artistName: t.artist };
        }
        userTrackMap[t.user_id].count += 1;
      });

      const userIds = Object.keys(userTrackMap);
      if (userIds.length === 0) {
        setArtists([]);
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      const profileMap: Record<string, { name: string | null; avatar: string | null }> = {};
      profiles?.forEach(p => {
        profileMap[p.user_id] = {
          name: p.display_name,
          avatar: p.avatar_url,
        };
      });

      const finalArtists: ArtistData[] = userIds
        .map((uid, index) => {
          const profile = profileMap[uid];
          const name = userTrackMap[uid].artistName || profile?.name || 'Artist';
          return {
            id: uid,
            userId: uid,
            name,
            trackCount: userTrackMap[uid].count,
            gradient: gradients[index % gradients.length],
            imageUrl: profile?.avatar || generateUniqueAvatar(name),
          };
        })
        .sort((a, b) => b.trackCount - a.trackCount)
        .slice(0, 16);

      setArtists(finalArtists);
    } catch (error) {
      console.error('Error fetching top artists:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTopArtists();

    // Realtime: gdy ktoś wgra utwór lub zmieni avatar → lista odświeża się automatycznie
    const channel = supabase
      .channel('trending-artists-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tracks' }, () => fetchTopArtists())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => fetchTopArtists())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
          <h2 className="font-display text-2xl font-bold">Trending Artists</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Twórcy z utworami w GrouAI Stream
          </p>
        </div>
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
              followers={artist.trackCount === 1 ? '1 utwór' : `${artist.trackCount} utworów`}
              gradient={artist.gradient}
              imageUrl={artist.imageUrl}
              isTrending={true}
              trackCount={artist.trackCount}
              onClick={() => handleArtistClick(artist)}
            />
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
};
