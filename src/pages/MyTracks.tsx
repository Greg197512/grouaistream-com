import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Music, Search, Upload, Loader2, Trash2, Share2, Pencil, Sparkles, Calendar } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { HQCover } from "@/components/ui/HQCover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { finalizeTrackDeletion } from "@/lib/trackDeletion";
import { TrackOptionsMenu, LikeButton } from "@/components/menus/TrackOptionsMenu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const MyTracks = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
  const [tracks, setTracks] = useState<(Track & { created_at: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadMyTracks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("tracks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading my tracks:", error);
      toast.error(t("myTracks.loadError"));
    } else {
      setTracks((data || []) as any);
    }
    setLoading(false);
  }, [user, t]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth"); return; }
    loadMyTracks();

    const handler = () => loadMyTracks();
    window.addEventListener("track-list-changed", handler);
    return () => window.removeEventListener("track-list-changed", handler);
  }, [user, authLoading, navigate, loadMyTracks]);

  const handleDelete = async (trackId: string) => {
    setDeletingId(trackId);
    const target = tracks.find(t => t.id === trackId);
    const { error } = await supabase.from("tracks").delete().eq("id", trackId);
    if (error) {
      toast.error(t("myTracks.deleteError"));
    } else {
      toast.success(t("myTracks.deleted"));
      setTracks(prev => prev.filter(t => t.id !== trackId));
      // Storage + rozgłoszenie do całej apki (player + listy + inni użytkownicy przez Realtime).
      await finalizeTrackDeletion({
        id: trackId,
        audio_url: target?.audio_url,
        video_url: (target as { video_url?: string | null } | undefined)?.video_url,
        cover_url: target?.cover_url,
      });
    }
    setDeletingId(null);
  };

  const handleShare = (track: Track) => {
    const url = `${window.location.origin}/?track=${track.id}`;
    navigator.clipboard.writeText(url);
    toast.success(t("myTracks.linkCopied"));
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pl-PL", {
      day: "numeric", month: "short", year: "numeric"
    });
  };

  const filteredTracks = tracks.filter(track =>
    track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    track.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading || loading) {
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
            <Music className="h-8 w-8 text-primary" />
            <h1 className="font-display text-3xl font-bold">{t("myTracks.title")}</h1>
            <Badge variant="secondary" className="text-xs">
              {tracks.length} {t("myTracks.tracksCount")}
            </Badge>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => navigate("/upload")} className="groove-gradient-bg text-primary-foreground hover:opacity-90 gap-2">
              <Upload className="h-4 w-4" /> {t("myTracks.uploadTrack")}
            </Button>
          </div>
        </div>

        {/* Search */}
        {tracks.length > 0 && (
          <div className="relative max-w-md mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("myTracks.searchPlaceholder")}
              className="pl-10 bg-secondary border-0 focus-visible:ring-1 focus-visible:ring-primary rounded-full h-10"
            />
          </div>
        )}

        {/* Empty State */}
        {tracks.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-secondary mb-6">
              <Music className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">{t("myTracks.emptyTitle")}</h2>
            <p className="text-muted-foreground mb-6 max-w-sm">{t("myTracks.emptyDesc")}</p>
            <Button onClick={() => navigate("/upload")} className="groove-gradient-bg text-primary-foreground hover:opacity-90 gap-2">
              <Upload className="h-4 w-4" /> {t("myTracks.uploadFirst")}
            </Button>
          </motion.div>
        )}

        {/* Track List */}
        {filteredTracks.length > 0 && (
          <div className="space-y-2">
            {filteredTracks.map((track, index) => {
              const isCurrentTrack = currentTrack?.id === track.id;
              return (
                <motion.div
                  key={track.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={cn(
                    "group flex items-center gap-4 p-3 rounded-xl border border-transparent hover:bg-secondary/50 hover:border-border transition-all cursor-pointer",
                    isCurrentTrack && "bg-secondary border-primary/30"
                  )}
                  onClick={() => playTrack(track)}
                >
                  {/* Cover */}
                  <div className="h-14 w-14 rounded-lg overflow-hidden flex-shrink-0 relative">
                    <HQCover src={track.cover_url} alt={track.title} genre={track.genre} artist={track.artist} className="h-full w-full" />
                    {isCurrentTrack && isPlaying && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="flex gap-0.5">
                          {[0, 1, 2].map(i => (
                            <motion.div
                              key={i}
                              className="w-1 bg-primary rounded-full"
                              animate={{ height: [8, 16, 8] }}
                              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn("font-medium text-sm truncate", isCurrentTrack && "text-primary")}>
                        {track.title}
                      </p>
                      {track.genre && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 hidden sm:inline-flex">
                          {track.genre}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{track.artist}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(track.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Duration */}
                  <span className="text-sm text-muted-foreground hidden sm:block">
                    {formatDuration(track.duration)}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <LikeButton trackId={track.id} />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleShare(track)}>
                      <Share2 className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("myTracks.deleteConfirmTitle")}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("myTracks.deleteConfirmDesc")} "{track.title}"?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("myTracks.cancel")}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(track.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {deletingId === track.id ? <Loader2 className="h-4 w-4 animate-spin" /> : t("myTracks.delete")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <TrackOptionsMenu
                      trackId={track.id}
                      trackTitle={track.title}
                      trackArtist={track.artist}
                      trackUrl={track.audio_url}
                      size="sm"
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* No results from search */}
        {tracks.length > 0 && filteredTracks.length === 0 && searchQuery && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t("myTracks.noResults")}</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default MyTracks;
