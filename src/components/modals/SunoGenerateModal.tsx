import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Music, Loader2, X, Play, Download, Wand2, Guitar } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/contexts/PlayerContext";
import { toast } from "sonner";

interface SunoGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GeneratedSong {
  id: string;
  title: string;
  audioUrl: string;
  streamUrl?: string;
  imageUrl?: string;
  duration?: number;
  style?: string;
}

const STYLE_PRESETS = [
  "Pop", "Rock", "Hip-Hop", "Electronic", "Jazz", "Classical",
  "R&B", "Country", "Reggae", "Metal", "Indie", "Lo-fi",
  "Ambient", "Trap", "House", "Disco",
];

export const SunoGenerateModal = ({ isOpen, onClose }: SunoGenerateModalProps) => {
  const { playTrack } = usePlayer();
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [style, setStyle] = useState("");
  const [instrumental, setInstrumental] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [polling, setPolling] = useState(false);
  const [songs, setSongs] = useState<GeneratedSong[]>([]);
  const [statusMsg, setStatusMsg] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const generate = async () => {
    if (!prompt.trim() && !customMode) {
      toast.error("Wpisz opis utworu");
      return;
    }

    setGenerating(true);
    setSongs([]);
    setStatusMsg("🎵 Generuję muzykę z Suno AI...");

    try {
      const body: any = { action: "generate", prompt: prompt.trim(), instrumental };
      if (customMode) {
        body.style = style || "Pop";
        body.title = title || "AI Track";
      }

      const { data, error } = await supabase.functions.invoke("suno-generate", { body });
      if (error) throw error;

      console.log("[Suno] Response:", data);

      const taskId = data?.data?.taskId || data?.taskId;

      if (taskId) {
        setStatusMsg("⏳ Utwór jest generowany... czekam na wynik (~30-120s)");
        setPolling(true);
        pollForResult(taskId);
      } else if (data?.data) {
        // Direct result
        handleResult(data.data);
      } else {
        throw new Error("Nieoczekiwana odpowiedź z Suno API");
      }
    } catch (err: any) {
      console.error("[Suno] Generate error:", err);
      toast.error("Błąd generowania: " + (err.message || "Nieznany błąd"));
      setStatusMsg("");
    } finally {
      setGenerating(false);
    }
  };

  const pollForResult = (taskId: string) => {
    let attempts = 0;
    const maxAttempts = 60; // 5 min max

    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        if (pollRef.current) clearInterval(pollRef.current);
        setPolling(false);
        setStatusMsg("⏰ Generowanie trwa dłużej niż oczekiwano. Spróbuj ponownie.");
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("suno-generate", {
          body: { action: "status", taskId },
        });

        if (error) throw error;

        const status = data?.data?.status || data?.status;
        const songs = data?.data?.songs || data?.data?.data || [];

        if (status === "completed" || status === "SUCCESS") {
          if (pollRef.current) clearInterval(pollRef.current);
          setPolling(false);
          handleResult(songs);
        } else if (status === "failed" || status === "FAILED") {
          if (pollRef.current) clearInterval(pollRef.current);
          setPolling(false);
          setStatusMsg("❌ Generowanie nie powiodło się");
          toast.error("Suno AI nie mogło wygenerować utworu");
        } else {
          setStatusMsg(`⏳ Generuję... (${Math.floor(attempts * 5)}s)`);
        }
      } catch (err) {
        console.error("[Suno] Poll error:", err);
      }
    }, 5000);
  };

  const handleResult = (data: any) => {
    const songList = Array.isArray(data) ? data : [data];
    const parsed: GeneratedSong[] = songList
      .filter((s: any) => s)
      .map((s: any) => ({
        id: s.id || s.songId || crypto.randomUUID(),
        title: s.title || s.name || title || "AI Generated",
        audioUrl: s.audioUrl || s.audio_url || s.sourceUrl || s.stream_url || "",
        streamUrl: s.streamUrl || s.stream_url || "",
        imageUrl: s.imageUrl || s.image_url || s.coverUrl || "",
        duration: s.duration || 0,
        style: s.style || s.tags || style || "",
      }));

    setSongs(parsed);
    setStatusMsg(parsed.length > 0 ? `✅ Wygenerowano ${parsed.length} utworów!` : "Brak wyników");
    if (parsed.length > 0) toast.success(`🎶 Wygenerowano ${parsed.length} utworów!`);
  };

  const playSong = (song: GeneratedSong) => {
    const url = song.streamUrl || song.audioUrl;
    if (!url) {
      toast.error("Brak linku audio");
      return;
    }

    playTrack({
      id: song.id,
      title: song.title,
      artist: "Suno AI",
      album: "AI Generated",
      duration: song.duration || 180,
      audio_url: url,
      cover_url: song.imageUrl || null,
      genre: song.style || "AI",
      mood: null,
    });
  };

  const saveSongToLibrary = async (song: GeneratedSong) => {
    const url = song.streamUrl || song.audioUrl;
    if (!url) return;

    try {
      const { error } = await supabase.from("tracks").insert({
        title: song.title,
        artist: "Suno AI",
        album: "AI Generated",
        duration: song.duration || 180,
        audio_url: url,
        cover_url: song.imageUrl || null,
        genre: song.style || "AI",
        mood: "generated",
      });

      if (error) throw error;
      toast.success(`"${song.title}" dodano do biblioteki!`);
    } catch (err: any) {
      toast.error("Błąd zapisu: " + err.message);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Wand2 className="h-5 w-5 text-primary" />
            Suno AI — Generuj muzykę
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
            <Label className="text-sm font-medium">Tryb zaawansowany</Label>
            <Switch checked={customMode} onCheckedChange={setCustomMode} />
          </div>

          {/* Prompt */}
          <div>
            <Label className="text-sm mb-1 block">
              {customMode ? "Tekst / Lyrics" : "Opis utworu"}
            </Label>
            <Textarea
              placeholder={customMode
                ? "Wpisz tekst piosenki lub opis..."
                : "Np. Energiczna piosenka elektroniczna z mocnym bassem i wokalem..."
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Custom mode fields */}
          <AnimatePresence>
            {customMode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 overflow-hidden"
              >
                <div>
                  <Label className="text-sm mb-1 block">Tytuł</Label>
                  <Input
                    placeholder="Nazwa utworu"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-sm mb-1 block">Styl muzyczny</Label>
                  <Input
                    placeholder="Np. Pop, Rock, Electronic..."
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {STYLE_PRESETS.map((s) => (
                      <Badge
                        key={s}
                        variant={style === s ? "default" : "outline"}
                        className="cursor-pointer text-xs hover:bg-primary/20 transition-colors"
                        onClick={() => setStyle(s)}
                      >
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Instrumental toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
            <div className="flex items-center gap-2">
              <Guitar className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm">Tylko instrumentalny (bez wokalu)</Label>
            </div>
            <Switch checked={instrumental} onCheckedChange={setInstrumental} />
          </div>

          {/* Generate button */}
          <Button
            onClick={generate}
            disabled={generating || polling}
            className="w-full groove-gradient-bg text-primary-foreground gap-2 h-11"
          >
            {generating || polling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {generating ? "Generuję..." : polling ? "Czekam na wynik..." : "Generuj utwór 🎶"}
          </Button>

          {/* Status */}
          {statusMsg && (
            <p className="text-sm text-center text-muted-foreground">{statusMsg}</p>
          )}

          {/* Results */}
          <AnimatePresence>
            {songs.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Music className="h-4 w-4 text-primary" />
                  Wygenerowane utwory
                </h3>
                {songs.map((song) => (
                  <div
                    key={song.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-secondary/30 transition-colors"
                  >
                    {song.imageUrl ? (
                      <img src={song.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg groove-gradient-bg flex items-center justify-center">
                        <Music className="h-5 w-5 text-primary-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{song.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Suno AI{song.style ? ` • ${song.style}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => playSong(song)}>
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => saveSongToLibrary(song)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
};
