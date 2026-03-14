import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Music, Loader2, Play, Download, Guitar, Waves } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { usePlayer } from "@/contexts/PlayerContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateMusic, type GeneratedTrack } from "@/utils/musicGenerator";

interface MusicGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STYLE_PRESETS = [
  "Pop", "Rock", "Hip-Hop", "Electronic", "Jazz", "Classical",
  "R&B", "Country", "Reggae", "Metal", "Indie", "Lo-fi",
  "Ambient", "Trap", "House", "Disco",
];

export const MusicGenerateModal = ({ isOpen, onClose }: MusicGenerateModalProps) => {
  const { playTrack } = usePlayer();
  const [title, setTitle] = useState("");
  const [style, setStyle] = useState("Pop");
  const [instrumental, setInstrumental] = useState(false);
  const [duration, setDuration] = useState(30);
  const [generating, setGenerating] = useState(false);
  const [songs, setSongs] = useState<GeneratedTrack[]>([]);

  const generate = async () => {
    setGenerating(true);
    setSongs([]);
    try {
      const track = await generateMusic({
        style,
        durationSeconds: duration,
        instrumental,
        title: title.trim() || undefined,
      });
      setSongs([track]);
      toast.success(`🎶 Wygenerowano "${track.title}"!`);
    } catch (err: any) {
      console.error("Generate error:", err);
      toast.error("Błąd generowania: " + (err.message || "Nieznany"));
    } finally {
      setGenerating(false);
    }
  };

  const playSong = (song: GeneratedTrack) => {
    playTrack({
      id: song.id,
      title: song.title,
      artist: "AI Generator",
      album: "AI Generated",
      duration: song.duration,
      audio_url: song.audioUrl,
      cover_url: null,
      genre: song.style,
      mood: null,
    });
  };

  const saveSongToLibrary = async (song: GeneratedTrack) => {
    try {
      const { error } = await supabase.from("tracks").insert({
        title: song.title,
        artist: "GrouAI Generator",
        album: "AI Generated",
        duration: song.duration,
        audio_url: song.audioUrl,
        genre: song.style,
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
            <Waves className="h-5 w-5 text-primary" />
            AI Music Generator
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <Label className="text-sm mb-1 block">Tytuł (opcjonalnie)</Label>
            <Input
              placeholder="Nazwa utworu"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Style */}
          <div>
            <Label className="text-sm mb-1 block">Styl muzyczny</Label>
            <div className="flex flex-wrap gap-1.5">
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

          {/* Duration */}
          <div>
            <Label className="text-sm mb-1 block">Długość: {duration}s</Label>
            <Slider
              value={[duration]}
              onValueChange={([v]) => setDuration(v)}
              min={10}
              max={120}
              step={5}
            />
          </div>

          {/* Instrumental toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
            <div className="flex items-center gap-2">
              <Guitar className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm">Tylko instrumentalny</Label>
            </div>
            <Switch checked={instrumental} onCheckedChange={setInstrumental} />
          </div>

          {/* Generate button */}
          <Button
            onClick={generate}
            disabled={generating}
            className="w-full groove-gradient-bg text-primary-foreground gap-2 h-11"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {generating ? "Generuję..." : "Generuj utwór 🎶"}
          </Button>

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
                    <div className="w-12 h-12 rounded-lg groove-gradient-bg flex items-center justify-center">
                      <Music className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{song.title}</p>
                      <p className="text-xs text-muted-foreground">
                        AI Generator • {song.style} • {song.duration}s
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
