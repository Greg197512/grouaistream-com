import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CoverDesigner } from "@/components/cover/CoverDesigner";
import { motion } from "framer-motion";
import { Disc3, Trash2, LogIn, Music, Save, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TrackItem {
  id: string;
  title: string;
  artist: string;
  duration: number;
  audio_url: string | null;
}

const AlbumCreator = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [albumTitle, setAlbumTitle] = useState("");
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<TrackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [frontCover, setFrontCover] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!user) return;
    loadTracks();
  }, [user]);

  const loadTracks = async () => {
    const { data } = await supabase
      .from("tracks")
      .select("id, title, artist, duration, audio_url")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data) setTracks(data);
    setLoading(false);
  };

  const toggleTrack = (track: TrackItem) => {
    const isSelected = selectedTracks.some(t => t.id === track.id);
    if (isSelected) {
      setSelectedTracks(prev => prev.filter(t => t.id !== track.id));
    } else {
      setSelectedTracks(prev => [...prev, track]);
    }
  };

  const removeFromAlbum = (id: string) => {
    setSelectedTracks(prev => prev.filter(t => t.id !== id));
  };

  const moveTrack = (index: number, direction: -1 | 1) => {
    const newIdx = index + direction;
    if (newIdx < 0 || newIdx >= selectedTracks.length) return;
    const arr = [...selectedTracks];
    [arr[index], arr[newIdx]] = [arr[newIdx], arr[index]];
    setSelectedTracks(arr);
  };

  const totalDuration = selectedTracks.reduce((sum, t) => sum + (t.duration || 0), 0);
  const formatTime = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

  const handleSaveAlbum = async () => {
    if (!albumTitle.trim()) { toast.error(t("album.enterTitle")); return; }
    if (selectedTracks.length < 2) { toast.error(t("album.minTracks")); return; }

    setSaving(true);
    try {
      const { data: playlist, error } = await supabase.from("playlists").insert({
        title: albumTitle,
        description: `Album • ${selectedTracks.length} ${t("album.tracks")} • ${formatTime(totalDuration)}`,
        cover_url: frontCover || null,
        user_id: user!.id,
        is_public: true,
        is_ai_generated: false,
      }).select("id").single();
      if (error) throw error;

      const trackInserts = selectedTracks.map((t, i) => ({
        playlist_id: playlist.id,
        track_id: t.id,
        position: i,
      }));
      const { error: tracksErr } = await supabase.from("playlist_tracks").insert(trackInserts);
      if (tracksErr) throw tracksErr;

      toast.success(`${t("album.saved")} "${albumTitle}"`);
      navigate(`/playlist/${playlist.id}`);
    } catch (err: any) {
      console.error("Save album error:", err);
      toast.error(t("album.enterTitle"));
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="max-w-md mx-auto px-6 py-20 text-center">
          <LogIn className="h-16 w-16 text-primary mx-auto mb-6" />
          <h1 className="text-2xl font-bold mb-3">{t("album.loginRequired")}</h1>
          <p className="text-muted-foreground mb-6">{t("album.loginDesc")}</p>
          <Button onClick={() => navigate("/auth")} className="gap-2">
            <LogIn className="h-4 w-4" /> {t("album.loginRequired")}
          </Button>
        </div>
      </MainLayout>
    );
  }

  const filteredTracks = searchQuery
    ? tracks.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.artist.toLowerCase().includes(searchQuery.toLowerCase()))
    : tracks;

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Disc3 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{t("album.pageTitle")}</h1>
              <p className="text-sm text-muted-foreground">{t("album.subtitle")}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Album info + cover */}
            <div className="space-y-6">
              <div className="groove-card p-5 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="album-title" className="font-semibold">{t("album.albumTitle")}</Label>
                  <Input
                    id="album-title"
                    placeholder={t("album.albumPlaceholder")}
                    value={albumTitle}
                    onChange={(e) => setAlbumTitle(e.target.value)}
                    className="bg-card/60"
                  />
                </div>

                <CoverDesigner title={albumTitle} genre="" onCoverReady={setFrontCover} coverUrl={frontCover} />
              </div>

              {selectedTracks.length > 0 && (
                <div className="groove-card p-5">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Music className="h-4 w-4 text-primary" />
                    {t("album.tracklist")} ({selectedTracks.length} {t("album.tracks")} • {formatTime(totalDuration)})
                  </h3>
                  <div className="space-y-1">
                    {selectedTracks.map((track, i) => (
                      <div key={track.id} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded hover:bg-secondary/50 group">
                        <span className="text-muted-foreground w-6 text-right font-mono text-xs">{i + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium">{track.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatTime(track.duration)}</span>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveTrack(i, -1)} disabled={i === 0}>
                            <span className="text-xs">↑</span>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveTrack(i, 1)} disabled={i === selectedTracks.length - 1}>
                            <span className="text-xs">↓</span>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeFromAlbum(track.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button onClick={handleSaveAlbum} disabled={saving || selectedTracks.length < 2} className="w-full mt-4 gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? t("album.saving") : t("album.save")}
                  </Button>
                </div>
              )}
            </div>

            {/* Right: Track picker */}
            <div className="groove-card p-5">
              <h3 className="font-semibold mb-3">{t("album.selectTracks")}</h3>
              <Input
                placeholder={t("album.searchTrack")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mb-3 bg-card/60"
              />

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
                  {filteredTracks.map(track => {
                    const isSelected = selectedTracks.some(st => st.id === track.id);
                    return (
                      <div
                        key={track.id}
                        onClick={() => toggleTrack(track)}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${
                          isSelected
                            ? "bg-primary/10 border border-primary/30"
                            : "hover:bg-secondary/50 border border-transparent"
                        }`}
                      >
                        <Checkbox checked={isSelected} className="pointer-events-none" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{track.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatTime(track.duration)}</span>
                      </div>
                    );
                  })}
                  {filteredTracks.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-8">{t("album.noTracks")}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </MainLayout>
  );
};

export default AlbumCreator;
