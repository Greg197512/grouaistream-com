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
import { MusicPromptBox } from "@/components/studio/MusicPromptBox";
import { VoiceRecorder } from "@/components/studio/VoiceRecorder";
import { VoiceLibrary } from "@/components/studio/VoiceLibrary";
import { StudioGrokDock } from "@/components/studio/StudioGrokDock";
import { StudioHifi } from "@/components/studio/StudioHifi";
import { StudioSparksBackdrop } from "@/components/studio/StudioSparksBackdrop";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { uploadToR2 } from "@/lib/r2Upload";
import { renderScore } from "@/lib/musicSynth";
import { generateMusic } from "@/utils/musicGenerator";
import { Lock, Crown, Download, Share2, Film } from "lucide-react";
import { VideoStudio } from "@/components/studio/VideoStudio";
import { downloadAudio, invokeStudioEngine, waitForAceStep, isSubscriptionError, fetchEngineLessons } from "@/lib/hubStudio";
import { Link, useSearchParams } from "react-router-dom";
import { getEra, eraStudioGenre } from "@/lib/eraEngine";

const FREE_GENERATION_LIMIT = 1;

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
  const { isPro, isUltimate, showUpgradeFor } = useSubscription();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<"generate" | "mix" | "suno" | "video">("generate");
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
  const [voiceLibKey, setVoiceLibKey] = useState(0); // bump to force VoiceLibrary refetch
  // Free-tier generation tracking
  const [freeUsed, setFreeUsed] = useState(0);
  const [showPaywall, setShowPaywall] = useState(false);
  // New advanced options
  const [mood, setMood] = useState<string>("happy");
  const [tempo, setTempo] = useState<string>("medium");
  const [vocalStyle, setVocalStyle] = useState<string>("singing");
  const [intensity, setIntensity] = useState<string>("balanced");
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Engine selector: "grouai" (AI Compose + browser synth), "elevenlabs", "n8n" (multi-engine router)
  const [engine, setEngine] = useState<"grouai" | "elevenlabs" | "n8n">(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("studio-engine") : null;
    if (stored === "elevenlabs" || stored === "n8n") return stored;
    return "grouai";
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("studio-engine", engine);
  }, [engine]);
  const useElevenLabs = engine === "elevenlabs";
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
  // Preset epoki z GROUA ERA (deep-link /studio?era=...) — wypełnia panel ręczny.
  const [searchParams] = useSearchParams();
  const [eraPreset, setEraPreset] = useState<{ label: string; accent: string; emoji: string } | null>(null);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load free-tier usage count on mount/login
  useEffect(() => {
    if (!user || isPro) { setFreeUsed(0); return; }
    supabase.rpc("get_user_generation_count", { _user_id: user.id })
      .then(({ data }) => setFreeUsed(typeof data === "number" ? data : 0));
  }, [user?.id, isPro]);

  // === GROUA ERA → Studio: prefill panelu z presetu epoki (deep-link) ===
  useEffect(() => {
    const eraKey = searchParams.get("era");
    if (!eraKey) return;
    const era = getEra(eraKey);
    if (!era) return;
    // Gatunek epoki → lista stylów Studia
    setGenre(eraStudioGenre(era));
    // Tytuł sugerowany
    setTitle(`GROUA ERA ${era.label}`);
    // Tempo epoki → preset tempa
    const midBpm = Math.round((era.tempo[0] + era.tempo[1]) / 2);
    setTempo(midBpm >= 150 ? "very-fast" : midBpm >= 120 ? "fast" : midBpm >= 90 ? "medium" : "slow");
    // Nastrój epoki → preset nastroju
    const moodMap: Record<string, string> = {
      energetic: "energetic", raw: "energetic", festival: "energetic", bold: "energetic", party: "energetic",
      romantic: "romantic", dreamy: "chill", chill: "chill", nostalgic: "chill", shiny: "happy", happy: "happy",
      sad: "sad", emotional: "sad", dark: "dark", immersive: "dark", rebellious: "dark",
    };
    const em = era.moods.map((m) => moodMap[m]).find(Boolean);
    if (em) setMood(em);
    setIntensity("rich");
    setShowAdvanced(true);
    setActiveTab("generate");
    setEraPreset({ label: era.label, accent: era.palette.accent, emoji: era.emoji });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);


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
    // === GATE 1: must be logged in to generate (so we can track usage) ===
    if (!user) {
      toast.error(t("studio.toast.loginRequired"));
      return;
    }

    // === GATE 2: free users get only 1 generation, then paywall ===
    if (!isPro && freeUsed >= FREE_GENERATION_LIMIT) {
      setShowPaywall(true);
      return;
    }

    setGenerating(true);
    setResult(null);
    setGenStatus(t("studio.status.generating"));

    try {
      const genreBlend = genre2 ? `${genre} mixed with ${genre2} (${blendRatio}% / ${100 - blendRatio}%)` : genre;
      const moodDesc = MOODS.find(m => m.id === mood)?.desc || "";
      const tempoDesc = TEMPOS.find(t => t.id === tempo)?.desc || "";
      const intensityDesc = INTENSITIES.find(i => i.id === intensity)?.desc || "";
      const vocalDesc = !instrumental ? VOCAL_STYLES.find(v => v.id === vocalStyle)?.desc || "" : "";
      const musicPrompt = `${genreBlend} ${title ? `"${title}"` : ""} track, ${moodDesc}, ${tempoDesc}, ${intensityDesc}${vocalDesc ? `, with ${vocalDesc}` : ""}, professional studio quality`.trim().replace(/\s+,/g, ",");

      const body: any = {
        prompt: musicPrompt,
        duration,
        vocals: !instrumental && customLyrics.trim().length > 0,
        vocalText: !instrumental ? customLyrics.trim() : null,
        // Use cloned user voice if available, otherwise auto-pick by genre
        vocalVoiceId: clonedVoiceId || getVoiceForGenre(genre),
      };

      setGenStatus(t("studio.status.instruments"));

      // === GROUAI STUDIO ENGINE — prawdziwy silnik Suno V5 + GPT (studyjna jakość,
      // czyste instrumenty i śpiewane wokale). Lokalny syntezator TYLKO jako awaryjny
      // plan B, gdy silnik nie odpowiada (żeby generowanie nigdy nie zawisło). ===
      if (engine === "grouai") {
        setGenStatus("🎼 Silnik komponuje w jakości studyjnej...");

        // ── STOPIEŃ 1: Suno V5.5 (funkcja suno-generate na LIVE; wymaga sekretu
        // SUNO_API_KEY). Najwyższa jakość: naturalne instrumenty i wokal jak Suno.
        // Gdy klucz nie ustawiony / błąd — cicho schodzimy na silnik hubowy. ──
        const sunoOk = await (async (): Promise<boolean> => {
          try {
            const { data: sd, error: se } = await supabase.functions.invoke("suno-generate", {
              body: {
                action: "generate",
                prompt: musicPrompt,
                style: genreBlend,
                title: title || undefined,
                instrumental,
                vocal_language: language,
                enhance: true,
              },
            });
            if (se) throw se;
            if ((sd as any)?.error) throw new Error((sd as any).error);
            const taskId = (sd as any)?.id || (sd as any)?.task_id;
            if (!taskId) throw new Error("brak taskId");

            const t0 = Date.now();
            while (Date.now() - t0 < 300000) { // Suno potrafi renderować do ~5 min
              await new Promise((r) => setTimeout(r, 4000));
              const { data: st } = await supabase.functions.invoke("suno-generate", {
                body: { action: "status", task_id: taskId },
              });
              const s = (st as any)?.status;
              if (s === "succeeded") {
                const url = (st as any)?.audio_url;
                if (!url) throw new Error("brak audio");
                const trackTitle = (st as any)?.title || title || `${genre} Track`;
                const coverUrl = (st as any)?.cover_url || undefined;
                const lyrics = customLyrics.trim()
                  ? parseLyricsFromText(customLyrics, duration)
                  : generateLyrics(genre, trackTitle, duration, instrumental);
                setResult({ audioUrl: url, title: trackTitle, genre, durationSeconds: (st as any)?.duration || duration, lyrics, imageUrl: coverUrl });
                setGenStatus(t("studio.status.done"));
                toast.success(`🎶 "${trackTitle}" — Suno V5.5, najwyższa jakość!`);
                await supabase.from("generations").insert({
                  user_id: user!.id, title: trackTitle, genre,
                  prompt: musicPrompt, instrumental, status: "completed", audio_url: url,
                });
                await supabase.from("tracks").insert({
                  user_id: user!.id, title: trackTitle, artist: "GrouAI Studio",
                  album: "AI Generated", duration: (st as any)?.duration || duration,
                  audio_url: url, cover_url: coverUrl || null, genre, mood,
                });
                window.dispatchEvent(new CustomEvent("grouai:generations-changed"));
                if (!isPro) setFreeUsed((prev) => prev + 1);
                return true;
              }
              if (s === "failed") throw new Error((st as any)?.error || "generacja nie powiodła się");
              setGenStatus(`⏳ Suno V5.5 renderuje… (${Math.round((Date.now() - t0) / 1000)}s)`);
            }
            throw new Error("timeout");
          } catch (e) {
            console.warn("[Studio] suno-generate niedostępny — przechodzę na silnik hub:", e);
            return false;
          }
        })();
        if (sunoOk) return;

        // ── STOPIEŃ 2: prawdziwy silnik hub (Suno V5 + GPT + emocje), pollowany
        // przez waitForAceStep — dokładnie ta sama, sprawdzona ścieżka co MusicPromptBox.
        const studioOk = await (async (): Promise<boolean> => {
          try {
            // Composed prompt niesie już gatunek/nastrój/tempo/energię/wokal. Gdy jest
            // własny tekst — przekazujemy go dosłownie, by silnik go zaśpiewał.
            let promptForEngine = instrumental
              ? `${musicPrompt} (instrumentalny, bez wokalu)`
              : (customLyrics.trim()
                  ? `${musicPrompt}. Zaśpiewaj DOKŁADNIE ten tekst:\n${customLyrics.trim()}`
                  : musicPrompt);

            // NAUKA: doklej lekcje z naszych najlepszych utworów (in-context learning).
            const lessons = await fetchEngineLessons(language);
            if (lessons) promptForEngine = `${promptForEngine}\n\n${lessons}`;

            const { data, error: fnErr } = await invokeStudioEngine("studio-prompt-engine", {
              prompt: promptForEngine,
              ...(language ? { language } : {}),
            });
            if (fnErr) throw new Error((fnErr as any).message || "Engine error");
            if (!(data as any)?.success) throw new Error((data as any)?.message || (data as any)?.error || "Engine error");

            const plan = (data as any).plan;
            const trackTitle = plan?.title || title || `${genre} Track`;
            const { audioUrl, coverUrl } = await waitForAceStep(
              (data as any).task_id, (data as any).generation_id,
              (sec) => setGenStatus(`⏳ Renderuję studyjny mix… (${sec}s)`),
            );

            const lyrics = customLyrics.trim()
              ? parseLyricsFromText(customLyrics, duration)
              : (plan?.full_lyrics ? parseLyricsFromText(plan.full_lyrics, duration) : generateLyrics(genre, trackTitle, duration, instrumental));

            setResult({ audioUrl, title: trackTitle, genre, durationSeconds: duration, lyrics, imageUrl: coverUrl || undefined });
            setGenStatus(t("studio.status.done"));
            toast.success(`🎶 "${trackTitle}" — studyjna jakość!`);
            // Silnik zapisał już utwór (rekord generations) — odśwież „Twoje utwory”.
            window.dispatchEvent(new CustomEvent("grouai:generations-changed"));
            if (!isPro) setFreeUsed((prev) => prev + 1);
            return true;
          } catch (e) {
            if (isSubscriptionError(e)) { setShowPaywall(true); setGenStatus(""); throw e; }
            console.warn("[Studio] studio-prompt-engine niedostępny — plan B (lokalny):", e);
            return false;
          }
        })();
        if (studioOk) return;

        // Plan B (awaryjny, rzadki): lokalny generator. Sygnalizujemy uczciwie.
        toast.warning("Silnik studyjny chwilowo niedostępny — używam wersji zapasowej. Spróbuj wygenerować ponownie za chwilę.");
        setGenStatus("Wersja zapasowa: komponuję lokalnie…");
        let audioBlobUrl: string | null = null;

        // Próba 1: kompozycja przez AI (edge function). Gdy serwer/AI padnie —
        // NIE przerywamy: przechodzimy na lokalny syntezator GrouAI (działa zawsze).
        try {
          const composeRes = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-compose`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
              body: JSON.stringify({
                prompt: musicPrompt,
                duration,
                genre: genreBlend,
                mood: MOODS.find(m => m.id === mood)?.id || "energetic",
                tempo: TEMPOS.find(t => t.id === tempo)?.id || "medium",
                intensity: INTENSITIES.find(i => i.id === intensity)?.id || "balanced",
              }),
            },
          );
          if (composeRes.ok) {
            const composeData = await composeRes.json();
            if (composeData.ok && composeData.score) {
              setGenStatus("Renderowanie audio w przeglądarce...");
              audioBlobUrl = await renderScore(composeData.score);
            }
          }
        } catch { /* przechodzimy na lokalny generator */ }

        // Próba 2 (fallback): lokalny generator GrouAI — pełna kompozycja w przeglądarce.
        if (!audioBlobUrl) {
          setGenStatus("GrouAI Synth komponuje lokalnie...");
          const moodMap: Record<string, "bright" | "melancholic" | "euphoric" | "dreamy" | "romantic" | "dark"> = {
            happy: "bright", sad: "melancholic", energetic: "euphoric",
            chill: "dreamy", romantic: "romantic", dark: "dark",
          };
          const tempoMap: Record<string, number> = { slow: 72, medium: 100, fast: 128, "very-fast": 152 };
          const energyMap: Record<string, "low" | "medium" | "high" | "extreme"> = {
            minimal: "low", balanced: "medium", rich: "high", epic: "extreme",
          };
          const localTrack = await generateMusic({
            style: genre,
            style2: genre2 || undefined,
            blendRatio: genre2 ? blendRatio / 100 : undefined,
            durationSeconds: duration,
            instrumental,
            title: title || undefined,
            prompt: musicPrompt,
            mood: moodMap[mood],
            energy: energyMap[intensity] || "medium",
            tempoOverride: tempoMap[tempo],
            textContent: customLyrics.trim() || undefined,
          });
          audioBlobUrl = localTrack.audioUrl;
        }

        if (!audioBlobUrl) throw new Error("Nie udało się wygenerować audio");

        const trackTitle = title || `${genre} Track`;
        const lyrics = customLyrics.trim()
          ? parseLyricsFromText(customLyrics, duration)
          : generateLyrics(genre, trackTitle, duration, instrumental);

        setGenStatus(t("studio.status.uploading"));
        let publicAudioUrl = audioBlobUrl;
        try {
          const wavResp = await fetch(audioBlobUrl);
          const wavBlob = await wavResp.blob();
          const safeTitle = trackTitle.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 40);
          const wavFile = new File([wavBlob], `${safeTitle}_${Date.now()}.wav`, { type: "audio/wav" });
          const uploadRes = await uploadToR2({ file: wavFile, folder: `studio/${user!.id}` });
          publicAudioUrl = uploadRes.publicUrl;
        } catch {
          toast.warning("Upload do chmury nie powiódł się — audio dostępne lokalnie");
        }

        setResult({ audioUrl: publicAudioUrl, title: trackTitle, genre, durationSeconds: duration, lyrics });
        setGenStatus(t("studio.status.done"));
        toast.success(`🎶 "${trackTitle}" — wygenerowany przez GrouAI Synth!`);

        await supabase.from("generations").insert({
          user_id: user!.id, title: trackTitle, genre,
          prompt: `GrouAI Synth: ${musicPrompt}`, instrumental,
          status: "completed", audio_url: publicAudioUrl,
        });
        if (publicAudioUrl.startsWith("http")) {
          await supabase.from("tracks").insert({
            user_id: user!.id, title: trackTitle, artist: "GrouAI Studio",
            album: "AI Generated", duration, audio_url: publicAudioUrl, genre, mood,
          });
        }
        if (!isPro) setFreeUsed(prev => prev + 1);
        return;
      }

      // === ROUTING: ElevenLabs vs n8n Multi-Engine Router ===
      const endpoint = useElevenLabs
        ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-music`
        : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/studio-router`;

      const routerBody = engine === "elevenlabs" ? body : {
        prompt: musicPrompt,
        title: title || `${genre} Track`,
        duration,
        instrumental,
        hasVocals: !instrumental && customLyrics.trim().length > 0,
        quality: "premium",
        lyrics: !instrumental ? customLyrics.trim() : undefined,
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(routerBody),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Unknown error" }));

        if (response.status === 402 || errData.error === "quota_exceeded") {
          toast.error(t("studio.toast.noCredits"), {
            description: errData.message || t("studio.toast.noCreditsDesc"),
            duration: 8000,
          });
          setGenStatus("");
          setGenerating(false);
          return;
        }

        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      // === n8n router branch — returns { engine, audio_url, status, task_id } ===
      if (engine === "n8n") {
        if (data.audio_url) {
          // Synchronous engine (MusicGen) returned ready URL
          setResult({
            audioUrl: data.audio_url,
            title: title || `${genre} Track`,
            genre,
            durationSeconds: duration,
            lyrics: customLyrics.trim()
              ? parseLyricsFromText(customLyrics, duration)
              : generateLyrics(genre, title || `${genre} Track`, duration, instrumental),
          });
          setGenStatus(t("studio.status.done"));
          toast.success(`🎶 Wygenerowane przez ${data.engine || "n8n router"}`);
          if (!isPro) setFreeUsed(p => p + 1);
          return;
        }
        if (data.task_id || data.status === "processing") {
          toast.success(`⏳ Router uruchomił ${data.engine || "silnik"} — utwór będzie gotowy za chwilę. Zobaczysz go w "Historia".`);
          setGenStatus("");
          if (!isPro) setFreeUsed(p => p + 1);
          return;
        }
        throw new Error(data.error || "Router n8n nie zwrócił audio");
      }

      // === ElevenLabs branch (default) — base64 music + vocals ===
      if (!data.success || !data.music) {
        throw new Error("Brak danych audio z ElevenLabs");
      }

      setGenStatus(data.vocals ? t("studio.status.mixing") : t("studio.status.finalizing"));

      // Mix music + vocals in browser → returns blob URL of WAV
      const audioBlobUrl = await mixAudioTracks(data.music, data.vocals);

      const trackTitle = title || `${genre} Track`;
      const lyrics = customLyrics.trim()
        ? parseLyricsFromText(customLyrics, duration)
        : generateLyrics(genre, trackTitle, duration, instrumental);

      // === Upload mixed WAV to R2 so it works across devices + persists ===
      setGenStatus(t("studio.status.uploading"));
      let publicAudioUrl = audioBlobUrl; // fallback: keep blob if upload fails
      try {
        const wavResp = await fetch(audioBlobUrl);
        const wavBlob = await wavResp.blob();
        const safeTitle = trackTitle.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 40);
        const wavFile = new File([wavBlob], `${safeTitle}_${Date.now()}.wav`, { type: "audio/wav" });
        const uploadRes = await uploadToR2({ file: wavFile, folder: `studio/${user.id}` });
        publicAudioUrl = uploadRes.publicUrl;
        console.log("[Studio] Uploaded to R2:", publicAudioUrl);
      } catch (uploadErr: any) {
        console.warn("[Studio] R2 upload failed, using local blob:", uploadErr);
        toast.warning(t("studio.toast.localOnly"), {
          description: t("studio.toast.localOnlyDesc"),
        });
      }

      setResult({
        audioUrl: publicAudioUrl,
        title: trackTitle,
        genre,
        durationSeconds: duration,
        lyrics,
      });

      setGenStatus(t("studio.status.done"));
      toast.success(`🎶 "${trackTitle}" — gotowy!`);

      // Save to generations + auto-add to user's tracks library
      const { data: genRow } = await supabase.from("generations").insert({
        user_id: user.id,
        title: trackTitle,
        genre,
        prompt: customLyrics || `ElevenLabs: ${musicPrompt}`,
        instrumental,
        status: "completed",
        audio_url: publicAudioUrl,
      }).select().single();

      // Auto-save to tracks (user's personal studio catalog)
      if (publicAudioUrl.startsWith("http")) {
        await supabase.from("tracks").insert({
          user_id: user.id,
          title: trackTitle,
          artist: "GrouAI Studio",
          album: "AI Generated",
          duration,
          audio_url: publicAudioUrl,
          genre,
          mood,
        });
      }

      // Increment free counter
      if (!isPro) setFreeUsed(prev => prev + 1);
    } catch (err: any) {
      console.error("[GrouAI Studio] Generate error:", err);
      toast.error(t("studio.toast.genError") + ": " + (err.message || ""));
      setGenStatus("");
      setErrorModal(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const saveToLibrary = async () => {
    if (!result) return;
    if (!user) { toast.error("Zaloguj się, aby zapisać"); return; }
    try {
      const artistName = user.user_metadata?.display_name || user.email?.split("@")[0] || "GrouAI Studio";
      const { error } = await supabase.from("tracks").insert({
        user_id: user.id,
        title: result.title,
        artist: artistName,
        album: "AI Generated",
        duration: result.durationSeconds,
        audio_url: result.audioUrl,
        cover_url: result.imageUrl || null,
        genre: result.genre,
        mood: "generated",
      });
      if (error) throw error;
      toast.success(t("studio.toast.savedToLib"));
    } catch (err: any) {
      toast.error(t("studio.toast.saveError") + ": " + err.message);
    }
  };

  // === PROMO: GrouAI Studio jest darmowe dla wszystkich — brak paywall ===
  if (false) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#0F0F1A" }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-lg w-full text-center space-y-6 p-8 rounded-2xl border border-primary/30 bg-background/40 backdrop-blur-xl"
          >
            <div className="mx-auto w-20 h-20 rounded-2xl flex items-center justify-center bg-gradient-to-br from-primary to-amber-500 shadow-[0_0_40px_hsl(var(--primary)/0.5)]">
              <Crown className="h-10 w-10 text-background" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-amber-400 bg-clip-text text-transparent">
                GrouAI Studio
              </h1>
              <p className="text-sm font-semibold text-amber-400 uppercase tracking-wider">
                🔒 {t("studio.gate.title")}
              </p>
            </div>
            <p className="text-foreground/80 leading-relaxed">
              {t("studio.gate.subtitle")}
            </p>

            {/* Powered by — partnerzy AI */}
            <div className="space-y-2 text-left bg-background/30 rounded-xl p-4 border border-primary/20">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary/80">{t("studio.gate.poweredBy")}:</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-foreground/80">
                <div className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-primary" /> <span><b>Suno v4</b> — {t("studio.gate.engineMusic")}</span></div>
                <div className="flex items-center gap-2"><Mic className="h-3.5 w-3.5 text-primary" /> <span><b>ElevenLabs</b> — {t("studio.gate.engineVocal")}</span></div>
                <div className="flex items-center gap-2"><Wand2 className="h-3.5 w-3.5 text-primary" /> <span><b>Replicate</b> — {t("studio.gate.engineMaster")}</span></div>
                <div className="flex items-center gap-2"><Type className="h-3.5 w-3.5 text-primary" /> <span><b>Gemini 2.5</b> — {t("studio.gate.engineLyrics")}</span></div>
              </div>
            </div>

            {/* Jakość audio */}
            <div className="space-y-2 text-left bg-background/30 rounded-xl p-4 border border-amber-500/20">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">{t("studio.gate.quality")}:</p>
              <div className="space-y-1.5 text-xs text-foreground/80">
                <div className="flex items-center justify-between"><span>🎚️ Format</span><span className="font-mono font-bold text-amber-400">WAV / FLAC Lossless</span></div>
                <div className="flex items-center justify-between"><span>🔊 Sample rate</span><span className="font-mono font-bold text-amber-400">48 kHz / 24-bit</span></div>
                <div className="flex items-center justify-between"><span>📡 Bitrate</span><span className="font-mono font-bold text-amber-400">do 1411 kbps</span></div>
                <div className="flex items-center justify-between"><span>🎤 Wokal</span><span className="font-mono font-bold text-amber-400">HD Voice Clone</span></div>
              </div>
            </div>

            {/* Co dostajesz */}
            <div className="space-y-2 text-left text-sm text-foreground/70 bg-background/30 rounded-xl p-4 border border-white/5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/50 mb-2">W pakiecie Ultimate:</p>
              <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Nielimitowane generowanie AI</div>
              <div className="flex items-center gap-2"><Mic className="h-4 w-4 text-primary" /> Voice cloning &amp; biblioteka głosów</div>
              <div className="flex items-center gap-2"><Blend className="h-4 w-4 text-primary" /> Track Mixer + crossfade + mastering</div>
              <div className="flex items-center gap-2"><Type className="h-4 w-4 text-primary" /> Auto-lyrics + tłumaczenia (4 języki)</div>
              <div className="flex items-center gap-2"><Wand2 className="h-4 w-4 text-primary" /> Bonus 12$ za 5 utworów Studio</div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                onClick={() => showUpgradeFor("GrouAI Studio")}
                className="flex-1 bg-gradient-to-r from-primary to-amber-500 hover:opacity-90 text-background font-bold gap-2"
                size="lg"
              >
                <Crown className="h-4 w-4" />
                {t("studio.gate.cta")}
              </Button>
              <Button asChild variant="outline" size="lg" className="flex-1 border-primary/30">
                <Link to="/">{t("studio.gate.later")}</Link>
              </Button>
            </div>
            <p className="text-[11px] text-foreground/40 pt-2">
              Ultimate = pełny dostęp do AI Studio (Suno + ElevenLabs + Replicate), AI Psychologist, lossless audio 48kHz/24-bit i wszystkie bonusy creatorów.
            </p>
          </motion.div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-screen" style={{ background: "#0F0F1A" }}>
        <div className="max-w-6xl mx-auto px-4 py-8 xl:grid xl:grid-cols-[minmax(0,1fr)_400px] xl:gap-8 xl:items-start">
          <div className="space-y-8 w-full max-w-2xl mx-auto xl:mx-0 min-w-0">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-4"
          >
            <div className="mx-auto w-24 h-24 rounded-2xl flex items-center justify-center relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #FF6B00, #FF9500, #9333EA)",
                boxShadow: "0 0 40px #FF6B0060, 0 0 80px #9333EA30",
              }}
            >
              {/* Statyczna poświata w tle (bez wirowania) */}
              <div
                aria-hidden
                className="absolute -inset-6 opacity-25"
                style={{ background: "conic-gradient(from 45deg, transparent, #ffffff55, transparent 40%)" }}
              />
              {/* Autorski equalizer — fala dźwiękowa */}
              <div className="relative z-10 flex items-end gap-[3px] h-12">
                {[0.55, 0.85, 0.35, 1, 0.5, 0.75, 0.4].map((base, i) => (
                  <motion.span
                    key={i}
                    className="w-[4px] rounded-full bg-white"
                    style={{ boxShadow: "0 0 6px rgba(255,255,255,0.7)" }}
                    animate={{ scaleY: [base, 1, base * 0.5, 0.9, base] }}
                    transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.09, ease: "easeInOut" }}
                    initial={{ height: "100%", transformOrigin: "bottom" }}
                  />
                ))}
              </div>
              {/* Iskra AI w rogu */}
              <motion.div
                className="absolute top-2 right-2 z-10"
                animate={{ scale: [1, 1.4, 1], opacity: [0.7, 1, 0.7], rotate: [0, 90, 0] }}
                transition={{ duration: 2.2, repeat: Infinity }}
              >
                <Sparkles className="h-4 w-4 text-white" />
              </motion.div>
              {/* Pulsująca ramka */}
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

          {/* Wieża hi-fi — gramofon/CD/kaseta + radio i wybór wykonawcy (gra nasz katalog) */}
          <StudioHifi />

          {/* Engine badge */}
          <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-[#FF6B00]/10 to-[#9333EA]/10 border border-[#FF6B00]/20">
            <Sparkles className="h-3.5 w-3.5 text-[#FF9500]" />
            <span className="text-xs text-gray-300">
              {engine === "grouai"
                ? <>Napędzany przez <span className="text-[#FF9500] font-semibold">GrouAI Studio Engine</span> — Suno V5 + GPT, studyjna jakość, śpiewane wokale</>
                : engine === "elevenlabs"
                ? <>Napędzany przez <span className="text-[#FF9500] font-semibold">ElevenLabs Music v1</span> — studyjna jakość, śpiewane wokale</>
                : <>Napędzany przez <span className="text-[#FF9500] font-semibold">GrouAI Multi-Engine Router</span> — auto-routing przez n8n</>}
            </span>
          </div>

          {/* === NATURAL LANGUAGE PROMPT BOX (PL/EN/NL/UK) === */}
          <MusicPromptBox
            onTrackReady={(data) => {
              if (data.audioUrl) {
                setResult({
                  audioUrl: data.audioUrl,
                  imageUrl: data.coverUrl,
                  title: data.plan?.title || data.plan?.lyrics_theme?.substring(0, 60) || `${data.plan?.genre || "AI"} ${data.plan?.mood || ""}`.trim(),
                  genre: data.plan?.genre || "AI",
                  generationId: data.generationId,
                  durationSeconds: data.plan?.duration_seconds || 30,
                  lyrics: [],
                });
                toast.success(`🎵 Twój utwór jest gotowy!`);
              } else if (data.processing) {
                toast.info(
                  data.engine === "suno"
                    ? "🎤 Suno komponuje pełny utwór z wokalem (~30-60s)…"
                    : "🎶 ElevenLabs przygotowuje wokal premium…",
                );
              }
            }}
          />

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
            <button
              onClick={() => setActiveTab("video")}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                activeTab === "video" ? "text-white" : "text-gray-400 hover:text-gray-200"
              }`}
              style={activeTab === "video" ? { background: "linear-gradient(135deg, #FF6B00, #9333EA)", boxShadow: "0 0 15px #9333EA40" } : undefined}
            >
              <Film className="h-4 w-4" /> Video Studio
            </button>
          </div>

          {activeTab === "mix" ? (
            <TrackMixer />
          ) : activeTab === "video" ? (
            <VideoStudio />
          ) : (
          <>
          {/* === RĘCZNY PANEL (jak w Suno): tytuł, styl, tekst, długość, nastrój === */}
          <div className="space-y-5 p-5 rounded-2xl border border-[#FF6B00]/20 bg-[#12121c]/70 backdrop-blur-md">
            {/* Baner presetu GROUA ERA */}
            {eraPreset && (
              <div className="flex items-center gap-3 p-3 rounded-xl border"
                style={{ borderColor: `${eraPreset.accent}55`, background: `${eraPreset.accent}14` }}>
                <span className="text-2xl">{eraPreset.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">Tworzysz epokę: GROUA ERA {eraPreset.label}</p>
                  <p className="text-[11px] text-gray-400">Ustawienia dobrane pod charakter epoki — możesz je dowolnie zmienić.</p>
                </div>
                <Sparkles className="h-4 w-4" style={{ color: eraPreset.accent }} />
              </div>
            )}
            {/* Szybkie presety — gotowe pomysły */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-400 flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-[#FF9500]" /> Szybki start</Label>
              <div className="flex flex-wrap gap-2">
                {QUICK_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setGenre(p.genre);
                      setMood(p.mood);
                      setTempo(p.tempo);
                      setIntensity(p.intensity);
                      setTitle(p.title);
                    }}
                    className="px-3 py-1.5 rounded-full text-xs border border-[#9333EA]/30 bg-[#9333EA]/10 text-gray-200 hover:bg-[#9333EA]/20 hover:border-[#9333EA]/60 transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tytuł utworu */}
            <div className="space-y-2">
              <Label htmlFor="track-title" className="text-xs text-gray-400 flex items-center gap-1.5"><Type className="h-3.5 w-3.5 text-[#FF9500]" /> Tytuł utworu</Label>
              <Input
                id="track-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="np. Nocna jazda"
                maxLength={80}
                className="bg-[#1a1a2e]/80 border-[#FF6B00]/20 text-white placeholder:text-gray-600 focus-visible:ring-[#FF6B00]/40"
              />
            </div>

            {/* Styl / gatunek */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-400 flex items-center gap-1.5"><Guitar className="h-3.5 w-3.5 text-[#FF9500]" /> Styl</Label>
              <div className="flex flex-wrap gap-2">
                {GENRES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGenre(g)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                      genre === g
                        ? "border-[#FF6B00] bg-[#FF6B00]/20 text-white"
                        : "border-white/10 bg-[#1a1a2e]/60 text-gray-400 hover:text-gray-200 hover:border-[#FF6B00]/40"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>

              {/* Mieszanie dwóch stylów */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setGenre2(genre2 ? null : (GENRES.find((g) => g !== genre) || null))}
                  className="text-[11px] text-[#9333EA] hover:text-[#c084fc] flex items-center gap-1"
                >
                  <Blend className="h-3 w-3" /> {genre2 ? "Wyłącz miks stylów" : "Zmiksuj z drugim stylem"}
                </button>
                {genre2 && (
                  <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {GENRES.filter((g) => g !== genre).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setGenre2(g)}
                          className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
                            genre2 === g
                              ? "border-[#9333EA] bg-[#9333EA]/20 text-white"
                              : "border-white/10 bg-[#1a1a2e]/60 text-gray-400 hover:text-gray-200"
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-gray-500 w-16 truncate">{genre}</span>
                      <Slider value={[blendRatio]} onValueChange={(v) => setBlendRatio(v[0])} min={10} max={90} step={5} className="flex-1" />
                      <span className="text-[10px] text-gray-500 w-16 truncate text-right">{genre2}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Długość */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-400 flex items-center gap-1.5"><Gauge className="h-3.5 w-3.5 text-[#FF9500]" /> Długość</Label>
              <div className="flex gap-2">
                {DURATION_OPTIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className={`flex-1 py-1.5 rounded-lg text-xs border transition-colors ${
                      duration === d
                        ? "border-[#FF6B00] bg-[#FF6B00]/20 text-white"
                        : "border-white/10 bg-[#1a1a2e]/60 text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {d < 60 ? `${d}s` : `${d / 60}min`}
                  </button>
                ))}
              </div>
            </div>

            {/* Instrumental */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#1a1a2e]/60 border border-white/5">
              <div className="flex items-center gap-2">
                <Music className="h-4 w-4 text-[#FF9500]" />
                <div>
                  <p className="text-sm text-gray-200">Instrumentalny</p>
                  <p className="text-[10px] text-gray-500">Bez wokalu — sama muzyka</p>
                </div>
              </div>
              <Switch checked={instrumental} onCheckedChange={setInstrumental} />
            </div>

            {/* Tekst piosenki — ręcznie */}
            <AnimatePresence initial={false}>
              {!instrumental && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <Label htmlFor="track-lyrics" className="text-xs text-gray-400 flex items-center gap-1.5"><Mic className="h-3.5 w-3.5 text-[#FF9500]" /> Tekst piosenki (ręcznie)</Label>
                    <button
                      type="button"
                      onClick={() => {
                        const auto = generateLyrics(genre, title || `${genre} Track`, duration, false)
                          .map((l) => l.text)
                          .join("\n");
                        setCustomLyrics(auto);
                        toast.success("Wygenerowano szkic tekstu — możesz go dowolnie edytować ✍️");
                      }}
                      className="text-[11px] text-[#9333EA] hover:text-[#c084fc] flex items-center gap-1"
                    >
                      <Wand2 className="h-3 w-3" /> Podpowiedz tekst
                    </button>
                  </div>
                  <Textarea
                    id="track-lyrics"
                    value={customLyrics}
                    onChange={(e) => setCustomLyrics(e.target.value)}
                    placeholder={"Wpisz własny tekst — silnik zaśpiewa go dokładnie.\n\n[Zwrotka 1]\n...\n\n[Refren]\n..."}
                    rows={6}
                    className="bg-[#1a1a2e]/80 border-[#FF6B00]/20 text-white placeholder:text-gray-600 focus-visible:ring-[#FF6B00]/40 resize-y font-mono text-sm leading-relaxed"
                  />
                  <p className="text-[10px] text-gray-500">
                    Zostaw puste, aby AI napisało tekst automatycznie. Znaczniki jak <span className="text-gray-400">[Zwrotka]</span>, <span className="text-gray-400">[Refren]</span> pomagają w strukturze.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Zaawansowane: nastrój, tempo, wokal, produkcja */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="text-xs text-[#FF9500] hover:text-white flex items-center gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" /> {showAdvanced ? "Ukryj opcje zaawansowane" : "Opcje zaawansowane (nastrój, tempo, wokal)"}
              </button>
              <AnimatePresence initial={false}>
                {showAdvanced && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-3 space-y-4">
                      {/* Nastrój */}
                      <div className="space-y-2">
                        <Label className="text-[11px] text-gray-400">Nastrój</Label>
                        <div className="flex flex-wrap gap-2">
                          {MOODS.map((m) => {
                            const Icon = m.icon;
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => setMood(m.id)}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] border flex items-center gap-1.5 transition-colors ${
                                  mood === m.id ? "border-current bg-white/10 text-white" : "border-white/10 bg-[#1a1a2e]/60 text-gray-400 hover:text-gray-200"
                                }`}
                                style={mood === m.id ? { color: m.color } : undefined}
                              >
                                <Icon className="h-3.5 w-3.5" /> {m.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Tempo */}
                      <div className="space-y-2">
                        <Label className="text-[11px] text-gray-400">Tempo</Label>
                        <div className="flex flex-wrap gap-2">
                          {TEMPOS.map((tp) => (
                            <button
                              key={tp.id}
                              type="button"
                              onClick={() => setTempo(tp.id)}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] border transition-colors ${
                                tempo === tp.id ? "border-[#FF6B00] bg-[#FF6B00]/20 text-white" : "border-white/10 bg-[#1a1a2e]/60 text-gray-400 hover:text-gray-200"
                              }`}
                            >
                              {tp.label} <span className="opacity-60">· {tp.bpm}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Styl wokalu — tylko gdy nie instrumentalny */}
                      {!instrumental && (
                        <div className="space-y-2">
                          <Label className="text-[11px] text-gray-400">Styl wokalu</Label>
                          <div className="flex flex-wrap gap-2">
                            {VOCAL_STYLES.map((vs) => (
                              <button
                                key={vs.id}
                                type="button"
                                onClick={() => setVocalStyle(vs.id)}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] border transition-colors ${
                                  vocalStyle === vs.id ? "border-[#9333EA] bg-[#9333EA]/20 text-white" : "border-white/10 bg-[#1a1a2e]/60 text-gray-400 hover:text-gray-200"
                                }`}
                              >
                                {vs.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Intensywność produkcji */}
                      <div className="space-y-2">
                        <Label className="text-[11px] text-gray-400">Produkcja</Label>
                        <div className="flex flex-wrap gap-2">
                          {INTENSITIES.map((it) => (
                            <button
                              key={it.id}
                              type="button"
                              onClick={() => setIntensity(it.id)}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] border transition-colors ${
                                intensity === it.id ? "border-[#FF6B00] bg-[#FF6B00]/20 text-white" : "border-white/10 bg-[#1a1a2e]/60 text-gray-400 hover:text-gray-200"
                              }`}
                            >
                              {it.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Twój głos (klonowanie) — nadpisuje głos dobrany po gatunku */}
                      {!instrumental && (
                        <div className="space-y-3 pt-1 border-t border-white/5">
                          <Label className="text-[11px] text-gray-400 flex items-center gap-1.5"><Mic className="h-3.5 w-3.5 text-[#9333EA]" /> Twój głos (opcjonalnie)</Label>
                          <VoiceLibrary
                            selectedVoiceId={clonedVoiceId}
                            onSelect={(id, label) => { setClonedVoiceId(id); setClonedVoiceLabel(label); }}
                            refreshKey={voiceLibKey}
                          />
                          <VoiceRecorder
                            clonedVoiceId={clonedVoiceId}
                            clonedVoiceLabel={clonedVoiceLabel}
                            onVoiceCloned={(id, label) => { setClonedVoiceId(id); setClonedVoiceLabel(label); setVoiceLibKey((k) => k + 1); }}
                            onCleared={() => { setClonedVoiceId(null); setClonedVoiceLabel(null); }}
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Przycisk generowania */}
            <Button
              onClick={generate}
              disabled={generating}
              className="w-full h-12 text-white font-bold gap-2 border-0 disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #FF6B00, #FF9500)", boxShadow: "0 0 20px #FF6B0050" }}
            >
              {generating ? (
                <><span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Generuję…</>
              ) : (
                <><Sparkles className="h-5 w-5" /> Wygeneruj utwór</>
              )}
            </Button>
          </div>

          {/* Status */}
          {genStatus && (
            <p className="text-sm text-center text-gray-400">{genStatus}</p>
          )}

          {/* Free-tier usage badge */}
          {user && !isPro && (
            <div className={`flex items-center justify-between p-3 rounded-xl border ${
              freeUsed >= FREE_GENERATION_LIMIT
                ? "border-[#FF6B00]/50 bg-[#FF6B00]/10"
                : "border-[#9333EA]/30 bg-[#1a1a2e]/60"
            }`}>
              <div className="flex items-center gap-2 text-xs">
                {freeUsed >= FREE_GENERATION_LIMIT ? (
                  <Lock className="h-4 w-4 text-[#FF9500]" />
                ) : (
                  <Sparkles className="h-4 w-4 text-[#9333EA]" />
                )}
                <span className="text-gray-300">
                  Free: <span className="font-bold text-white">{freeUsed} / {FREE_GENERATION_LIMIT}</span> utworów wykorzystanych
                </span>
              </div>
              {freeUsed >= FREE_GENERATION_LIMIT && (
                <Link
                  to="/settings"
                  className="text-xs text-[#FF9500] hover:text-white font-semibold flex items-center gap-1"
                >
                  <Crown className="h-3 w-3" /> Upgrade
                </Link>
              )}
            </div>
          )}

          {!user && (
            <p className="text-center text-xs text-gray-500">
              <a href="/auth" className="text-[#FF9500] underline">Zaloguj się</a>, aby generować i zapisywać utwory
            </p>
          )}

          {/* Iskry w tle podczas generowania — stabilne, bez błysków */}
          <StudioSparksBackdrop active={generating} />

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
                className="relative p-5 rounded-2xl border border-[#FF6B00]/40 bg-[#12121c]/85 backdrop-blur-md space-y-4 overflow-hidden"
                style={{ boxShadow: "inset 0 0 0 1px rgba(255,149,0,0.08), 0 0 24px rgba(255,107,0,0.18), 0 8px 32px rgba(0,0,0,0.45)" }}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-24 -right-24 w-56 h-56 rounded-full"
                  style={{ background: "radial-gradient(circle, rgba(255,107,0,0.18), transparent 70%)" }}
                />

                <motion.div
                  className="flex items-center gap-3 relative z-10"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  {result.imageUrl ? (
                    <motion.img
                      src={result.imageUrl}
                      alt={result.title}
                      className="w-24 h-24 rounded-xl object-cover border border-[#FF6B00]/40 shadow-lg"
                      style={{ boxShadow: "0 0 25px #FF6B0030" }}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <motion.div
                      className="w-14 h-14 rounded-xl flex items-center justify-center"
                      style={{ background: "linear-gradient(135deg, #FF6B00, #FF9500)" }}
                      animate={{ rotate: [0, 5, -5, 0] }}
                      transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                    >
                      <Music className="h-7 w-7 text-white" />
                    </motion.div>
                  )}
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

                {/* Pobieranie + Wyślij — jak w Suno */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="relative z-10 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      const data = { title: result.title, text: `Posłuchaj „${result.title}” — stworzone w GrouAI Studio 🎧`, url: result.audioUrl };
                      if (navigator.share) navigator.share(data).catch(() => {});
                      else navigator.clipboard.writeText(result.audioUrl).then(() => toast.success("Link skopiowany 🔗"));
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white border border-white/15 bg-white/5 transition-transform hover:scale-105 hover:bg-white/10"
                  >
                    <Share2 className="h-4 w-4" />
                    Wyślij
                  </button>
                  <button
                    onClick={() => {
                      downloadAudio(result.audioUrl, `${result.title || "grouai-track"}.mp3`)
                        .then(() => toast.success("Pobieranie rozpoczęte 🎵"))
                        .catch(() => window.open(result.audioUrl, "_blank"));
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white transition-transform hover:scale-105"
                    style={{ background: "linear-gradient(135deg, #FF6B00, #FF9500)", boxShadow: "0 0 15px #FF6B0040" }}
                  >
                    <Download className="h-4 w-4" />
                    Pobierz MP3
                  </button>
                </motion.div>

                {result.lyrics.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="relative z-10">
                    <LyricsDisplay lyrics={result.lyrics} currentTime={playbackTime} isPlaying={isPlaying} totalDuration={result.durationSeconds} />
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          </>
          )}
          </div>

          {/* Twoje utwory — biblioteka jak w Suno (zawsze widoczna, te same funkcje dla wszystkich) */}
          <aside className="mt-10 xl:mt-0 xl:sticky xl:top-24 w-full max-w-2xl mx-auto xl:mx-0 min-w-0">
            <GenerationHistory />
          </aside>
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

      {/* Paywall Modal — free tier limit reached */}
      <Dialog open={showPaywall} onOpenChange={setShowPaywall}>
        <DialogContent className="bg-[#1a1a2e] border-[#FF6B00]/40 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl text-center flex flex-col items-center gap-3">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, #FF6B00, #FF9500, #9333EA)",
                  boxShadow: "0 0 30px #FF6B0060",
                }}
              >
                <Crown className="h-8 w-8 text-white" />
              </div>
              <span style={{ background: "linear-gradient(135deg, #FF6B00, #FF9500)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Wykorzystałeś darmowy utwór
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-300 text-center leading-relaxed">
              Każdy nowy użytkownik ma <span className="text-[#FF9500] font-semibold">1 darmowy utwór</span> w GrouAI Studio.
              Aby tworzyć kolejne — wybierz plan Pro lub Ultimate.
            </p>
            <div className="space-y-2 text-xs text-gray-400">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[#FF6B00]/10 border border-[#FF6B00]/20">
                <Sparkles className="h-4 w-4 text-[#FF9500] flex-shrink-0" />
                <span>Nielimitowane generowanie utworów</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[#9333EA]/10 border border-[#9333EA]/20">
                <Mic className="h-4 w-4 text-[#9333EA] flex-shrink-0" />
                <span>Klonowanie nielimitowanej liczby głosów</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[#FF6B00]/10 border border-[#FF6B00]/20">
                <Music className="h-4 w-4 text-[#FF9500] flex-shrink-0" />
                <span>Pełna biblioteka utworów w chmurze</span>
              </div>
            </div>
            <Link to="/settings" onClick={() => setShowPaywall(false)}>
              <Button
                className="w-full h-12 text-white border-0 font-bold gap-2"
                style={{
                  background: "linear-gradient(135deg, #FF6B00, #FF9500)",
                  boxShadow: "0 0 25px #FF6B0050",
                }}
              >
                <Crown className="h-5 w-5" /> Zobacz plany
              </Button>
            </Link>
            <button
              onClick={() => setShowPaywall(false)}
              className="w-full text-center text-xs text-gray-500 hover:text-gray-300"
            >
              Może później
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Wąskie, przeciągalne okno chat-Grok — wszystko w jednym */}
      <StudioGrokDock />

    </MainLayout>
  );
};

export default Suno;
