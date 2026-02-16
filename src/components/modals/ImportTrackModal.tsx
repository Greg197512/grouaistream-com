import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Link, Loader2, Youtube, CheckCircle, Download, AlertCircle } from "lucide-react";
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

type Status = "idle" | "fetching" | "downloading" | "uploading" | "saving" | "done" | "error";

const STATUS_LABELS: Record<Status, string> = {
  idle: "",
  fetching: "Pobieram dane z YouTube...",
  downloading: "Pobieram muzykę z YouTube...",
  uploading: "Zapisuję plik...",
  saving: "Zapisuję utwór w bibliotece...",
  done: "Gotowe!",
  error: "Błąd",
};

export const ImportTrackModal = ({ isOpen, onClose, onSuccess }: ImportTrackModalProps) => {
  const { user } = useAuth();
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleYouTubeUrlChange = async (url: string) => {
    setYoutubeUrl(url);
    setErrorMsg("");
    const videoId = extractYouTubeId(url);
    if (!videoId || !user) return;

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

      // Download audio via edge function
      setStatus("downloading");
      let audioUrl: string | null = null;
      let downloadFileName = `${title} - ${artist}.m4a`;
      let trackDuration = 180;

      try {
        const { data: fnData, error: fnError } = await supabase.functions.invoke('youtube-download', {
          body: { videoId, title, artist },
        });

        if (fnError) throw new Error(fnError.message);

        if (fnData?.url) {
          audioUrl = fnData.url;
          downloadFileName = fnData.fileName || downloadFileName;
          if (fnData.duration) trackDuration = fnData.duration;
        } else if (fnData?.fallback) {
          console.log('Audio download failed, saving YouTube link only');
        } else if (fnData?.error) {
          console.log('Download error:', fnData.error);
        }
      } catch (err: any) {
        console.log('Edge function error, saving YouTube link:', err.message);
      }

      // Save to DB
      setStatus("saving");
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const coverUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

      const { error: dbError } = await supabase.from("tracks").insert({
        title,
        artist,
        genre: null,
        audio_url: audioUrl,
        video_url: videoUrl,
        cover_url: coverUrl,
        duration: trackDuration,
        mood: null,
      });

      if (dbError) throw dbError;

      // Trigger browser download if we have audio
      if (audioUrl) {
        try {
          const link = document.createElement('a');
          link.href = audioUrl;
          link.download = downloadFileName;
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } catch {}
      }

      setStatus("done");
      const msg = audioUrl 
        ? `Pobrano i zaimportowano: ${title}`
        : `Zaimportowano: ${title} (odtwarzanie przez YouTube)`;
      toast.success(msg);
      onSuccess?.();

      setTimeout(() => handleClose(), 1500);
    } catch (error: any) {
      console.error("Import error:", error);
      setErrorMsg(error.message || "Błąd importu");
      setStatus("error");
      toast.error(error.message || "Błąd importu");
    }
  };

  const handleClose = () => {
    setYoutubeUrl("");
    setStatus("idle");
    setErrorMsg("");
    onClose();
  };

  if (!isOpen) return null;

  const isProcessing = !["idle", "done", "error"].includes(status);

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
              <h2 className="text-sm font-bold">Import YouTube + Pobierz MP3</h2>
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
                  disabled={isProcessing}
                />
              </div>
            </div>

            {/* Status */}
            {status !== "idle" && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-center gap-2 p-2 rounded-lg text-xs ${
                  status === "error" ? "bg-destructive/10 text-destructive" : "bg-secondary/50"
                }`}
              >
                {isProcessing && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                {status === "done" && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
                {status === "error" && <AlertCircle className="h-3.5 w-3.5" />}
                <span className={status === "done" ? "text-green-500 font-medium" : ""}>
                  {status === "error" ? errorMsg : STATUS_LABELS[status]}
                </span>
              </motion.div>
            )}

            {status === "error" && (
              <Button 
                size="sm" 
                variant="outline" 
                className="w-full text-xs"
                onClick={() => { setStatus("idle"); setYoutubeUrl(""); setErrorMsg(""); }}
              >
                Spróbuj ponownie
              </Button>
            )}

            <p className="text-[10px] text-muted-foreground text-center">
              Wklej link → automatycznie pobiorę MP3 na dysk i dodam do biblioteki
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
