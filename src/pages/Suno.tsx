import { useState, useRef, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Music, Guitar, Waves, Blend, Type, Zap, Mic, Heart, Gauge, Flame, Wand2, Sun, Moon, Cloud, Coffee } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { motion, AnimatePresence } from "framer-motion";
import { TrackMixer } from "@/components/studio/TrackMixer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { WaveformPlayer } from "@/components/studio/WaveformPlayer";
import { NeonWavesLoader } from "@/components/studio/NeonWavesLoader";
import { GenerationHistory } from "@/components/studio/GenerationHistory";
import { LyricsDisplay, generateLyrics, parseLyricsFromText } from "@/components/studio/LyricsDisplay";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SunoGeneratePanel } from "@/components/studio/SunoGeneratePanel";
import { VoiceRecorder } from "@/components/studio/VoiceRecorder";

const GENRES = [
  "Pop", "Rock", "Electronic", "Hip-Hop", "Jazz", "Classical",
  "R&B", "Country", "Reggae", "Metal", "Indie", "Lo-fi",
  "Ambient", "Trap", "House", "Disco",
];

// Auto voice selection based on genre
const getVoiceForGenre = (genre: string): string => {
  const femaleGenres = ["Pop", "R&B", "Disco", "Jazz", "Ambient", "Lo-fi", "Indie"];
  const energeticGenres = ["Electronic", "House", "Trap", "Metal", "Rock"];
  if (femaleGenres.includes(genre)) return "EXAVITQu4vr4xnSDxMaL"; // Sarah
  if (energeticGenres.includes(genre)) return "nPczCjzI2devNBz1zQrb"; // Brian
  return "TX3LPaxmHKxFdv7VOQHJ"; // Liam - default
};

const DURATION_OPTIONS = [15, 30, 60, 120];

// Mood / atmosphere presets — affects prompt context
const MOODS = [
  { id: "happy", label: "Radosny", icon: Sun, color: "#FFD700", desc: "uplifting, joyful, bright" },
  { id: "sad", label: "Melancholijny", icon: Cloud, color: "#6B8FFF", desc: "melancholic, emotional, deep" },
  { id: "energetic", label: "Energetyczny", icon: Flame, color: "#FF4500", desc: "high-energy, intense, driving" },
  { id: "chill", label: "Chillout", icon: Coffee, color: "#A78BFA", desc: "relaxed, smooth, mellow" },
  { id: "romantic", label: "Romantyczny", icon: Heart, color: "#FF69B4", desc: "romantic, tender, intimate" },
  { id: "dark", label: "Mroczny", icon: Moon, color: "#9333EA", desc: "dark, cinematic, mysterious" },
];

// Tempo presets — BPM ranges
const TEMPOS = [
  { id: "slow", label: "Wolne", bpm: "60-80 BPM", desc: "slow tempo, gentle" },
  { id: "medium", label: "Średnie", bpm: "90-110 BPM", desc: "medium tempo, groovy" },
  { id: "fast", label: "Szybkie", bpm: "120-140 BPM", desc: "fast tempo, upbeat" },
  { id: "very-fast", label: "Bardzo szybkie", bpm: "150+ BPM", desc: "very fast tempo, driving rhythm" },
];

// Vocal style — affects how AI sings
const VOCAL_STYLES = [
  { id: "singing", label: "Śpiew", desc: "melodic singing voice" },
  { id: "rap", label: "Rap", desc: "rap flow, rhythmic spoken delivery" },
  { id: "whisper", label: "Szept", desc: "whispered intimate vocals" },
  { id: "powerful", label: "Mocny", desc: "powerful belting vocals" },
  { id: "soft", label: "Delikatny", desc: "soft, breathy vocals" },
];

// Production intensity
const INTENSITIES = [
  { id: "minimal", label: "Minimal", desc: "minimal production, sparse arrangement" },
  { id: "balanced", label: "Zbalansowany", desc: "balanced production" },
  { id: "rich", label: "Bogata", desc: "rich, layered production with multiple instruments" },
  { id: "epic", label: "Epicka", desc: "epic, cinematic, orchestral production" },
];

// Quick prompt presets — full track ideas
const QUICK_PRESETS = [
  { label: "🌙 Lo-fi do nauki", genre: "Lo-fi", mood: "chill", tempo: "slow", intensity: "minimal", title: "Late Night Study" },
  { label: "💪 Trening na siłce", genre: "Hip-Hop", mood: "energetic", tempo: "fast", intensity: "rich", title: "Beast Mode" },
  { label: "❤️ Pierwszy taniec", genre: "R&B", mood: "romantic", tempo: "slow", intensity: "balanced", title: "Forever Yours" },
  { label: "🎉 Impreza", genre: "House", mood: "energetic", tempo: "fast", intensity: "rich", title: "Friday Night" },
  { label: "🌧️ Deszczowy poranek", genre: "Jazz", mood: "sad", tempo: "slow", intensity: "minimal", title: "Rainy Window" },
  { label: "🚀 Epicki finał", genre: "Classical", mood: "dark", tempo: "medium", intensity: "epic", title: "Last Stand" },
];

// Mix two base64 audio tracks in browser using Web Audio API
async function mixAudioTracks(musicBase64: string, vocalsBase64: string | null): Promise<string> {
  const audioCtx = new AudioContext({ sampleRate: 44100 });

  const musicBytes = Uint8Array.from(atob(musicBase64), c => c.charCodeAt(0));
  const musicBuffer = await audioCtx.decodeAudioData(musicBytes.buffer.slice(0));

  if (!vocalsBase64) {
    const offCtx = new OfflineAudioContext(musicBuffer.numberOfChannels, musicBuffer.length, 44100);
    const src = offCtx.createBufferSource();
    src.buffer = musicBuffer;
    src.connect(offCtx.destination);
    src.start(0);
    const rendered = await offCtx.startRendering();
    audioCtx.close();
    return audioBufferToWav(rendered);
  }

  const vocalBytes = Uint8Array.from(atob(vocalsBase64), c => c.charCodeAt(0));
  const vocalBuffer = await audioCtx.decodeAudioData(vocalBytes.buffer.slice(0));

  const maxLen = Math.max(musicBuffer.length, vocalBuffer.length);
  const channels = Math.max(musicBuffer.numberOfChannels, vocalBuffer.numberOfChannels);
  const offCtx = new OfflineAudioContext(channels, maxLen, 44100);

  // Music track at ~60% volume (lower to let vocals shine)
  const musicSrc = offCtx.createBufferSource();
  musicSrc.buffer = musicBuffer;
  const musicGain = offCtx.createGain();
  musicGain.gain.value = 0.55;
  musicSrc.connect(musicGain).connect(offCtx.destination);
  musicSrc.start(0);

  // === SINGING VOCAL PROCESSING ===
  const vocalSrc = offCtx.createBufferSource();
  vocalSrc.buffer = vocalBuffer;
  
  // Main vocal gain (louder for singing prominence)
  const vocalGain = offCtx.createGain();
  vocalGain.gain.value = 0.95;

  // Pitch-shifted harmony layer (up 3 semitones for singing harmony)
  const harmonySrc = offCtx.createBufferSource();
  harmonySrc.buffer = vocalBuffer;
  harmonySrc.playbackRate.value = Math.pow(2, 3/12); // +3 semitones
  const harmonyGain = offCtx.createGain();
  harmonyGain.gain.value = 0.18; // Subtle harmony

  // Lower octave doubling for depth
  const octaveSrc = offCtx.createBufferSource();
  octaveSrc.buffer = vocalBuffer;
  octaveSrc.playbackRate.value = Math.pow(2, -5/12); // -5 semitones (lower)
  const octaveGain = offCtx.createGain();
  octaveGain.gain.value = 0.12;

  // Reverb for vocals (larger, concert hall style)
  const convolver = offCtx.createConvolver();
  const irLength = 44100 * 2.5;
  const irBuffer = offCtx.createBuffer(2, irLength, 44100);
  for (let ch = 0; ch < 2; ch++) {
    const data = irBuffer.getChannelData(ch);
    for (let i = 0; i < irLength; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-2.5 * i / irLength) * 0.4;
    }
  }
  convolver.buffer = irBuffer;

  // Dry vocals (main)
  const dryGain = offCtx.createGain();
  dryGain.gain.value = 0.65;
  vocalSrc.connect(vocalGain).connect(dryGain).connect(offCtx.destination);

  // Wet (reverb) vocals  
  const wetGain = offCtx.createGain();
  wetGain.gain.value = 0.35;
  vocalSrc.connect(vocalGain).connect(convolver).connect(wetGain).connect(offCtx.destination);

  // Harmony layer with its own reverb
  harmonySrc.connect(harmonyGain).connect(convolver).connect(offCtx.destination);

  // Octave doubling dry
  octaveSrc.connect(octaveGain).connect(offCtx.destination);

  // Chorus effect via slight detuning
  const chorusSrc = offCtx.createBufferSource();
  chorusSrc.buffer = vocalBuffer;
  chorusSrc.detune.value = 12; // Slight detune for chorus width
  const chorusGain = offCtx.createGain();
  chorusGain.gain.value = 0.15;
  chorusSrc.connect(chorusGain).connect(convolver).connect(offCtx.destination);

  // Start all vocal layers with slight delay for musical feel
  vocalSrc.start(0.4);
  harmonySrc.start(0.4);
  octaveSrc.start(0.4);
  chorusSrc.start(0.4);

  const rendered = await offCtx.startRendering();
  audioCtx.close();
  return audioBufferToWav(rendered);
}

function audioBufferToWav(buffer: AudioBuffer): string {
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2;
  const dataSize = length * numChannels * bytesPerSample;

  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  const channels = [];
  for (let ch = 0; ch < numChannels; ch++) channels.push(buffer.getChannelData(ch));

  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }
  }

  const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

const Suno = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"generate" | "mix" | "suno">("generate");
  const [genre, setGenre] = useState("Pop");
  const [genre2, setGenre2] = useState<string | null>(null);
  const [blendRatio, setBlendRatio] = useState(50);
  const [title, setTitle] = useState("");
  const [instrumental, setInstrumental] = useState(false);
  const [customLyrics, setCustomLyrics] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState("");
  const [duration, setDuration] = useState(30);
  // Cloned voice from user's recording (overrides genre-based voice)
  const [clonedVoiceId, setClonedVoiceId] = useState<string | null>(null);
  const [clonedVoiceLabel, setClonedVoiceLabel] = useState<string | null>(null);
  // New advanced options
  const [mood, setMood] = useState<string>("happy");
  const [tempo, setTempo] = useState<string>("medium");
  const [vocalStyle, setVocalStyle] = useState<string>("singing");
  const [intensity, setIntensity] = useState<string>("balanced");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [result, setResult] = useState<{
    audioUrl: string;
    title: string;
    genre: string;
    generationId?: string;
    durationSeconds: number;
    lyrics: { time: number; text: string }[];
    imageUrl?: string;
  } | null>(null);
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
    setGenStatus("🎵 Generuję muzykę z ElevenLabs...");

    try {
      const genreBlend = genre2 ? `${genre} mixed with ${genre2}` : genre;
      const musicPrompt = `${genreBlend} ${title ? `"${title}"` : ""} track, professional studio quality, rich production`.trim();

      const body: any = {
        prompt: musicPrompt,
        duration,
        vocals: !instrumental && customLyrics.trim().length > 0,
        vocalText: !instrumental ? customLyrics.trim() : null,
        // Use cloned user voice if available, otherwise auto-pick by genre
        vocalVoiceId: clonedVoiceId || getVoiceForGenre(genre),
      };

      setGenStatus("🎼 ElevenLabs generuje instrumenty...");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-music`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Unknown error" }));

        // Handle quota exceeded gracefully
        if (response.status === 402 || errData.error === "quota_exceeded") {
          toast.error("💳 Brak kredytów ElevenLabs Music", {
            description: errData.message || "Twoje konto wyczerpało limit. Doładuj plan na elevenlabs.io.",
            duration: 8000,
          });
          setGenStatus("");
          setGenerating(false);
          return;
        }

        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !data.music) {
        throw new Error("Brak danych audio z ElevenLabs");
      }

      setGenStatus(data.vocals ? "🎤 Miksowanie wokalu z muzyką..." : "🔊 Finalizuję utwór...");

      // Mix music + vocals in browser
      const audioUrl = await mixAudioTracks(data.music, data.vocals);

      const trackTitle = title || `${genre} Track`;
      const lyrics = customLyrics.trim()
        ? parseLyricsFromText(customLyrics, duration)
        : generateLyrics(genre, trackTitle, duration, instrumental);

      setResult({
        audioUrl,
        title: trackTitle,
        genre,
        durationSeconds: duration,
        lyrics,
      });

      setGenStatus("✅ Wygenerowano!");
      toast.success(`🎶 "${trackTitle}" — gotowy!`);

      // Save to generations if logged in
      if (user) {
        supabase.from("generations").insert({
          user_id: user.id,
          title: trackTitle,
          genre,
          prompt: customLyrics || `ElevenLabs: ${musicPrompt}`,
          instrumental,
          status: "completed",
          audio_url: audioUrl,
        }).then();
      }
    } catch (err: any) {
      console.error("[GrouAI Studio] Generate error:", err);
      toast.error("Błąd generowania: " + (err.message || "Nieznany błąd"));
      setGenStatus("");
      setErrorModal(err.message);
    } finally {
      setGenerating(false);
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
              Twórz profesjonalne utwory muzyczne z AI. Wybierz styl, wpisz tekst, wybierz głos — i wygeneruj muzykę ze śpiewanym wokalem w jakości studyjnej.
            </p>
          </motion.div>

          {/* Engine badge */}
          <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-[#FF6B00]/10 to-[#9333EA]/10 border border-[#FF6B00]/20">
            <Sparkles className="h-3.5 w-3.5 text-[#FF9500]" />
            <span className="text-xs text-gray-300">
              Napędzany przez <span className="text-[#FF9500] font-semibold">ElevenLabs Music v1</span> — studyjna jakość, śpiewane wokale
            </span>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 p-1 rounded-xl bg-[#1a1a2e]/80 border border-[#FF6B00]/10">
            <button
              onClick={() => setActiveTab("generate")}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                activeTab === "generate" ? "text-white" : "text-gray-400 hover:text-gray-200"
              }`}
              style={activeTab === "generate" ? { background: "linear-gradient(135deg, #FF6B00, #FF9500)", boxShadow: "0 0 15px #FF6B0040" } : undefined}
            >
              <Sparkles className="h-4 w-4" /> Generator
            </button>
            <button
              onClick={() => setActiveTab("mix")}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                activeTab === "mix" ? "text-white" : "text-gray-400 hover:text-gray-200"
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
                  style={genre === g ? { background: "linear-gradient(135deg, #FF6B00, #FF9500)", boxShadow: "0 0 12px #FF6B0050" } : undefined}
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
                  style={genre2 === g ? { background: "linear-gradient(135deg, #9333EA, #FF6B00)", boxShadow: "0 0 12px #9333EA50" } : undefined}
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
                    min={10} max={90} step={5}
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

          {/* Duration Selection */}
          <div className="space-y-2">
            <Label className="text-sm text-gray-300">Długość</Label>
            <div className="flex gap-2">
              {DURATION_OPTIONS.map((d) => (
                <Badge
                  key={d}
                  className={`cursor-pointer text-xs px-4 py-2 transition-all ${
                    duration === d
                      ? "text-white border-transparent"
                      : "bg-transparent border-[#FF6B00]/20 text-gray-400 hover:border-[#FF6B00]/50"
                  }`}
                  style={duration === d ? { background: "linear-gradient(135deg, #FF6B00, #FF9500)" } : undefined}
                  onClick={() => setDuration(d)}
                >
                  {d}s
                </Badge>
              ))}
            </div>
          </div>

          {/* Instrumental Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-[#FF6B00]/20 bg-[#1a1a2e]/60">
            <div className="flex items-center gap-3">
              <Guitar className="h-5 w-5 text-[#FF9500]" />
              <Label className="text-sm text-gray-200">Tylko instrumentalny</Label>
            </div>
            <Switch checked={instrumental} onCheckedChange={(v) => { setInstrumental(v); if (v) setCustomLyrics(""); }} className="data-[state=checked]:bg-[#FF6B00]" />
          </div>

          {/* Auto Voice Info */}
          <AnimatePresence>
            {!instrumental && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-3 rounded-xl border border-[#9333EA]/20 bg-[#1a1a2e]/40 flex items-center gap-3">
                  <Mic className="h-4 w-4 text-[#9333EA]" />
                  <p className="text-xs text-gray-400">
                    {clonedVoiceId
                      ? <>Wokal zostanie zaśpiewany <span className="text-[#FF9500] font-medium">Twoim sklonowanym głosem</span></>
                      : <>Głos wokalisty zostanie automatycznie dobrany do stylu <span className="text-[#FF9500] font-medium">{genre}</span></>
                    }
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Voice Recorder — clone user's voice for AI singing */}
          <AnimatePresence>
            {!instrumental && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <VoiceRecorder
                  clonedVoiceId={clonedVoiceId}
                  clonedVoiceLabel={clonedVoiceLabel}
                  onVoiceCloned={(id, label) => { setClonedVoiceId(id); setClonedVoiceLabel(label); }}
                  onCleared={() => { setClonedVoiceId(null); setClonedVoiceLabel(null); }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Custom Lyrics Editor */}
          <AnimatePresence>
            {!instrumental && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 overflow-hidden"
              >
                <Label className="text-sm text-gray-300 flex items-center gap-2">
                  <Type className="h-4 w-4 text-[#FF9500]" />
                  Tekst / Lyrics (wpisz, aby wokal śpiewał)
                </Label>
                <Textarea
                  placeholder={"Wpisz tekst piosenki...\n\nVerse 1:\nTwój tekst tutaj...\n\nChorus:\nRefren tutaj..."}
                  value={customLyrics}
                  onChange={(e) => setCustomLyrics(e.target.value)}
                  rows={6}
                  className="bg-[#1a1a2e] border-[#FF6B00]/20 text-white placeholder:text-gray-600 focus:border-[#FF6B00] focus:ring-[#FF6B00]/30 resize-none font-mono text-sm"
                />
                <p className="text-xs text-gray-500">
                  Wpisz tekst — AI wokalista zaśpiewa go na tle muzyki. Zostaw puste dla utworu bez wokalu.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Engine Info */}
          <div className="p-4 rounded-xl border border-[#9333EA]/30 bg-[#1a1a2e]/60 space-y-2">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-[#9333EA]" />
              <div>
                <Label className="text-sm text-gray-200">GrouAI Engine (ElevenLabs HQ)</Label>
                <p className="text-xs text-gray-500">Profesjonalna muzyka AI + śpiewany wokal — jakość studyjna</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Badge className="text-xs bg-[#9333EA] text-white border-transparent">
                <Music className="h-3 w-3 mr-1" /> Instrumenty AI
              </Badge>
              {!instrumental && (
                <Badge className="text-xs bg-[#FF6B00] text-white border-transparent">
                  <Mic className="h-3 w-3 mr-1" /> Wokal AI
                </Badge>
              )}
            </div>
          </div>

          {/* Generate Button */}
          <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={generate}
              disabled={generating}
              className="w-full h-14 text-lg font-bold text-white border-0 gap-3"
              style={{
                background: generating ? "#333" : "linear-gradient(135deg, #9333EA, #FF6B00)",
                boxShadow: generating ? "none" : "0 0 30px #9333EA40, 0 4px 20px #FF6B0030",
              }}
            >
              {!generating && <Zap className="h-5 w-5" />}
              {generating ? "Generuję..." : `⚡ Generuj ${duration}s${!instrumental ? " + wokal" : ""}`}
              {!generating && <Music className="h-5 w-5" />}
            </Button>
          </motion.div>

          {/* Status */}
          {genStatus && (
            <p className="text-sm text-center text-gray-400">{genStatus}</p>
          )}

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

          {/* Result */}
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
                    <motion.p className="font-bold text-white text-lg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
                      {result.title}
                    </motion.p>
                    <p className="text-xs text-[#FF9500]/70">GrouAI Studio • {result.genre} • {result.durationSeconds}s</p>
                  </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="relative z-10">
                  <WaveformPlayer audioUrl={result.audioUrl} title={result.title} genre={result.genre} onSaveToLibrary={saveToLibrary} />
                </motion.div>

                {result.lyrics.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="relative z-10">
                    <LyricsDisplay lyrics={result.lyrics} currentTime={playbackTime} isPlaying={isPlaying} totalDuration={result.durationSeconds} />
                  </motion.div>
                )}
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
          <p className="text-xs text-gray-500">Sprawdź czy ElevenLabs API jest dostępne i spróbuj ponownie</p>
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
