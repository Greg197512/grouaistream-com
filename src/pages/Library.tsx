import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Library as LibraryIcon, Plus, Music, Clock, Heart, Upload, Youtube, FileAudio, Loader2, Database } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlaylistCard } from "@/components/cards/PlaylistCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { ImportTrackModal } from "@/components/modals/ImportTrackModal";
import { FileUploadModal } from "@/components/modals/FileUploadModal";

interface Playlist {
  id: string;
  title: string;
  description: string | null;
  is_ai_generated: boolean;
  gradient: string | null;
  created_at: string;
}

const Library = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
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

        if (error) {
          console.error('Batch error:', error);
          continue;
        }

        const progress = data?.progress || Math.round(((batch + 1) / 40) * 100);
        setPopulateProgress(Math.min(progress, 100));
        setPopulateMsg(`Batch ${batch + 1}/40 — ${t("library.batchAdded")} ${data?.added || 0} (${data?.totalLibrary || '?'})`);

        if ((data?.totalLibrary || 0) >= 20000) {
          setPopulateMsg(`${t("library.goalReached")} ${data.totalLibrary}`);
          break;
        }

        // Small delay between batches
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
    if (!spotifyToken.trim()) {
      toast.error(t("library.pasteTokenError"));
      return;
    }
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
      setTimeout(() => {
        setSpotifyImporting(false);
        setSpotifyMsg("");
      }, 3000);
    }
  }, [spotifyToken]);

  const loadLibrary = async () => {
    if (!user) return;
    
    setLoading(true);

    // Load user playlists
    const { data: playlistData } = await supabase
      .from("playlists")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setPlaylists(playlistData || []);

    // Count liked songs
    const { count: likedCountData } = await supabase
      .from("liked_songs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    setLikedCount(likedCountData || 0);

    // Count listening history
    const { count: historyCountData } = await supabase
      .from("listening_history")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    setHistoryCount(historyCountData || 0);

    setLoading(false);
  };

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

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
            <Button
              onClick={runBulkPopulate}
              variant="outline"
              className="gap-2"
              disabled={populating}
            >
              {populating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              {populating ? t("library.populating") : t("library.populate20k")}
            </Button>
            <Button
              onClick={() => setShowSpotifyInput(!showSpotifyInput)}
              variant="outline"
              className="gap-2 border-green-500/50 text-green-400 hover:bg-green-500/10"
              disabled={spotifyImporting}
            >
              {spotifyImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Music className="h-4 w-4" />}
              {t("library.spotifyImport")}
            </Button>
            <Button
              onClick={() => setShowUploadModal(true)}
              variant="outline"
              className="gap-2"
            >
              <FileAudio className="h-4 w-4" />
              {t("library.uploadFile")}
            </Button>
            <Button
              onClick={() => setShowImportModal(true)}
              variant="outline"
              className="gap-2"
            >
              <Youtube className="h-4 w-4" />
              {t("library.importYoutube")}
            </Button>
            <Button
              onClick={() => navigate("/create-playlist")}
              className="groove-gradient-bg text-primary-foreground hover:opacity-90 gap-2"
            >
              <Plus className="h-4 w-4" />
              {t("library.createPlaylist")}
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
            <p className="text-sm text-muted-foreground">
              {t("library.spotifyImportDesc")}
            </p>
            <div className="flex gap-2">
              <Input
                placeholder={t("library.pasteToken")}
                value={spotifyToken}
                onChange={e => setSpotifyToken(e.target.value)}
                className="flex-1 bg-background/50"
              />
              <Button
                onClick={runSpotifyImport}
                disabled={spotifyImporting || !spotifyToken.trim()}
                className="bg-green-600 hover:bg-green-700 text-white gap-2"
              >
                {spotifyImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {spotifyImporting ? t("library.importing") : t("library.import")}
              </Button>
            </div>
            {spotifyMsg && (
              <p className="text-sm text-green-400">{spotifyMsg}</p>
            )}
          </div>
        )}


        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/liked")}
            className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 hover:border-primary/50 transition-colors"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
              <Heart className="h-6 w-6 text-primary-foreground fill-primary-foreground" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold">{t("library.likedSongs")}</h3>
              <p className="text-sm text-muted-foreground">{likedCount} {t("library.songs")}</p>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 hover:border-blue-500/50 transition-colors"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
              <Clock className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold">{t("library.recentlyPlayed")}</h3>
              <p className="text-sm text-muted-foreground">{historyCount} {t("library.plays")}</p>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/radio")}
            className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 hover:border-primary/50 transition-colors"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-lg groove-gradient-bg">
              <Music className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold">GrouaRadio</h3>
              <p className="text-sm text-muted-foreground">{t("library.liveStreaming")}</p>
            </div>
          </motion.button>
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

      {/* Import Modal */}
      <ImportTrackModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={loadLibrary}
      />

      {/* File Upload Modal */}
      <FileUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={loadLibrary}
      />
    </MainLayout>
  );
};

export default Library;
