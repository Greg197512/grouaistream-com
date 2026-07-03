import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Film, Loader2, Database, Flag, Globe, Play, X, Search, RefreshCw, Music, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

interface Movie {
  id: string;
  title: string;
  original_title: string | null;
  director: string;
  year: number | null;
  genre: string | null;
  category: string;
  description: string | null;
  poster_url: string | null;
  video_url: string | null;
  duration_minutes: number | null;
  rating: number | null;
  country: string | null;
}

interface TrackClip {
  id: string;
  title: string;
  artist: string;
  video_url: string | null;
  cover_url: string | null;
  genre: string | null;
}

const Movies = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [tracks, setTracks] = useState<TrackClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [populating, setPopulating] = useState(false);
  const [populateProgress, setPopulateProgress] = useState(0);
  const [populateMsg, setPopulateMsg] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [selectedClip, setSelectedClip] = useState<TrackClip | null>(null);
  const [searching, setSearching] = useState<string | null>(null);
  const [batchSearching, setBatchSearching] = useState(false);
  const [clipBatch, setClipBatch] = useState(false);

  const loadMovies = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("movies")
      .select("*")
      .gte("duration_minutes", 60)
      .order("rating", { ascending: false, nullsFirst: false })
      .limit(100);

    if (activeTab === "polish") query = query.eq("category", "polish");
    else if (activeTab === "foreign") query = query.eq("category", "foreign");

    const { data } = await query;
    setMovies((data as Movie[]) || []);

    const { count } = await supabase
      .from("movies")
      .select("*", { count: "exact", head: true });
    setTotalCount(count || 0);

    setLoading(false);
  }, [activeTab]);

  const loadTracks = useCallback(async () => {
    setLoading(true);
    // Prioritize tracks that already have a music video, then the rest so users can trigger search
    const client = supabase as any;
    const { data } = await client
      .from("tracks")
      .select("id, title, artist, video_url, cover_url, genre")
      .eq("is_public", true)
      .order("video_url", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(120);
    setTracks((data as TrackClip[]) || []);
    setLoading(false);
  }, []);

  const playClip = useCallback(async (clip: TrackClip) => {
    if (clip.video_url) {
      setSelectedClip(clip);
      return;
    }
    setSearching(clip.id);
    try {
      const { data, error } = await supabase.functions.invoke("track-video-search", {
        body: { mode: "single", trackId: clip.id, title: clip.title, artist: clip.artist },
      });
      if (error || !data?.success) {
        toast.error(`Nie znaleziono teledysku dla "${clip.title}"`);
        return;
      }
      const updated = { ...clip, video_url: data.videoUrl, cover_url: data.coverUrl };
      setTracks((prev) => prev.map((c) => (c.id === clip.id ? updated : c)));
      setSelectedClip(updated);
      toast.success(`Znaleziono: ${data.youtubeTitle}`);
    } catch {
      toast.error("Błąd wyszukiwania teledysku");
    } finally {
      setSearching(null);
    }
  }, []);

  const runClipBatch = useCallback(async () => {
    if (clipBatch) return;
    setClipBatch(true);
    let total = 0;
    try {
      for (let i = 0; i < 3; i++) {
        const { data, error } = await supabase.functions.invoke("track-video-search", {
          body: { mode: "batch", batchSize: 15 },
        });
        if (error) break;
        total += data?.updated || 0;
        if (!data?.updated) break;
        toast.info(`Batch ${i + 1}: +${data.updated} teledysków`);
        await new Promise((r) => setTimeout(r, 800));
      }
      toast.success(`Dodano ${total} teledysków 🎬`);
      loadTracks();
    } finally {
      setClipBatch(false);
    }
  }, [clipBatch, loadTracks]);

  const searchAndPlay = useCallback(async (movie: Movie) => {
    // If already has video_url, play directly
    if (movie.video_url) {
      setSelectedMovie(movie);
      return;
    }

    setSearching(movie.id);
    try {
      const { data, error } = await supabase.functions.invoke("movie-youtube-search", {
        body: { movieId: movie.id, title: movie.title, director: movie.director, year: movie.year, mode: "single" },
      });

      if (error || !data?.success) {
        toast.error(`Nie znaleziono "${movie.title}" na YouTube`);
        return;
      }

      const updatedMovie = { ...movie, video_url: data.videoUrl, poster_url: data.posterUrl };
      setMovies(prev => prev.map(m => m.id === movie.id ? updatedMovie : m));
      setSelectedMovie(updatedMovie);
      toast.success(`Znaleziono: ${data.youtubeTitle}`);
    } catch (err) {
      toast.error("Błąd wyszukiwania");
    } finally {
      setSearching(null);
    }
  }, []);

  const runBatchSearch = useCallback(async () => {
    if (batchSearching) return;
    setBatchSearching(true);
    let totalUpdated = 0;

    try {
      for (let i = 0; i < 5; i++) {
        const { data, error } = await supabase.functions.invoke("movie-youtube-search", {
          body: { mode: "batch" },
        });

        if (error) break;
        totalUpdated += data?.updated || 0;
        
        if (data?.message === "All movies already have URLs" || data?.updated === 0) break;
        toast.info(`Batch ${i + 1}: znaleziono ${data?.updated}/${data?.total} filmów`);
        await new Promise(r => setTimeout(r, 1000));
      }

      toast.success(`Zaktualizowano ${totalUpdated} filmów!`);
      loadMovies();
    } catch (err) {
      toast.error("Błąd batch search");
    } finally {
      setBatchSearching(false);
    }
  }, [batchSearching, loadMovies]);

  const runBulkPopulate = useCallback(async () => {
    if (populating) return;
    setPopulating(true);
    setPopulateProgress(0);
    setPopulateMsg("Rozpoczynam wypełnianie filmów...");

    try {
      for (let batch = 0; batch < 40; batch++) {
        setPopulateMsg(`Batch ${batch + 1}/40 — dodaję filmy...`);

        const { data, error } = await supabase.functions.invoke("bulk-populate-movies", {
          body: { batch, batchSize: 500 },
        });

        if (error) continue;

        const progress = data?.progress || Math.round(((batch + 1) / 40) * 100);
        setPopulateProgress(Math.min(progress, 100));
        setPopulateMsg(`Batch ${batch + 1}/40 — dodano ${data?.added || 0} (${data?.totalMovies || "?"} łącznie)`);

        if ((data?.totalMovies || 0) >= 20000) {
          setPopulateMsg(`Cel osiągnięty! ${data.totalMovies} filmów.`);
          break;
        }

        await new Promise(r => setTimeout(r, 500));
      }

      setPopulateProgress(100);
      setPopulateMsg("Gotowe!");
      toast.success("Biblioteka filmów wypełniona!");
      loadMovies();
    } catch (err: any) {
      toast.error("Błąd: " + (err.message || "Unknown"));
    } finally {
      setTimeout(() => setPopulating(false), 3000);
    }
  }, [populating, loadMovies]);

  const getVideoId = (url: string) => {
    const match = url.match(/(?:v=|\/)([\w-]{11})/);
    return match?.[1] || null;
  };

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    if (activeTab === "clips") loadTracks();
    else loadMovies();
  }, [user, navigate, loadMovies, loadTracks, activeTab]);

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Film className="h-8 w-8 text-primary" />
            <div>
              <h1 className="font-display text-3xl font-bold">{t("movies.title")}</h1>
              <p className="text-sm text-muted-foreground">{totalCount} {t("movies.moviesInDb")}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {activeTab === "clips" ? (
              <Button
                onClick={runClipBatch}
                variant="outline"
                className="gap-2"
                disabled={clipBatch}
              >
                {clipBatch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {clipBatch ? "Szukam teledysków…" : "Znajdź teledyski AI"}
              </Button>
            ) : (
              <>
                <Button
                  onClick={runBatchSearch}
                  variant="outline"
                  className="gap-2"
                  disabled={batchSearching}
                >
                  {batchSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {batchSearching ? t("movies.searching") : t("movies.searchYoutube")}
                </Button>
                <Button
                  onClick={runBulkPopulate}
                  variant="outline"
                  className="gap-2"
                  disabled={populating}
                >
                  {populating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                  {populating ? t("movies.populating") : t("movies.populate20k")}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Progress */}
        {populating && (
          <div className="mb-6 p-4 rounded-xl border border-border bg-card space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{populateMsg}</span>
              <span className="text-muted-foreground">{populateProgress}%</span>
            </div>
            <Progress value={populateProgress} className="h-2" />
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList>
            <TabsTrigger value="all" className="gap-2">
              <Film className="h-4 w-4" /> {t("movies.all")}
            </TabsTrigger>
            <TabsTrigger value="polish" className="gap-2">
              <Flag className="h-4 w-4" /> {t("movies.polish")}
            </TabsTrigger>
            <TabsTrigger value="foreign" className="gap-2">
              <Globe className="h-4 w-4" /> {t("movies.foreign")}
            </TabsTrigger>
            <TabsTrigger value="clips" className="gap-2">
              <Music className="h-4 w-4" /> Teledyski AI
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Music Clips Grid */}
        {activeTab === "clips" ? (
          tracks.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {tracks.map((clip) => (
                <motion.div
                  key={clip.id}
                  whileHover={{ scale: 1.03, y: -4 }}
                  onClick={() => playClip(clip)}
                  className="group rounded-xl overflow-hidden border border-border bg-card hover:border-primary/50 transition-colors cursor-pointer relative"
                >
                  <div className="aspect-video bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center relative overflow-hidden">
                    {clip.cover_url ? (
                      <img src={clip.cover_url} alt={clip.title} className="w-full h-full object-cover" />
                    ) : (
                      <Music className="h-10 w-10 text-muted-foreground/40" />
                    )}
                    <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      {searching === clip.id ? (
                        <Loader2 className="h-10 w-10 text-primary animate-spin" />
                      ) : (
                        <Play className="h-10 w-10 text-primary fill-primary" />
                      )}
                    </div>
                    {clip.video_url ? (
                      <span className="absolute bottom-2 right-2 bg-accent text-accent-foreground text-[10px] font-bold px-2 py-0.5 rounded">▶ YT</span>
                    ) : (
                      <span className="absolute bottom-2 right-2 bg-primary/80 text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> AI
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="font-semibold text-sm truncate">{clip.title}</h3>
                    <p className="text-xs text-muted-foreground truncate">{clip.artist}</p>
                    {clip.genre && (
                      <span className="text-[10px] bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded mt-1 inline-block">
                        {clip.genre}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Brak utworów. Wgraj coś, żeby zobaczyć teledyski AI.</p>
            </div>
          )
        ) : movies.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {movies.map((movie) => (
              <motion.div
                key={movie.id}
                whileHover={{ scale: 1.03, y: -4 }}
                onClick={() => searchAndPlay(movie)}
                className="group rounded-xl overflow-hidden border border-border bg-card hover:border-primary/50 transition-colors cursor-pointer relative"
              >
                <div className="aspect-[2/3] bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center relative overflow-hidden">
                  {movie.poster_url ? (
                    <img src={movie.poster_url} alt={movie.title} className="w-full h-full object-cover" />
                  ) : (
                    <Film className="h-12 w-12 text-muted-foreground/30" />
                  )}
                  
                  {/* Play overlay */}
                  <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    {searching === movie.id ? (
                      <Loader2 className="h-10 w-10 text-primary animate-spin" />
                    ) : (
                      <Play className="h-10 w-10 text-primary fill-primary" />
                    )}
                  </div>

                  {movie.rating && (
                    <span className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-lg">
                      ⭐ {movie.rating}
                    </span>
                  )}
                  {movie.category === "polish" && (
                    <span className="absolute top-2 left-2 bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5 rounded">
                      PL
                    </span>
                  )}
                  {movie.video_url && (
                    <span className="absolute bottom-2 right-2 bg-accent text-accent-foreground text-[10px] font-bold px-2 py-0.5 rounded">
                      ▶ YT
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-sm truncate">{movie.title}</h3>
                  <p className="text-xs text-muted-foreground truncate">{movie.director}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {movie.year && <span className="text-xs text-muted-foreground">{movie.year}</span>}
                    {movie.genre && (
                      <span className="text-[10px] bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">
                        {movie.genre}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Film className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{ t("movies.empty") }</p>
          </div>
        )}
      </div>

      {/* YouTube Player Modal */}
      <AnimatePresence>
        {selectedMovie && selectedMovie.video_url && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/90 flex items-center justify-center p-4"
            onClick={() => setSelectedMovie(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-5xl bg-card rounded-2xl overflow-hidden border border-border shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div>
                  <h2 className="font-display text-xl font-bold">{selectedMovie.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedMovie.director} • {selectedMovie.year} • {selectedMovie.genre}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedMovie(null)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Player */}
              <div className="aspect-video w-full bg-black">
                <iframe
                  key={selectedMovie.id}
                  src={`https://www.youtube.com/embed/${getVideoId(selectedMovie.video_url!)}?autoplay=1&rel=0&modestbranding=1`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  title={selectedMovie.title}
                />
              </div>

              {/* Info */}
              {selectedMovie.description && (
                <div className="p-4 border-t border-border">
                  <p className="text-sm text-muted-foreground">{selectedMovie.description}</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MainLayout>
  );
};

export default Movies;
