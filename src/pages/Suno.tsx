import { useState, useRef, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Music, Guitar, Waves, Blend, Type, Zap, Mic, Heart, Gauge, Flame, Wand2, Sun, Moon, Cloud, Coffee, SlidersHorizontal, ListMusic, Timer } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { motion, AnimatePresence } from "framer-motion";
import { TrackMixer } from "@/components/studio/TrackMixer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { NeonWavesLoader } from "@/components/studio/NeonWavesLoader";
import { GenerationHistory } from "@/components/studio/GenerationHistory";
import { LyricsDisplay, generateLyrics, parseLyricsFromText } from "@/components/studio/LyricsDisplay";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MusicPromptBox } from "@/components/studio/MusicPromptBox";
import { VoiceRecorder } from "@/components/studio/VoiceRecorder";
import { VoiceLibrary } from "@/components/studio/VoiceLibrary";
import { StudioGrokDock } from "@/components/studio/StudioGrokDock";
import { StudioHifi } from "@/components/studio/StudioHifi";
import { StudioSparksBackdrop } from "@/components/studio/StudioSparksBackdrop";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { uploadToR2 } from "@/lib/r2Upload";
import { mirrorToR2, isPersistentAudioUrl } from "@/lib/mirrorAudio";
import { certifyWithToasts } from "@/lib/releasePipeline";
import { renderScore } from "@/lib/musicSynth";
import { generateMusic } from "@/utils/musicGenerator";
import { Lock, Crown, Download, Share2, Film, Disc3 } from "lucide-react";
import { VideoStudio } from "@/components/studio/VideoStudio";
import { GrouaiStudioShell } from "@/components/studio/daw/GrouaiStudioShell";
import { StudioBrandHeader } from "@/components/studio/create/StudioBrandHeader";
import { MoodAnalysisCard, type MoodSuggestion } from "@/components/studio/create/MoodAnalysisCard";
import { PromptCoach } from "@/components/studio/create/PromptCoach";
import { GeneratedTrackPlayer } from "@/components/studio/create/GeneratedTrackPlayer";
import { MOOD_STYLE } from "@/lib/moodDetect";
import { sectionsFromLyrics, SECTION_META, structureToLyrics, structureToPrompt, type SongStructure } from "@/lib/songStructures";
import { checkSpotifyReady, type SpotifyReadyCheck } from "@/lib/loudness";
import { SpotifyReadyBadge } from "@/components/studio/SpotifyReadyBadge";
import { downloadAudio, isSubscriptionError } from "@/lib/hubStudio";
import { Link, useSearchParams } from "react-router-dom";
import { getEra, eraStudioGenre, trackYear, eraForYear } from "@/lib/eraEngine";
import { eraUi } from "@/lib/eraContent";

const FREE_GENERATION_LIMIT = 1;
// 🎉 Darmowy tydzień w GrouAI Studio — do tej daty każdy tworzy bez limitu.
const FREE_WEEK_UNTIL = new Date("2026-08-31T23:59:59Z");
const isFreeWeek = () => Date.now() < FREE_WEEK_UNTIL.getTime();

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
  // Lokalny tłumacz Studia — całe UII przełącza się na wybrany język (PL/EN/NL/UA).
  const L = (pl: string, en: string, nl: string, ua: string) =>
    language === "en" ? en : language === "nl" ? nl : language === "ua" ? ua : pl;
  const moodL = (id: string) => (({ happy: L("Radosny","Happy","Vrolijk","Радісний"), sad: L("Melancholijny","Melancholic","Melancholisch","Меланхолійний"), energetic: L("Energetyczny","Energetic","Energiek","Енергійний"), chill: L("Chillout","Chill","Chill","Чіл"), romantic: L("Romantyczny","Romantic","Romantisch","Романтичний"), dark: L("Mroczny","Dark","Duister","Похмурий") }) as Record<string,string>)[id] || id;
  const tempoL = (id: string) => (({ slow: L("Wolne","Slow","Langzaam","Повільне"), medium: L("Średnie","Medium","Gemiddeld","Середнє"), fast: L("Szybkie","Fast","Snel","Швидке"), "very-fast": L("Bardzo szybkie","Very fast","Zeer snel","Дуже швидке") }) as Record<string,string>)[id] || id;
  const vocalL = (id: string) => (({ singing: L("Śpiew","Singing","Zang","Спів"), rap: L("Rap","Rap","Rap","Реп"), whisper: L("Szept","Whisper","Fluister","Шепіт"), powerful: L("Mocny","Powerful","Krachtig","Потужний"), soft: L("Delikatny","Soft","Zacht","Ніжний") }) as Record<string,string>)[id] || id;
  const intensityL = (id: string) => (({ minimal: L("Minimal","Minimal","Minimaal","Мінімал"), balanced: L("Zbalansowany","Balanced","Gebalanceerd","Збалансований"), rich: L("Bogata","Rich","Rijk","Багата"), epic: L("Epicka","Epic","Episch","Епічна") }) as Record<string,string>)[id] || id;
  const presetL = (pl: string) => (({
    "🌙 Lo-fi do nauki": L("🌙 Lo-fi do nauki","🌙 Lo-fi for studying","🌙 Lo-fi om te studeren","🌙 Lo-fi для навчання"),
    "💪 Trening na siłce": L("💪 Trening na siłce","💪 Gym workout","💪 Work-out","💪 Тренування в залі"),
    "❤️ Pierwszy taniec": L("❤️ Pierwszy taniec","❤️ First dance","❤️ Eerste dans","❤️ Перший танець"),
    "🎉 Impreza": L("🎉 Impreza","🎉 Party","🎉 Feest","🎉 Вечірка"),
    "🌧️ Deszczowy poranek": L("🌧️ Deszczowy poranek","🌧️ Rainy morning","🌧️ Regenachtige ochtend","🌧️ Дощовий ранок"),
    "🚀 Epicki finał": L("🚀 Epicki finał","🚀 Epic finale","🚀 Episch finale","🚀 Епічний фінал"),
  } as Record<string,string>)[pl] || pl);
  const [activeTab, setActiveTab] = useState<"generate" | "mix" | "suno" | "video" | "record">("generate");
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
  // Szybkie generowanie (prompt) vs Studio zaawansowane (struktura, BPM, nastrój)
  const [createMode, setCreateModeState] = useState<"quick" | "advanced">(() => {
    try { return localStorage.getItem("studio-create-mode") === "advanced" ? "advanced" : "quick"; } catch { return "quick"; }
  });
  const setCreateMode = (m: "quick" | "advanced") => { setCreateModeState(m); try { localStorage.setItem("studio-create-mode", m); } catch { /* brak pamięci */ } };
  const [quickPrompt, setQuickPrompt] = useState("");
  const onQuickPrompt = useCallback((p: string) => setQuickPrompt(p), []);
  const [extraPrompt, setExtraPrompt] = useState("");
  const [bpm, setBpm] = useState<number | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const uiLang: "pl" | "en" = language === "pl" ? "pl" : "en";
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
  const [spotifyCheck, setSpotifyCheck] = useState<SpotifyReadyCheck | null>(null);

  // Policz znacznik "gotowe na Spotify" dla świeżo gotowego utworu (parametry
  // techniczne wg publicznych wytycznych Spotify — nie wysyła nic nigdzie).
  useEffect(() => {
    if (!result?.audioUrl) { setSpotifyCheck(null); return; }
    let cancelled = false;
    setSpotifyCheck(null);
    (async () => {
      try {
        const r = await fetch(result.audioUrl);
        const arr = await r.arrayBuffer();
        const ctx = new AudioContext();
        const buf = await ctx.decodeAudioData(arr);
        ctx.close();
        if (!cancelled) setSpotifyCheck(checkSpotifyReady(buf));
      } catch { /* cicho — znacznik po prostu się nie pokaże */ }
    })();
    return () => { cancelled = true; };
  }, [result?.audioUrl]);
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
    const yearParam = searchParams.get("year");
    const y = yearParam && /^\d{4}$/.test(yearParam) ? parseInt(yearParam, 10) : undefined;
    // Gatunek epoki → lista stylów Studia
    setGenre(eraStudioGenre(era));
    // Tytuł sugerowany — z rokiem, żeby utwór trafił do GROUA ERA pod tym rokiem
    setTitle(`GROUA ERA ${y ?? era.label}`);
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
    setCreateModeState("advanced");
    setEraPreset({ label: y ? String(y) : era.label, accent: era.palette.accent, emoji: era.emoji });
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

  // Nastrój → styl: w szybkim trybie dopisuje klimat do promptu, w zaawansowanym ustawia gatunek/tempo/nastrój.
  const applyMoodSuggestion = (sg: MoodSuggestion) => {
    const st = MOOD_STYLE[sg.mood];
    if (createMode === "quick") {
      window.dispatchEvent(new CustomEvent("grouai:studio-set-prompt", { detail: { text: uiLang === "pl" ? st.prompt : st.promptEn, mode: "append" } }));
    } else {
      setGenre(st.genre);
      setMood(sg.mood === "epic" ? "dark" : sg.mood);
      setTempo(st.tempo);
      setBpm(null);
      setIntensity(st.intensity);
    }
    toast.success(L(`Styl dopasowany do nastroju: ${st.genre}`,`Style matched to mood: ${st.genre}`,`Stijl afgestemd: ${st.genre}`,`Стиль підібрано: ${st.genre}`));
  };
  const applyStructure = (st: SongStructure) => {
    if (instrumental) { setExtraPrompt((p) => (p.trim() ? `${p.trim()}, ${structureToPrompt(st, uiLang)}` : structureToPrompt(st, uiLang))); return; }
    if (customLyrics.trim() && !window.confirm(L("Zastąpić obecny tekst szablonem struktury?","Replace current lyrics with the structure template?","Huidige tekst vervangen door sjabloon?","Замінити текст шаблоном?"))) return;
    setCustomLyrics(structureToLyrics(st, uiLang));
    setTimeout(() => document.getElementById("track-lyrics")?.focus(), 50);
  };
  const lyricSections = sectionsFromLyrics(customLyrics);
  const moodCard = (
    <MoodAnalysisCard
      text={createMode === "quick" ? quickPrompt : `${title} ${genre} ${extraPrompt} ${customLyrics}`}
      lang={uiLang} L={L}
      onApply={applyMoodSuggestion}
    />
  );

  // Nowy utwór → przewiń do odtwarzacza.
  useEffect(() => {
    if (result?.audioUrl) setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 350);
  }, [result?.audioUrl]);

  const generate = async () => {
    // === GATE 1: must be logged in to generate (so we can track usage) ===
    if (!user) {
      toast.error(t("studio.toast.loginRequired"));
      return;
    }

    // === GATE 2: free users get only 1 generation, then paywall ===
    // 🎉 Darmowy tydzień — w tym okresie każdy tworzy bez limitu (brak paywalla).
    if (!isPro && !isFreeWeek() && freeUsed >= FREE_GENERATION_LIMIT) {
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
      let musicPrompt = `${genreBlend} ${title ? `"${title}"` : ""} track, ${moodDesc}, ${bpm ? `${bpm} BPM` : tempoDesc}, ${intensityDesc}${vocalDesc ? `, with ${vocalDesc}` : ""}${extraPrompt.trim() ? `, ${extraPrompt.trim()}` : ""}, professional studio quality`.trim().replace(/\s+,/g, ",");

      // === Piosenka z DATĄ w tytule → dobierz brzmienie z tamtych czasów ===
      // (np. "Lato 1994" → sound lat 90.). Rok trafia też do albumu, żeby utwór
      // pojawił się w GROUA ERA pod właściwym rokiem.
      const detectedYear = trackYear({ title });
      const eraOfYear = detectedYear ? eraForYear(detectedYear) : undefined;
      if (eraOfYear) {
        musicPrompt = `${musicPrompt}, ${eraOfYear.vibe}, ${eraOfYear.instrumentation.join(", ")}, authentic sound of the year ${detectedYear}`;
      }
      const eraAlbum = detectedYear ? `AI ERA ${detectedYear}` : "AI Generated";

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
            if (se) {
              // Treść odpowiedzi funkcji (np. 401 sesji) zamiast ogólnego „non-2xx".
              const ctx = await (se as any)?.context?.json?.().catch(() => null);
              throw new Error(ctx?.error || se.message);
            }
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
                const remoteUrl = (st as any)?.audio_url;
                if (!remoteUrl) throw new Error("brak audio");
                const trackTitle = (st as any)?.title || title || `${genre} Track`;
                const coverUrl = (st as any)?.cover_url || undefined;
                const lyrics = customLyrics.trim()
                  ? parseLyricsFromText(customLyrics, duration)
                  : generateLyrics(genre, trackTitle, duration, instrumental);
                // Kopia na R2 — adres dostawcy nie jest trwały (zniknął Storage projektu).
                setGenStatus(t("studio.status.uploading"));
                const url = await mirrorToR2(remoteUrl, trackTitle, user!.id);
                setResult({ audioUrl: url, title: trackTitle, genre, durationSeconds: (st as any)?.duration || duration, lyrics, imageUrl: coverUrl });
                setGenStatus(t("studio.status.done"));
                toast.success(`🎶 "${trackTitle}" — Suno V5.5, najwyższa jakość!`);
                const { data: gen } = await supabase.from("generations").insert({
                  user_id: user!.id, title: trackTitle, genre,
                  prompt: musicPrompt, instrumental, status: "completed", audio_url: url,
                }).select("id").maybeSingle();
                // Od razu w „Nowe na serwerze” — pod nazwą twórcy (tak też pójdzie do Spotify).
                const artistName = user!.user_metadata?.display_name || user!.email?.split("@")[0] || "GrouAI Studio";
                const { data: tr } = await supabase.from("tracks").insert({
                  user_id: user!.id, title: trackTitle, artist: artistName,
                  album: eraAlbum, duration: (st as any)?.duration || duration,
                  audio_url: url, cover_url: coverUrl || null, genre, mood,
                }).select("id").maybeSingle();
                window.dispatchEvent(new CustomEvent("grouai:generations-changed"));
                // Studio GrouAI: mastering pod Spotify, WAV, okładka 3000×3000, czysty tekst → znaczek.
                if (isPersistentAudioUrl(url)) {
                  certifyWithToasts({
                    audioUrl: url, coverUrl, title: trackTitle, artist: artistName, genre,
                    lyrics: customLyrics.trim() || (st as any)?.all?.[0]?.prompt || "",
                    instrumental, userId: user!.id, generationId: gen?.id, trackId: tr?.id,
                  });
                }
                if (!isPro) setFreeUsed((prev) => prev + 1);
                return true;
              }
              if (s === "failed") throw new Error((st as any)?.error || "generacja nie powiodła się");
              setGenStatus(`⏳ Suno V5.5 renderuje… (${Math.round((Date.now() - t0) / 1000)}s)`);
            }
            throw new Error("timeout");
          } catch (e) {
            console.warn("[Studio] suno-generate niedostępny — przechodzę na GrouAI Engine:", e);
            toast.warning(`Suno: ${(e as Error)?.message || "brak odpowiedzi"} — generuję zapasowym silnikiem (instrumentalnie, do 30 s).`, { duration: 9000 });
            return false;
          }
        })();
        if (sunoOk) return;

        // ── STOPIEŃ 2: GrouAI Engine (MusicGen na Replicate, w projekcie Lovable). Zastępuje
        // dawny silnik „hub" z usuniętego projektu. Instrumentalnie, do 30 s; plik trafia na R2.
        const studioOk = await (async (): Promise<boolean> => {
          try {
            setGenStatus("🧠 GrouAI Engine komponuje…");
            const engineDuration = Math.min(Math.max(duration, 8), 30);
            const { data: gd, error: ge } = await supabase.functions.invoke("groua-music-engine", {
              body: { action: "generate", prompt: musicPrompt.slice(0, 780), duration: engineDuration, instrumental: true, title: title || undefined },
            });
            if (ge) throw ge;
            if ((gd as any)?.error) throw new Error((gd as any).error);
            const predictionId = (gd as any)?.id as string | undefined;
            const generationId = (gd as any)?.generation_id as string | undefined;
            if (!predictionId) throw new Error("brak prediction_id");

            const t0 = Date.now();
            let remoteUrl: string | null = null;
            while (Date.now() - t0 < 240_000) {
              await new Promise((r) => setTimeout(r, 3000));
              const { data: st } = await supabase.functions.invoke("groua-music-engine", {
                body: { action: "status", prediction_id: predictionId, generation_id: generationId },
              });
              const s2 = (st as any)?.status;
              if (s2 === "succeeded") { remoteUrl = (st as any)?.output || null; break; }
              if (s2 === "failed" || s2 === "canceled") throw new Error((st as any)?.error || "generacja nie powiodła się");
              setGenStatus(`⏳ GrouAI Engine renderuje… (${Math.round((Date.now() - t0) / 1000)}s)`);
            }
            if (!remoteUrl) throw new Error("timeout");

            const trackTitle = title || `${genre} Track`;
            setGenStatus(t("studio.status.uploading"));
            const url = await mirrorToR2(remoteUrl, trackTitle, user!.id); // nic nie robi, gdy już na R2
            const lyrics = generateLyrics(genre, trackTitle, engineDuration, true);
            setResult({ audioUrl: url, title: trackTitle, genre, durationSeconds: engineDuration, lyrics });
            setGenStatus(t("studio.status.done"));
            toast.success(`🎶 "${trackTitle}" — GrouAI Engine (instrumental)`);
            if (isPersistentAudioUrl(url)) {
              await supabase.from("tracks").insert({
                user_id: user!.id, title: trackTitle, artist: "GrouAI Studio",
                album: eraAlbum, duration: engineDuration, audio_url: url, genre, mood,
              });
            }
            window.dispatchEvent(new CustomEvent("grouai:generations-changed"));
            if (!isPro) setFreeUsed((prev) => prev + 1);
            return true;
          } catch (e) {
            if (isSubscriptionError(e)) { setShowPaywall(true); setGenStatus(""); throw e; }
            console.warn("[Studio] GrouAI Engine niedostępny — plan B (lokalny):", e);
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
            album: eraAlbum, duration, audio_url: publicAudioUrl, genre, mood,
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
          album: eraAlbum,
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
    if (!isPersistentAudioUrl(result.audioUrl)) {
      toast.error("Plik nie został jeszcze zapisany na serwerze — spróbuj wygenerować ponownie.");
      return;
    }
    try {
      const artistName = user.user_metadata?.display_name || user.email?.split("@")[0] || "GrouAI Studio";
      const { error } = await supabase.from("tracks").insert({
        user_id: user.id,
        title: result.title,
        artist: artistName,
        album: (trackYear({ title: result.title }) ? `AI ERA ${trackYear({ title: result.title })}` : "AI Generated"),
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
      <div className="studio-premium min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 py-8 xl:grid xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-8 xl:items-start">
          <div className="space-y-6 w-full max-w-3xl mx-auto xl:mx-0 xl:max-w-none min-w-0">
          {/* Branding GrouAI Studio + Verified Human Streams */}
          <StudioBrandHeader
            L={L}
            poweredBy={<>
              {engine === "grouai"
                ? <>{L("Napędzany przez","Powered by","Aangedreven door","На основі")} <span className="text-[#FF9500] font-semibold">GrouAI Studio Engine</span> — Suno V5 + GPT, {L("studyjna jakość, śpiewane wokale","studio quality, sung vocals","studiokwaliteit, gezongen zang","студійна якість, співаний вокал")}</>
                : engine === "elevenlabs"
                ? <>{L("Napędzany przez","Powered by","Aangedreven door","На основі")} <span className="text-[#FF9500] font-semibold">ElevenLabs Music v1</span> — {L("studyjna jakość, śpiewane wokale","studio quality, sung vocals","studiokwaliteit, gezongen zang","студійна якість, співаний вокал")}</>
                : <>{L("Napędzany przez","Powered by","Aangedreven door","На основі")} <span className="text-[#FF9500] font-semibold">GrouAI Multi-Engine Router</span> — {L("auto-routing przez n8n","auto-routing via n8n","auto-routing via n8n","авто-маршрутизація через n8n")}</>}
            </>}
          />

          {/* Modes — stable controls with no animated backgrounds. */}
          <div className="grid grid-cols-4 gap-1 border-b border-border pb-2" role="tablist" aria-label="Studio">
            {([
              { id: "generate", icon: Sparkles, label: L("Generator","Generator","Generator","Генератор"), vip: false },
              { id: "mix", icon: Blend, label: L("Miks","Mix","Mix","Мікс"), vip: false },
              { id: "video", icon: Film, label: L("Wideo","Video","Video","Відео"), vip: false },
              { id: "record", icon: Disc3, label: L("Studio Pro","Studio Pro","Studio Pro","Studio Pro"), vip: true },
            ] as const).map(({ id, icon: Icon, label, vip }) => (
              <Button key={id} variant="ghost" role="tab" aria-selected={activeTab === id} onClick={() => setActiveTab(id)} className={activeTab === id ? "studio-premium-selected" : "text-muted-foreground hover:bg-secondary"}>
                <Icon className="h-4 w-4" />{label}{vip && <Crown className="h-3 w-3 text-[#FFD400]" />}
              </Button>
            ))}
          </div>

          {activeTab === "mix" ? (
            <TrackMixer />
          ) : activeTab === "video" ? (
            <VideoStudio />
          ) : activeTab === "record" ? (
            <GrouaiStudioShell />
          ) : (
          <>
          {/* Szybkie generowanie vs Studio zaawansowane */}
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[#1E2A44] bg-[#0B1020] p-1.5" role="tablist" aria-label={L("Tryb tworzenia","Creation mode","Maakmodus","Режим створення")}>
            {([
              { id: "quick", icon: Zap, title: L("Szybkie generowanie","Quick Generate","Snel genereren","Швидке створення"), sub: L("Opisz utwór — AI zrobi resztę","Describe it — AI does the rest","Beschrijf het — AI doet de rest","Опиши — решту зробить AI") },
              { id: "advanced", icon: SlidersHorizontal, title: L("Studio zaawansowane","Advanced Studio","Geavanceerde studio","Розширена студія"), sub: L("Struktura, BPM, nastrój, tekst, głos","Structure, BPM, mood, lyrics, voice","Structuur, BPM, stemming, tekst","Структура, BPM, настрій, текст") },
            ] as const).map(({ id, icon: Icon, title: tt, sub }) => (
              <button key={id} type="button" role="tab" aria-selected={createMode === id} onClick={() => setCreateMode(id)}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-all ${createMode === id ? "bg-gradient-to-br from-[#F5B73B]/20 to-[#3B82F6]/10 ring-1 ring-[#F5B73B]/60 shadow-[0_0_20px_rgba(245,183,59,0.15)]" : "hover:bg-white/5"}`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${createMode === id ? "bg-[#F5B73B] text-[#1a1203]" : "bg-white/5 text-gray-400"}`}><Icon className="h-5 w-5" /></span>
                <span className="min-w-0">
                  <span className={`block text-sm font-bold ${createMode === id ? "text-white" : "text-gray-300"}`}>{tt}</span>
                  <span className="block truncate text-[11px] text-gray-500">{sub}</span>
                </span>
              </button>
            ))}
          </div>

          {createMode === "quick" ? (
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
              onPromptChange={onQuickPrompt}
              belowPrompt={
                <PromptCoach
                  lang={uiLang} L={L}
                  structureLabel={L("Przykładowe struktury (zwrotka / refren)","Example structures (verse / chorus)","Voorbeeldstructuren (couplet / refrein)","Приклади структур (куплет / приспів)")}
                  onHint={(text) => window.dispatchEvent(new CustomEvent("grouai:studio-set-prompt", { detail: { text, mode: "append" } }))}
                  onStructure={(st) => window.dispatchEvent(new CustomEvent("grouai:studio-set-prompt", { detail: { text: structureToPrompt(st, uiLang), mode: "append" } }))}
                />
              }
            />
          ) : (
          /* === STUDIO ZAAWANSOWANE (jak w Suno): tytuł, styl, struktura, tempo, nastrój, tekst === */
          <div className="space-y-5 rounded-3xl border border-[#F5B73B]/30 bg-[#0B1020]/95 p-5 shadow-[0_0_40px_rgba(59,130,246,0.08)] sm:p-6">
            {/* Baner presetu GROUA ERA */}
            {eraPreset && (
              <div className="flex items-center gap-3 p-3 rounded-xl border"
                style={{ borderColor: `${eraPreset.accent}55`, background: `${eraPreset.accent}14` }}>
                <span className="text-2xl">{eraPreset.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{eraUi(language, "studioBannerTitle")} {eraPreset.label}</p>
                  <p className="text-[11px] text-gray-400">{eraUi(language, "studioBannerSub")}</p>
                </div>
                <Sparkles className="h-4 w-4" style={{ color: eraPreset.accent }} />
              </div>
            )}
            {/* Szybkie presety — gotowe pomysły */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-400 flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-[#FF9500]" /> {L("Szybki start","Quick start","Snelle start","Швидкий старт")}</Label>
              <div className="flex flex-wrap gap-2">
                {QUICK_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    title={presetL(p.label)}
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
                    {presetL(p.label)}
                  </button>
                ))}
              </div>
            </div>

            {/* Tytuł utworu */}
            <div className="space-y-2">
              <Label htmlFor="track-title" className="text-xs text-gray-400 flex items-center gap-1.5"><Type className="h-3.5 w-3.5 text-[#FF9500]" /> {L("Tytuł utworu","Title","Titel","Назва")}</Label>
              <Input
                id="track-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={L("np. Nocna jazda","e.g. Night drive","bijv. Nachtrit","напр. Нічна їзда")}
                maxLength={80}
                className="bg-[#1a1a2e]/80 border-[#FF6B00]/20 text-white placeholder:text-gray-600 focus-visible:ring-[#FF6B00]/40"
              />
            </div>

            {/* Opis i klimat (dopisywany do promptu silnika) */}
            <div className="space-y-2">
              <Label htmlFor="track-extra" className="text-xs text-gray-400 flex items-center gap-1.5"><Wand2 className="h-3.5 w-3.5 text-[#F5B73B]" /> {L("Opis i klimat (opcjonalnie)","Description & vibe (optional)","Beschrijving & sfeer (optioneel)","Опис і настрій (необов’язково)")}</Label>
              <Textarea
                id="track-extra"
                value={extraPrompt}
                onChange={(e) => setExtraPrompt(e.target.value)}
                placeholder={L("np. podróż przez góry o świcie, smyczki i fortepian, narastające aż do wielkiego finału","e.g. a journey through the mountains at dawn, strings and piano building to a huge finale","bijv. een reis door de bergen bij zonsopgang","напр. подорож горами на світанку")}
                rows={3}
                className="bg-black/40 border-[#1E2A44] text-white text-base placeholder:text-gray-600 focus-visible:ring-[#F5B73B]/50 resize-y"
              />
              <PromptCoach
                lang={uiLang} L={L}
                structureLabel={L("Struktura utworu → szablon tekstu","Song structure → lyrics template","Songstructuur → tekstsjabloon","Структура пісні → шаблон тексту")}
                onHint={(text) => setExtraPrompt((p) => (p.trim() ? `${p.trim()}, ${text}` : text))}
                onStructure={applyStructure}
              />
            </div>

            {/* Styl / gatunek */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-400 flex items-center gap-1.5"><Guitar className="h-3.5 w-3.5 text-[#FF9500]" /> {L("Styl","Style","Stijl","Стиль")}</Label>
              <div className="flex flex-wrap gap-2">
                {GENRES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGenre(g)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      genre === g
                        ? "border-[#F5B73B] bg-[#F5B73B]/10 text-[#FFD27A] shadow-[0_0_12px_rgba(245,183,59,0.2)]"
                        : "border-[#1E2A44] bg-[#0F1629] text-gray-300 hover:text-white hover:border-white/30"
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
                  <Blend className="h-3 w-3" /> {genre2 ? L("Wyłącz miks stylów","Turn off style mix","Stijlmix uit","Вимкнути мікс") : L("Zmiksuj z drugim stylem","Mix with another style","Meng met andere stijl","Змішати зі стилем")}
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

            {/* Struktura · tempo · nastrój */}
            <div className="space-y-4 rounded-2xl border border-[#1E2A44] bg-black/30 p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-300"><SlidersHorizontal className="h-3.5 w-3.5 text-[#F5B73B]" /> {L("Struktura · tempo · nastrój","Structure · tempo · mood","Structuur · tempo · stemming","Структура · темп · настрій")}</p>
              <div className="space-y-2">
                <Label className="text-[11px] text-gray-400 flex items-center gap-1.5"><ListMusic className="h-3.5 w-3.5 text-[#3B82F6]" /> {L("Struktura utworu","Song structure","Songstructuur","Структура пісні")}</Label>
                {lyricSections.length > 0 ? (
                  <div className="flex h-9 gap-[3px] overflow-hidden rounded-lg">
                    {lyricSections.map((x, i) => (
                      <span key={i} title={x.label} className="flex min-w-0 items-center justify-center truncate px-1 text-[10px] font-bold text-black/80"
                        style={{ flexGrow: Math.max(1, x.lines || 2), background: SECTION_META[x.kind].color }}>{x.label}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-500">{L("Wybierz strukturę w „Opis i klimat” — wstawię znaczniki [Zwrotka] / [Refren] do tekstu, a tu zobaczysz jej przebieg.","Pick a structure under “Description & vibe” — I’ll insert [Verse] / [Chorus] tags into the lyrics and show the layout here.","Kies een structuur — ik voeg [Couplet]/[Refrein] toe.","Обери структуру — додам мітки [Куплет]/[Приспів].")}</p>
                )}
              </div>
            {/* Tempo */}
            <div className="space-y-2">
              <Label className="text-[11px] text-gray-400">{L("Tempo","Tempo","Tempo","Темп")}</Label>
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
                    {tempoL(tp.id)} <span className="opacity-60">· {tp.bpm}</span>
                  </button>
                ))}
              </div>
            </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-[11px] text-gray-300">
                  <Switch checked={bpm !== null} onCheckedChange={(on) => setBpm(on ? ({ slow: 72, medium: 100, fast: 128, "very-fast": 160 } as Record<string, number>)[tempo] ?? 100 : null)} />
                  {L("Dokładne BPM","Exact BPM","Exacte BPM","Точний BPM")}
                </label>
                {bpm !== null && (
                  <>
                    <Slider value={[bpm]} onValueChange={(v) => { setBpm(v[0]); setTempo(v[0] >= 150 ? "very-fast" : v[0] >= 118 ? "fast" : v[0] >= 86 ? "medium" : "slow"); }} min={60} max={190} step={1} className="flex-1" />
                    <span className="w-16 text-right text-sm font-bold tabular-nums text-[#F5B73B]">{bpm} BPM</span>
                  </>
                )}
              </div>
            {/* Nastrój */}
            <div className="space-y-2">
              <Label className="text-[11px] text-gray-400">{L("Nastrój","Mood","Stemming","Настрій")}</Label>
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
                      <Icon className="h-3.5 w-3.5" /> {moodL(m.id)}
                    </button>
                  );
                })}
              </div>
            </div>
            </div>

            {/* Długość */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-400 flex items-center gap-1.5"><Gauge className="h-3.5 w-3.5 text-[#FF9500]" /> {L("Długość","Length","Lengte","Тривалість")}</Label>
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
                  <p className="text-sm text-gray-200">{L("Instrumentalny","Instrumental","Instrumentaal","Інструментал")}</p>
                  <p className="text-[10px] text-gray-500">{L("Bez wokalu — sama muzyka","No vocals — music only","Geen zang — alleen muziek","Без вокалу — лише музика")}</p>
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
                    <Label htmlFor="track-lyrics" className="text-xs text-gray-400 flex items-center gap-1.5"><Mic className="h-3.5 w-3.5 text-[#FF9500]" /> {L("Tekst piosenki (ręcznie)","Lyrics (manual)","Songtekst (handmatig)","Текст пісні (вручну)")}</Label>
                    <button
                      type="button"
                      onClick={() => {
                        const auto = generateLyrics(genre, title || `${genre} Track`, duration, false)
                          .map((l) => l.text)
                          .join("\n");
                        setCustomLyrics(auto);
                        toast.success(L("Wygenerowano szkic tekstu — możesz go dowolnie edytować ✍️","Draft lyrics generated — edit them freely ✍️","Concepttekst gegenereerd — bewerk vrij ✍️","Чернетку тексту згенеровано — редагуй вільно ✍️"));
                      }}
                      className="text-[11px] text-[#9333EA] hover:text-[#c084fc] flex items-center gap-1"
                    >
                      <Wand2 className="h-3 w-3" /> {L("Podpowiedz tekst","Suggest lyrics","Tekst voorstellen","Підказати текст")}
                    </button>
                  </div>
                  <Textarea
                    id="track-lyrics"
                    value={customLyrics}
                    onChange={(e) => setCustomLyrics(e.target.value)}
                    placeholder={L("Wpisz własny tekst — silnik zaśpiewa go dokładnie.\n\n[Zwrotka 1]\n...\n\n[Refren]\n...","Type your own lyrics — the engine will sing them exactly.\n\n[Verse 1]\n...\n\n[Chorus]\n...","Typ je eigen tekst — de engine zingt hem precies.\n\n[Couplet 1]\n...\n\n[Refrein]\n...","Впиши власний текст — рушій заспіває його точно.\n\n[Куплет 1]\n...\n\n[Приспів]\n...")}
                    rows={6}
                    className="bg-[#1a1a2e]/80 border-[#FF6B00]/20 text-white placeholder:text-gray-600 focus-visible:ring-[#FF6B00]/40 resize-y font-mono text-sm leading-relaxed"
                  />
                  <p className="text-[10px] text-gray-500">
                    {L("Zostaw puste, aby AI napisało tekst automatycznie. Znaczniki jak [Zwrotka], [Refren] pomagają w strukturze.","Leave empty and AI will write the lyrics. Tags like [Verse], [Chorus] help with structure.","Laat leeg en AI schrijft de tekst. Tags als [Couplet], [Refrein] helpen met de structuur.","Залиш порожнім — AI напише текст. Мітки як [Куплет], [Приспів] допомагають зі структурою.")}
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
                <Sparkles className="h-3.5 w-3.5" /> {showAdvanced ? L("Ukryj opcje zaawansowane","Hide advanced options","Verberg geavanceerd","Сховати додаткові") : L("Więcej opcji (wokal, produkcja, Twój głos)","More options (vocals, production, your voice)","Meer opties (zang, productie, jouw stem)","Більше опцій (вокал, продакшн, твій голос)")}
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
                      {/* Styl wokalu — tylko gdy nie instrumentalny */}
                      {!instrumental && (
                        <div className="space-y-2">
                          <Label className="text-[11px] text-gray-400">{L("Styl wokalu","Vocal style","Zangstijl","Стиль вокалу")}</Label>
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
                                {vocalL(vs.id)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Intensywność produkcji */}
                      <div className="space-y-2">
                        <Label className="text-[11px] text-gray-400">{L("Produkcja","Production","Productie","Продакшн")}</Label>
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
                              {intensityL(it.id)}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Twój głos (klonowanie) — nadpisuje głos dobrany po gatunku */}
                      {!instrumental && (
                        <div className="space-y-3 pt-1 border-t border-white/5">
                          <Label className="text-[11px] text-gray-400 flex items-center gap-1.5"><Mic className="h-3.5 w-3.5 text-[#9333EA]" /> {L("Twój głos (opcjonalnie)","Your voice (optional)","Jouw stem (optioneel)","Твій голос (необов’язково)")}</Label>
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
              className="w-full h-14 text-base font-extrabold uppercase tracking-[0.15em] gap-2 border border-[#93C5FD]/40 text-white disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #1D4ED8, #3B82F6 55%, #F5B73B)", boxShadow: "0 0 26px rgba(59,130,246,0.45), inset 0 0 0 1px rgba(255,224,138,0.35)" }}
            >
              {generating ? (
                <><span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> {L("Generuję…","Generating…","Genereren…","Генерую…")}</>
              ) : (
                <><Sparkles className="h-5 w-5" /> {L("Wygeneruj utwór","Generate track","Genereer track","Згенерувати трек")}</>
              )}
            </Button>
            <p className="text-center text-[11px] text-gray-500"><Timer className="mr-1 inline h-3 w-3" />{L("Szacowany czas","Estimated time","Geschatte tijd","Орієнтовний час")}: {engine === "grouai" ? "1–3 min" : "30–60 s"}</p>
          </div>
          )}

          {/* Analiza nastroju — z opisu, z detektora i z pory dnia (na szerokim ekranie w prawej kolumnie) */}
          <div className="xl:hidden">{moodCard}</div>

          {/* Status */}
          {genStatus && (
            <p className="text-sm text-center text-gray-400">{genStatus}</p>
          )}

          {/* 🎉 Baner darmowego tygodnia */}
          {user && !isPro && isFreeWeek() && (
            <div className="flex items-center gap-2 p-3 rounded-xl border border-[#FF9500]/50 bg-gradient-to-r from-[#FF6B00]/15 to-[#9333EA]/15">
              <Sparkles className="h-4 w-4 text-[#FF9500]" />
              <span className="text-sm text-white font-semibold">{L("🎉 Darmowy tydzień — twórz bez limitu!","🎉 Free week — create without limits!","🎉 Gratis week — maak zonder limiet!","🎉 Безкоштовний тиждень — твори без ліміту!")}</span>
            </div>
          )}

          {/* Free-tier usage badge */}
          {user && !isPro && !isFreeWeek() && (
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
                  Free: <span className="font-bold text-white">{freeUsed} / {FREE_GENERATION_LIMIT}</span> {L("utworów wykorzystanych","tracks used","tracks gebruikt","треків використано")}
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
              <a href="/auth" className="text-[#FF9500] underline">{L("Zaloguj się","Sign in","Log in","Увійти")}</a>{L(", aby generować i zapisywać utwory"," to generate and save tracks"," om tracks te maken en op te slaan"," щоб створювати й зберігати треки")}
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
                ref={resultRef}
                initial={{ opacity: 0, y: 40, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="relative p-5 rounded-3xl border border-[#3B82F6]/40 bg-[#0B1020]/95 space-y-4 overflow-hidden"
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
                    <p className="text-xs text-[#F5B73B]/80">GrouAI Studio • {result.genre} • {result.durationSeconds}s</p>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{L("Gotowe · odsłuch","Ready · preview","Klaar · voorbeeld","Готово · прослуховування")}</p>
                  </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="relative z-10">
                  <GeneratedTrackPlayer
                    audioUrl={result.audioUrl} title={result.title} autoPlay L={L}
                    onTime={(tm, pl) => { setPlaybackTime(tm); setIsPlaying(pl); }}
                    onSave={saveToLibrary}
                    onDownload={() => { downloadAudio(result.audioUrl, `${result.title || "grouai-track"}.mp3`).catch(() => window.open(result.audioUrl, "_blank")); }}
                  />
                  {spotifyCheck && <div className="mt-2"><SpotifyReadyBadge check={spotifyCheck} /></div>}
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
                    {L("Wyślij","Share","Delen","Поділитися")}
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
                    {L("Pobierz MP3","Download MP3","Download MP3","Завантажити MP3")}
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

          {/* Wieża hi-fi — gramofon/CD/kaseta + radio i wybór wykonawcy (gra nasz katalog) */}
          <StudioHifi />
          </div>

          {/* Twoje utwory — biblioteka jak w Suno (zawsze widoczna, te same funkcje dla wszystkich) */}
          <aside className="mt-10 xl:mt-0 xl:sticky xl:top-24 w-full max-w-2xl mx-auto xl:mx-0 min-w-0">
            {activeTab === "generate" && <div className="mb-6 hidden xl:block">{moodCard}</div>}
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
