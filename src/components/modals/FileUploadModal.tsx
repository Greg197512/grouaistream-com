import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Music, Loader2, CheckCircle, AlertCircle, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  isAllowedMediaFile,
  isVideoLikeFile,
  MAX_UPLOAD_SIZE_BYTES,
  MEDIA_FILE_ACCEPT,
} from "@/lib/mediaFormats";
import { uploadToR2 } from "@/lib/r2Upload";

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** Jeśli podane — wgrane utwory zostaną automatycznie dodane do tej playlisty */
  playlistId?: string;
}


interface UploadItem {
  file: File;
  title: string;
  artist: string;
  status: "uploading" | "done" | "error";
  error?: string;
  percent: number;
}

const MIN_DURATION_SEC = 150;
const MAX_DURATION_SEC = 1140;
const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function parseFilename(file: File): { title: string; artist: string } {
  const name = file.name.replace(/\.[^/.]+$/, "");
  const parts = name.split(" - ");
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(" - ").trim() };
  }
  return { title: name, artist: "Unknown Artist" };
}

function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    let settled = false;
    const finish = (d: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(tid);
      audio.onloadedmetadata = null;
      audio.onerror = null;
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(url);
      resolve(d);
    };
    const tid = setTimeout(() => finish(180), 3000);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const d = Math.round(audio.duration);
      finish(Number.isFinite(d) && d > 0 ? d : 180);
    };
    audio.onerror = () => finish(180);
    audio.src = url;
  });
}

export const FileUploadModal = ({ isOpen, onClose, onSuccess, playlistId }: FileUploadModalProps) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const uploadSingleFile = useCallback(async (file: File, index: number) => {
    if (!user) return;
    const { title, artist } = parseFilename(file);
    const isVideo = isVideoLikeFile(file);
    const folder = isVideo ? "videos" : "tracks";
    const displayName = user.user_metadata?.display_name || user.email?.split("@")[0] || "Artist";

    try {
      const duration = await getAudioDuration(file);

      // Validate track duration for audio uploads
      if (!isVideo && duration > 0 && (duration < MIN_DURATION_SEC || duration > MAX_DURATION_SEC)) {
        const msg = `Długość ${fmtDur(duration)} poza zakresem 2:30–19:00.`;
        toast.error(msg);
        throw new Error(msg);
      }

      const { publicUrl } = await uploadToR2({
        file,
        folder,
        onProgress: (percent) => {
          setItems(prev => prev.map((it, idx) => idx === index ? { ...it, percent } : it));
        },
      });

      const { data: inserted, error: insertErr } = await supabase.from("tracks").insert({
        title,
        artist: artist !== "Unknown Artist" ? artist : displayName,
        duration,
        audio_url: isVideo ? null : publicUrl,
        video_url: isVideo ? publicUrl : null,
        cover_url: null,
        genre: null,
        mood: null,
        user_id: user.id,
      }).select("id").single();

      if (insertErr) throw insertErr;

      // Dodaj do playlisty jeżeli podano playlistId
      if (playlistId && inserted?.id) {
        const { count } = await supabase
          .from("playlist_tracks")
          .select("*", { count: "exact", head: true })
          .eq("playlist_id", playlistId);
        await supabase.from("playlist_tracks").insert({
          playlist_id: playlistId,
          track_id: inserted.id,
          position: count ?? 0,
        });
      }

      setItems(prev => prev.map((it, idx) => idx === index ? { ...it, status: "done", percent: 100 } : it));
      return true;
    } catch (err: any) {
      console.error("Upload error:", file.name, err);
      setItems(prev => prev.map((it, idx) => idx === index
        ? { ...it, status: "error", error: err.message || "Błąd" } : it));
      return false;
    }
  }, [user, playlistId]);


  const startUpload = useCallback(async (files: File[]) => {
    if (!user) {
      toast.error("Zaloguj się, aby przesyłać pliki");
      return;
    }

    const validFiles = files.filter(f => {
      if (!isAllowedMediaFile(f, MAX_UPLOAD_SIZE_BYTES)) return false;
      if (f.size > MAX_UPLOAD_SIZE_BYTES || f.size < 1000) return false;
      return true;
    });

    if (validFiles.length === 0) {
      toast.error("Brak obsługiwanych plików audio lub wideo");
      return;
    }

    const newItems: UploadItem[] = validFiles.map(f => {
      const { title, artist } = parseFilename(f);
      return { file: f, title, artist, status: "uploading" as const, percent: 0 };
    });

    const startIndex = items.length;
    setItems(prev => [...prev, ...newItems]);
    setUploading(true);

    let successCount = 0;
    for (let i = 0; i < validFiles.length; i++) {
      const ok = await uploadSingleFile(validFiles[i], startIndex + i);
      if (ok) successCount++;
    }

    setUploading(false);
    if (successCount > 0) {
      toast.success(`Przesłano ${successCount} ${successCount === 1 ? "utwór" : "utworów"}!`);
      onSuccess?.();
    }
    if (successCount === validFiles.length) {
      setTimeout(() => handleClose(), 1500);
    }
  }, [user, items.length, uploadSingleFile, onSuccess]);

  const addFiles = useCallback((fileList: FileList | File[]) => {
    startUpload(Array.from(fileList));
  }, [startUpload]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const fileList: File[] = [];
    if (e.dataTransfer.items) {
      for (const item of Array.from(e.dataTransfer.items)) {
        const f = item.getAsFile();
        if (f) fileList.push(f);
      }
    }
    if (fileList.length > 0) {
      addFiles(fileList);
    } else if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
    e.target.value = "";
  };

  const handleClose = () => {
    if (uploading) return;
    setItems([]);
    onClose();
  };

  if (!isOpen) return null;

  const doneCount = items.filter(i => i.status === "done").length;
  const totalProgress = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;

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
          className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Upload className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-lg font-bold">Wrzuć na serwer</h2>
            </div>
            <button onClick={handleClose} disabled={uploading} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-3 overflow-y-auto flex-1 min-h-0">
            {/* Drop Zone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={cn(
                "relative border-2 border-dashed rounded-xl p-6 text-center transition-all",
                dragActive
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50 hover:bg-secondary/50",
              )}
            >
              <div className="flex flex-col items-center gap-3">
                <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                  <Music className="h-10 w-10 text-muted-foreground" />
                </motion.div>
                <div>
                  <p className="font-medium text-sm">Wybierz pliki — upload startuje od razu</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    MP3, WAV, FLAC, MP4, MOV, MKV — do 500MB/plik
                  </p>
                </div>
                <div className="flex gap-2 mt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Wybierz pliki
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    disabled={uploading}
                    onClick={() => folderInputRef.current?.click()}
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    Wybierz katalog
                  </Button>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept={MEDIA_FILE_ACCEPT}
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <input
                ref={folderInputRef}
                type="file"
                // @ts-ignore
                webkitdirectory=""
                // @ts-ignore
                directory=""
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* File list */}
            {items.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                <p className="text-xs font-medium text-muted-foreground">
                  {doneCount}/{items.length} gotowe {uploading && "• przesyłanie..."}
                </p>
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg text-xs",
                      item.status === "done" && "bg-green-500/10",
                      item.status === "error" && "bg-destructive/10",
                      item.status === "uploading" && "bg-primary/10",
                    )}
                  >
                    {item.status === "uploading" && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />}
                    {item.status === "done" && <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                    {item.status === "error" && <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                    <span className="truncate flex-1">
                      {item.artist !== "Unknown Artist" ? `${item.artist} — ${item.title}` : item.title}
                    </span>
                    {item.status === "uploading" && (
                      <span className="text-primary shrink-0 font-medium">{item.percent}%</span>
                    )}
                    <span className="text-muted-foreground shrink-0">
                      {(item.file.size / 1024 / 1024).toFixed(1)}MB
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Progress */}
            {items.length > 0 && (
              <div className="space-y-1">
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${totalProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end p-4 border-t border-border bg-secondary/30 shrink-0">
            <Button variant="outline" size="sm" onClick={handleClose} disabled={uploading}>
              {uploading ? "Przesyłanie..." : "Zamknij"}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
