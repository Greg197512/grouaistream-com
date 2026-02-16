import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Link, Upload, Music, Loader2, Youtube, CheckCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { extractYouTubeId } from "@/components/player/YouTubePlayer";

interface ImportTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ImportTrackModal = ({ isOpen, onClose, onSuccess }: ImportTrackModalProps) => {
  const { user } = useAuth();
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [genre, setGenre] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  const handleYouTubeUrlChange = async (url: string) => {
    setYoutubeUrl(url);
    const videoId = extractYouTubeId(url);
    if (!videoId) return;

    setFetching(true);
    try {
      const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
      const data = await response.json();
      if (data.title) {
        const titleParts = data.title.split(' - ');
        if (titleParts.length >= 2) {
          setArtist(titleParts[0].trim());
          setTitle(titleParts.slice(1).join(' - ').trim());
        } else {
          setTitle(data.title);
          setArtist(data.author_name || '');
        }
      }
    } catch (error) {
      console.error("Error fetching video info:", error);
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Zaloguj się aby importować");
      return;
    }

    const videoId = extractYouTubeId(youtubeUrl);
    if (!videoId) {
      toast.error("Nieprawidłowy URL YouTube");
      return;
    }

    if (!title.trim()) {
      toast.error("Wpisz tytuł");
      return;
    }

    setLoading(true);
    try {
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const coverUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

      const { error } = await supabase.from("tracks").insert({
        title: title.trim(),
        artist: artist.trim() || "Unknown Artist",
        genre: genre.trim() || null,
        video_url: videoUrl,
        cover_url: coverUrl,
        duration: 180,
        mood: null,
      });

      if (error) throw error;

      // Auto-download cover image
      try {
        const link = document.createElement('a');
        link.href = coverUrl;
        link.download = `${title.trim()} - ${artist.trim() || 'Unknown'}.jpg`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch {}

      toast.success("Utwór zaimportowany!");
      onSuccess?.();
      handleClose();
    } catch (error: any) {
      console.error("Error importing track:", error);
      toast.error(error.message || "Błąd importu");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setYoutubeUrl("");
    setTitle("");
    setArtist("");
    setGenre("");
    onClose();
  };

  if (!isOpen) return null;

  const videoId = extractYouTubeId(youtubeUrl);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl overflow-hidden max-h-[80vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Youtube className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-lg font-bold">Import YouTube</h2>
            </div>
            <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="youtube-url" className="text-sm">YouTube URL</Label>
              <div className="relative">
                <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  id="youtube-url"
                  placeholder="https://youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => handleYouTubeUrlChange(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
                {fetching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                {videoId && !fetching && <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-green-500" />}
              </div>
            </div>

            {videoId && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3">
                <div className="aspect-video rounded-lg overflow-hidden bg-secondary">
                  <img
                    src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                    alt="Thumbnail"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="title" className="text-sm">Tytuł *</Label>
                    <Input id="title" placeholder="Tytuł" value={title} onChange={(e) => setTitle(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="artist" className="text-sm">Artysta</Label>
                    <Input id="artist" placeholder="Artysta" value={artist} onChange={(e) => setArtist(e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="genre" className="text-sm">Gatunek</Label>
                  <Input id="genre" placeholder="np. Rock, Pop, Punk" value={genre} onChange={(e) => setGenre(e.target.value)} className="h-9 text-sm" />
                </div>
              </motion.div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 p-4 border-t border-border bg-secondary/30">
            <Button variant="outline" onClick={handleClose} size="sm">Anuluj</Button>
            <Button onClick={handleSubmit} disabled={loading || !videoId || !title.trim()} size="sm" className="gap-1.5">
              {loading ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" />Importuję...</>
              ) : (
                <><Download className="h-3.5 w-3.5" />Importuj</>
              )}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
