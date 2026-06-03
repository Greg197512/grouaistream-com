import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Music, Loader2, Play, Download, Wand2, Guitar, ImagePlus, Upload, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/contexts/PlayerContext";
import { toast } from "sonner";

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

export const SunoGeneratePanel = () => {
  const { playTrack } = usePlayer();
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [style, setStyle] = useState("");
  const [instrumental, setInstrumental] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [duration, setDuration] = useState(15);
  const [useFingerprint, setUseFingerprint] = useState(true);
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
      if (!file.type.startsWith("image/")) { toast.error("Wybierz plik graficzny"); return; }
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
      const desc = coverMode === "custom" && coverDescription.trim()
        ? coverDescription.trim()
        : `profesjonalna okładka albumu dla "${songTitle}" w stylu ${songStyle || "muzycznym"}`;
      const { data, error } = await supabase.functions.invoke("ai-cover-generate", {
        body: { title: songTitle, style: songStyle, description: desc, mode: coverMode }
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
          use_fingerprint: useFingerprint,
          title: title || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const predId = data?.id;
      const genId = data?.generation_id;
      if (!predId) throw new Error("Brak prediction_id z silnika");
      if (data?.fingerprint_applied) {
        const fp = data.fingerprint_summary;
        setStatusMsg(`🧠 GrouAI Engine + Twój fingerprint (${fp?.genre || "—"}, ${fp?.bpm || "—"} BPM)...`);
      } else {
        setStatusMsg(`⏳ GrouAI Engine pracuje... (~${Math.round(duration * 1.5)}s)`);
      }
      setPolling(true);
      pollResult(predId, genId);
    } catch (err: any) {
      toast.error("GrouAI Engine: " + (err.message || "błąd"));
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
        setStatusMsg("⏰ Timeout GrouAI Engine");
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
          handleResult([{
            id: data.id,
            title: title || "GrouAI Track",
            audio_url: url,
            audioUrl: url,
            tags: style || "GrouAI",
            duration,
          }]);
        } else if (status === "failed" || status === "canceled") {
          if (pollRef.current) clearInterval(pollRef.current);
          setPolling(false);
          setStatusMsg("❌ GrouAI Engine: " + (data?.error || "nie powiodło się"));
        } else {
          setStatusMsg(`⏳ GrouAI Engine: ${status}... (${attempts * 3}s)`);
        }
      } catch {}
    }, 3000);
  };

  const handleResult = (data: any) => {
    const songList = Array.isArray(data) ? data : [data];
    const parsed: GeneratedSong[] = songList.filter(Boolean).map((s: any) => ({
      id: s.id || s.songId || crypto.randomUUID(),
      title: s.title || s.name || title || "AI Generated",
      audioUrl: s.audioUrl || s.audio_url || "",
      streamUrl: s.streamUrl || "",
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
    <div className="space-y-5">
      {/* Engine info + controls */}
      <div className="p-4 rounded-xl border border-[#9333EA]/30 bg-gradient-to-br from-[#1a1a2e]/80 to-[#0f0f1e]/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#9333EA]" />
            <span className="text-sm font-semibold text-white">GrouAI Engine</span>
            <Badge className="text-[10px] px-1.5 py-0 bg-purple-500/20 text-purple-400 border-0">MusicGen</Badge>
          </div>
          <span className="text-[11px] text-gray-400">{duration}s · stereo</span>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-400">Długość: {duration}s</Label>
          <input
            type="range"
            min={4}
            max={30}
            step={1}
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value))}
            className="w-full accent-[#9333EA]"
          />
        </div>
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#9333EA]/5 border border-[#9333EA]/20">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-[#9333EA]" />
            <div>
              <Label className="text-xs text-gray-200 cursor-pointer">Brzmiej jak ja</Label>
              <p className="text-[10px] text-gray-500">AI doda Twój BPM, gatunek i mood do promptu</p>
            </div>
          </div>
          <Switch
            checked={useFingerprint}
            onCheckedChange={setUseFingerprint}
            className="data-[state=checked]:bg-[#9333EA]"
          />
        </div>
      </div>

      {/* Advanced mode toggle */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-[#FF6B00]/20 bg-[#1a1a2e]/60">
        <Label className="text-sm text-gray-200">Tryb zaawansowany (tytuł + styl)</Label>
        <Switch checked={customMode} onCheckedChange={setCustomMode} className="data-[state=checked]:bg-[#FF6B00]" />
      </div>

      {/* Prompt */}
      <div className="space-y-2">
        <Label className="text-sm text-gray-300">{customMode ? "Tekst / Lyrics" : "Opis utworu"}</Label>
        <Textarea
          placeholder={customMode ? "Wpisz tekst piosenki lub opis..." : "Np. Energiczna elektronika z mocnym bassem i syntezatorami..."}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          className="bg-[#1a1a2e] border-[#FF6B00]/20 text-white placeholder:text-gray-500 focus:border-[#FF6B00] resize-none"
        />
      </div>

      {/* Custom mode fields */}
      <AnimatePresence>
        {customMode && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-4 overflow-hidden">
            <div className="space-y-2">
              <Label className="text-sm text-gray-300">Tytuł</Label>
              <Input placeholder="Nazwa utworu" value={title} onChange={(e) => setTitle(e.target.value)}
                className="bg-[#1a1a2e] border-[#FF6B00]/20 text-white placeholder:text-gray-500 focus:border-[#FF6B00]" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-gray-300">Styl muzyczny</Label>
              <Input placeholder="Np. Pop, Rock, Electronic..." value={style} onChange={(e) => setStyle(e.target.value)}
                className="bg-[#1a1a2e] border-[#FF6B00]/20 text-white placeholder:text-gray-500 focus:border-[#FF6B00]" />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {STYLE_PRESETS.map((s) => (
                  <Badge key={s}
                    className={`cursor-pointer text-xs px-3 py-1.5 transition-all ${style === s ? "text-white border-transparent" : "bg-transparent border-[#9333EA]/20 text-gray-400 hover:border-[#9333EA]/50"}`}
                    style={style === s ? { background: "linear-gradient(135deg, #9333EA, #FF6B00)" } : undefined}
                    onClick={() => setStyle(s)}>{s}</Badge>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instrumental toggle */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-[#FF6B00]/20 bg-[#1a1a2e]/60">
        <div className="flex items-center gap-3">
          <Guitar className="h-5 w-5 text-[#FF9500]" />
          <Label className="text-sm text-gray-200">Tylko instrumentalny (bez wokalu)</Label>
        </div>
        <Switch checked={instrumental} onCheckedChange={setInstrumental} className="data-[state=checked]:bg-[#FF6B00]" />
      </div>

      {/* Cover Art */}
      <div className="p-4 rounded-xl border border-[#9333EA]/20 bg-[#1a1a2e]/60 space-y-3">
        <div className="flex items-center gap-2">
          <ImagePlus className="h-4 w-4 text-[#FF9500]" />
          <Label className="text-sm font-medium text-gray-200">Okładka utworu</Label>
        </div>
        <div className="flex gap-2">
          {(["auto", "custom", "upload"] as CoverMode[]).map((mode) => (
            <Badge key={mode}
              className={`cursor-pointer text-xs px-3 py-1.5 transition-all ${coverMode === mode ? "text-white border-transparent" : "bg-transparent border-[#FF6B00]/20 text-gray-400 hover:border-[#FF6B00]/50"}`}
              style={coverMode === mode ? { background: "linear-gradient(135deg, #FF6B00, #9333EA)" } : undefined}
              onClick={() => setCoverMode(mode)}>
              {mode === "auto" ? "🤖 Auto AI" : mode === "custom" ? "🎨 Opisz AI" : "📁 Własna"}
            </Badge>
          ))}
        </div>
        {coverMode === "auto" && <p className="text-xs text-gray-500">AI automatycznie wygeneruje okładkę dopasowaną do tytułu i stylu.</p>}
        {coverMode === "custom" && (
          <Textarea placeholder="Opisz jak ma wyglądać okładka..." value={coverDescription} onChange={(e) => setCoverDescription(e.target.value)} rows={2}
            className="bg-[#1a1a2e] border-[#FF6B00]/20 text-white placeholder:text-gray-500 resize-none text-sm" />
        )}
        {coverMode === "upload" && (
          <div>
            <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverFile} />
            {coverPreview ? (
              <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-[#FF6B00]/30">
                <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
                <button onClick={removeCoverFile} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center">
                  <X className="h-3 w-3 text-white" />
                </button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="gap-2 border-[#FF6B00]/30 text-gray-300 hover:text-white" onClick={() => coverInputRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" /> Wybierz grafikę
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Generate button */}
      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
        <Button
          onClick={generate}
          disabled={generating || polling}
          className="w-full h-14 text-lg font-bold text-white border-0 gap-3"
          style={{
            background: generating || polling ? "#333" : "linear-gradient(135deg, #9333EA, #FF6B00)",
            boxShadow: generating || polling ? "none" : "0 0 30px #9333EA40, 0 4px 20px #FF6B0030",
          }}
        >
          {generating || polling ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wand2 className="h-5 w-5" />}
          {generating ? "Generuję..." : polling ? "Czekam na wynik..." : "⚡ Generuj z GrouAI Engine"}
          {!generating && !polling && <Sparkles className="h-5 w-5" />}
        </Button>
      </motion.div>

      {/* Status */}
      {statusMsg && <p className="text-sm text-center text-gray-400">{statusMsg}</p>}

      {/* Results */}
      <AnimatePresence>
        {songs.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <h3 className="font-bold text-sm flex items-center gap-2 text-white">
              <Music className="h-4 w-4 text-[#FF9500]" /> Wygenerowane utwory
            </h3>
            {songs.map((song) => (
              <motion.div
                key={song.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 p-4 rounded-xl border border-[#9333EA]/20 bg-[#1a1a2e]/80 hover:border-[#9333EA]/40 transition-colors"
              >
                {song.imageUrl ? (
                  <img src={song.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #9333EA, #FF6B00)" }}>
                    <Music className="h-6 w-6 text-white" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{song.title}</p>
                  <p className="text-xs text-gray-400">GrouAI Engine{song.style ? ` • ${song.style}` : ""}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="ghost" className="h-10 w-10 text-[#9333EA] hover:bg-[#9333EA]/20" onClick={() => playSong(song)}>
                    <Play className="h-5 w-5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-10 w-10 text-[#FF9500] hover:bg-[#FF6B00]/20" onClick={() => saveSongToLibrary(song)}>
                    <Download className="h-5 w-5" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
