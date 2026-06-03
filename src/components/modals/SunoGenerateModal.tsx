import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Music, Loader2, X, Play, Download, Wand2, Guitar, ImagePlus, Upload, Palette } from "lucide-react";
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

type CoverMode = "auto" | "custom" | "upload";

export const SunoGenerateModal = ({ isOpen, onClose }: SunoGenerateModalProps) => {
  const { playTrack } = usePlayer();
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [style, setStyle] = useState("");
  const [instrumental, setInstrumental] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [duration, setDuration] = useState(15);
  const [generating, setGenerating] = useState(false);
  const [polling, setPolling] = useState(false);
  const [songs, setSongs] = useState<GeneratedSong[]>([]);
  const [statusMsg, setStatusMsg] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [coverMode, setCoverMode] = useState<CoverMode>("auto");
  const [coverDescription, setCoverDescription] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleCoverFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) { toast.error("Wybierz plik graficzny (JPG, PNG, WEBP)"); return; }
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const removeCoverFile = () => {
    if (coverPreview?.startsWith("blob:")) URL.revokeObjectURL(coverPreview);
    setCoverFile(null);
    setCoverPreview(null);
  };

  const uploadCoverToStorage = async (file: File): Promise<string | null> => {
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const safeName = `covers/groua-custom-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("music").upload(safeName, file, { contentType: file.type, upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("music").getPublicUrl(safeName);
      return data.publicUrl;
    } catch { return null; }
  };

  const generateAICover = async (songTitle: string, songStyle: string): Promise<string | null> => {
    try {
      toast.loading("🎨 Generuję okładkę AI...", { id: "ai-cover" });
      const descriptionPart = coverMode === "custom" && coverDescription.trim()
        ? coverDescription.trim()
        : `profesjonalna, kinowa okładka albumu muzycznego dla utworu "${songTitle}" w stylu ${songStyle || "muzycznym"}`;
      const { data, error } = await supabase.functions.invoke("ai-cover-generate", {
        body: { title: songTitle, style: songStyle, description: descriptionPart, mode: coverMode }
      });
      if (error) throw error;
      if (data?.cover_url) { toast.success("🎨 Okładka wygenerowana!", { id: "ai-cover" }); return data.cover_url; }
      toast.dismiss("ai-cover");
      return null;
    } catch { toast.error("Błąd generowania okładki", { id: "ai-cover" }); return null; }
  };

  const generate = async () => {
    if (!prompt.trim() && !customMode) { toast.error("Wpisz opis utworu"); return; }
    setGenerating(true);
    setSongs([]);
    setStatusMsg("🧠 GrouAI Engine (MusicGen) generuje...");
    try {
      const { data, error } = await supabase.functions.invoke("groua-music-engine", {
        body: {
          action: "generate",
          prompt: prompt.trim(),
          duration,
          instrumental,
          title: title || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const predId = data?.id;
      const genId = data?.generation_id;
      if (!predId) throw new Error("Brak prediction_id z silnika");
      setStatusMsg(`⏳ GrouAI Engine pracuje... (~${Math.round(duration * 1.5)}s)`);
      setPolling(true);
      pollResult(predId, genId);
    } catch (err: any) {
      toast.error("Błąd generowania: " + (err.message || "Nieznany błąd"));
      setStatusMsg("");
    } finally { setGenerating(false); }
  };

  const pollResult = (predictionId: string, generationId?: string) => {
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 60) {
        if (pollRef.current) clearInterval(pollRef.current);
        setPolling(false);
        setStatusMsg("⏰ Generowanie trwa dłużej niż oczekiwano. Spróbuj ponownie.");
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke("groua-music-engine", {
          body: { action: "status", prediction_id: predictionId, generation_id: generationId },
        });
        if (error) throw error;
        const status = data?.status;
        if (status === "succeeded") {
          if (pollRef.current) clearInterval(pollRef.current);
          setPolling(false);
          const url = typeof data.output === "string" ? data.output : data.output?.[0];
          if (!url) { setStatusMsg("❌ Brak audio z GrouAI Engine"); return; }
          handleResult([{ id: data.id, title: title || "GrouAI Track", audio_url: url, audioUrl: url, tags: style || "GrouAI", duration }]);
        } else if (status === "failed" || status === "canceled") {
          if (pollRef.current) clearInterval(pollRef.current);
          setPolling(false);
          setStatusMsg("❌ Generowanie nie powiodło się");
          toast.error("GrouAI Engine nie mogło wygenerować utworu");
        } else {
          setStatusMsg(`⏳ Generuję... (${attempts * 3}s)`);
        }
      } catch {}
    }, 3000);
  };

  const handleResult = (data: any) => {
    const songList = Array.isArray(data) ? data : [data];
    const parsed: GeneratedSong[] = songList
      .filter((s: any) => s)
      .map((s: any) => ({
        id: s.id || s.songId || crypto.randomUUID(),
        title: s.title || s.name || title || "AI Generated",
        audioUrl: s.audioUrl || s.audio_url || "",
        streamUrl: s.streamUrl || s.stream_url || "",
        imageUrl: s.imageUrl || s.image_url || "",
        duration: s.duration || 0,
        style: s.tags || s.style || style || "",
      }));
    setSongs(parsed);
    setStatusMsg(parsed.length > 0 ? `✅ Wygenerowano ${parsed.length} utworów!` : "Brak wyników");
    if (parsed.length > 0) toast.success(`🎶 Wygenerowano ${parsed.length} utworów!`);
  };

  const playSong = (song: GeneratedSong) => {
    const url = song.streamUrl || song.audioUrl;
    if (!url) { toast.error("Brak linku audio"); return; }
    playTrack({ id: song.id, title: song.title, artist: "GrouAI Engine", album: "AI Generated", duration: song.duration || 180, audio_url: url, cover_url: song.imageUrl || null, genre: song.style || "AI", mood: null });
  };

  const saveSongToLibrary = async (song: GeneratedSong) => {
    const url = song.streamUrl || song.audioUrl;
    if (!url) return;
    try {
      let finalCoverUrl = song.imageUrl || null;
      if (coverMode === "upload" && coverFile) { const uploaded = await uploadCoverToStorage(coverFile); if (uploaded) finalCoverUrl = uploaded; }
      else if (coverMode === "custom" || coverMode === "auto") { const aiCover = await generateAICover(song.title, song.style || style || ""); if (aiCover) finalCoverUrl = aiCover; }
      const { error } = await supabase.from("tracks").insert({ title: song.title, artist: "GrouAI Engine", album: "AI Generated", duration: song.duration || 180, audio_url: url, cover_url: finalCoverUrl, genre: song.style || "AI", mood: "generated" });
      if (error) throw error;
      toast.success(`"${song.title}" dodano do biblioteki!`);
    } catch (err: any) { toast.error("Błąd zapisu: " + err.message); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Wand2 className="h-5 w-5 text-primary" />
            GrouAI Studio — Generuj muzykę
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
            <Label className="text-sm mb-1 block">{customMode ? "Tekst / Lyrics" : "Opis utworu"}</Label>
            <Textarea
              placeholder={customMode ? "Wpisz tekst piosenki lub opis..." : "Np. Energiczna elektronika z mocnym bassem i syntezatorami..."}
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
                  <Input placeholder="Nazwa utworu" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm mb-1 block">Styl muzyczny</Label>
                  <Input placeholder="Np. Pop, Rock, Electronic..." value={style} onChange={(e) => setStyle(e.target.value)} />
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

          {/* Duration */}
          <div className="p-3 rounded-lg bg-secondary/30 border border-border space-y-2">
            <Label className="text-sm">Długość: {duration}s</Label>
            <input
              type="range"
              min={4}
              max={30}
              step={1}
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          {/* Instrumental toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
            <div className="flex items-center gap-2">
              <Guitar className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm">Tylko instrumentalny (bez wokalu)</Label>
            </div>
            <Switch checked={instrumental} onCheckedChange={setInstrumental} />
          </div>

          {/* Cover Art */}
          <div className="p-3 rounded-lg bg-secondary/30 border border-border space-y-3">
            <div className="flex items-center gap-2">
              <ImagePlus className="h-4 w-4 text-primary" />
              <Label className="text-sm font-medium">Okładka utworu</Label>
            </div>
            <div className="flex gap-1.5">
              <Badge variant={coverMode === "auto" ? "default" : "outline"} className="cursor-pointer text-xs hover:bg-primary/20 transition-colors" onClick={() => setCoverMode("auto")}>🤖 Auto AI</Badge>
              <Badge variant={coverMode === "custom" ? "default" : "outline"} className="cursor-pointer text-xs hover:bg-primary/20 transition-colors" onClick={() => setCoverMode("custom")}><Palette className="h-3 w-3 mr-1" /> Opisz AI</Badge>
              <Badge variant={coverMode === "upload" ? "default" : "outline"} className="cursor-pointer text-xs hover:bg-primary/20 transition-colors" onClick={() => setCoverMode("upload")}><Upload className="h-3 w-3 mr-1" /> Własna</Badge>
            </div>
            {coverMode === "auto" && <p className="text-[11px] text-muted-foreground">AI automatycznie wygeneruje profesjonalną okładkę dopasowaną do tytułu i stylu.</p>}
            {coverMode === "custom" && (
              <div>
                <Textarea placeholder="Opisz jak ma wyglądać okładka..." value={coverDescription} onChange={(e) => setCoverDescription(e.target.value)} rows={2} className="resize-none text-sm" />
                <p className="text-[10px] text-muted-foreground mt-1">Opisz styl, kolory, scenę — AI wygeneruje okładkę na podstawie Twojego opisu.</p>
              </div>
            )}
            {coverMode === "upload" && (
              <div>
                <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverFile} />
                {coverPreview ? (
                  <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-border">
                    <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
                    <button onClick={removeCoverFile} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center">
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => coverInputRef.current?.click()}>
                    <Upload className="h-3.5 w-3.5" /> Wybierz grafikę
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Generate button */}
          <Button onClick={generate} disabled={generating || polling} className="w-full groove-gradient-bg text-primary-foreground gap-2 h-11">
            {generating || polling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? "Generuję..." : polling ? "Czekam na wynik..." : "Generuj utwór 🎶"}
          </Button>

          {/* Status */}
          {statusMsg && <p className="text-sm text-center text-muted-foreground">{statusMsg}</p>}

          {/* Results */}
          <AnimatePresence>
            {songs.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Music className="h-4 w-4 text-primary" /> Wygenerowane utwory
                </h3>
                {songs.map((song) => (
                  <div key={song.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-secondary/30 transition-colors">
                    {song.imageUrl ? (
                      <img src={song.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg groove-gradient-bg flex items-center justify-center">
                        <Music className="h-5 w-5 text-primary-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{song.title}</p>
                      <p className="text-xs text-muted-foreground">GrouAI Engine{song.style ? ` • ${song.style}` : ""}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => playSong(song)}><Play className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => saveSongToLibrary(song)}><Download className="h-4 w-4" /></Button>
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
