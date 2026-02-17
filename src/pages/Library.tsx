import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Library as LibraryIcon, Plus, Music, Clock, Heart, Upload, Youtube, FileAudio, Loader2, Database } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { PlaylistCard } from "@/components/cards/PlaylistCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
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
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [likedCount, setLikedCount] = useState(0);
  const [historyCount, setHistoryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [populating, setPopulating] = useState(false);
  const [populateProgress, setPopulateProgress] = useState(0);
  const [populateMsg, setPopulateMsg] = useState("");

  const runBulkPopulate = useCallback(async () => {
    if (populating) return;
    setPopulating(true);
    setPopulateProgress(0);
    setPopulateMsg("Rozpoczynam wypełnianie biblioteki...");

    try {
      for (let batch = 0; batch < 40; batch++) {
        setPopulateMsg(`Batch ${batch + 1}/40 — pobieram utwory...`);
        
        const { data, error } = await supabase.functions.invoke('bulk-populate', {
          body: { batch, batchSize: 500, source: 'all' },
        });

        if (error) {
          console.error('Batch error:', error);
          continue;
        }

        const progress = data?.progress || Math.round(((batch + 1) / 40) * 100);
        setPopulateProgress(Math.min(progress, 100));
        setPopulateMsg(`Batch ${batch + 1}/40 — dodano ${data?.added || 0} utworów (${data?.totalLibrary || '?'} łącznie)`);

        if ((data?.totalLibrary || 0) >= 20000) {
          setPopulateMsg(`Cel osiągnięty! ${data.totalLibrary} utworów w bibliotece.`);
          break;
        }

        // Small delay between batches
        await new Promise(r => setTimeout(r, 500));
      }

      setPopulateProgress(100);
      setPopulateMsg("Gotowe! Biblioteka wypełniona.");
      toast.success("Biblioteka wypełniona!");
      loadLibrary();
    } catch (err: any) {
      console.error('Populate error:', err);
      toast.error("Błąd podczas wypełniania: " + (err.message || "Unknown"));
    } finally {
      setTimeout(() => setPopulating(false), 3000);
    }
  }, [populating]);

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
            <h1 className="font-display text-3xl font-bold">Your Library</h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={runBulkPopulate}
              variant="outline"
              className="gap-2"
              disabled={populating}
            >
              {populating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              {populating ? "Wypełniam..." : "Wypełnij 20k"}
            </Button>
            <Button
              onClick={() => setShowUploadModal(true)}
              variant="outline"
              className="gap-2"
            >
              <FileAudio className="h-4 w-4" />
              Upload File
            </Button>
            <Button
              onClick={() => setShowImportModal(true)}
              variant="outline"
              className="gap-2"
            >
              <Youtube className="h-4 w-4" />
              Import YouTube
            </Button>
            <Button
              onClick={() => navigate("/create-playlist")}
              className="groove-gradient-bg text-primary-foreground hover:opacity-90 gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Playlist
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

        {/* Quick Access Cards */}
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
              <h3 className="font-semibold">Liked Songs</h3>
              <p className="text-sm text-muted-foreground">{likedCount} songs</p>
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
              <h3 className="font-semibold">Recently Played</h3>
              <p className="text-sm text-muted-foreground">{historyCount} plays</p>
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
              <p className="text-sm text-muted-foreground">Live streaming</p>
            </div>
          </motion.button>
        </div>

        {/* Playlists */}
        <h2 className="font-display text-xl font-bold mb-4">Your Playlists</h2>
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
            <p>No playlists yet. Create your first playlist!</p>
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
