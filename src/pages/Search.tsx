import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search as SearchIcon, Music, Mic, Download } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { TrackRow } from "@/components/cards/TrackRow";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { toast } from "sonner";
import { CCMixterSection } from "@/components/sections/CCMixterSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const genres = [
  { name: "Rock", color: "from-red-500 to-orange-500" },
  { name: "Pop", color: "from-pink-500 to-purple-500" },
  { name: "Punk", color: "from-gray-700 to-gray-900" },
  { name: "Pop-Rock", color: "from-purple-500 to-pink-500" },
  { name: "Pop-Punk", color: "from-green-400 to-teal-500" },
  { name: "Punk-Rock", color: "from-orange-400 to-red-500" },
  { name: "Electronic", color: "from-cyan-500 to-blue-500" },
  { name: "Chill", color: "from-indigo-500 to-purple-500" },
];

const Search = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [allTracks, setAllTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const { playTrack, playPlaylist, currentTrack, isPlaying, togglePlay } = usePlayer();

  useEffect(() => {
    // Load only playable tracks
    const loadTracks = async () => {
      const { data, error } = await supabase
        .from("tracks")
        .select("*")
        .or("audio_url.not.is.null,video_url.not.is.null")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading tracks:", error);
        return;
      }

      setAllTracks(data || []);
    };

    loadTracks();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const searchTracks = async () => {
      setLoading(true);
      const searchQuery = query.toLowerCase();
      
      const filtered = allTracks.filter(
        (track) =>
          track.title.toLowerCase().includes(searchQuery) ||
          track.artist.toLowerCase().includes(searchQuery) ||
          track.genre?.toLowerCase().includes(searchQuery) ||
          track.album?.toLowerCase().includes(searchQuery)
      );
      
      setResults(filtered);
      setLoading(false);
    };

    const debounce = setTimeout(searchTracks, 300);
    return () => clearTimeout(debounce);
  }, [query, allTracks]);

  const handleGenreClick = (genre: string) => {
    setQuery(genre);
  };

  const handlePlayTrack = (track: Track, index: number) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
    } else if (results.length > 0) {
      playPlaylist(results, index);
    } else {
      // Play from all tracks
      const trackIndex = allTracks.findIndex(t => t.id === track.id);
      playPlaylist(allTracks, trackIndex >= 0 ? trackIndex : 0);
    }
  };

  return (
    <MainLayout>
      <div className="px-6 py-8">
        {/* Search Header */}
        <div className="mb-8">
          <div className="relative max-w-xl">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search for songs, artists, or genres..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-12 pr-12 h-14 text-lg rounded-full bg-secondary border-none"
            />
            <button className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-muted rounded-full transition-colors">
              <Mic className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Results */}
        {query.trim() ? (
          <div>
            <h2 className="font-display text-xl font-bold mb-4">
              {loading ? "Searching..." : `Results for "${query}" (${results.length})`}
            </h2>
            {results.length > 0 ? (
              <div className="space-y-2">
                {results.map((track, index) => (
                  <TrackRow
                    key={track.id}
                    id={track.id}
                    index={index + 1}
                    title={track.title}
                    artist={track.artist}
                    album={track.album || ""}
                    duration={formatDuration(track.duration)}
                    imageUrl={track.cover_url || undefined}
                    trackUrl={track.video_url || track.audio_url}
                    isPlaying={currentTrack?.id === track.id && isPlaying}
                    onPlay={() => handlePlayTrack(track, index)}
                  />
                ))}
              </div>
            ) : (
              !loading && (
                <p className="text-muted-foreground">No results found</p>
              )
            )}
          </div>
        ) : (
          <Tabs defaultValue="library" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="library">My Library</TabsTrigger>
              <TabsTrigger value="ccmixter" className="flex items-center gap-1">
                <Download className="h-3.5 w-3.5" />
                CC Mixter (Free)
              </TabsTrigger>
            </TabsList>

            <TabsContent value="library">
              {/* Browse Genres */}
              <h2 className="font-display text-xl font-bold mb-4">Browse All</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {genres.map((genre) => (
                  <motion.button
                    key={genre.name}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleGenreClick(genre.name)}
                    className={`relative h-32 rounded-xl bg-gradient-to-br ${genre.color} overflow-hidden group`}
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="font-display text-xl font-bold text-primary-foreground">
                        {genre.name}
                      </span>
                    </div>
                    <Music className="absolute bottom-2 right-2 h-8 w-8 text-primary-foreground/30 rotate-12" />
                  </motion.button>
                ))}
              </div>

              {/* All Tracks */}
              <h2 className="font-display text-xl font-bold mt-8 mb-4">
                All Tracks ({allTracks.length})
              </h2>
              <div className="space-y-2">
                {allTracks.slice(0, 50).map((track, index) => (
                  <TrackRow
                    key={track.id}
                    id={track.id}
                    index={index + 1}
                    title={track.title}
                    artist={track.artist}
                    album={track.album || ""}
                    duration={formatDuration(track.duration)}
                    imageUrl={track.cover_url || undefined}
                    trackUrl={track.video_url || track.audio_url}
                    isPlaying={currentTrack?.id === track.id && isPlaying}
                    onPlay={() => handlePlayTrack(track, index)}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="ccmixter" className="space-y-0">
              <div className="mb-6 p-4 rounded-lg bg-primary/10 border border-primary/20">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Download className="h-4 w-4 text-primary" />
                  Free Legal Downloads
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  All tracks below are licensed under Creative Commons. Download legally with proper attribution.
                </p>
              </div>
              
              <CCMixterSection genre="rock" title="Rock Discoveries" limit={8} />
              <CCMixterSection genre="punk" title="Punk Underground" limit={8} />
              <CCMixterSection genre="pop" title="Pop Gems" limit={8} />
              <CCMixterSection genre="electronic" title="Electronic Beats" limit={8} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </MainLayout>
  );
};

export default Search;
