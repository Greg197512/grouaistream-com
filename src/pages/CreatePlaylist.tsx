import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import {
  Music,
  Sparkles,
  X,
  GripVertical,
  Search,
  Plus,
  Image as ImageIcon,
  Palette,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { HQCover } from "@/components/ui/HQCover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Track } from "@/contexts/PlayerContext";

import cover1 from "@/assets/playlist-cover-1.jpg";
import cover2 from "@/assets/playlist-cover-2.jpg";
import cover3 from "@/assets/playlist-cover-3.jpg";
import cover4 from "@/assets/playlist-cover-4.jpg";
import cover5 from "@/assets/playlist-cover-5.jpg";
import cover6 from "@/assets/playlist-cover-6.jpg";

const COVER_GALLERY = [
  { id: "c1", url: cover1 },
  { id: "c2", url: cover2 },
  { id: "c3", url: cover3 },
  { id: "c4", url: cover4 },
  { id: "c5", url: cover5 },
  { id: "c6", url: cover6 },
];

const GRADIENTS = [
  "from-orange-500 via-red-500 to-pink-600",
  "from-purple-500 via-pink-500 to-red-500",
  "from-cyan-500 via-blue-500 to-purple-600",
  "from-green-400 via-emerald-500 to-teal-600",
  "from-yellow-400 via-orange-500 to-red-500",
  "from-fuchsia-500 via-purple-500 to-indigo-600",
];

/* ── Draggable track item ── */
const DraggableTrack = ({
  track,
  isSelected,
}: {
  track: Track;
  isSelected: boolean;
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `track-${track.id}`,
    data: { track },
  });

  return (
    <motion.div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      layout
      whileHover={{ scale: 1.01, x: 2 }}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className={`group flex items-center gap-3 p-2.5 rounded-xl cursor-grab active:cursor-grabbing transition-all border ${
        isSelected
          ? "bg-primary/10 border-primary/40"
          : "bg-card/50 border-border/30 hover:border-primary/30 hover:bg-card"
      }`}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary shrink-0" />
      <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 ring-1 ring-border/40">
        <HQCover
          src={track.cover_url}
          alt={track.title}
          artist={track.artist}
          genre={track.genre}
          className="w-full h-full"
          fallbackClassName="w-full h-full"
        />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="font-medium text-sm truncate">{track.title}</p>
        <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
      </div>
      {isSelected && (
        <div className="text-xs text-primary font-bold pr-1">✓</div>
      )}
    </motion.div>
  );
};

/* ── Drop zone (the playlist) ── */
const PlaylistDropZone = ({
  selectedTracks,
  allTracks,
  onRemove,
  dropLabel,
  emptyLabel,
  removeLabel,
}: {
  selectedTracks: string[];
  allTracks: Track[];
  onRemove: (id: string) => void;
  dropLabel: string;
  emptyLabel: string;
  removeLabel: string;
}) => {
  const { isOver, setNodeRef } = useDroppable({ id: "playlist-drop" });

  const tracks = selectedTracks
    .map((id) => allTracks.find((t) => t.id === id))
    .filter(Boolean) as Track[];

  return (
    <div
      ref={setNodeRef}
      className={`relative rounded-2xl border-2 border-dashed transition-all min-h-[180px] p-4 ${
        isOver
          ? "border-primary bg-primary/10 scale-[1.01] shadow-[0_0_30px_hsl(var(--primary)/0.3)]"
          : "border-border/40 bg-card/30"
      }`}
    >
      {tracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full min-h-[150px] text-center gap-2">
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center"
          >
            <Plus className="h-6 w-6 text-primary" />
          </motion.div>
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {tracks.map((t, i) => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: i * 0.02 }}
                className="flex items-center gap-3 p-2 rounded-lg bg-background/60 border border-border/30 group"
              >
                <span className="text-xs text-muted-foreground w-5 text-center">
                  {i + 1}
                </span>
                <div className="w-9 h-9 rounded overflow-hidden shrink-0">
                  <HQCover
                    src={t.cover_url}
                    alt={t.title}
                    artist={t.artist}
                    genre={t.genre}
                    className="w-full h-full"
                    fallbackClassName="w-full h-full"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {t.artist}
                  </p>
                </div>
                <button
                  onClick={() => onRemove(t.id)}
                  aria-label={removeLabel}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
      {isOver && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-primary font-bold text-lg drop-shadow-[0_0_10px_hsl(var(--primary))]">
            {dropLabel}
          </span>
        </div>
      )}
    </div>
  );
};

const CreatePlaylist = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverMode, setCoverMode] = useState<"image" | "gradient">("image");
  const [selectedCoverUrl, setSelectedCoverUrl] = useState<string>(cover1);
  const [selectedGradient, setSelectedGradient] = useState(GRADIENTS[0]);
  const [allTracks, setAllTracks] = useState<Track[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [activeTrack, setActiveTrack] = useState<Track | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    const loadTracks = async () => {
      const { data } = await supabase
        .from("tracks")
        .select("*")
        .order("title", { ascending: true })
        .limit(500);
      setAllTracks((data || []) as Track[]);
    };
    loadTracks();
  }, [user, navigate]);

  const filteredTracks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allTracks;
    return allTracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q)
    );
  }, [allTracks, search]);

  const handleDragStart = (e: DragStartEvent) => {
    setActiveTrack((e.active.data.current?.track as Track) || null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveTrack(null);
    if (e.over?.id === "playlist-drop") {
      const track = e.active.data.current?.track as Track | undefined;
      if (track && !selectedTracks.includes(track.id)) {
        setSelectedTracks((prev) => [...prev, track.id]);
      }
    }
  };

  const removeTrack = (id: string) =>
    setSelectedTracks((prev) => prev.filter((x) => x !== id));

  const handleAIGenerate = async () => {
    setAiGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-playlist", {
        body: {
          action: "generate_playlist",
          mood: "energetic",
          genre: "electronic",
          context: "Generate a creative playlist for the user",
        },
      });
      if (error) throw error;
      if (data?.data) {
        setTitle(data.data.playlistName || "AI Mix");
        setDescription(data.data.description || "");
        toast.success(t("createPlaylist.aiSuccess"));
      }
    } catch (err) {
      console.error("AI gen error", err);
      toast.error(t("createPlaylist.errorAi"));
    } finally {
      setAiGenerating(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error(t("createPlaylist.errorName"));
      return;
    }
    setLoading(true);
    try {
      const insertData: {
        user_id: string;
        title: string;
        description: string;
        gradient: string | null;
        cover_url: string | null;
        is_ai_generated: boolean;
      } = {
        user_id: user!.id,
        title,
        description,
        gradient: coverMode === "gradient" ? selectedGradient : null,
        cover_url: coverMode === "image" ? selectedCoverUrl : null,
        is_ai_generated: false,
      };

      const { data: playlist, error: playlistError } = await supabase
        .from("playlists")
        .insert(insertData)
        .select()
        .single();
      if (playlistError) throw playlistError;

      if (selectedTracks.length > 0) {
        const trackInserts = selectedTracks.map((trackId, index) => ({
          playlist_id: playlist.id,
          track_id: trackId,
          position: index,
        }));
        const { error: tracksError } = await supabase
          .from("playlist_tracks")
          .insert(trackInserts);
        if (tracksError) throw tracksError;
      }

      toast.success(t("createPlaylist.created"));
      navigate("/library");
    } catch (err) {
      console.error("Create playlist error", err);
      toast.error(t("createPlaylist.errorCreate"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="px-4 sm:px-6 py-8 max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="font-display text-3xl sm:text-4xl font-bold bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500 bg-clip-text text-transparent">
              {t("createPlaylist.title")}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {t("createPlaylist.subtitle")}
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-[400px_1fr] gap-6">
            {/* LEFT: Cover + form + drop zone */}
            <div className="space-y-5">
              {/* Cover preview */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative aspect-square rounded-2xl overflow-hidden shadow-[0_20px_60px_-20px_hsl(var(--primary)/0.5)] ring-1 ring-border/30"
              >
                {coverMode === "image" ? (
                  <img
                    src={selectedCoverUrl}
                    alt="cover"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className={`w-full h-full bg-gradient-to-br ${selectedGradient} flex items-center justify-center`}
                  >
                    <Music className="h-24 w-24 text-white/80 drop-shadow-2xl" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                {title && (
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <p className="text-white font-display text-xl font-bold drop-shadow-lg truncate">
                      {title}
                    </p>
                  </div>
                )}
              </motion.div>

              {/* Cover mode tabs */}
              <div className="flex gap-2 p-1 rounded-xl bg-card/50 border border-border/30">
                <button
                  onClick={() => setCoverMode("image")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    coverMode === "image"
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ImageIcon className="h-4 w-4" />
                  {t("createPlaylist.coverGallery")}
                </button>
                <button
                  onClick={() => setCoverMode("gradient")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    coverMode === "gradient"
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Palette className="h-4 w-4" />
                  {t("createPlaylist.coverGradients")}
                </button>
              </div>

              {/* Cover gallery */}
              {coverMode === "image" ? (
                <div className="grid grid-cols-3 gap-2">
                  {COVER_GALLERY.map((c) => (
                    <motion.button
                      key={c.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedCoverUrl(c.url)}
                      className={`relative aspect-square rounded-xl overflow-hidden ring-2 transition-all ${
                        selectedCoverUrl === c.url
                          ? "ring-primary shadow-[0_0_15px_hsl(var(--primary)/0.5)]"
                          : "ring-transparent hover:ring-primary/50"
                      }`}
                    >
                      <img
                        src={c.url}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </motion.button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {GRADIENTS.map((g) => (
                    <motion.button
                      key={g}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedGradient(g)}
                      className={`aspect-square rounded-xl bg-gradient-to-br ${g} ring-2 transition-all ${
                        selectedGradient === g
                          ? "ring-primary shadow-[0_0_15px_hsl(var(--primary)/0.5)]"
                          : "ring-transparent hover:ring-primary/50"
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Form */}
              <div className="space-y-3">
                <div>
                  <Label htmlFor="title" className="text-xs uppercase tracking-wider text-muted-foreground">
                    {t("createPlaylist.nameLabel")}
                  </Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t("createPlaylist.namePlaceholder")}
                    className="mt-1 bg-card/50"
                  />
                </div>
                <div>
                  <Label htmlFor="description" className="text-xs uppercase tracking-wider text-muted-foreground">
                    {t("createPlaylist.descLabel")}
                  </Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t("createPlaylist.descPlaceholder")}
                    className="mt-1 bg-card/50 resize-none"
                    rows={2}
                  />
                </div>
              </div>

              {/* Drop zone */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    {t("createPlaylist.dropZone")} · {selectedTracks.length}
                  </Label>
                  <p className="text-xs text-primary">{t("createPlaylist.dragHint")}</p>
                </div>
                <PlaylistDropZone
                  selectedTracks={selectedTracks}
                  allTracks={allTracks}
                  onRemove={removeTrack}
                  dropLabel={t("createPlaylist.dropHere")}
                  emptyLabel={t("createPlaylist.emptyDrop")}
                  removeLabel={t("createPlaylist.removeTrack")}
                />
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <Button
                  onClick={handleAIGenerate}
                  variant="outline"
                  disabled={aiGenerating}
                  className="w-full gap-2 border-primary/30 hover:border-primary hover:bg-primary/10"
                >
                  <Sparkles className="h-4 w-4" />
                  {aiGenerating
                    ? t("createPlaylist.aiGenerating")
                    : t("createPlaylist.aiGenerate")}
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={loading || !title.trim()}
                  className="w-full bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 hover:opacity-90 text-white font-bold shadow-lg shadow-primary/30"
                >
                  {loading
                    ? t("createPlaylist.creating")
                    : t("createPlaylist.create")}
                </Button>
              </div>
            </div>

            {/* RIGHT: Track library */}
            <div className="rounded-2xl bg-card/30 border border-border/30 p-4 flex flex-col min-h-[60vh]">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-lg font-bold">
                  {t("createPlaylist.allTracks")}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {filteredTracks.length}
                </span>
              </div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("createPlaylist.searchTracks")}
                  className="pl-9 bg-background/50"
                />
              </div>
              <div className="space-y-1.5 overflow-y-auto groove-scrollbar pr-1 flex-1 max-h-[70vh]">
                {filteredTracks.map((track) => (
                  <DraggableTrack
                    key={track.id}
                    track={track}
                    isSelected={selectedTracks.includes(track.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {activeTrack && (
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-card border border-primary shadow-2xl shadow-primary/40 max-w-xs">
              <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0">
                <HQCover
                  src={activeTrack.cover_url}
                  alt={activeTrack.title}
                  artist={activeTrack.artist}
                  genre={activeTrack.genre}
                  className="w-full h-full"
                  fallbackClassName="w-full h-full"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{activeTrack.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {activeTrack.artist}
                </p>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </MainLayout>
  );
};

export default CreatePlaylist;
