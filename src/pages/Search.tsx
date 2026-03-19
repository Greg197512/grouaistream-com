import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search as SearchIcon, Music, Mic, MicOff, Download, Loader2, Youtube, Sparkles, Globe } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TrackRow } from "@/components/cards/TrackRow";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, Track } from "@/contexts/PlayerContext";

import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { CCMixterSection } from "@/components/sections/CCMixterSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { searchCCMixter, CCMixterTrack } from "@/services/ccMixterService";
import { cn } from "@/lib/utils";

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

const ccTrackToTrack = (cc: CCMixterTrack): Track => {
  const downloadUrl = cc.download_url || cc.files?.[0]?.download_url;
  return {
    id: `cc-${cc.upload_id}`,
    title: cc.upload_name,
    artist: cc.user_real_name || cc.user_name,
    album: "CC Mixter",
    duration: 180,
    audio_url: downloadUrl || null,
    cover_url: null,
    video_url: null,
    genre: null,
    mood: null,
  };
};

const Search = () => {
  const [searchParams] = useSearchParams();
  const urlQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(urlQuery);

  // Sync query from URL params (when navigating from TopBar)
  useEffect(() => {
    if (urlQuery && urlQuery !== query) {
      setQuery(urlQuery);
    }
  }, [urlQuery]);
  const [results, setResults] = useState<Track[]>([]);
  const [ccResults, setCcResults] = useState<Track[]>([]);
  const [allTracks, setAllTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [ccLoading, setCcLoading] = useState(false);
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
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

  // Normalize text for fuzzy matching (remove diacritics, lowercase)
  const normalize = useCallback((text: string) => {
    return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/ø/g, "o");
  }, []);

  // Local library + DB search (debounced)
  useEffect(() => {
    if (!query.trim()) { setResults([]); setCcResults([]); return; }
    setLoading(true);

    const timer = setTimeout(async () => {
      const searchQuery = normalize(query);
      const words = searchQuery.split(/\s+/).filter(w => w.length > 1);

      // 1. Local fuzzy search — score-based ranking
      const scored = allTracks.map(track => {
        const title = normalize(track.title);
        const artist = normalize(track.artist);
        const genre = normalize(track.genre || "");
        const album = normalize(track.album || "");
        const combined = `${title} ${artist} ${genre} ${album}`;

        let score = 0;
        // Exact full match = highest
        if (title === searchQuery || artist === searchQuery) score += 100;
        // Title/artist starts with query
        if (title.startsWith(searchQuery) || artist.startsWith(searchQuery)) score += 50;
        // Contains full query
        if (combined.includes(searchQuery)) score += 30;
        // Each word matched
        for (const word of words) {
          if (title.includes(word)) score += 10;
          if (artist.includes(word)) score += 8;
          if (genre.includes(word)) score += 3;
          if (album.includes(word)) score += 3;
        }
        return { track, score };
      }).filter(s => s.score > 0).sort((a, b) => b.score - a.score).map(s => s.track);

      // 2. Also query DB directly with ilike for tracks not yet loaded
      try {
        const ilikePattern = `%${query.trim()}%`;
        const { data: dbResults } = await supabase
          .from("tracks")
          .select("*")
          .or(`title.ilike.${ilikePattern},artist.ilike.${ilikePattern},album.ilike.${ilikePattern},genre.ilike.${ilikePattern}`)
          .or("audio_url.not.is.null,video_url.not.is.null")
          .limit(50);

        if (dbResults) {
          const dbPlayable = filterTracks(dbResults.filter(isPlayableTrack));
          const existingIds = new Set(scored.map(t => t.id));
          const newFromDb = dbPlayable.filter(t => !existingIds.has(t.id));
          setResults([...scored, ...newFromDb]);
        } else {
          setResults(scored);
        }
      } catch {
        setResults(scored);
      }
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, allTracks, normalize, filterTracks]);

  // CC Mixter search (debounced)
  useEffect(() => {
    if (!query.trim() || query.length < 3) { setCcResults([]); return; }
    setCcLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { tracks } = await searchCCMixter(query, 10);
        setCcResults(tracks.map(ccTrackToTrack).filter(t => t.audio_url));
      } catch {
        setCcResults([]);
      } finally {
        setCcLoading(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [query]);

  const handleYouTubeSearch = useCallback(async () => {
    if (!query.trim() || youtubeLoading) return;
    setYoutubeLoading(true);
    const toastId = toast.loading(`🔍 Szukam "${query}" na YouTube...`);

    try {
      const { data: aiData, error: aiError } = await supabase.functions.invoke("ai-assistant", {
        body: {
          message: `Znajdź na YouTube dokładny videoId (11 znaków) dla: "${query}". Odpowiedz TYLKO samym videoId, nic więcej.`,
          history: []
        }
      });

      if (aiError) throw aiError;

      const responseText = aiData?.response || "";
      const videoIdMatch = responseText.match(/[a-zA-Z0-9_-]{11}/);
      
      if (!videoIdMatch) {
        toast.dismiss(toastId);
        toast.error("Nie znaleziono utworu na YouTube");
        setYoutubeLoading(false);
        return;
      }

      const videoId = videoIdMatch[0];
      toast.loading(`⬇️ Pobieram z YouTube...`, { id: toastId });

      const { data: dlData, error: dlError } = await supabase.functions.invoke("youtube-download", {
        body: { videoId }
      });

      if (!dlError && dlData?.audioUrl) {
        const newTrack: Track = {
          id: dlData.trackId || crypto.randomUUID(),
          title: dlData.title || query,
          artist: dlData.artist || "YouTube",
          album: dlData.album || undefined,
          duration: dlData.duration || 240,
          audio_url: dlData.audioUrl,
          cover_url: dlData.coverUrl || undefined,
          video_url: `https://www.youtube.com/watch?v=${videoId}`,
          genre: undefined,
          mood: undefined,
        };
        toast.dismiss(toastId);
        toast.success(`✅ Znaleziono: ${newTrack.title}`);
        playTrack(newTrack);
        setAllTracks(prev => [newTrack, ...prev]);
      } else {
        const newTrack: Track = {
          id: crypto.randomUUID(),
          title: query,
          artist: "YouTube",
          album: undefined,
          duration: 240,
          audio_url: undefined,
          cover_url: undefined,
          video_url: `https://www.youtube.com/watch?v=${videoId}`,
          genre: undefined,
          mood: undefined,
        };
        toast.dismiss(toastId);
        toast.success(`▶️ Odtwarzam z YouTube: ${query}`);
        playTrack(newTrack);
      }
    } catch (error) {
      console.error("YouTube search error:", error);
      toast.dismiss(toastId);
      toast.error("Błąd wyszukiwania YouTube");
    } finally {
      setYoutubeLoading(false);
    }
  }, [query, youtubeLoading, playTrack]);

  // Voice input via Web Speech API
  const toggleVoiceSearch = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Twoja przeglądarka nie obsługuje rozpoznawania mowy");
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pl-PL";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognitionRef.current = recognition;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => {
      setIsListening(false);
      toast.error("Błąd rozpoznawania mowy");
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      toast.success(`🎤 "${transcript}"`);
    };

    recognition.start();
  }, [isListening]);

  const handleGenreClick = (genre: string) => setQuery(genre);

  const allResults = [...results, ...ccResults.filter(cc => !results.some(r => r.title.toLowerCase() === cc.title.toLowerCase()))];

  const handlePlayTrack = (track: Track, index: number) => {
    if (currentTrack?.id === track.id) { togglePlay(); }
    else if (allResults.length > 0) { playPlaylist(allResults, index); }
    else { const trackIndex = allTracks.findIndex(t => t.id === track.id); playPlaylist(allTracks, trackIndex >= 0 ? trackIndex : 0); }
  };

  const totalLoading = loading || ccLoading;

  return (
    <MainLayout>
      <div className="px-3 sm:px-6 py-4 sm:py-8 pb-24 sm:pb-8">
        <div className="mb-4 sm:mb-8">
          <div className="relative max-w-xl mx-auto sm:mx-0">
            <SearchIcon className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t("search.placeholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 sm:pl-12 pr-10 sm:pr-12 h-11 sm:h-14 text-base sm:text-lg rounded-full bg-secondary border-none"
            />
            <button
              onClick={toggleVoiceSearch}
              className={cn(
                "absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 p-1.5 sm:p-2 rounded-full transition-colors",
                isListening
                  ? "bg-destructive/20 text-destructive animate-pulse"
                  : "hover:bg-muted text-muted-foreground"
              )}
            >
              {isListening ? <MicOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Mic className="h-4 w-4 sm:h-5 sm:w-5" />}
            </button>
          </div>
          {isListening && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-destructive mt-2 ml-4 flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              Słucham... powiedz nazwę utworu
            </motion.p>
          )}
        </div>

        {query.trim() ? (
          <div>
            {/* Results header */}
            <h2 className="font-display text-base sm:text-xl font-bold mb-3 sm:mb-4">
              {totalLoading ? t("search.searching") : `${t("search.resultsFor")} "${query}" (${allResults.length})`}
            </h2>

            {/* Source badges */}
            {allResults.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {results.length > 0 && (
                  <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                    <Music className="h-3 w-3" /> Biblioteka: {results.length}
                  </span>
                )}
                {ccResults.length > 0 && (
                  <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center gap-1">
                    <Globe className="h-3 w-3" /> CC Mixter: {ccResults.length}
                  </span>
                )}
                {ccLoading && (
                  <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> CC Mixter...
                  </span>
                )}
              </div>
            )}

            {/* Combined results */}
            {allResults.length > 0 ? (
              <div className="space-y-1 sm:space-y-2">
                {allResults.map((track, index) => (
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
            ) : (!totalLoading && (
              <div className="flex flex-col items-center gap-4 py-12">
                <p className="text-muted-foreground">{t("search.noResults")}</p>
              </div>
            ))}

            {/* YouTube fallback — always show when query exists */}
            {!totalLoading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-3 mt-6 pt-6 border-t border-border"
              >
                <Sparkles className="h-6 w-6 text-primary animate-pulse" />
                <p className="text-sm text-muted-foreground">
                  {allResults.length > 0 ? "Nie widzisz tego, czego szukasz?" : "AI znajdzie to na YouTube"}
                </p>
                <Button
                  onClick={handleYouTubeSearch}
                  disabled={youtubeLoading}
                  className="gap-2 bg-red-600 hover:bg-red-700 text-white"
                  size="lg"
                >
                  {youtubeLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Youtube className="h-5 w-5" />
                  )}
                  {youtubeLoading ? "Szukam..." : `Wyszukaj "${query}" na YouTube`}
                </Button>
              </motion.div>
            )}
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
              <h2 className="font-display text-base sm:text-xl font-bold mb-3 sm:mb-4">{t("search.browseAll")}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
                {genres.map((genre) => (
                  <motion.button key={genre.name} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => handleGenreClick(genre.name)} className={`relative h-20 sm:h-32 rounded-xl bg-gradient-to-br ${genre.color} overflow-hidden group`}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="font-display text-base sm:text-xl font-bold text-primary-foreground">{genre.name}</span>
                    </div>
                    <Music className="absolute bottom-2 right-2 h-8 w-8 text-primary-foreground/30 rotate-12" />
                  </motion.button>
                ))}
              </div>

              <h2 className="font-display text-base sm:text-xl font-bold mt-6 sm:mt-8 mb-3 sm:mb-4">{t("search.allTracks")} ({allTracks.length})</h2>
              <div className="space-y-1 sm:space-y-2">
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
