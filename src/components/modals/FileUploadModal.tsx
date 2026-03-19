import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Music, Loader2, CheckCircle, AlertCircle, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const ALLOWED_EXTENSIONS = [
  ".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac", ".opus", ".wma", ".weba",
  ".mp4", ".webm", ".mkv", ".avi", ".mov", ".3gp", ".ogv",
];
const ALLOWED_TYPES = [
  "audio/mpeg", "audio/wav", "audio/mp3", "audio/x-wav", "audio/mp4", "audio/x-m4a",
  "audio/ogg", "audio/flac", "audio/aac", "audio/opus", "audio/webm", "audio/x-flac",
  "audio/x-aac", "audio/vnd.wave", "audio/wave", "audio/x-ms-wma",
  "video/mp4", "video/webm", "video/ogg", "video/quicktime", "video/x-matroska",
  "video/x-msvideo", "video/avi", "video/3gpp",
];
const MAX_SIZE = 100 * 1024 * 1024;

interface UploadItem {
  file: File;
  title: string;
  artist: string;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

function parseFilename(file: File): { title: string; artist: string } {
  const name = file.name.replace(/\.[^/.]+$/, "");
  const parts = name.split(" - ");
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(" - ").trim() };
  }
  return { title: name, artist: "Unknown Artist" };
}

function isAllowedFile(file: File): boolean {
  if (ALLOWED_TYPES.includes(file.type)) return true;
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

export const FileUploadModal = ({ isOpen, onClose, onSuccess }: FileUploadModalProps) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);

  const addFiles = useCallback((files: FileList | File[]) => {
    const newItems: UploadItem[] = [];
    for (const file of Array.from(files)) {
      if (!isAllowedFile(file)) continue;
      if (file.size > MAX_SIZE) continue;
      if (file.size < 1000) continue; // skip tiny/empty files
      const { title, artist } = parseFilename(file);
      newItems.push({ file, title, artist, status: "pending" });
    }
    if (newItems.length === 0) {
      toast.error("Brak obsługiwanych plików audio (MP3, WAV, M4A, OGG, FLAC, MP4)");
      return;
    }
    setItems(prev => [...prev, ...newItems]);
  }, []);

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
        const entry = item.webkitGetAsEntry?.();
        if (entry) {
          // For drag-drop folders we collect files from dataTransfer.files
          // webkitGetAsEntry doesn't easily give us files recursively in sync
        }
        const f = item.getAsFile();
        if (f) fileList.push(f);
      }
    }
    if (fileList.length === 0 && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    } else if (fileList.length > 0) {
      addFiles(fileList);
    }
  }, [addFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
    e.target.value = "";
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadAll = async () => {
    if (!user) {
      toast.error("Zaloguj się, aby przesyłać pliki");
      return;
    }
    if (items.length === 0) return;

    setUploading(true);
    setUploadedCount(0);
    let successCount = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.status === "done") { successCount++; continue; }

      setItems(prev => prev.map((it, idx) => idx === i ? { ...it, status: "uploading" } : it));

      try {
        const ext = item.file.name.split(".").pop()?.toLowerCase() || "mp3";
        const safeName = item.title.replace(/[^a-zA-Z0-9\-_]/g, '_').substring(0, 80);
        const filePath = `shared/${Date.now()}-${safeName}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("music")
          .upload(filePath, item.file, { contentType: item.file.type || "audio/mpeg" });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("music").getPublicUrl(filePath);
        const publicUrl = urlData.publicUrl;

        const isVideo = item.file.type.startsWith("video/");
        const { error: insertError } = await supabase.from("tracks").insert({
          title: item.title,
          artist: item.artist,
          genre: null,
          duration: 180,
          audio_url: isVideo ? null : publicUrl,
          video_url: isVideo ? publicUrl : null,
          cover_url: null,
          mood: null,
        });

        if (insertError) throw insertError;

        setItems(prev => prev.map((it, idx) => idx === i ? { ...it, status: "done" } : it));
        successCount++;
        setUploadedCount(successCount);
      } catch (err: any) {
        console.error("Upload error for", item.file.name, err);
        setItems(prev => prev.map((it, idx) => idx === i 
          ? { ...it, status: "error", error: err.message || "Błąd" } : it));
      }
    }

    setUploading(false);
    if (successCount > 0) {
      toast.success(`Przesłano ${successCount} ${successCount === 1 ? "utwór" : "utworów"} do biblioteki!`);
      onSuccess?.();
    }
    if (successCount === items.length) {
      setTimeout(() => handleClose(), 1200);
    }
  };

  const handleClose = () => {
    if (uploading) return;
    setItems([]);
    setUploadedCount(0);
    onClose();
  };

  if (!isOpen) return null;

  const pendingCount = items.filter(i => i.status === "pending" || i.status === "error").length;
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
              <h2 className="text-lg font-bold">Prześlij muzykę</h2>
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
                  <p className="font-medium text-sm">Przeciągnij pliki lub katalogi tutaj</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    MP3, WAV, M4A, OGG, FLAC, MP4 — do 100MB/plik
                  </p>
                </div>
                <div className="flex gap-2 mt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Wybierz pliki
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
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
                accept=".mp3,.wav,.m4a,.ogg,.flac,.aac,.opus,.wma,.weba,.mp4,.webm,.mkv,.avi,.mov,.3gp,.ogv"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <input
                ref={folderInputRef}
                type="file"
                // @ts-ignore - webkitdirectory is not in types
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
                  {items.length} {items.length === 1 ? "plik" : "plików"} • {doneCount} gotowe
                </p>
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg text-xs",
                      item.status === "done" && "bg-green-500/10",
                      item.status === "error" && "bg-destructive/10",
                      item.status === "uploading" && "bg-primary/10",
                      item.status === "pending" && "bg-secondary/50",
                    )}
                  >
                    {item.status === "uploading" && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />}
                    {item.status === "done" && <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                    {item.status === "error" && <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                    {item.status === "pending" && <Music className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                    <span className="truncate flex-1">
                      {item.artist !== "Unknown Artist" ? `${item.artist} — ${item.title}` : item.title}
                    </span>
                    <span className="text-muted-foreground shrink-0">
                      {(item.file.size / 1024 / 1024).toFixed(1)}MB
                    </span>
                    {!uploading && item.status !== "uploading" && (
                      <button onClick={() => removeItem(idx)} className="shrink-0 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Progress */}
            {uploading && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Przesyłanie... {uploadedCount}/{items.length}</span>
                  <span>{totalProgress}%</span>
                </div>
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
          <div className="flex justify-between gap-2 p-4 border-t border-border bg-secondary/30 shrink-0">
            <Button variant="outline" size="sm" onClick={handleClose} disabled={uploading}>
              Anuluj
            </Button>
            <Button
              size="sm"
              onClick={handleUploadAll}
              disabled={uploading || pendingCount === 0}
              className="gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Przesyłanie...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Prześlij {pendingCount > 0 ? `(${pendingCount})` : ""}
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
