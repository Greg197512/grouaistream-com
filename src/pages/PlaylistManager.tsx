import { useState, useEffect, useMemo } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { motion, AnimatePresence } from "framer-motion";
import {
  Music,
  Sparkles,
  Loader2,
  Search,
  Plus,
  Play,
  GripVertical,
  ListMusic,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HQCover } from "@/components/ui/HQCover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { Track, usePlayer } from "@/contexts/PlayerContext";
import { toast } from "sonner";

import cover1 from "@/assets/playlist-cover-1.jpg";
import cover2 from "@/assets/playlist-cover-2.jpg";
import cover3 from "@/assets/playlist-cover-3.jpg";
import cover4 from "@/assets/playlist-cover-4.jpg";
import cover5 from "@/assets/playlist-cover-5.jpg";
import cover6 from "@/assets/playlist-cover-6.jpg";
import cover7 from "@/assets/playlist-cover-7.jpg";
import cover8 from "@/assets/playlist-cover-8.jpg";

const FALLBACK_COVERS = [cover1, cover2, cover3, cover4, cover5, cover6, cover7, cover8];

interface Playlist {
  id: string;
  title: string;
  gradient: string | null;
  cover_url: string | null;
  tracks: Track[];
}

/* ─────── Draggable track item ─────── */
const DraggableTrackItem = ({
  track,
  isCurrent,
  isPlaying,
  onPlay,
}: {
  track: Track;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: () => void;
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `lib-${track.id}`,
    data: { track },
  });

  return (
    <motion.div
      ref={setNodeRef}
      layout
      className={`group flex items-center gap-2 p-2 rounded-xl border transition-all ${
        isDragging
          ? "opacity-30 border-primary"
          : isCurrent
          ? "border-primary/50 bg-primary/5"
          : "border-transparent hover:border-primary/30 hover:bg-primary/5"
      }`}
    >
      <button
        {...listeners}
        {...attributes}
        className="cursor-grab active:cursor-grabbing p-1 opacity-40 group-hover:opacity-100 transition-opacity touch-none"
        aria-label="drag"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <button onClick={onPlay} className="flex-shrink-0 relative h-10 w-10 rounded-lg overflow-hidden">
        {track.cover_url ? (
          <HQCover src={track.cover_url} alt="" className="h-full w-full" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-orange-500 via-pink-500 to-purple-600 flex items-center justify-center">
            <Music className="h-4 w-4 text-white" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {isCurrent && isPlaying ? (
            <div className="flex items-center gap-0.5">
              {[1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  className="w-0.5 bg-primary rounded-full"
                  animate={{ height: [3, 10, 3] }}
                  transition={{ repeat: Infinity, duration: 0.4, delay: i * 0.1 }}
                />
              ))}
            </div>
          ) : (
            <Play className="h-4 w-4 text-white fill-white" />
          )}
        </div>
      </button>

      <div className="flex-1 min-w-0">
        <p className="truncate font-medium text-xs">{track.title}</p>
        <p className="truncate text-[10px] text-muted-foreground">{track.artist}</p>
      </div>
    </motion.div>
  );
};

/* ─────── Playlist drop card ─────── */
const PlaylistDropCard = ({
  playlist,
  fallbackCover,
  onOpen,
  t,
}: {
  playlist: Playlist;
  fallbackCover: string;
  onOpen: () => void;
  t: (key: any) => string;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: `pl-${playlist.id}` });
  const cover = playlist.cover_url || fallbackCover;

  return (
    <motion.div
      ref={setNodeRef}
      layout
      animate={{
        scale: isOver ? 1.03 : 1,
      }}
      className={`relative overflow-hidden rounded-2xl border-2 transition-all ${
        isOver
          ? "border-primary shadow-[0_0_40px_hsl(var(--primary)/0.5)]"
          : "border-border/50 hover:border-primary/40"
      }`}
    >
      {/* Cover background */}
      <div className="absolute inset-0">
        <img src={cover} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/40" />
      </div>

      <div className="relative p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="h-14 w-14 rounded-xl overflow-hidden ring-2 ring-primary/30 shadow-lg flex-shrink-0">
            <img src={cover} alt={playlist.title} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-display font-bold text-base truncate">{playlist.title}</h4>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <ListMusic className="h-3 w-3" />
              {playlist.tracks.length} {t("playlistManager.tracksCount" as any)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs hover:bg-primary/20"
            onClick={onOpen}
          >
            {t("playlistManager.open" as any)}
          </Button>
        </div>

        {/* Drop indicator */}
        <AnimatePresence>
          {isOver && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center justify-center gap-2 py-4 text-primary text-sm font-semibold rounded-xl border-2 border-dashed border-primary bg-primary/10 mb-2"
            >
              <Plus className="h-5 w-5" />
              {t("playlistManager.dropHere" as any)}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tracks preview */}
        {playlist.tracks.length > 0 ? (
          <div className="space-y-1 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
            {playlist.tracks.slice(0, 6).map((track) => (
              <div
                key={track.id}
                className="flex items-center gap-2 p-1.5 rounded-lg text-xs bg-card/40 backdrop-blur-sm"
              >
                {track.cover_url ? (
                  <img src={track.cover_url} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" loading="lazy" />
                ) : (
                  <div className="w-6 h-6 rounded bg-gradient-to-br from-orange-500 to-pink-600 flex items-center justify-center flex-shrink-0">
                    <Music className="h-3 w-3 text-white" />
                  </div>
                )}
                <span className="truncate flex-1 font-medium">{track.title}</span>
                <span className="text-[9px] text-muted-foreground truncate max-w-[60px]">{track.artist}</span>
              </div>
            ))}
            {playlist.tracks.length > 6 && (
              <p className="text-center text-[10px] text-muted-foreground pt-1">
                +{playlist.tracks.length - 6}
              </p>
            )}
          </div>
        ) : (
          !isOver && (
            <div className="text-center py-6 text-muted-foreground border-2 border-dashed border-border/40 rounded-xl">
              <Music className="h-6 w-6 mx-auto mb-1 opacity-50" />
              <p className="text-xs">{t("playlistManager.emptyDrop" as any)}</p>
            </div>
          )
        )}
      </div>
    </motion.div>
  );
};

/* ─────── Main page ─────── */
const PlaylistManager = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { playTrack, currentTrack, isPlaying } = usePlayer();

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [allTracks, setAllTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTrack, setActiveTrack] = useState<Track | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    loadData();
  }, [user, navigate]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    const [playlistsRes, tracksRes] = await Promise.all([
      supabase
        .from("playlists")
        .select("id, title, gradient, cover_url")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("tracks").select("*").order("title").limit(500),
    ]);

    const tracks: Track[] = (tracksRes.data || []).map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      album: t.album,
      duration: t.duration,
      audio_url: t.audio_url,
      video_url: t.video_url,
      cover_url: t.cover_url,
      genre: t.genre,
      mood: t.mood,
    }));

    const playlistsWithTracks: Playlist[] = [];
    for (const pl of playlistsRes.data || []) {
      const { data: playlistTracks } = await supabase
        .from("playlist_tracks")
        .select("track_id, position")
        .eq("playlist_id", pl.id)
        .order("position");

      const trackIds = new Set((playlistTracks || []).map((pt) => pt.track_id));
      const playlistTrackItems = tracks.filter((tr) => trackIds.has(tr.id));

      playlistsWithTracks.push({
        id: pl.id,
        title: pl.title,
        gradient: pl.gradient,
        cover_url: pl.cover_url,
        tracks: playlistTrackItems,
      });
    }

    setPlaylists(playlistsWithTracks);
    setAllTracks(tracks);
    setLoading(false);
  };

  const filteredTracks = useMemo(() => {
    if (!search.trim()) return allTracks.slice(0, 80);
    const q = search.toLowerCase();
    return allTracks
      .filter((tr) => tr.title.toLowerCase().includes(q) || tr.artist.toLowerCase().includes(q))
      .slice(0, 80);
  }, [allTracks, search]);

  const handleDragStart = (e: DragStartEvent) => {
    const track = e.active.data.current?.track as Track | undefined;
    setActiveTrack(track || null);
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveTrack(null);
    const { active, over } = e;
    if (!over) return;

    const track = active.data.current?.track as Track | undefined;
    if (!track) return;

    const overId = String(over.id);
    if (!overId.startsWith("pl-")) return;
    const playlistId = overId.replace(/^pl-/, "");
    const destPlaylist = playlists.find((p) => p.id === playlistId);
    if (!destPlaylist) return;

    if (destPlaylist.tracks.some((t) => t.id === track.id)) {
      toast.error(t("playlistManager.alreadyInPlaylist" as any));
      return;
    }

    try {
      const { error } = await supabase.from("playlist_tracks").insert({
        playlist_id: playlistId,
        track_id: track.id,
        position: destPlaylist.tracks.length,
      });
      if (error) throw error;
      setPlaylists((prev) =>
        prev.map((p) => (p.id === playlistId ? { ...p, tracks: [...p.tracks, track] } : p))
      );
      toast.success(`"${track.title}" ${t("playlistManager.added" as any)} "${destPlaylist.title}"`);
    } catch {
      toast.error(t("playlistManager.addError" as any));
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="relative px-4 md:px-6 py-8 max-w-7xl mx-auto">
        {/* Background atmosphere */}
        <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
          <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-orange-500/10 blur-[120px]" />
          <div className="absolute top-1/2 -left-20 w-96 h-96 rounded-full bg-purple-600/10 blur-[120px]" />
          <div className="absolute bottom-0 right-1/3 w-96 h-96 rounded-full bg-pink-500/8 blur-[120px]" />
        </div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8 flex-wrap gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-orange-500 via-pink-500 to-purple-600 flex items-center justify-center shadow-[0_0_30px_hsl(var(--primary)/0.5)]">
              <Sparkles className="h-7 w-7 text-white" />
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-orange-500 via-pink-500 to-purple-600 blur-xl opacity-50 -z-10" />
            </div>
            <div>
              <h1 className="font-display text-3xl md:text-4xl font-black bg-gradient-to-r from-orange-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                {t("playlistManager.title" as any)}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t("playlistManager.subtitle" as any)}
              </p>
            </div>
          </div>
          <Button
            onClick={() => navigate("/create-playlist")}
            className="gap-2 bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 text-white hover:opacity-90 shadow-lg"
          >
            <Plus className="h-4 w-4" />
            {t("playlistManager.newPlaylist" as any)}
          </Button>
        </motion.div>

        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: All tracks library */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-1"
            >
              <div className="sticky top-4 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl p-4 shadow-xl">
                <h3 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
                  <Music className="h-5 w-5 text-orange-400" />
                  {t("playlistManager.allTracks" as any)}
                </h3>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("playlistManager.searchPlaceholder" as any)}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-background/40 border-border/50 focus-visible:border-primary"
                  />
                </div>

                <div className="space-y-1 max-h-[65vh] overflow-y-auto pr-1 custom-scrollbar">
                  {filteredTracks.map((track) => (
                    <DraggableTrackItem
                      key={track.id}
                      track={track}
                      isCurrent={currentTrack?.id === track.id}
                      isPlaying={isPlaying}
                      onPlay={() => playTrack(track)}
                    />
                  ))}
                  {filteredTracks.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-8">
                      {t("playlistManager.noResults" as any)}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Right: Playlist drop zones */}
            <div className="lg:col-span-2">
              {playlists.length > 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-5"
                >
                  {playlists.map((playlist, idx) => (
                    <PlaylistDropCard
                      key={playlist.id}
                      playlist={playlist}
                      fallbackCover={FALLBACK_COVERS[idx % FALLBACK_COVERS.length]}
                      onOpen={() => navigate(`/playlist/${playlist.id}`)}
                      t={t}
                    />
                  ))}
                </motion.div>
              ) : (
                <div className="text-center py-16 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl">
                  <div className="inline-flex h-20 w-20 rounded-2xl bg-gradient-to-br from-orange-500 via-pink-500 to-purple-600 items-center justify-center mb-4 shadow-xl">
                    <Music className="h-10 w-10 text-white" />
                  </div>
                  <h2 className="font-display text-2xl font-bold mb-2">
                    {t("playlistManager.empty" as any)}
                  </h2>
                  <p className="text-muted-foreground mb-4">
                    {t("playlistManager.emptyDesc" as any)}
                  </p>
                  <Button
                    onClick={() => navigate("/create-playlist")}
                    className="bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 text-white"
                  >
                    {t("playlistManager.createFirst" as any)}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Drag overlay */}
          <DragOverlay>
            {activeTrack && (
              <motion.div
                initial={{ scale: 1 }}
                animate={{ scale: 1.05 }}
                className="flex items-center gap-2 p-2 rounded-xl bg-card border-2 border-primary shadow-[0_0_30px_hsl(var(--primary)/0.6)] cursor-grabbing"
              >
                {activeTrack.cover_url ? (
                  <img src={activeTrack.cover_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500 to-purple-600 flex items-center justify-center">
                    <Music className="h-4 w-4 text-white" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium text-xs">{activeTrack.title}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{activeTrack.artist}</p>
                </div>
              </motion.div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </MainLayout>
  );
};

export default PlaylistManager;
