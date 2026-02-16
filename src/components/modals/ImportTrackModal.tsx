import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Link, Loader2, Youtube, CheckCircle, Download, Music } from "lucide-react";
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
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "fetching" | "saving" | "downloading" | "done">("idle");

  const handleYouTubeUrlChange = async (url: string) => {
    setYoutubeUrl(url);
    const videoId = extractYouTubeId(url);
    if (!videoId || !user) return;

    // Auto-import flow
    setStatus("fetching");
    try {
      let title = "";
      let artist = "";

      // Fetch metadata
      const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
      const data = await response.json();
      if (data.title) {
        const titleParts = data.title.split(' - ');
        if (titleParts.length >= 2) {
          artist = titleParts[0].trim();
          title = titleParts.slice(1).join(' - ').trim();
        } else {
          title = data.title;
          artist = data.author_name || 'Unknown Artist';
        }
      } else {
        title = `YouTube ${videoId}`;
        artist = "Unknown Artist";
      }

      // Save to DB
      setStatus("saving");
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const coverUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

      const { error } = await supabase.from("tracks").insert({
        title,
        artist,
        genre: null,
        video_url: videoUrl,
        cover_url: coverUrl,
        duration: 180,
        mood: null,
      });

      if (error) throw error;

      // Auto-download cover
      setStatus("downloading");
      try {
        const coverLink = document.createElement('a');
        coverLink.href = coverUrl;
        coverLink.download = `${title} - ${artist}.jpg`;
        coverLink.target = '_blank';
        document.body.appendChild(coverLink);
        coverLink.click();
        document.body.removeChild(coverLink);
      } catch {}

      setStatus("done");
      toast.success(`Zaimportowano: ${title}`);
      onSuccess?.();

      // Auto-close after short delay
      setTimeout(() => {
        handleClose();
      }, 1200);
    } catch (error: any) {
      console.error("Error importing track:", error);
      toast.error(error.message || "Błąd importu");
      setStatus("idle");
    }
  };

  const handleClose = () => {
    setYoutubeUrl("");
    setStatus("idle");
    setLoading(false);
    onClose();
  };

  if (!isOpen) return null;

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
          className="w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Youtube className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-sm font-bold">Import YouTube</h2>
            </div>
            <button onClick={handleClose} className="p-1 rounded-lg hover:bg-secondary transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-3 space-y-3">
            <div className="space-y-1">
              <Label htmlFor="youtube-url" className="text-xs">Wklej link YouTube</Label>
              <div className="relative">
                <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  id="youtube-url"
                  placeholder="https://youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => handleYouTubeUrlChange(e.target.value)}
                  className="pl-9 h-8 text-xs"
                  disabled={status !== "idle"}
                />
              </div>
            </div>

            {/* Status indicator */}
            {status !== "idle" && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 text-xs"
              >
                {status === "fetching" && (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /><span>Pobieram dane...</span></>
                )}
                {status === "saving" && (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /><span>Zapisuję utwór...</span></>
                )}
                {status === "downloading" && (
                  <><Download className="h-3.5 w-3.5 animate-bounce text-primary" /><span>Pobieram na dysk...</span></>
                )}
                {status === "done" && (
                  <><CheckCircle className="h-3.5 w-3.5 text-green-500" /><span className="text-green-500 font-medium">Gotowe!</span></>
                )}
              </motion.div>
            )}

            <p className="text-[10px] text-muted-foreground text-center">
              Wklej link — automatycznie zaimportuję i pobiorę na dysk
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};