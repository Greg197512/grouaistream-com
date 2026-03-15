import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Music, Guitar, Waves } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { WaveformPlayer } from "@/components/studio/WaveformPlayer";
import { NeonWavesLoader } from "@/components/studio/NeonWavesLoader";
import { GenerationHistory } from "@/components/studio/GenerationHistory";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const GENRES = [
  "Pop", "Rock", "Electronic", "Hip-Hop", "Jazz", "Classical",
  "R&B", "Country", "Reggae", "Metal", "Indie", "Lo-fi",
  "Ambient", "Trap", "House", "Disco",
];

const Suno = () => {
  const { user } = useAuth();
  const [genre, setGenre] = useState("Pop");
  const [title, setTitle] = useState("");
  const [instrumental, setInstrumental] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ audioUrl: string; title: string; genre: string; generationId: string } | null>(null);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  const buildPrompt = () => {
    let prompt = `30-second ${genre} track`;
    if (title.trim()) prompt += `, "${title.trim()}"`;
    if (instrumental) prompt += ", instrumental only";
    prompt += ", high quality, professional mix";
    return prompt;
  };

  const generate = async () => {
    if (!user) {
      toast.error("Zaloguj się, aby generować muzykę");
      return;
    }

    setGenerating(true);
    setResult(null);

    try {
      const customApiKey = localStorage.getItem("replicate_api_key") || undefined;
      const prompt = buildPrompt();

      const { data, error } = await supabase.functions.invoke("replicate-music", {
        body: {
          prompt,
          title: title.trim() || `${genre} Track`,
          genre,
          instrumental,
          customApiKey,
        },
      });

      if (error) throw error;
      if (data?.error) {
        setErrorModal(data.error);
        return;
      }

      setResult({
        audioUrl: data.audioUrl,
        title: data.title,
        genre: data.genre,
        generationId: data.generationId,
      });
      toast.success(`🎶 Wygenerowano "${data.title}"!`);
    } catch (err: any) {
      console.error("Generate error:", err);
      setErrorModal(err.message || "Nieznany błąd generowania");
    } finally {
      setGenerating(false);
    }
  };

  const saveToLibrary = async () => {
    if (!result || !user) return;
    try {
      const { error } = await supabase.from("tracks").insert({
        title: result.title,
        artist: "GrouAI Studio",
        album: "AI Generated",
        duration: 30,
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
          {/* Header / Logo */}
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
              {/* Animated glow ring */}
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

          {/* Duration (locked) */}
          <div className="space-y-2">
            <Label className="text-sm text-gray-300">Długość: 30s</Label>
            <div className="h-2 rounded-full bg-[#1a1a2e] relative overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: "100%",
                  background: "linear-gradient(90deg, #FF6B00, #FF9500)",
                  boxShadow: "0 0 8px #FF6B0060",
                }}
              />
            </div>
            <p className="text-xs text-gray-500">Stała długość 30 sekund</p>
          </div>

          {/* Instrumental Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-[#FF6B00]/20 bg-[#1a1a2e]/60">
            <div className="flex items-center gap-3">
              <Guitar className="h-5 w-5 text-[#FF9500]" />
              <Label className="text-sm text-gray-200">Tylko instrumentalny</Label>
            </div>
            <Switch
              checked={instrumental}
              onCheckedChange={setInstrumental}
              className="data-[state=checked]:bg-[#FF6B00]"
            />
          </div>

          {/* Generate Button */}
          <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={generate}
              disabled={generating || !user}
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
              <a href="/auth" className="text-[#FF9500] underline">Zaloguj się</a>, aby generować muzykę
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

          {/* Result */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-2xl border border-[#FF6B00]/30 bg-[#1a1a2e]/80 backdrop-blur-sm space-y-4"
                style={{ boxShadow: "0 0 30px #FF6B0015" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #FF6B00, #FF9500)" }}
                  >
                    <Music className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-white">{result.title}</p>
                    <p className="text-xs text-[#FF9500]/70">GrouAI Studio • {result.genre} • 30s</p>
                  </div>
                </div>
                <WaveformPlayer
                  audioUrl={result.audioUrl}
                  title={result.title}
                  genre={result.genre}
                  onSaveToLibrary={saveToLibrary}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Generation History */}
          <GenerationHistory />
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
