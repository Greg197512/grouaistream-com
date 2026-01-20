import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Link, Upload, Music, Loader2, Youtube, CheckCircle } from "lucide-react";
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
  const [mode, setMode] = useState<'youtube' | 'file'>('youtube');
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
    
    // Try to fetch video info using noembed
    try {
      const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
      const data = await response.json();
      
      if (data.title) {
        // Try to parse artist - title format
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
      toast.error("Please sign in to import tracks");
      return;
    }

    if (mode === 'youtube') {
      const videoId = extractYouTubeId(youtubeUrl);
      if (!videoId) {
        toast.error("Invalid YouTube URL");
        return;
      }

      if (!title.trim()) {
        toast.error("Please enter a title");
        return;
      }

      setLoading(true);
      
      try {
        const { error } = await supabase.from("tracks").insert({
          title: title.trim(),
          artist: artist.trim() || "Unknown Artist",
          genre: genre.trim() || null,
          video_url: `https://www.youtube.com/watch?v=${videoId}`,
          cover_url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          duration: 180, // Default duration, will be updated when played
          mood: null,
        });

        if (error) throw error;

        toast.success("Track imported successfully!");
        onSuccess?.();
        handleClose();
      } catch (error: any) {
        console.error("Error importing track:", error);
        toast.error(error.message || "Failed to import track");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleClose = () => {
    setYoutubeUrl("");
    setTitle("");
    setArtist("");
    setGenre("");
    setMode('youtube');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Music className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl font-bold">Import Track</h2>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-secondary transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Mode Selector */}
          <div className="flex gap-2 p-4 border-b border-border">
            <Button
              variant={mode === 'youtube' ? 'default' : 'outline'}
              onClick={() => setMode('youtube')}
              className="flex-1 gap-2"
            >
              <Youtube className="h-4 w-4" />
              YouTube URL
            </Button>
            <Button
              variant={mode === 'file' ? 'default' : 'outline'}
              onClick={() => setMode('file')}
              className="flex-1 gap-2"
              disabled
            >
              <Upload className="h-4 w-4" />
              Upload File
              <span className="text-xs opacity-60">(Soon)</span>
            </Button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {mode === 'youtube' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="youtube-url">YouTube URL</Label>
                  <div className="relative">
                    <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="youtube-url"
                      placeholder="https://youtube.com/watch?v=..."
                      value={youtubeUrl}
                      onChange={(e) => handleYouTubeUrlChange(e.target.value)}
                      className="pl-10"
                    />
                    {fetching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {extractYouTubeId(youtubeUrl) && !fetching && (
                      <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                    )}
                  </div>
                </div>

                {extractYouTubeId(youtubeUrl) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-4"
                  >
                    {/* Preview */}
                    <div className="aspect-video rounded-lg overflow-hidden bg-secondary">
                      <img
                        src={`https://img.youtube.com/vi/${extractYouTubeId(youtubeUrl)}/hqdefault.jpg`}
                        alt="Video thumbnail"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="title">Title *</Label>
                        <Input
                          id="title"
                          placeholder="Track title"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="artist">Artist</Label>
                        <Input
                          id="artist"
                          placeholder="Artist name"
                          value={artist}
                          onChange={(e) => setArtist(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="genre">Genre</Label>
                      <Input
                        id="genre"
                        placeholder="e.g., Rock, Pop, Punk"
                        value={genre}
                        onChange={(e) => setGenre(e.target.value)}
                      />
                    </div>
                  </motion.div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-6 border-t border-border bg-secondary/30">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || !extractYouTubeId(youtubeUrl) || !title.trim()}
              className="gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Import Track
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
