import { useState, useRef, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Music, Guitar, Waves, Plus, Blend, Disc3 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { motion, AnimatePresence } from "framer-motion";
import { TrackMixer } from "@/components/studio/TrackMixer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { WaveformPlayer } from "@/components/studio/WaveformPlayer";
import { NeonWavesLoader } from "@/components/studio/NeonWavesLoader";
import { GenerationHistory } from "@/components/studio/GenerationHistory";
import { LyricsDisplay, generateLyrics } from "@/components/studio/LyricsDisplay";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { generateMusic, extendTrack, type GeneratedTrack } from "@/utils/musicGenerator";

const GENRES = [
  "Pop", "Rock", "Electronic", "Hip-Hop", "Jazz", "Classical",
  "R&B", "Country", "Reggae", "Metal", "Indie", "Lo-fi",
  "Ambient", "Trap", "House", "Disco",
];

const Suno = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"generate" | "mix">("generate");
  const [genre, setGenre] = useState("Pop");
  const [genre2, setGenre2] = useState<string | null>(null);
  const [blendRatio, setBlendRatio] = useState(50);
  const [title, setTitle] = useState("");
  const [instrumental, setInstrumental] = useState(false);
  const [useSamples, setUseSamples] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [extending, setExtending] = useState(false);
  const [result, setResult] = useState<{ audioUrl: string; title: string; genre: string; generationId?: string; durationSeconds: number; lastTrack?: GeneratedTrack; lyrics: { time: number; text: string }[] } | null>(null);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Track playback time for lyrics sync
  useEffect(() => {
    if (!result?.audioUrl) return;
    const audio = new Audio(result.audioUrl);
    audioRef.current = audio;
    
    const onTimeUpdate = () => setPlaybackTime(audio.currentTime);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => { setIsPlaying(false); setPlaybackTime(0); };
    
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.pause();
    };
  }, [result?.audioUrl]);

  const generate = async () => {
    setGenerating(true);
    setResult(null);

    try {
      const track = await generateMusic({
        style: genre,
        style2: genre2 || undefined,
        blendRatio: genre2 ? blendRatio / 100 : undefined,
        durationSeconds: 30,
        instrumental,
        title: title.trim() || undefined,
        useSamples,
      });

      const genreName = genre2 ? `${genre} × ${genre2}` : genre;
      const lyrics = generateLyrics(genreName, track.title, 30, instrumental);

      let generationId: string | undefined;
      if (user) {
        const { data: gen } = await supabase.from("generations").insert({
          user_id: user.id,
          title: track.title,
          genre: genreName,
          prompt: `30-second ${genreName} track${instrumental ? ", instrumental only" : ""}${useSamples ? " + CC Mixter samples" : ""}`,
          instrumental,
          status: "completed",
          audio_url: track.audioUrl,
        }).select().single();
        generationId = gen?.id;
      }

      setResult({
        audioUrl: track.audioUrl,
        title: track.title,
        genre: genreName,
        generationId,
        durationSeconds: 30,
        lastTrack: track,
        lyrics,
      });
      toast.success(`🎶 Wygenerowano "${track.title}"!`);
    } catch (err: any) {
      console.error("Generate error:", err);
      setErrorModal(err.message || "Nieznany błąd generowania");
    } finally {
      setGenerating(false);
    }
  };

  const handleExtend = async () => {
    if (!result?.lastTrack) return;
    setExtending(true);
    try {
      const extended = await extendTrack(result.lastTrack, 30);
      const newDuration = result.durationSeconds + 30;

      // Update generation record
      if (user && result.generationId) {
        await supabase.from("generations").update({
          audio_url: extended.audioUrl,
        }).eq("id", result.generationId);
      }

      const newLyrics = generateLyrics(result.genre, result.title, newDuration, instrumental);
      setResult(prev => prev ? {
        ...prev,
        audioUrl: extended.audioUrl,
        durationSeconds: newDuration,
        lastTrack: extended,
        lyrics: newLyrics,
      } : null);
      toast.success(`🎶 Przedłużono do ${newDuration}s!`);
    } catch (err: any) {
      toast.error("Błąd przedłużania: " + err.message);
    } finally {
      setExtending(false);
    }
  };

  const saveToLibrary = async () => {
    if (!result) return;
    try {
      const { error } = await supabase.from("tracks").insert({
        title: result.title,
        artist: "GrouAI Studio",
        album: "AI Generated",
        duration: result.durationSeconds,
        audio_url: result.audioUrl,
        genre: result.genre,
        mood: "generated",
      });
      if (error) throw error;
      toast.success("Utwór zapisany w Twojej bibliotece! 📀");
    } catch (err: any) {
      toast.error("Błąd zapisu: " + err.message);
    }
  };

  return (
    <MainLayout>
      <div className="min-h-screen" style={{ background: "#0F0F1A" }}>
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-4"
          >
            <div className="mx-auto w-24 h-24 rounded-2xl flex items-center justify-center relative"
              style={{
                background: "linear-gradient(135deg, #FF6B00, #FF9500, #9333EA)",
                boxShadow: "0 0 40px #FF6B0060, 0 0 80px #9333EA30",
              }}
            >
              <Waves className="h-12 w-12 text-white" />
              <motion.div
                className="absolute inset-0 rounded-2xl"
                style={{ border: "2px solid #FF6B0080" }}
                animate={{ scale: [1, 1.08, 1], opacity: [0.6, 0.2, 0.6] }}
                transition={{ duration: 2.5, repeat: Infinity }}
              />
            </div>
            <h1 className="text-3xl font-bold text-white">GrouAI Studio</h1>
            <p className="text-sm text-gray-400 max-w-md mx-auto leading-relaxed">
              Twórz unikalne utwory muzyczne algorytmicznie. Wybierz styl, ustaw długość i wygeneruj muzykę bezpośrednio w przeglądarce — bez zewnętrznych API, za darmo!
            </p>
          </motion.div>

          {/* Tabs */}
          <div className="flex gap-2 p-1 rounded-xl bg-[#1a1a2e]/80 border border-[#FF6B00]/10">
            <button
              onClick={() => setActiveTab("generate")}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                activeTab === "generate"
                  ? "text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
              style={activeTab === "generate" ? { background: "linear-gradient(135deg, #FF6B00, #FF9500)", boxShadow: "0 0 15px #FF6B0040" } : undefined}
            >
              <Sparkles className="h-4 w-4" /> Generator
            </button>
            <button
              onClick={() => setActiveTab("mix")}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                activeTab === "mix"
                  ? "text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
              style={activeTab === "mix" ? { background: "linear-gradient(135deg, #9333EA, #FF6B00)", boxShadow: "0 0 15px #9333EA40" } : undefined}
            >
              <Blend className="h-4 w-4" /> Track Mix
            </button>
          </div>

          {activeTab === "mix" ? (
            <TrackMixer />
          ) : (
          <>

          {/* Genre Selection */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-2">
            <Label className="text-sm text-gray-300">Styl muzyczny</Label>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => (
                <Badge
                  key={g}
                  className={`cursor-pointer text-xs px-3 py-1.5 transition-all ${
                    genre === g
                      ? "text-white border-transparent"
                      : "bg-transparent border-[#FF6B00]/20 text-gray-400 hover:border-[#FF6B00]/50 hover:text-gray-200"
                  }`}
                  style={genre === g ? {
                    background: "linear-gradient(135deg, #FF6B00, #FF9500)",
                    boxShadow: "0 0 12px #FF6B0050",
                  } : undefined}
                  onClick={() => setGenre(g)}
                >
                  {g}
                </Badge>
              ))}
            </div>
          </motion.div>

          {/* Genre Blend */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-gray-300 flex items-center gap-2">
                <Blend className="h-4 w-4 text-[#FF9500]" />
                Łączenie gatunków
              </Label>
              {genre2 && (
                <button onClick={() => setGenre2(null)} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                  Wyłącz ✕
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {GENRES.filter(g => g !== genre).map((g) => (
                <Badge
                  key={g}
                  className={`cursor-pointer text-xs px-3 py-1.5 transition-all ${
                    genre2 === g
                      ? "text-white border-transparent"
                      : "bg-transparent border-[#9333EA]/20 text-gray-500 hover:border-[#9333EA]/50 hover:text-gray-300"
                  }`}
                  style={genre2 === g ? {
                    background: "linear-gradient(135deg, #9333EA, #FF6B00)",
                    boxShadow: "0 0 12px #9333EA50",
                  } : undefined}
                  onClick={() => setGenre2(genre2 === g ? null : g)}
                >
                  {g}
                </Badge>
              ))}
            </div>
            <AnimatePresence>
              {genre2 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{genre}</span>
                    <span>Mix: {blendRatio}%</span>
                    <span>{genre2}</span>
                  </div>
                  <Slider
                    value={[blendRatio]}
                    onValueChange={([v]) => setBlendRatio(v)}
                    min={10}
                    max={90}
                    step={5}
                    className="w-full"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Title Input */}
          <div className="space-y-2">
            <Label className="text-sm text-gray-300">Tytuł (opcjonalnie)</Label>
            <Input
              placeholder="Nazwa utworu"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-[#1a1a2e] border-[#FF6B00]/20 text-white placeholder:text-gray-500 focus:border-[#FF6B00] focus:ring-[#FF6B00]/30"
            />
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label className="text-sm text-gray-300">Długość: 30s</Label>
            <div className="h-2 rounded-full bg-[#1a1a2e] relative overflow-hidden">
              <div className="h-full rounded-full" style={{ width: "100%", background: "linear-gradient(90deg, #FF6B00, #FF9500)", boxShadow: "0 0 8px #FF6B0060" }} />
            </div>
            <p className="text-xs text-gray-500">Stała długość 30 sekund (możesz przedłużyć po wygenerowaniu)</p>
          </div>

          {/* Instrumental Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-[#FF6B00]/20 bg-[#1a1a2e]/60">
            <div className="flex items-center gap-3">
              <Guitar className="h-5 w-5 text-[#FF9500]" />
              <Label className="text-sm text-gray-200">Tylko instrumentalny</Label>
            </div>
            <Switch checked={instrumental} onCheckedChange={setInstrumental} className="data-[state=checked]:bg-[#FF6B00]" />
          </div>

          {/* CC Mixter Samples Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-[#FF6B00]/20 bg-[#1a1a2e]/60">
            <div className="flex items-center gap-3">
              <Disc3 className="h-5 w-5 text-[#FF9500]" />
              <div>
                <Label className="text-sm text-gray-200">Sample z CC Mixter</Label>
                <p className="text-xs text-gray-500">Wzbogaca brzmienie prawdziwymi loopami CC</p>
              </div>
            </div>
            <Switch checked={useSamples} onCheckedChange={setUseSamples} className="data-[state=checked]:bg-[#FF6B00]" />
          </div>

          {/* Generate Button */}
          <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={generate}
              disabled={generating}
              className="w-full h-14 text-lg font-bold text-white border-0 gap-3"
              style={{
                background: generating ? "#333" : "linear-gradient(135deg, #FF6B00, #FF9500)",
                boxShadow: generating ? "none" : "0 0 30px #FF6B0040, 0 4px 20px #FF6B0030",
              }}
            >
              {!generating && <Sparkles className="h-5 w-5" />}
              {generating ? "Generuję..." : "✨ Generuj utwór ♪"}
              {!generating && <Music className="h-5 w-5" />}
            </Button>
          </motion.div>

          {!user && (
            <p className="text-center text-xs text-gray-500">
              <a href="/auth" className="text-[#FF9500] underline">Zaloguj się</a>, aby zapisywać utwory do biblioteki
            </p>
          )}

          {/* Loading Animation */}
          <AnimatePresence>
            {generating && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <NeonWavesLoader />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Result with enhanced animation */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 40, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="relative p-5 rounded-2xl border border-[#FF6B00]/30 bg-[#1a1a2e]/80 backdrop-blur-sm space-y-4 overflow-hidden"
                style={{ boxShadow: "0 0 40px #FF6B0020, 0 8px 32px rgba(0,0,0,0.4)" }}
              >
                {/* Animated glow behind card */}
                <motion.div
                  className="absolute -top-20 -right-20 w-40 h-40 rounded-full"
                  style={{ background: "radial-gradient(circle, #FF6B0030, transparent 70%)" }}
                  animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />

                <motion.div
                  className="flex items-center gap-3 relative z-10"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <motion.div
                    className="w-14 h-14 rounded-xl flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #FF6B00, #FF9500)" }}
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                  >
                    <Music className="h-7 w-7 text-white" />
                  </motion.div>
                  <div className="flex-1">
                    <motion.p
                      className="font-bold text-white text-lg"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.25 }}
                    >
                      {result.title}
                    </motion.p>
                    <p className="text-xs text-[#FF9500]/70">GrouAI Studio • {result.genre} • {result.durationSeconds}s</p>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="relative z-10"
                >
                  <WaveformPlayer
                    audioUrl={result.audioUrl}
                    title={result.title}
                    genre={result.genre}
                    onSaveToLibrary={saveToLibrary}
                  />
                </motion.div>

                {/* Lyrics Display */}
                {result.lyrics.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="relative z-10"
                  >
                    <LyricsDisplay
                      lyrics={result.lyrics}
                      currentTime={playbackTime}
                      isPlaying={isPlaying}
                      totalDuration={result.durationSeconds}
                    />
                  </motion.div>
                )}

                {/* Extend button */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                  className="relative z-10"
                >
                  <Button
                    onClick={handleExtend}
                    disabled={extending}
                    variant="outline"
                    className="w-full gap-2 border-[#FF6B00]/30 text-[#FF9500] hover:bg-[#FF6B00]/10 hover:text-white"
                  >
                    <Plus className="h-4 w-4" />
                    {extending ? "Przedłużam..." : `Przedłuż o 30s (obecny: ${result.durationSeconds}s)`}
                  </Button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Generation History */}
          <GenerationHistory />
          </>
          )}
        </div>
      </div>

      {/* Error Modal */}
      <Dialog open={!!errorModal} onOpenChange={() => setErrorModal(null)}>
        <DialogContent className="bg-[#1a1a2e] border-[#FF6B00]/30 text-white">
          <DialogHeader>
            <DialogTitle className="text-[#FF9500]">Błąd generowania</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-300">{errorModal}</p>
          <p className="text-xs text-gray-500">Spróbuj ponownie za chwilę — serwer jest zajęty</p>
          <Button
            onClick={() => { setErrorModal(null); generate(); }}
            className="w-full text-white"
            style={{ background: "linear-gradient(135deg, #FF6B00, #FF9500)" }}
          >
            Spróbuj jeszcze raz
          </Button>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Suno;
