import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search as SearchIcon, Music, Mic, Download } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { TrackRow } from "@/components/cards/TrackRow";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { CCMixterSection } from "@/components/sections/CCMixterSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const isPlayableTrack = (track: Track): boolean => {
  const youtubePattern = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|^[a-zA-Z0-9_-]{11}$)/;
  const hasValidYouTube = Boolean(track.video_url && youtubePattern.test(track.video_url));
  const hasValidAudio = Boolean(track.audio_url && /^https?:\/\//i.test(track.audio_url) && !track.audio_url.includes("open.spotify.com") && !track.audio_url.startsWith("spotify:"));
  const hasValidDirectVideo = Boolean(track.video_url && /^https?:\/\//i.test(track.video_url) && !track.video_url.includes("open.spotify.com") && !track.video_url.startsWith("spotify:"));
  return hasValidYouTube || hasValidAudio || hasValidDirectVideo;
};

const genres = [
  { name: "Rock", color: "from-red-500 to-orange-500" },
  { name: "Punk", color: "from-gray-700 to-gray-900" },
  { name: "Pop", color: "from-pink-500 to-purple-500" },
  { name: "Hip-Hop", color: "from-amber-500 to-orange-600" },
  { name: "Rap", color: "from-slate-600 to-slate-900" },
  { name: "R&B", color: "from-violet-500 to-fuchsia-500" },
  { name: "Electronic", color: "from-cyan-500 to-blue-500" },
  { name: "House", color: "from-sky-500 to-indigo-500" },
  { name: "Techno", color: "from-blue-600 to-purple-700" },
  { name: "Metal", color: "from-zinc-700 to-zinc-900" },
  { name: "Indie", color: "from-emerald-500 to-teal-500" },
  { name: "Alternative", color: "from-lime-500 to-green-600" },
  { name: "Jazz", color: "from-yellow-500 to-amber-600" },
  { name: "Classical", color: "from-rose-400 to-orange-400" },
  { name: "Country", color: "from-orange-500 to-yellow-600" },
  { name: "Reggae", color: "from-green-500 to-yellow-500" },
];

const Search = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [allTracks, setAllTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const { playTrack, playPlaylist, currentTrack, isPlaying, togglePlay } = usePlayer();
  const { t } = useLanguage();

  useEffect(() => {
    const loadTracks = async () => {
      const { data, error } = await supabase.from("tracks").select("*").or("audio_url.not.is.null,video_url.not.is.null").order("created_at", { ascending: false });
      if (error) { console.error("Error loading tracks:", error); return; }
      const playableTracks = (data || []).filter(isPlayableTrack);
      setAllTracks(playableTracks);
    };
    loadTracks();
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const searchTracks = async () => {
      setLoading(true);
      const searchQuery = query.toLowerCase();
      const filtered = allTracks.filter((track) =>
        track.title.toLowerCase().includes(searchQuery) || track.artist.toLowerCase().includes(searchQuery) || track.genre?.toLowerCase().includes(searchQuery) || track.album?.toLowerCase().includes(searchQuery)
      );
      setResults(filtered);
      setLoading(false);
    };
    const debounce = setTimeout(searchTracks, 300);
    return () => clearTimeout(debounce);
  }, [query, allTracks]);

  const handleGenreClick = (genre: string) => setQuery(genre);

  const handlePlayTrack = (track: Track, index: number) => {
    if (currentTrack?.id === track.id) { togglePlay(); }
    else if (results.length > 0) { playPlaylist(results, index); }
    else { const trackIndex = allTracks.findIndex(t => t.id === track.id); playPlaylist(allTracks, trackIndex >= 0 ? trackIndex : 0); }
  };

  return (
    <MainLayout>
      <div className="px-6 py-8">
        <div className="mb-8">
          <div className="relative max-w-xl">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input type="text" placeholder={t("search.placeholder")} value={query} onChange={(e) => setQuery(e.target.value)} className="pl-12 pr-12 h-14 text-lg rounded-full bg-secondary border-none" />
            <button className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-muted rounded-full transition-colors">
              <Mic className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {query.trim() ? (
          <div>
            <h2 className="font-display text-xl font-bold mb-4">
              {loading ? t("search.searching") : `${t("search.resultsFor")} "${query}" (${results.length})`}
            </h2>
            {results.length > 0 ? (
              <div className="space-y-2">
                {results.map((track, index) => (
                  <TrackRow key={track.id} id={track.id} index={index + 1} title={track.title} artist={track.artist} album={track.album || ""} duration={formatDuration(track.duration)} imageUrl={track.cover_url || undefined} trackUrl={track.video_url || track.audio_url} isPlaying={currentTrack?.id === track.id && isPlaying} onPlay={() => handlePlayTrack(track, index)} />
                ))}
              </div>
            ) : (!loading && <p className="text-muted-foreground">{t("search.noResults")}</p>)}
          </div>
        ) : (
          <Tabs defaultValue="library" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="library">{t("search.myLibrary")}</TabsTrigger>
              <TabsTrigger value="ccmixter" className="flex items-center gap-1">
                <Download className="h-3.5 w-3.5" />
                {t("search.ccMixter")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="library">
              <h2 className="font-display text-xl font-bold mb-4">{t("search.browseAll")}</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {genres.map((genre) => (
                  <motion.button key={genre.name} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => handleGenreClick(genre.name)} className={`relative h-32 rounded-xl bg-gradient-to-br ${genre.color} overflow-hidden group`}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="font-display text-xl font-bold text-primary-foreground">{genre.name}</span>
                    </div>
                    <Music className="absolute bottom-2 right-2 h-8 w-8 text-primary-foreground/30 rotate-12" />
                  </motion.button>
                ))}
              </div>

              <h2 className="font-display text-xl font-bold mt-8 mb-4">{t("search.allTracks")} ({allTracks.length})</h2>
              <div className="space-y-2">
                {allTracks.slice(0, 50).map((track, index) => (
                  <TrackRow key={track.id} id={track.id} index={index + 1} title={track.title} artist={track.artist} album={track.album || ""} duration={formatDuration(track.duration)} imageUrl={track.cover_url || undefined} trackUrl={track.video_url || track.audio_url} isPlaying={currentTrack?.id === track.id && isPlaying} onPlay={() => handlePlayTrack(track, index)} />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="ccmixter" className="space-y-0">
              <div className="mb-6 p-4 rounded-lg bg-primary/10 border border-primary/20">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Download className="h-4 w-4 text-primary" />
                  {t("search.freeLegalDownloads")}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">{t("search.freeLegalDownloadsDesc")}</p>
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
