import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Library as LibraryIcon, Plus, Music, Clock, Heart, Upload, Youtube, 
  FileAudio, Loader2, Database, FolderOpen, X, MoreVertical, Trash2,
  Play, ChevronRight, Sparkles, Wand2
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PlaylistCard } from "@/components/cards/PlaylistCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { ImportTrackModal } from "@/components/modals/ImportTrackModal";
import { FileUploadModal } from "@/components/modals/FileUploadModal";
import { cn } from "@/lib/utils";
import { SunoGenerateModal } from "@/components/modals/SunoGenerateModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Genre cover images
import genreRock from "@/assets/genres/rock.jpg";
import genrePop from "@/assets/genres/pop.jpg";
import genreHiphop from "@/assets/genres/hiphop.jpg";
import genreRap from "@/assets/genres/rap.jpg";
import genreMetal from "@/assets/genres/metal.jpg";
import genrePunk from "@/assets/genres/punk.jpg";
import genreElectronic from "@/assets/genres/electronic.jpg";
import genreJazz from "@/assets/genres/jazz.jpg";
import genreClassical from "@/assets/genres/classical.jpg";
import genreRnb from "@/assets/genres/rnb.jpg";
import genreIndie from "@/assets/genres/indie.jpg";
import genreAlternative from "@/assets/genres/alternative.jpg";
import genreReggae from "@/assets/genres/reggae.jpg";
import genreBlues from "@/assets/genres/blues.jpg";
import genreCountry from "@/assets/genres/country.jpg";

interface Playlist {
  id: string;
  title: string;
  description: string | null;
  is_ai_generated: boolean;
  gradient: string | null;
  created_at: string;
}

const GENRE_CATALOGS = [
  { genre: "Rock", emoji: "🎸", gradient: "from-red-500/20 to-orange-500/20", border: "border-red-500/30", image: genreRock },
  { genre: "Pop", emoji: "🎤", gradient: "from-pink-500/20 to-rose-500/20", border: "border-pink-500/30", image: genrePop },
  { genre: "Hip-Hop", emoji: "🎧", gradient: "from-purple-500/20 to-violet-500/20", border: "border-purple-500/30", image: genreHiphop },
  { genre: "Rap", emoji: "🎙️", gradient: "from-violet-500/20 to-indigo-500/20", border: "border-violet-500/30", image: genreRap },
  { genre: "Metal", emoji: "🤘", gradient: "from-zinc-500/20 to-gray-500/20", border: "border-zinc-500/30", image: genreMetal },
  { genre: "Punk", emoji: "⚡", gradient: "from-orange-500/20 to-yellow-500/20", border: "border-orange-500/30", image: genrePunk },
  { genre: "Electronic", emoji: "🎹", gradient: "from-cyan-500/20 to-blue-500/20", border: "border-cyan-500/30", image: genreElectronic },
  { genre: "Jazz", emoji: "🎷", gradient: "from-yellow-500/20 to-amber-500/20", border: "border-yellow-500/30", image: genreJazz },
  { genre: "Classical", emoji: "🎻", gradient: "from-emerald-500/20 to-green-500/20", border: "border-emerald-500/30", image: genreClassical },
  { genre: "R&B", emoji: "💜", gradient: "from-rose-500/20 to-pink-500/20", border: "border-rose-500/30", image: genreRnb },
  { genre: "Indie", emoji: "🌿", gradient: "from-teal-500/20 to-emerald-500/20", border: "border-teal-500/30", image: genreIndie },
  { genre: "Alternative", emoji: "🔮", gradient: "from-sky-500/20 to-indigo-500/20", border: "border-sky-500/30", image: genreAlternative },
  { genre: "Reggae", emoji: "🌴", gradient: "from-green-500/20 to-yellow-500/20", border: "border-green-500/30", image: genreReggae },
  { genre: "Blues", emoji: "🎺", gradient: "from-blue-500/20 to-indigo-500/20", border: "border-blue-500/30", image: genreBlues },
  { genre: "Country", emoji: "🤠", gradient: "from-amber-500/20 to-orange-500/20", border: "border-amber-500/30", image: genreCountry },
];

const Library = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { playTrack, playPlaylist, currentTrack, isPlaying, togglePlay } = usePlayer();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [likedCount, setLikedCount] = useState(0);
  const [historyCount, setHistoryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [spotifyToken, setSpotifyToken] = useState("");
  const [spotifyImporting, setSpotifyImporting] = useState(false);
  const [spotifyMsg, setSpotifyMsg] = useState("");
  const [showSpotifyInput, setShowSpotifyInput] = useState(false);
  const [populating, setPopulating] = useState(false);
  const [populateProgress, setPopulateProgress] = useState(0);
  const [populateMsg, setPopulateMsg] = useState("");
  
  // Genre catalogs
  const [genreCounts, setGenreCounts] = useState<Record<string, number>>({});
  const [openGenre, setOpenGenre] = useState<string | null>(null);
  const [genreTracks, setGenreTracks] = useState<Track[]>([]);
  const [genreLoading, setGenreLoading] = useState(false);

  const runBulkPopulate = useCallback(async () => {
    if (populating) return;
    setPopulating(true);
    setPopulateProgress(0);
    setPopulateMsg(t("library.startingPopulate"));

    try {
      for (let batch = 0; batch < 40; batch++) {
        setPopulateMsg(`Batch ${batch + 1}/40 — ${t("library.batchFetching")}`);
        
        const { data, error } = await supabase.functions.invoke('bulk-populate', {
          body: { batch, batchSize: 500, source: 'all' },
        });

        if (error) { console.error('Batch error:', error); continue; }

        const progress = data?.progress || Math.round(((batch + 1) / 40) * 100);
        setPopulateProgress(Math.min(progress, 100));
        setPopulateMsg(`Batch ${batch + 1}/40 — ${t("library.batchAdded")} ${data?.added || 0} (${data?.totalLibrary || '?'})`);

        if ((data?.totalLibrary || 0) >= 20000) {
          setPopulateMsg(`${t("library.goalReached")} ${data.totalLibrary}`);
          break;
        }
        await new Promise(r => setTimeout(r, 500));
      }

      setPopulateProgress(100);
      setPopulateMsg(t("library.donePopulated"));
      toast.success(t("library.populatedSuccess"));
      loadLibrary();
    } catch (err: any) {
      console.error('Populate error:', err);
      toast.error(t("library.populateError") + ": " + (err.message || "Unknown"));
    } finally {
      setTimeout(() => setPopulating(false), 3000);
    }
  }, [populating]);

  const runSpotifyImport = useCallback(async () => {
    if (!spotifyToken.trim()) { toast.error(t("library.pasteTokenError")); return; }
    setSpotifyImporting(true);
    setSpotifyMsg(t("library.fetchingSpotify"));
    try {
      const { data, error } = await supabase.functions.invoke('spotify-import', {
        body: { spotifyToken: spotifyToken.trim() },
      });
      if (error) throw error;
      setSpotifyMsg(`${t("library.spotifyDone")} ${data.fetched}, ${t("library.batchAdded")} ${data.inserted}`);
      toast.success(`${data.inserted} ${t("library.spotifyAddedSuccess")}`);
      loadLibrary();
    } catch (err: any) {
      console.error('Spotify import error:', err);
      toast.error(t("library.spotifyImportError") + ": " + (err.message || "Unknown"));
      setSpotifyMsg(t("library.spotifyImportErrorMsg"));
    } finally {
      setTimeout(() => { setSpotifyImporting(false); setSpotifyMsg(""); }, 3000);
    }
  }, [spotifyToken]);

  const loadGenreCounts = async () => {
    // Fetch counts for each genre from liked_songs joined with tracks
    if (!user) return;
    
    const { data: likedTracks } = await supabase
      .from("liked_songs")
      .select("track_id, tracks(genre)")
      .eq("user_id", user.id);

    const counts: Record<string, number> = {};
    (likedTracks || []).forEach((lt: any) => {
      const genre = lt.tracks?.genre;
      if (genre) {
        counts[genre] = (counts[genre] || 0) + 1;
      }
    });
    setGenreCounts(counts);
  };

  const openGenreCatalog = async (genre: string) => {
    if (openGenre === genre) { setOpenGenre(null); return; }
    setOpenGenre(genre);
    setGenreLoading(true);
    
    if (!user) return;
    
    const { data: likedTracks } = await supabase
      .from("liked_songs")
      .select("track_id, tracks(*)")
      .eq("user_id", user.id);

    const filtered = (likedTracks || [])
      .filter((lt: any) => lt.tracks?.genre === genre)
      .map((lt: any) => lt.tracks as Track);
    
    setGenreTracks(filtered);
    setGenreLoading(false);
  };

  const deleteGenreCatalog = async (genre: string) => {
    if (!user) return;
    
    // Remove all liked songs of this genre
    const { data: likedTracks } = await supabase
      .from("liked_songs")
      .select("id, tracks(genre)")
      .eq("user_id", user.id);

    const idsToDelete = (likedTracks || [])
      .filter((lt: any) => lt.tracks?.genre === genre)
      .map((lt: any) => lt.id);

    if (idsToDelete.length > 0) {
      await supabase.from("liked_songs").delete().in("id", idsToDelete);
      toast.success(`${t("library.catalogDeleted")} ${genre} (${idsToDelete.length} ${t("library.tracks")})`);
      loadLibrary();
    } else {
      toast.info(`${t("library.catalogEmpty")} — ${genre}`);
    }
  };

  const loadLibrary = async () => {
    if (!user) return;
    setLoading(true);

    const { data: playlistData } = await supabase
      .from("playlists")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setPlaylists(playlistData || []);

    const { count: likedCountData } = await supabase
      .from("liked_songs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);
    setLikedCount(likedCountData || 0);

    const { count: historyCountData } = await supabase
      .from("listening_history")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);
    setHistoryCount(historyCountData || 0);

    await loadGenreCounts();
    setLoading(false);
  };

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    loadLibrary();
  }, [user, navigate]);

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </MainLayout>
    );
  }

  const activeGenres = GENRE_CATALOGS.filter(g => (genreCounts[g.genre] || 0) > 0);
  const emptyGenres = GENRE_CATALOGS.filter(g => !genreCounts[g.genre]);

  return (
    <MainLayout>
      <div className="px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <LibraryIcon className="h-8 w-8 text-primary" />
            <h1 className="font-display text-3xl font-bold">{t("library.title")}</h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={runBulkPopulate} variant="outline" className="gap-2" disabled={populating}>
              {populating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              {populating ? t("library.populating") : t("library.populate20k")}
            </Button>
            <Button onClick={() => setShowSpotifyInput(!showSpotifyInput)} variant="outline" className="gap-2 border-green-500/50 text-green-400 hover:bg-green-500/10" disabled={spotifyImporting}>
              {spotifyImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Music className="h-4 w-4" />}
              {t("library.spotifyImport")}
            </Button>
            <Button onClick={() => setShowUploadModal(true)} variant="outline" className="gap-2">
              <FileAudio className="h-4 w-4" /> {t("library.uploadFile")}
            </Button>
            <Button onClick={() => setShowImportModal(true)} variant="outline" className="gap-2">
              <Youtube className="h-4 w-4" /> {t("library.importYoutube")}
            </Button>
            <Button onClick={() => navigate("/create-playlist")} className="groove-gradient-bg text-primary-foreground hover:opacity-90 gap-2">
              <Plus className="h-4 w-4" /> {t("library.createPlaylist")}
            </Button>
          </div>
        </div>

        {/* Populate progress */}
        {populating && (
          <div className="mb-6 p-4 rounded-xl border border-border bg-card space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{populateMsg}</span>
              <span className="text-muted-foreground">{populateProgress}%</span>
            </div>
            <Progress value={populateProgress} className="h-2" />
          </div>
        )}

        {/* Spotify Import Section */}
        {showSpotifyInput && (
          <div className="mb-6 p-4 rounded-xl border border-green-500/30 bg-green-500/5 space-y-3">
            <h3 className="font-semibold text-green-400 flex items-center gap-2">
              <Music className="h-4 w-4" /> {t("library.spotifyImportTitle")}
            </h3>
            <p className="text-sm text-muted-foreground">{t("library.spotifyImportDesc")}</p>
            <div className="flex gap-2">
              <Input placeholder={t("library.pasteToken")} value={spotifyToken} onChange={e => setSpotifyToken(e.target.value)} className="flex-1 bg-background/50" />
              <Button onClick={runSpotifyImport} disabled={spotifyImporting || !spotifyToken.trim()} className="bg-green-600 hover:bg-green-700 text-white gap-2">
                {spotifyImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {spotifyImporting ? t("library.importing") : t("library.import")}
              </Button>
            </div>
            {spotifyMsg && <p className="text-sm text-green-400">{spotifyMsg}</p>}
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => navigate("/liked")}
            className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 hover:border-primary/50 transition-colors">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
              <Heart className="h-6 w-6 text-primary-foreground fill-primary-foreground" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold">{t("library.likedSongs")}</h3>
              <p className="text-sm text-muted-foreground">{likedCount} {t("library.songs")}</p>
            </div>
          </motion.button>

          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 hover:border-blue-500/50 transition-colors">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
              <Clock className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold">{t("library.recentlyPlayed")}</h3>
              <p className="text-sm text-muted-foreground">{historyCount} {t("library.plays")}</p>
            </div>
          </motion.button>

          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => navigate("/radio-live")}
            className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 hover:border-primary/50 transition-colors">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg groove-gradient-bg">
              <Music className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold">GrouaRadio</h3>
              <p className="text-sm text-muted-foreground">{t("library.liveStreaming")}</p>
            </div>
          </motion.button>
        </div>

        {/* Genre Catalogs */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-bold">{t("library.genreCatalogs")}</h2>
            <Badge variant="secondary" className="text-xs">
              <Sparkles className="h-3 w-3 mr-1" /> {t("library.aiSortsAuto")}
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {GENRE_CATALOGS.map((cat) => {
              const count = genreCounts[cat.genre] || 0;
              const isOpen = openGenre === cat.genre;
              
              return (
                <div key={cat.genre} className="relative group">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => openGenreCatalog(cat.genre)}
                    className={cn(
                      "w-full rounded-xl border transition-all text-left overflow-hidden",
                      cat.border,
                      isOpen && "ring-2 ring-primary/50",
                      count === 0 && "opacity-40"
                    )}
                  >
                    <div className="relative h-24 w-full">
                      <img src={cat.image} alt={cat.genre} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                      <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
                        <div>
                          <p className="font-bold text-sm text-white drop-shadow-lg">{cat.genre}</p>
                          <p className="text-xs text-white/70">{count} {t("library.tracks")}</p>
                        </div>
                        <ChevronRight className={cn("h-4 w-4 text-white/70 transition-transform", isOpen && "rotate-90")} />
                      </div>
                    </div>
                  </motion.button>
                  
                  {/* Actions on hover */}
                  {count > 0 && (
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1 rounded-md hover:bg-secondary/80 bg-background/80 backdrop-blur-sm">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => {
                            openGenreCatalog(cat.genre).then(() => {
                              if (genreTracks.length) playPlaylist(genreTracks);
                            });
                          }}>
                            <Play className="h-4 w-4 mr-2" /> {t("library.playAll")}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => deleteGenreCatalog(cat.genre)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> {t("library.deleteCatalog")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Expanded genre tracks */}
          <AnimatePresence>
            {openGenre && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 overflow-hidden"
              >
                <div className="p-4 rounded-xl border border-border bg-card">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-primary" />
                      {openGenre} — {genreTracks.length} {t("library.tracks")}
                    </h3>
                    <div className="flex gap-2">
                      {genreTracks.length > 0 && (
                        <Button size="sm" variant="outline" onClick={() => playPlaylist(genreTracks)} className="gap-1">
                          <Play className="h-3.5 w-3.5" /> {t("library.play")}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setOpenGenre(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  
                  {genreLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : genreTracks.length === 0 ? (
                    <p className="text-center py-6 text-muted-foreground text-sm">{t("library.noTracksInCatalog")}</p>
                  ) : (
                    <div className="space-y-1 max-h-80 overflow-y-auto">
                      {genreTracks.map((track) => {
                        const isCurrent = currentTrack?.id === track.id;
                        return (
                          <div
                            key={track.id}
                            onClick={() => isCurrent ? togglePlay() : playTrack(track)}
                            className={cn(
                              "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                              isCurrent ? "bg-primary/10" : "hover:bg-secondary/60"
                            )}
                          >
                            <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-primary/10 flex items-center justify-center">
                              {track.cover_url ? (
                                <img src={track.cover_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Music className="h-4 w-4 text-primary" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-sm font-medium truncate", isCurrent && "text-primary")}>{track.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                            </div>
                            {isCurrent && isPlaying && (
                              <div className="flex gap-0.5">
                                {[1,2,3].map(i => (
                                  <motion.div key={i} className="w-0.5 bg-primary rounded-full"
                                    animate={{ height: [4, 12, 4] }}
                                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Playlists */}
        <h2 className="font-display text-xl font-bold mb-4">{t("library.yourPlaylists")}</h2>
        {playlists.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {playlists.map((playlist) => (
              <PlaylistCard
                key={playlist.id}
                id={playlist.id}
                title={playlist.title}
                description={playlist.description || ""}
                isAI={playlist.is_ai_generated}
                gradient={playlist.gradient || undefined}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t("library.noPlaylists")}</p>
          </div>
        )}
      </div>

      <ImportTrackModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} onSuccess={loadLibrary} />
      <FileUploadModal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} onSuccess={loadLibrary} />
    </MainLayout>
  );
};

export default Library;
