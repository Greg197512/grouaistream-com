import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Music, FileAudio, FileVideo, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const ALLOWED_AUDIO = ["audio/mpeg", "audio/wav", "audio/mp3", "audio/x-wav"];
const ALLOWED_VIDEO = ["video/mp4", "video/webm"];
const MAX_SIZE = 100 * 1024 * 1024; // 100MB

export const FileUploadModal = ({ isOpen, onClose, onSuccess }: FileUploadModalProps) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [genre, setGenre] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_AUDIO.includes(file.type) && !ALLOWED_VIDEO.includes(file.type)) {
      return "Please upload MP3, WAV, or MP4 files only";
    }
    if (file.size > MAX_SIZE) {
      return "File size must be under 100MB";
    }
    return null;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError(null);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const validationError = validateFile(droppedFile);
      if (validationError) {
        setError(validationError);
        return;
      }
      setFile(droppedFile);
      
      // Auto-fill title from filename
      const fileName = droppedFile.name.replace(/\.[^/.]+$/, "");
      const parts = fileName.split(" - ");
      if (parts.length >= 2) {
        setArtist(parts[0].trim());
        setTitle(parts.slice(1).join(" - ").trim());
      } else {
        setTitle(fileName);
      }
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validationError = validateFile(selectedFile);
      if (validationError) {
        setError(validationError);
        return;
      }
      setFile(selectedFile);
      
      // Auto-fill title from filename
      const fileName = selectedFile.name.replace(/\.[^/.]+$/, "");
      const parts = fileName.split(" - ");
      if (parts.length >= 2) {
        setArtist(parts[0].trim());
        setTitle(parts.slice(1).join(" - ").trim());
      } else {
        setTitle(fileName);
      }
    }
  };

  const handleUpload = async () => {
    if (!user) {
      toast.error("Zaloguj się, aby przesyłać pliki");
      return;
    }

    if (!file || !title.trim()) {
      toast.error("Wybierz plik i wpisz tytuł");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const isVideo = ALLOWED_VIDEO.includes(file.type);
      const ext = file.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

      // Upload to storage
      setUploadProgress(20);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("music")
        .upload(filePath, file, { contentType: file.type });

      if (uploadError) throw uploadError;
      setUploadProgress(70);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("music")
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;
      setUploadProgress(85);

      // Insert track record
      const { error: insertError } = await supabase.from("tracks").insert({
        title: title.trim(),
        artist: artist.trim() || "Unknown Artist",
        genre: genre || null,
        duration: 180,
        audio_url: isVideo ? null : publicUrl,
        video_url: isVideo ? publicUrl : null,
        cover_url: null,
        mood: null,
      });

      if (insertError) throw insertError;
      setUploadProgress(100);

      toast.success("Utwór przesłany!");
      onSuccess?.();
      handleClose();
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error(err.message || "Błąd przesyłania");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setTitle("");
    setArtist("");
    setGenre("");
    setError(null);
    setUploadProgress(0);
    onClose();
  };

  const isAudio = file && ALLOWED_AUDIO.includes(file.type);
  const isVideo = file && ALLOWED_VIDEO.includes(file.type);

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
              <motion.div 
                className="p-2 rounded-lg bg-primary/10"
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Upload className="h-5 w-5 text-primary" />
              </motion.div>
              <h2 className="text-xl font-bold">Upload Music</h2>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-secondary transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Drop Zone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
                dragActive 
                  ? "border-primary bg-primary/10" 
                  : "border-border hover:border-primary/50 hover:bg-secondary/50",
                file && "border-green-500 bg-green-500/10"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav,.mp4,.webm"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              {file ? (
                <div className="flex flex-col items-center gap-3">
                  {isAudio ? (
                    <FileAudio className="h-12 w-12 text-primary" />
                  ) : (
                    <FileVideo className="h-12 w-12 text-primary" />
                  )}
                  <div>
                    <p className="font-medium text-sm">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <Music className="h-12 w-12 text-muted-foreground" />
                  </motion.div>
                  <div>
                    <p className="font-medium">Drop your music file here</p>
                    <p className="text-sm text-muted-foreground">
                      or click to browse (MP3, WAV, MP4)
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm"
              >
                <AlertCircle className="h-4 w-4" />
                {error}
              </motion.div>
            )}

            {/* Metadata */}
            {file && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-4"
              >
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
                  <Select value={genre} onValueChange={setGenre}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select genre" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Rock">Rock</SelectItem>
                      <SelectItem value="Pop">Pop</SelectItem>
                      <SelectItem value="Punk">Punk</SelectItem>
                      <SelectItem value="Pop-Punk">Pop-Punk</SelectItem>
                      <SelectItem value="Pop-Rock">Pop-Rock</SelectItem>
                      <SelectItem value="Punk-Rock">Punk-Rock</SelectItem>
                      <SelectItem value="Metal">Metal</SelectItem>
                      <SelectItem value="Electronic">Electronic</SelectItem>
                      <SelectItem value="Hip-Hop">Hip-Hop</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Upload Progress */}
                {uploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <motion.div
                        className="h-full groove-gradient-bg"
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-6 border-t border-border bg-secondary/30">
            <Button variant="outline" onClick={handleClose} disabled={uploading}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploading || !file || !title.trim()}
              className="gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload Track
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
