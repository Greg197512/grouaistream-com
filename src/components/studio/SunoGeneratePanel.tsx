import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Music, Music2, Loader2, Play, Download, Wand2, Guitar, ImagePlus, Upload, X, Zap, Mic2, FileText, Save, Gauge, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { invokeStudioEngine, fireCoverGeneration, isSubscriptionError, downloadAudio } from "@/lib/hubStudio";
import { masterAudioToWav } from "@/lib/aiMastering";
import { audioToMidiDownload } from "@/lib/audioToMidi";
import { UpgradeModal } from "@/components/modals/UpgradeModal";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
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

// Polskie gatunki — dedykowane, jednym klikiem (przewaga nad Suno).
const PL_GENRES = [
  "Disco Polo", "Rap uliczny", "Rock'n'roll PL", "Metal PL",
  "Folk", "Poezja śpiewana", "Dance/Eurodance", "Muzyka filmowa",
];

// Sekcje struktury — klik wstawia znacznik do tekstu (ACE śpiewa wg struktury).
const STRUCTURE_TAGS = [
  "[Intro]", "[Zwrotka 1]", "[Pre-refren]", "[Refren]",
  "[Zwrotka 2]", "[Bridge]", "[Solo]", "[Outro]",
];

// Wybuch cząsteczek przy udanej generacji („drop").
const BURST_ICONS = ["🎵", "🎶", "✨", "🔥", "💫", "🎧"];
const MusicBurst = () => (
  <div className="pointer-events-none fixed inset-0 z-[120] flex items-center justify-center">
    {Array.from({ length: 18 }).map((_, i) => {
      const angle = (i / 18) * Math.PI * 2;
      const dist = 120 + Math.random() * 160;
      return (
        <motion.span
          key={i}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0.5 }}
          animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, opacity: 0, scale: 1.4, rotate: (Math.random() - 0.5) * 220 }}
          transition={{ duration: 1.1 + Math.random() * 0.5, ease: "easeOut" }}
          className="absolute text-2xl"
        >
          {BURST_ICONS[i % BURST_ICONS.length]}
        </motion.span>
      );
    })}
  </div>
);

type CoverMode = "auto" | "custom" | "upload";

type Engine = "suno" | "acestep" | "musicgen";

export const SunoGeneratePanel = () => {
  const { playTrack } = usePlayer();
  const { user } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [style, setStyle] = useState("");
  const [instrumental, setInstrumental] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [duration, setDuration] = useState(30);
  const [useFingerprint, setUseFingerprint] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [polling, setPolling] = useState(false);
  const [songs, setSongs] = useState<GeneratedSong[]>([]);
  const [statusMsg, setStatusMsg] = useState("");
  const [masteringId, setMasteringId] = useState<string | null>(null);
  const [midiId, setMidiId] = useState<string | null>(null);
  const [burstKey, setBurstKey] = useState(0);
  // Ustawienia masteringu (0..100)
  const [masterLoud, setMasterLoud] = useState(60);
  const [masterBright, setMasterBright] = useState(50);
  const [masterBass, setMasterBass] = useState(50);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ACE-Step: engine choice + editable lyrics (AI proposes → user fixes → ACE sings)
  const [engine, setEngine] = useState<Engine>("suno");
  const [lyrics, setLyrics] = useState("");
  const [lyricsLang, setLyricsLang] = useState<"pl" | "en" | "nl" | "uk">("pl");
  const [writingLyrics, setWritingLyrics] = useState(false);

  // Slidery wibracji — 0..100 (energia, emocje, oryginalność, radiowość) → opis dokładany do promptu.
  const [energy, setEnergy] = useState(50);
  const [emotion, setEmotion] = useState(50);
  const [originality, setOriginality] = useState(50);
  const [radioFriendly, setRadioFriendly] = useState(50);

  // Klik w sekcję struktury → dopisuje znacznik do tekstu.
  const insertStructure = (tag: string) => {
    setLyrics((prev) => (prev.trim() ? `${prev.replace(/\s+$/, "")}\n\n${tag}\n` : `${tag}\n`));
  };

  // Buduje słowny opis z suwaków (silnik lepiej rozumie słowa niż liczby).
  const buildVibe = (): string => {
    const parts: string[] = [];
    parts.push(energy < 33 ? "spokojna, stonowana energia" : energy > 66 ? "wysoka energia, mocne uderzenie" : "zrównoważona energia");
    parts.push(emotion < 33 ? "chłodny, zdystansowany nastrój" : emotion > 66 ? "bardzo emocjonalny, poruszający wokal" : "umiarkowanie emocjonalny");
    parts.push(originality < 33 ? "klasyczne, sprawdzone brzmienie" : originality > 66 ? "eksperymentalne, oryginalne, nieszablonowe" : "świeże, ale przystępne brzmienie");
    parts.push(radioFriendly > 66 ? "chwytliwy, radiowy, hitowy refren" : radioFriendly < 33 ? "alternatywne, undergroundowe brzmienie" : "przyjemne dla ucha");
    return parts.join(", ");
  };

  const [coverMode, setCoverMode] = useState<CoverMode>("auto");
  const [showUpgrade, setShowUpgrade] = useState(false);
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
      const { data, error } = await invokeStudioEngine("ai-cover-generate", {
        title: songTitle, style: songStyle, description: desc, mode: coverMode,
      });
      if (error) throw error;
      if (data?.cover_url) { toast.success("🎨 Okładka wygenerowana!", { id: "ai-cover" }); return data.cover_url; }
      toast.dismiss("ai-cover");
      return null;
    } catch { toast.error("Błąd generowania okładki", { id: "ai-cover" }); return null; }
  };

  // === AI pisze pełny tekst (prompt-engine plan_only) ===
  const writeLyricsWithAI = async () => {
    if (!prompt.trim()) { toast.error("Najpierw opisz utwór"); return; }
    setWritingLyrics(true);
    try {
      const { data, error } = await supabase.functions.invoke("studio-prompt-engine", {
        body: { prompt: prompt.trim(), plan_only: true, language: lyricsLang },
      });
      if (error) throw error;
      const plan = (data as any)?.plan;
      const full = plan?.full_lyrics?.trim();
      if (!full) { toast.error("AI nie zwróciło tekstu — spróbuj opisać dokładniej"); return; }
      setLyrics(full);
      if (plan?.language) setLyricsLang(plan.language);
      toast.success("✍️ AI napisało tekst — możesz go poprawić przed generowaniem");
    } catch (err: any) {
      toast.error("Nie udało się: " + (err.message || "błąd"));
    } finally { setWritingLyrics(false); }
  };

  const generate = async () => {
    if (!prompt.trim() && !customMode) { toast.error("Wpisz opis utworu"); return; }

    const usingAce = engine === "acestep";
    const usingSuno = engine === "suno";
    if (usingAce && !instrumental && !lyrics.trim()) {
      toast.error('Dodaj tekst lub kliknij "AI napisz tekst"');
      return;
    }

    setGenerating(true);
    setSongs([]);
    const engineLabel = usingSuno
      ? "Suno V5 + GPT-5.5 (studio quality)"
      : usingAce
      ? "ACE-Step (śpiewa)"
      : "GrouAI Engine (MusicGen)";
    setStatusMsg(`🧠 ${engineLabel} generuje...`);

    try {
      const vibe = buildVibe();
      const fnName = usingSuno ? "suno-generate" : usingAce ? "acestep-generate" : "groua-music-engine";
      const reqBody: any = usingSuno
        ? {
            action: "generate",
            prompt: prompt.trim() + (vibe ? `, ${vibe}` : ""),
            style: style || undefined,
            title: title || undefined,
            instrumental,
            vocal_language: lyricsLang,
            enhance: true,
          }
        : usingAce
        ? {
            action: "generate",
            prompt: prompt.trim() + (style ? `, ${style}` : "") + (vibe ? `, ${vibe}` : ""),
            lyrics: instrumental ? "" : lyrics,
            vocal_language: lyricsLang,
            duration,
            instrumental,
            title: title || undefined,
            genre: style || undefined,
          }
        : {
            action: "generate",
            prompt: prompt.trim() + (vibe ? `, ${vibe}` : ""),
            duration: Math.min(duration, 30),
            instrumental,
            use_fingerprint: useFingerprint,
            title: title || undefined,
          };

      const { data, error } = await invokeStudioEngine(fnName, reqBody);
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const predId = data?.id;
      const genId = data?.generation_id;
      if (!predId) throw new Error("Brak task_id z silnika");

      // Okładka AI (darmowa) w tle — gotowa zanim skończy się muzyka.
      // Przy trybie "upload" użytkownik doda własną grafikę przy zapisie.
      if (usingAce && coverMode !== "upload") {
        fireCoverGeneration(
          predId,
          title || prompt.trim().slice(0, 80),
          style || prompt.trim().slice(0, 120),
          coverMode === "custom" && coverDescription.trim() ? coverDescription.trim() : undefined
        );
      }

      if (!usingAce && data?.fingerprint_applied) {
        const fp = data.fingerprint_summary;
        setStatusMsg(`🧠 GrouAI Engine + Twój fingerprint (${fp?.genre || "—"}, ${fp?.bpm || "—"} BPM)...`);
      } else {
        setStatusMsg(`⏳ ${engineLabel} pracuje... (~${Math.round(duration * 1.5)}s)`);
      }
      setPolling(true);
      pollResult(predId, genId, fnName);
    } catch (err: any) {
      if (isSubscriptionError(err)) {
        setShowUpgrade(true);
        setStatusMsg("");
      } else {
        toast.error(engineLabel + ": " + (err.message || "błąd"));
        setStatusMsg("");
      }
    } finally { setGenerating(false); }
  };

  const pollResult = (predictionId: string, generationId: string | undefined, fnName: string) => {
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 80) {
        if (pollRef.current) clearInterval(pollRef.current);
        setPolling(false);
        setStatusMsg("⏰ Timeout silnika");
        return;
      }
      try {
        const { data, error } = await invokeStudioEngine(fnName, {
          action: "status", prediction_id: predictionId, task_id: predictionId, generation_id: generationId,
        });
        if (error) throw error;
        const status = data?.status;
        if (status === "succeeded" || status === "completed" || status === "ready") {
          if (pollRef.current) clearInterval(pollRef.current);
          setPolling(false);
          const url = data?.audio_url || (typeof data.output === "string" ? data.output : data.output?.[0]);
          if (!url) { setStatusMsg("❌ Brak audio z silnika"); return; }
          handleResult([{
            id: data.id || predictionId,
            title: title || "GrouAI Track",
            audio_url: url,
            audioUrl: url,
            image_url: coverPreview || data.cover_url || "",
            tags: style || (engine === "acestep" ? "ACE-Step" : "GrouAI"),
            duration,
          }]);
        } else if (status === "failed" || status === "canceled") {
          if (pollRef.current) clearInterval(pollRef.current);
          setPolling(false);
          setStatusMsg("❌ Silnik: " + (data?.error || "nie powiodło się"));
        } else {
          setStatusMsg(`⏳ ${status || "processing"}... (${attempts * 3}s)`);
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
    if (parsed.length > 0) {
      toast.success(`🎶 Wygenerowano ${parsed.length} utworów!`);
      setBurstKey((k) => k + 1); // wybuch cząsteczek
    }
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
      if (!user) { toast.error("Zaloguj się, aby zapisać"); return; }
      const { error } = await supabase.from("tracks").insert({ user_id: user.id, title: song.title, artist: user.user_metadata?.display_name || user.email?.split("@")[0] || "GrouAI Engine", album: "AI Generated", duration: song.duration || 180, audio_url: url, cover_url: finalCoverUrl, genre: song.style || "AI", mood: "generated" });
      if (error) throw error;
      toast.success(`"${song.title}" dodano do biblioteki!`);
    } catch (err: any) { toast.error("Błąd zapisu: " + err.message); }
  };

  return (
    <div className="space-y-5">
      {/* Engine selector */}
      <div className="p-4 rounded-xl border border-[#FF6B00]/30 bg-gradient-to-br from-[#1a1a2e]/80 to-[#0f0f1e]/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#FF9500]" />
            <span className="text-sm font-semibold text-white">Silnik AI</span>
          </div>
          <span className="text-[11px] text-gray-400">{duration}s</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setEngine("acestep")}
            className={`p-3 rounded-lg border text-left transition-all ${engine === "acestep" ? "border-[#FF6B00] bg-[#FF6B00]/10" : "border-[#FF6B00]/20 bg-[#1a1a2e]/40 hover:border-[#FF6B00]/50"}`}
          >
            <div className="flex items-center gap-1.5">
              <Mic2 className="h-3.5 w-3.5 text-[#FF9500]" />
              <span className="text-xs font-semibold text-white">ACE-Step</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Śpiewa Twój tekst (PL/EN/NL/UK)</p>
          </button>
          <button
            onClick={() => setEngine("musicgen")}
            className={`p-3 rounded-lg border text-left transition-all ${engine === "musicgen" ? "border-[#9333EA] bg-[#9333EA]/10" : "border-[#9333EA]/20 bg-[#1a1a2e]/40 hover:border-[#9333EA]/50"}`}
          >
            <div className="flex items-center gap-1.5">
              <Music className="h-3.5 w-3.5 text-[#9333EA]" />
              <span className="text-xs font-semibold text-white">MusicGen</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Instrumental, bez wokalu (fallback)</p>
          </button>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-400">Długość: {duration}s</Label>
          <input
            type="range"
            min={engine === "acestep" ? 15 : 4}
            max={engine === "acestep" ? 180 : 30}
            step={1}
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value))}
            className="w-full accent-[#FF6B00]"
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

      {/* ACE-Step lyrics editor (only when ACE + has vocals) */}
      <AnimatePresence>
        {engine === "acestep" && !instrumental && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-xl border border-[#FF6B00]/30 bg-[#1a1a2e]/60 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#FF9500]" />
                  <Label className="text-sm font-medium text-gray-200">Tekst piosenki (ACE śpiewa to dosłownie)</Label>
                </div>
                <div className="flex gap-1">
                  {(["pl", "en", "nl", "uk"] as const).map((l) => (
                    <button
                      key={l}
                      onClick={() => setLyricsLang(l)}
                      className={`text-[10px] px-2 py-0.5 rounded ${lyricsLang === l ? "bg-[#FF6B00] text-white" : "bg-[#1a1a2e] text-gray-400 border border-[#FF6B00]/20"}`}
                    >{l.toUpperCase()}</button>
                  ))}
                </div>
              </div>
              <Textarea
                placeholder={"[Verse 1]\nTekst piosenki...\n\n[Chorus]\nRefren..."}
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                rows={6}
                className="bg-[#0f0f1e] border-[#FF6B00]/20 text-white placeholder:text-gray-600 focus:border-[#FF6B00] resize-none font-mono text-sm"
              />
              {/* Struktura: klik wstawia sekcję do tekstu */}
              <div className="flex flex-wrap gap-1.5">
                {STRUCTURE_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => insertStructure(tag)}
                    className="text-[10px] px-2 py-1 rounded-md border border-[#9333EA]/30 bg-[#9333EA]/10 text-gray-200 hover:bg-[#9333EA]/25 transition-colors"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
              <Button
                onClick={writeLyricsWithAI}
                disabled={writingLyrics || !prompt.trim()}
                variant="outline"
                size="sm"
                className="w-full gap-2 border-[#FF6B00]/30 text-[#FF9500] hover:bg-[#FF6B00]/10"
              >
                {writingLyrics ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                {writingLyrics ? "AI pisze..." : "✨ AI napisz tekst z mojego opisu"}
              </Button>
              <p className="text-[10px] text-gray-500">Tekst możesz dowolnie edytować. Używaj [Verse 1], [Chorus], [Bridge] dla struktury.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wibracja — slidery doklejane słownie do promptu silnika */}
      <div className="p-4 rounded-xl border border-[#9333EA]/20 bg-[#1a1a2e]/60 space-y-3">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-[#FF9500]" />
          <Label className="text-sm font-medium text-gray-200">Wibracja utworu</Label>
        </div>
        {[
          { label: "Energia", val: energy, set: setEnergy, lo: "spokojnie", hi: "mocno" },
          { label: "Emocje", val: emotion, set: setEmotion, lo: "chłodno", hi: "wzruszająco" },
          { label: "Oryginalność", val: originality, set: setOriginality, lo: "klasycznie", hi: "eksperyment" },
          { label: "Radiowość", val: radioFriendly, set: setRadioFriendly, lo: "underground", hi: "hit radiowy" },
        ].map((s) => (
          <div key={s.label} className="space-y-1">
            <div className="flex justify-between text-[11px] text-gray-400">
              <span className="font-medium text-gray-300">{s.label}</span>
              <span className="text-gray-500">{s.lo} ↔ {s.hi}</span>
            </div>
            <input
              type="range" min={0} max={100} step={1} value={s.val}
              onChange={(e) => s.set(parseInt(e.target.value))}
              className="w-full accent-[#9333EA]"
            />
          </div>
        ))}
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
              <p className="text-[10px] text-gray-500 mt-2">🇵🇱 Polskie gatunki:</p>
              <div className="flex flex-wrap gap-1.5">
                {PL_GENRES.map((s) => (
                  <Badge key={s}
                    className={`cursor-pointer text-xs px-3 py-1.5 transition-all ${style === s ? "text-white border-transparent" : "bg-transparent border-[#FF6B00]/20 text-gray-400 hover:border-[#FF6B00]/50"}`}
                    style={style === s ? { background: "linear-gradient(135deg, #FF6B00, #9333EA)" } : undefined}
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

            {/* Ustawienia masteringu — używane przez przycisk „Masteruj" na utworze */}
            <div className="p-3 rounded-xl border border-emerald-500/20 bg-[#101826]/60 space-y-2">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs font-medium text-gray-200">🎚️ Mastering — dostrój przed pobraniem WAV</span>
              </div>
              {[
                { label: "Głośność", val: masterLoud, set: setMasterLoud },
                { label: "Jasność", val: masterBright, set: setMasterBright },
                { label: "Bas", val: masterBass, set: setMasterBass },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="w-16 text-[11px] text-gray-400">{s.label}</span>
                  <input
                    type="range" min={0} max={100} value={s.val}
                    onChange={(e) => s.set(parseInt(e.target.value))}
                    className="flex-1 accent-emerald-400"
                  />
                  <span className="w-8 text-right text-[10px] text-gray-500">{s.val}</span>
                </div>
              ))}
            </div>
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
                  <Button size="icon" variant="ghost" className="h-10 w-10 text-[#9333EA] hover:bg-[#9333EA]/20" onClick={() => playSong(song)} title="Odtwórz">
                    <Play className="h-5 w-5" />
                  </Button>
                  <Button
                    size="icon" variant="ghost"
                    className="h-10 w-10 text-gray-300 hover:bg-white/10"
                    title="Pobierz MP3"
                    onClick={() => {
                      const url = song.streamUrl || song.audioUrl;
                      if (!url) { toast.error("Brak pliku audio"); return; }
                      downloadAudio(url, `${song.title || "grouai-track"}.mp3`)
                        .then(() => toast.success("Pobieranie rozpoczęte 🎵"))
                        .catch(() => window.open(url, "_blank"));
                    }}
                  >
                    <Download className="h-5 w-5" />
                  </Button>
                  <Button
                    size="icon" variant="ghost"
                    className="h-10 w-10 text-emerald-400 hover:bg-emerald-400/20"
                    title="Masteruj AI (głośniej, pełniej — pod Spotify/YouTube), pobierz WAV"
                    disabled={masteringId === song.id}
                    onClick={async () => {
                      const url = song.streamUrl || song.audioUrl;
                      if (!url) { toast.error("Brak pliku audio"); return; }
                      setMasteringId(song.id);
                      toast.loading("🎚️ Masteruję (EQ + kompresja + głośność)...", { id: "master" });
                      try {
                        await masterAudioToWav(url, `${song.title || "grouai-track"} (master).wav`, { loudness: masterLoud, brightness: masterBright, bass: masterBass });
                        toast.success("Gotowe — pobrano zmasterowany WAV 🎚️", { id: "master" });
                      } catch {
                        toast.error("Nie udało się zmasterować tego pliku", { id: "master" });
                      } finally {
                        setMasteringId(null);
                      }
                    }}
                  >
                    {masteringId === song.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <SlidersHorizontal className="h-5 w-5" />}
                  </Button>
                  <Button
                    size="icon" variant="ghost"
                    className="h-10 w-10 text-sky-400 hover:bg-sky-400/20"
                    title="Pobierz MIDI (dla producentów) — audio→MIDI w przeglądarce"
                    disabled={midiId === song.id}
                    onClick={async () => {
                      const url = song.streamUrl || song.audioUrl;
                      if (!url) { toast.error("Brak pliku audio"); return; }
                      setMidiId(song.id);
                      toast.loading("🎹 Zamieniam na MIDI (ładuję model)...", { id: "midi" });
                      try {
                        await audioToMidiDownload(url, `${song.title || "grouai-track"}.mid`);
                        toast.success("Gotowe — pobrano plik MIDI 🎹", { id: "midi" });
                      } catch (e: any) {
                        toast.error("MIDI: " + (e?.message || "nie udało się"), { id: "midi" });
                      } finally {
                        setMidiId(null);
                      }
                    }}
                  >
                    {midiId === song.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <Music2 className="h-5 w-5" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-10 w-10 text-[#FF9500] hover:bg-[#FF6B00]/20" onClick={() => saveSongToLibrary(song)} title="Zapisz w bibliotece GrouAI">
                    <Save className="h-5 w-5" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generowanie wymaga planu Pro/Ultimate */}
      <UpgradeModal open={showUpgrade} onOpenChange={setShowUpgrade} />

      {/* Wybuch cząsteczek po udanej generacji */}
      {burstKey > 0 && <MusicBurst key={burstKey} />}
    </div>
  );
};
