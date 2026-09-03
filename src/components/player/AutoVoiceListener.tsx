import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Sparkles, Music } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAISafe } from "@/contexts/AIContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAssistantConfig } from "@/hooks/useAssistantConfig";
import { AssistantNamingModal } from "@/components/modals/AssistantNamingModal";
import { speak, isTTSSpeaking } from "@/utils/tts";
import { supabase } from "@/integrations/supabase/client";
import { invokeHubAI } from "@/lib/hubAI";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useClapControl } from "@/hooks/useClapControl";
import { useDJMode } from "@/hooks/useDJMode";
import type { Language } from "@/i18n/translations";

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

const SILENCE_TIMEOUT_MS = 300_000; // 5 minutes

/** Get current app language */
const getAppLanguage = (): Language => {
  const saved = localStorage.getItem("grooveai-language");
  return (saved as Language) || "en";
};

/** Speech recognition locale code */
const LANG_TO_RECOGNITION: Record<Language, string> = {
  pl: "pl-PL", en: "en-US", nl: "nl-NL", ua: "uk-UA",
};

/** Multilingual navigation keywords → route */
const NAV_MAP: Record<string, string> = {
  // PL
  "stron": "/", "główn": "/",
  "szukaj": "/search", "wyszuk": "/search",
  "bibliotek": "/library",
  "polubionych": "/liked", "polubion": "/liked",
  "serwer": "/server", "medi": "/server",
  "film": "/movies",
  "ustawien": "/settings",
  "nastro": "/mood-history",
  "playlist": "/playlist-manager",
  "admin": "/admin",
  "studio": "/studio", "suno": "/studio",
  // EN
  "home": "/", "main page": "/",
  "search": "/search",
  "library": "/library",
  "liked": "/liked", "favorites": "/liked", "favourite": "/liked",
  "server": "/server", "media": "/server",
  "movie": "/movies", "films": "/movies",
  "radio": "/radio-live",
  "settings": "/settings",
  "mood": "/mood-history",
  // NL
  "startpagina": "/", "hoofdpagina": "/", "thuis": "/",
  "zoek": "/search", "zoeken": "/search",
  "bibliotheek": "/library",
  "favorieten": "/liked", "geliked": "/liked",
  "mediaserver": "/server",
  "instellingen": "/settings",
  "stemming": "/mood-history",
  "afspeellijst": "/playlist-manager",
  // UA
  "головн": "/", "дом": "/",
  "пошук": "/search", "шукай": "/search",
  "бібліотек": "/library",
  "улюблен": "/liked",
  "сервер": "/server",
  "фільм": "/movies",
  "налаштув": "/settings",
  "настрі": "/mood-history",
  "плейліст": "/playlist-manager",
};

const normalizeCommand = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const includesAny = (text: string, phrases: string[]) =>
  phrases.some((phrase) => text.includes(phrase));

const WEATHER_CODE_MAP: Record<number, string> = {
  0: "bezchmurnie",
  1: "prawie bezchmurnie",
  2: "częściowe zachmurzenie",
  3: "duże zachmurzenie",
  45: "mgliście",
  48: "osadzający się szron",
  51: "lekka mżawka",
  53: "mżawka",
  55: "intensywna mżawka",
  61: "lekki deszcz",
  63: "deszcz",
  65: "mocny deszcz",
  71: "lekki śnieg",
  73: "śnieg",
  75: "intensywny śnieg",
  80: "przelotne opady",
  81: "przelotny deszcz",
  82: "silne przelotne opady",
  95: "burza",
};

const extractCityFromWeatherCommand = (command: string): string | null => {
  const cityMatch = command.match(/(?:w|dla|na)\s+([a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ\-\s]{2,})/i);
  if (!cityMatch?.[1]) return null;

  return cityMatch[1]
    .replace(/\b(jutro|dzisiaj|dziś|teraz|pogoda|prognoza)\b/gi, "")
    .trim() || null;
};

const getWeatherSummary = async (command: string) => {
  const requestedCity = extractCityFromWeatherCommand(command) || "Warszawa";

  const geoResp = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(requestedCity)}&count=1&language=pl&format=json`
  );

  if (!geoResp.ok) throw new Error("Geocoding failed");
  const geoData = await geoResp.json();
  const place = geoData?.results?.[0];
  if (!place) throw new Error("City not found");

  const weatherResp = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`
  );

  if (!weatherResp.ok) throw new Error("Weather fetch failed");
  const weatherData = await weatherResp.json();

  const currentTemp = Math.round(weatherData?.current?.temperature_2m ?? 0);
  const currentWind = Math.round(weatherData?.current?.wind_speed_10m ?? 0);
  const currentCode = weatherData?.current?.weather_code ?? 3;
  const todayMax = Math.round(weatherData?.daily?.temperature_2m_max?.[0] ?? currentTemp);
  const todayMin = Math.round(weatherData?.daily?.temperature_2m_min?.[0] ?? currentTemp);
  const description = WEATHER_CODE_MAP[currentCode] ?? "zmienna pogoda";

  return `Pogoda dla ${place.name}: teraz ${currentTemp} stopni, ${description}. Wiatr około ${currentWind} kilometrów na godzinę. Dzisiaj od ${todayMin} do ${todayMax} stopni.`;
};

export const AutoVoiceListener = () => {
  const { user } = useAuth();
  const aiContext = useAISafe();
  const processVoiceCommand = aiContext?.processVoiceCommand;
  const isAIEnabled = aiContext?.isAIEnabled ?? false;
  const isProcessing = aiContext?.isProcessing ?? false;
  const { playPlaylist, nextTrack, prevTrack, setVolume, pausePlayback, resumePlayback, restartCurrentTrack, seek, audioElement, toggleRepeat, toggleShuffle, currentTrack, addToQueue } = usePlayer();
  const navigate = useNavigate();
  const { assistantName, needsNaming, saveAssistantName } = useAssistantConfig();
  const { startDJSession, parseDJCommand, isDJActive, stopDJSession } = useDJMode();

  const [isListening, setIsListening] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");
  const [showIndicator, setShowIndicator] = useState(false);
  const [autoListenEnabled, setAutoListenEnabled] = useState(false);
  const [showNamingModal, setShowNamingModal] = useState(false);
  const [greeted, setGreeted] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const restartTimeoutRef = useRef<number | null>(null);
  const lastProcessedRef = useRef<{ text: string; time: number }>({ text: "", time: 0 });
  const silenceTimerRef = useRef<number | null>(null);
  const startListeningRef = useRef<(() => void) | null>(null);
  const autoListenRef = useRef(false);

  // Keep ref in sync with state so async handlers always have latest value
  useEffect(() => { autoListenRef.current = autoListenEnabled; }, [autoListenEnabled]);

  useEffect(() => {
    const stored = localStorage.getItem("auto-voice-listen");
    if (stored === "true") setAutoListenEnabled(true);
  }, []);

  useEffect(() => {
    if (user && needsNaming) {
      setShowNamingModal(true);
    }
  }, [user, needsNaming]);

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = window.setTimeout(() => {
      if (recognitionRef.current) { try { recognitionRef.current.abort(); } catch {} }
      setIsListening(false);
      setAutoListenEnabled(false);
      localStorage.setItem("auto-voice-listen", "false");
      toast.info("🎙️ Mikrofon wyłączony po 2 minutach ciszy");
    }, SILENCE_TIMEOUT_MS);
  }, []);

  const fetchAISuggestions = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.functions.invoke("ai-suggest-tracks", {
        body: { user_id: user.id }
      });
      if (error) throw error;
      if (data?.suggestions?.length > 0) {
        setAiSuggestions(data.suggestions);
        setShowSuggestions(true);
        const names = data.suggestions.slice(0, 3).map((s: any) => s.title).join(", ");
        await safeSpeakAndResume(`Proponuję na dziś: ${names}. Powiedz puść, żeby odtworzyć.`);
      } else {
        await safeSpeakAndResume("Nie mam jeszcze dość danych o Twoich preferencjach. Posłuchaj trochę muzyki, a nauczę się Twoich gustów!");
      }
    } catch (e) {
      console.error("AI suggestions error:", e);
      await safeSpeakAndResume("Przepraszam, nie udało mi się przygotować propozycji.");
    }
  }, [user]);

  // Flag to prevent recognition from processing input while TTS is active
  const isSpeakingRef = useRef(false);
  // Flag to indicate safeSpeakAndResume will handle restart (prevents onend from double-restarting)
  const speakRestartingRef = useRef(false);

  /**
   * Pause recognition → speak → resume recognition.
   * This prevents the mic from picking up what the assistant says.
   */
  const safeSpeakAndResume = useCallback(async (text: string) => {
    isSpeakingRef.current = true;
    speakRestartingRef.current = true;
    // Fully destroy recognition to prevent onend from restarting
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onend = null;
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }
    if (restartTimeoutRef.current) { clearTimeout(restartTimeoutRef.current); restartTimeoutRef.current = null; }
    setIsListening(false);

    await speak(text, { mode: "assistant", lang: LANG_TO_RECOGNITION[getAppLanguage()] });

    // Small extra gap to let echo fade
    await new Promise(r => setTimeout(r, 800));
    isSpeakingRef.current = false;
    speakRestartingRef.current = false;

    // Restart recognition if auto-listen is still on
    if (autoListenRef.current) {
      restartTimeoutRef.current = window.setTimeout(() => {
        console.log("[Voice] Restarting recognition after TTS");
        startListeningRef.current?.();
      }, 200);
    }
  }, []);

  const shutdownMic = useCallback(() => {
    // Fully destroy recognition instance
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onend = null;
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (restartTimeoutRef.current) { clearTimeout(restartTimeoutRef.current); restartTimeoutRef.current = null; }
    setIsListening(false);
    setAutoListenEnabled(false);
    localStorage.setItem("auto-voice-listen", "false");
    isSpeakingRef.current = true;
    speak("Wyłączam się. Do zobaczenia!").then(() => { isSpeakingRef.current = false; });
    toast.info("🔇 Asystent wyłączony");
    setShowSuggestions(false);
  }, []);

  const handleSingleClap = useCallback(() => {
    resumePlayback();
    toast.success("👏 Wznawiam odtwarzanie");
  }, [resumePlayback]);

  const handleDoubleClap = useCallback(() => {
    pausePlayback();
    toast.info("👏👏 Zatrzymuję odtwarzanie");
  }, [pausePlayback]);

  useClapControl({
    enabled: autoListenEnabled && !!user,
    onSingleClap: handleSingleClap,
    onDoubleClap: handleDoubleClap,
  });

  const tryNavigate = useCallback((lower: string): boolean => {
    for (const [keyword, route] of Object.entries(NAV_MAP)) {
      if (lower.includes(keyword)) {
        navigate(route);
        const pageNames: Record<string, string> = {
          "/": "Strona główna", "/search": "Szukaj", "/library": "Biblioteka",
          "/liked": "Polubione utwory", "/server": "Serwer mediów", "/movies": "Filmy",
          "/radio-live": "Radio", "/settings": "Ustawienia", "/mood-history": "Historia nastroju",
          "/playlist-manager": "Playlisty", "/admin": "Admin", "/studio": "Studio"
        };
        toast.success(`📂 Otwieram: ${pageNames[route] || route}`);
        safeSpeakAndResume(`Otwieram ${pageNames[route] || route}`);
        return true;
      }
    }
    return false;
  }, [navigate, safeSpeakAndResume]);

  const handlePlayFromAI = useCallback(async (trackId: string) => {
    try {
      const { data: track } = await supabase.from("tracks").select("*").eq("id", trackId).single();
      if (track) {
        playPlaylist([track], 0);
        safeSpeakAndResume(`Odtwarzam ${track.title}`);
      }
    } catch {}
  }, [playPlaylist, safeSpeakAndResume]);

  const GENRE_KEYWORDS = [
    "rock", "pop", "punk", "disco", "jazz", "blues", "metal", "hip-hop", "hip hop",
    "rap", "electronic", "techno", "house", "classical", "reggae", "soul", "funk",
    "country", "r&b", "rnb", "indie", "alternative", "ambient", "latin", "folk",
  ];

  const MULTILINGUAL_NUMBERS: Record<string, number> = {
    // PL
    "jeden": 1, "jedną": 1, "jedno": 1,
    "dwa": 2, "dwie": 2, "dwóch": 2, "dwoch": 2,
    "trzy": 3, "trzech": 3,
    "cztery": 4, "czterech": 4,
    "pięć": 5, "piec": 5, "pieciu": 5, "pięciu": 5,
    "sześć": 6, "szesc": 6, "sześciu": 6, "szesciu": 6,
    "siedem": 7, "siedmiu": 7,
    "osiem": 8, "ośmiu": 8, "osmiu": 8,
    "dziewięć": 9, "dziewiec": 9, "dziewięciu": 9,
    "dziesięć": 10, "dziesiec": 10, "dziesięciu": 10,
    "piętnaście": 15, "pietnascie": 15,
    "dwadzieścia": 20, "dwadziescia": 20,
    // EN
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "fifteen": 15, "twenty": 20,
    // NL
    "een": 1, "één": 1, "twee": 2, "drie": 3, "vier": 4, "vijf": 5,
    "zes": 6, "zeven": 7, "acht": 8, "negen": 9, "tien": 10,
    "elf": 11, "twaalf": 12, "vijftien": 15, "twintig": 20,
    // UA
    "один": 1, "одну": 1, "два": 2, "дві": 2, "три": 3,
    "чотири": 4, "п'ять": 5, "шість": 6, "сім": 7,
    "вісім": 8, "дев'ять": 9, "десять": 10, "п'ятнадцять": 15,
    "двадцять": 20,
  };

  const parseNumber = useCallback((text: string): number | undefined => {
    const digitMatch = text.match(/(\d+)/);
    if (digitMatch) return parseInt(digitMatch[1]);
    const normalized = normalizeCommand(text);
    for (const [word, num] of Object.entries(MULTILINGUAL_NUMBERS)) {
      if (normalized.includes(normalizeCommand(word))) return num;
    }
    return undefined;
  }, []);

  const searchAndPlay = useCallback(async (query: string, count?: number) => {
    try {
      console.log("[Voice] searchAndPlay:", query, "count:", count);
      toast.loading(`🔍 Szukam: "${query}"...`, { id: "voice-search" });

      const lowerQuery = query.toLowerCase().trim();
      const matchedGenre = GENRE_KEYWORDS.find(g => lowerQuery.includes(g));

      let tracks: any[] | null = null;

      // "mix" or empty = random tracks from library
      if (lowerQuery === "mix" || lowerQuery === "" || lowerQuery === "coś" || lowerQuery === "cos" || lowerQuery === "muzykę" || lowerQuery === "muzyke" || lowerQuery === "muzyka") {
        const { data } = await supabase
          .from("tracks")
          .select("*")
          .limit(100);
        if (data && data.length > 0) {
          tracks = data.sort(() => Math.random() - 0.5).slice(0, count || 10);
        }
      } else if (matchedGenre) {
        const { data } = await supabase
          .from("tracks")
          .select("*")
          .ilike("genre", `%${matchedGenre}%`)
          .limit(count || 10);
        tracks = data;
      }

      if (!tracks || tracks.length === 0) {
        // Sanitize query to prevent PostgREST parse errors (remove commas, special chars)
        const safeQuery = query.replace(/[,()]/g, "").trim();
        if (safeQuery) {
          // Search title and artist separately to avoid .or() parsing issues
          const { data: titleMatches } = await supabase
            .from("tracks")
            .select("*")
            .ilike("title", `%${safeQuery}%`)
            .limit(count || 10);
          
          const { data: artistMatches } = await supabase
            .from("tracks")
            .select("*")
            .ilike("artist", `%${safeQuery}%`)
            .limit(count || 10);
          
          // Merge and deduplicate
          const all = [...(titleMatches || []), ...(artistMatches || [])];
          const seen = new Set<string>();
          tracks = all.filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true; }).slice(0, count || 10);
        }
      }

      if (tracks && tracks.length > 0) {
        const toPlay = count ? tracks.slice(0, count) : tracks;
        playPlaylist(toPlay, 0);
        toast.success(`🎵 Odtwarzam ${toPlay.length} utworów: ${toPlay[0].title}`, { id: "voice-search", duration: 4000 });
        await safeSpeakAndResume(`Odtwarzam ${toPlay.length} utworów ${matchedGenre || ""}, ${toPlay[0].title}`);
      } else {
        toast.loading(`🌐 Szukam w sieci: "${query}"...`, { id: "voice-search" });
        try {
          const { data: aiData, error: aiError } = await invokeHubAI({
            message: `Znajdź YouTube video ID (11 znaków) dla utworu: "${query}". Odpowiedz TYLKO w formacie: VIDEOID:xxxxxxxxxxx albo NOTFOUND jeśli nie znasz.`,
            history: []
          });
          
          if (!aiError && aiData?.response) {
            const videoIdMatch = aiData.response.match(/VIDEOID:([a-zA-Z0-9_-]{11})/);
            if (videoIdMatch) {
              const videoId = videoIdMatch[1];
              toast.loading(`⬇️ Pobieram z YouTube...`, { id: "voice-search" });
              const { data: dlData, error: dlError } = await supabase.functions.invoke("youtube-download", {
                body: { videoId, title: query, artist: "YouTube" }
              });
              
              if (!dlError && dlData?.url) {
                const { data: newTrack } = await supabase.from("tracks").insert({
                  title: query,
                  artist: "YouTube",
                  audio_url: dlData.url,
                  video_url: `https://www.youtube.com/watch?v=${videoId}`,
                  cover_url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                  duration: dlData.duration || 180,
                }).select().single();
                
                if (newTrack) {
                  playPlaylist([newTrack], 0);
                  toast.success(`🎵 Pobrano i odtwarzam: ${query}`, { id: "voice-search", duration: 4000 });
                  await safeSpeakAndResume(`Pobrałem i odtwarzam ${query}`);
                }
              } else {
                const fallbackTrack = {
                  id: crypto.randomUUID(),
                  title: query, artist: "YouTube", album: null,
                  audio_url: null,
                  video_url: `https://www.youtube.com/watch?v=${videoId}`,
                  cover_url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                  genre: null, mood: null, duration: 180,
                };
                playPlaylist([fallbackTrack], 0);
                toast.success(`🎵 Odtwarzam z YouTube: ${query}`, { id: "voice-search", duration: 4000 });
                await safeSpeakAndResume(`Odtwarzam z YouTube: ${query}`);
              }
            } else {
              toast.error(`Nie znaleziono: "${query}"`, { id: "voice-search" });
              await safeSpeakAndResume(`Nie znalazłam utworu ${query}`);
            }
          } else {
            toast.error(`Nie znaleziono: "${query}"`, { id: "voice-search" });
            await safeSpeakAndResume(`Nie znalazłam utworu ${query}`);
          }
        } catch {
          toast.error(`Nie znaleziono: "${query}"`, { id: "voice-search" });
          await safeSpeakAndResume(`Nie znalazłam utworu ${query}`);
        }
      }
    } catch {
      toast.error("Błąd wyszukiwania", { id: "voice-search" });
    }
  }, [playPlaylist, safeSpeakAndResume]);

  // Guard against concurrent command processing
  const isProcessingCommandRef = useRef(false);

  const processCommand = useCallback(async (command: string) => {
    const lower = command.toLowerCase().trim();
    const normalized = normalizeCommand(command);
    console.log("[Voice] processCommand:", command, "| normalized:", normalized, "| length:", normalized.length);
    if (normalized.length < 2) return;

    // Guard: ignore if TTS is still speaking (mic echo protection)
    if (isSpeakingRef.current) { console.log("[Voice] Ignored - TTS speaking"); return; }

    // Guard: ignore if already processing a command
    if (isProcessingCommandRef.current) {
      console.log("[Voice] Ignored - already processing:", command);
      return;
    }
    isProcessingCommandRef.current = true;

    setLastTranscript(command);
    setShowIndicator(true);
    resetSilenceTimer();

    try {
    const lang = getAppLanguage();

    // STOP command - HIGHEST PRIORITY - all languages
    const stopRequested = includesAny(normalized, [
      // PL
      "stop", "stopp", "stup", "stap", "zatrzymaj", "pauza", "pauze", "wstrzymaj",
      "wylacz player", "wylacz muzyk", "cisza", "ucisz",
      // EN
      "pause", "halt", "silence", "quiet", "shut up",
      // NL
      "pauzeer", "pauzeren", "stilte", "stil",
      // UA
      "стоп", "пауза", "зупини", "тиша",
    ]) || includesAny(lower, ["stop", "pauza", "zatrzymaj", "wstrzymaj", "pause", "pauzeer", "стоп", "пауза"]);

    if (stopRequested) {
      pausePlayback();
      const msgs: Record<Language, string> = { pl: "Zatrzymuję", en: "Pausing", nl: "Gepauzeerd", ua: "Зупиняю" };
      await safeSpeakAndResume(msgs[lang]);
      toast.info("⏹️ " + msgs[lang]);
      return;
    }

    // Shutdown commands
    if (lower.includes("wyłącz się") || (lower.includes("wyłącz") && lower.includes("asystent")) || lower.includes("zamknij się")
      || lower.includes("shut down") || lower.includes("turn off") || lower.includes("go away")
      || lower.includes("schakel uit") || lower.includes("ga weg") || lower.includes("stop ermee")
      || lower.includes("вимкнись") || lower.includes("вимкни")) {
      shutdownMic();
      return;
    }

    // DJ Mode commands
    const djResult = parseDJCommand(command);
    if (djResult.isDJCommand) {
      const djMsgs: Record<Language, string> = {
        pl: "DJ GrouAI przygotowuje set...",
        en: "DJ GrouAI preparing set...",
        nl: "DJ GrouAI bereidt set voor...",
        ua: "DJ GrouAI готує сет...",
      };
      toast.loading(`🎧 ${djMsgs[lang]}`, { id: "dj-voice" });
      await startDJSession({
        genres: djResult.genres,
        partyType: djResult.partyType,
        trackCount: djResult.trackCount,
        customPrompt: djResult.customPrompt,
      });
      toast.success(`🎧 DJ GrouAI! ${djResult.trackCount} tracks`, { id: "dj-voice", duration: 5000 });
      return;
    }

    // Stop DJ
    if (isDJActive && includesAny(normalized, [
      "stop dj", "wylacz dj", "koniec setu", "zakoncz set",
      "stop the dj", "end the set",
      "stop de dj", "einde set",
      "зупини діджея", "кінець сету",
    ])) {
      await stopDJSession();
      return;
    }

    // Weather command (online) - multilingual
    if (includesAny(normalized, [
      "pogoda", "prognoza", "jaka pogoda", "sprawdz pogode",
      "weather", "forecast", "what's the weather",
      "weer", "weerbericht", "wat is het weer",
      "погода", "прогноз",
    ])) {
      toast.loading("🌤️ ...", { id: "voice-weather" });
      try {
        const weatherSummary = await getWeatherSummary(command);
        toast.success(`🌤️ ${weatherSummary.slice(0, 80)}...`, { id: "voice-weather", duration: 4500 });
        await safeSpeakAndResume(weatherSummary);
      } catch {
        const errMsgs: Record<Language, string> = {
          pl: "Nie udało się pobrać pogody", en: "Failed to get weather",
          nl: "Weer ophalen mislukt", ua: "Не вдалося отримати погоду",
        };
        toast.error(errMsgs[lang], { id: "voice-weather" });
        await safeSpeakAndResume(errMsgs[lang]);
      }
      return;
    }

    // Resume
    if (includesAny(normalized, [
      "wznow", "kontynuuj", "graj dalej", "prosto",
      "resume", "continue", "keep playing",
      "hervat", "ga door", "verder spelen",
      "продовжуй", "далі грай",
    ])) {
      resumePlayback();
      const msgs: Record<Language, string> = { pl: "Wznawiam odtwarzanie", en: "Resuming playback", nl: "Hervatten", ua: "Продовжую" };
      await safeSpeakAndResume(msgs[lang]);
      return;
    }

    // Restart
    if (includesAny(normalized, [
      "od poczatku", "zacznij od poczatku", "od nowa",
      "from the start", "restart", "from beginning", "start over",
      "opnieuw", "van het begin", "begin opnieuw",
      "спочатку", "заново",
    ])) {
      restartCurrentTrack();
      const msgs: Record<Language, string> = { pl: "Od początku", en: "Restarting", nl: "Opnieuw", ua: "Спочатку" };
      await safeSpeakAndResume(msgs[lang]);
      return;
    }

    // Simple play/resume (short commands)
    if ((lower.includes("graj") || lower.includes("play") || lower.includes("speel") || lower.includes("грай"))
        && !lower.includes("następ") && !lower.includes("odtwarz") && !lower.includes("next") && !lower.includes("volgende")
        && lower.split(" ").length <= 2) {
      resumePlayback();
      const msgs: Record<Language, string> = { pl: "Odtwarzam", en: "Playing", nl: "Afspelen", ua: "Граю" };
      await safeSpeakAndResume(msgs[lang]);
      return;
    }

    // Przewijanie o czas: „przewiń do przodu o 1 minutę", „cofnij 30 sekund", „skip forward 2 min"
    const wantsSeek =
      /(przewin|przewiń|cofnij|do przodu|do tyłu|do tylu|naprzód|naprzod|wstecz|fast ?forward|forward|rewind|skip ?(forward|back)|vooruit|terug|spoel|перемот|вперед|назад)/.test(normalized) &&
      /(sekund|sekunt|second|minut|minute|\bmin\b|\bsec\b|хвил|секун)/.test(normalized);
    const liveDur = audioElement?.duration || 0;
    const liveCur = audioElement?.currentTime || 0;
    if (wantsSeek && liveDur > 0) {
      const back = /(cofnij|do tyłu|do tylu|wstecz|rewind|\bback\b|terug|назад)/.test(normalized);
      const isMinutes = /(minut|minute|\bmin\b|хвил)/.test(normalized);
      const amount = parseNumber(normalized) ?? (isMinutes ? 1 : 30);
      const deltaSec = amount * (isMinutes ? 60 : 1) * (back ? -1 : 1);
      const target = Math.max(0, Math.min(liveDur, liveCur + deltaSec));
      seek((target / liveDur) * 100);
      const dirTxt: Record<Language, string> = back
        ? { pl: "Cofam", en: "Rewinding", nl: "Terugspoelen", ua: "Назад" }
        : { pl: "Przewijam do przodu", en: "Fast forwarding", nl: "Vooruitspoelen", ua: "Вперед" };
      const unit = isMinutes ? "min" : "s";
      await safeSpeakAndResume(`${dirTxt[lang]} o ${amount} ${unit}`);
      toast.info(`⏩ ${dirTxt[lang]} ${amount}${unit}`);
      return;
    }

    // Przewiń na początek / koniec utworu
    if (includesAny(normalized, ["na poczatek", "poczatek utworu", "to the start", "to the beginning", "naar het begin", "на початок"])) {
      restartCurrentTrack();
      await safeSpeakAndResume({ pl: "Od początku", en: "From the start", nl: "Vanaf begin", ua: "Спочатку" }[lang]);
      return;
    }
    if (includesAny(normalized, ["na koniec", "koniec utworu", "to the end", "naar het einde", "в кінець"]) && liveDur > 0) {
      seek(98);
      await safeSpeakAndResume({ pl: "Na koniec", en: "To the end", nl: "Naar einde", ua: "У кінець" }[lang]);
      return;
    }

    // Powtarzanie / zapętlenie
    if (includesAny(normalized, ["powtarzaj", "zapetl", "zapętl", "w kolko", "w koło", "repeat", "loop", "herhaal", "повтор", "зациклюй"])) {
      toggleRepeat();
      await safeSpeakAndResume({ pl: "Zmieniam powtarzanie", en: "Toggling repeat", nl: "Herhalen aangepast", ua: "Повтор змінено" }[lang]);
      toast.info("🔁 Powtarzanie");
      return;
    }

    // Losowo / tasowanie
    if (includesAny(normalized, ["losowo", "tasuj", "wymieszaj", "przetasuj", "shuffle", "random", "husselen", "willekeurig", "перемішай", "випадков"])) {
      toggleShuffle();
      await safeSpeakAndResume({ pl: "Przełączam losowe odtwarzanie", en: "Toggling shuffle", nl: "Shuffle aangepast", ua: "Перемішування змінено" }[lang]);
      toast.info("🔀 Losowo");
      return;
    }

    // Ustaw dokładną głośność: „głośność na 50", „ustaw głośność 30 procent"
    if (/(g[łl]o[śs]no|volume|geluid|гучніст|громкост)/.test(normalized) && parseNumber(normalized) !== undefined) {
      const vol = Math.max(0, Math.min(100, parseNumber(normalized)!));
      setVolume(vol);
      await safeSpeakAndResume({ pl: `Głośność ${vol} procent`, en: `Volume ${vol} percent`, nl: `Volume ${vol} procent`, ua: `Гучність ${vol} відсотків` }[lang]);
      toast.info(`🔊 ${vol}%`);
      return;
    }

    // Polub / dodaj do ulubionych AKTUALNY utwór
    if (includesAny(normalized, ["polub", "dodaj do ulubionych", "do ulubionych ten", "like this", "add to favorites", "add to liked", "vind ik leuk", "voeg toe aan favorieten", "подобається", "додай до улюблених"])) {
      if (!currentTrack) { await safeSpeakAndResume("Nie ma teraz nic odtwarzanego"); return; }
      if (!user) { await safeSpeakAndResume("Zaloguj się, aby polubić"); return; }
      try {
        await supabase.from("liked_songs").upsert({ user_id: user.id, track_id: currentTrack.id }, { onConflict: "user_id,track_id" });
        window.dispatchEvent(new CustomEvent("track-like-changed", { detail: { trackId: currentTrack.id, liked: true } }));
        await safeSpeakAndResume({ pl: `Polubiono ${currentTrack.title}`, en: `Liked ${currentTrack.title}`, nl: "Geliked", ua: "Додано" }[lang]);
        toast.success(`❤️ ${currentTrack.title}`);
      } catch { await safeSpeakAndResume("Nie udało się polubić"); }
      return;
    }

    // Dodaj aktualny utwór do kolejki
    if (includesAny(normalized, ["do kolejki", "dodaj do kolejki", "add to queue", "in de wachtrij", "до черги"])) {
      if (currentTrack) { addToQueue(currentTrack); await safeSpeakAndResume({ pl: "Dodano do kolejki", en: "Added to queue", nl: "Toegevoegd aan wachtrij", ua: "Додано до черги" }[lang]); }
      return;
    }

    // Rozdziel bieżący utwór na ścieżki (stemy) — otwiera odtwarzacz solo/mute
    if (includesAny(normalized, ["rozdziel na sciezki", "na sciezki", "stemy", "sciezki utworu", "rozbij na sciezki", "pokaz sciezki", "split stems", "separate stems", "wokal osobno", "aparte tracks", "op sporen", "розділи на доріжки"])) {
      if (!currentTrack?.audio_url) { await safeSpeakAndResume("Najpierw włącz jakiś utwór"); return; }
      window.dispatchEvent(new CustomEvent("grouai:open-stems", { detail: { audioUrl: currentTrack.audio_url, title: currentTrack.title } }));
      await safeSpeakAndResume({ pl: "Rozdzielam na ścieżki", en: "Splitting into stems", nl: "Splitsen in sporen", ua: "Розділяю на доріжки" }[lang]);
      return;
    }

    // Next track
    if (includesAny(lower, ["następn", "dalej", "skip", "next", "volgende", "overslaan", "наступн", "далі", "w prawo", "prawo"])) {
      nextTrack();
      const msgs: Record<Language, string> = { pl: "Następny utwór", en: "Next track", nl: "Volgend nummer", ua: "Наступний трек" };
      await safeSpeakAndResume(msgs[lang]);
      return;
    }

    // Previous track
    if (includesAny(lower, ["poprzedni", "cofnij", "wstecz", "previous", "back", "vorige", "terug", "попередн", "назад", "w lewo", "lewo"])) {
      prevTrack();
      const msgs: Record<Language, string> = { pl: "Poprzedni utwór", en: "Previous track", nl: "Vorig nummer", ua: "Попередній трек" };
      await safeSpeakAndResume(msgs[lang]);
      return;
    }

    // Rolki (Reels) — „w górę" / „w dół" naśladują gest swipe (jeśli Rolki są otwarte)
    if (includesAny(normalized, ["w gore", "do gory", "gora"]) || includesAny(lower, ["up", "omhoog", "вгору"])) {
      window.dispatchEvent(new CustomEvent("grouai:reel-nav", { detail: { direction: "next" } }));
      const msgs: Record<Language, string> = { pl: "W górę", en: "Up", nl: "Omhoog", ua: "Вгору" };
      await safeSpeakAndResume(msgs[lang]);
      return;
    }
    if (includesAny(lower, ["w dół", "na dół", "dół", "dol"]) || includesAny(lower, ["down", "omlaag", "вниз"])) {
      window.dispatchEvent(new CustomEvent("grouai:reel-nav", { detail: { direction: "prev" } }));
      const msgs: Record<Language, string> = { pl: "W dół", en: "Down", nl: "Omlaag", ua: "Вниз" };
      await safeSpeakAndResume(msgs[lang]);
      return;
    }

    // Volume up
    if (includesAny(lower, ["głośniej", "louder", "volume up", "harder", "luider", "гучніше"])) {
      setVolume(85);
      const msgs: Record<Language, string> = { pl: "Głośniej", en: "Louder", nl: "Harder", ua: "Гучніше" };
      await safeSpeakAndResume(msgs[lang]);
      return;
    }

    // Volume down
    if (includesAny(lower, ["ciszej", "cicho", "quieter", "softer", "volume down", "zachter", "stiller", "тихіше"])) {
      setVolume(25);
      const msgs: Record<Language, string> = { pl: "Ciszej", en: "Quieter", nl: "Zachter", ua: "Тихіше" };
      await safeSpeakAndResume(msgs[lang]);
      return;
    }

    // Mute
    if (includesAny(lower, ["wycisz", "mute", "dempen", "вимкни звук"])) {
      setVolume(0);
      const msgs: Record<Language, string> = { pl: "Wyciszono", en: "Muted", nl: "Gedempt", ua: "Без звуку" };
      await safeSpeakAndResume(msgs[lang]);
      return;
    }

    // ==========================================
    // PLAYLIST OPEN / PLAY COMMANDS (multilingual)
    // ==========================================
    const playlistOpenMatch = lower.match(/(?:otwórz|otworz|pokaż|pokaz|wyświetl|wyswietl|open|show|display|toon|open|відкрий|покажи)\s+(?:playlist[ęeay]?|plej\s*list[ęeay]?|afspeellijst|плейліст)\s+(.+)/i);
    const playlistPlayMatch = lower.match(/(?:plej|play|puść|pusc|odtwórz|odtworz|włącz|wlacz|zagraj|graj|odpal|leć|lec|dawaj|speel|draai|грай|увімкни)\s+(?:playlist[ęeay]?|plej\s*list[ęeay]?|afspeellijst|плейліст)\s+(.+)/i);
    const playlistNameOnly = !playlistOpenMatch && !playlistPlayMatch && lower.match(/(?:playlist[ęeay]?|plej\s*list[ęeay]?|afspeellijst|плейліст)\s+(.+)/i);

    if (playlistOpenMatch || playlistPlayMatch || playlistNameOnly) {
      const isPlayMode = !!playlistPlayMatch || !!playlistNameOnly;
      const searchName = (playlistPlayMatch?.[1] || playlistOpenMatch?.[1] || playlistNameOnly?.[1] || "").trim();
      
      if (searchName) {
        toast.loading(`📋 Szukam playlisty: "${searchName}"...`, { id: "voice-playlist" });
        try {
          const { data: playlists } = await supabase
            .from("playlists")
            .select("id, title")
            .ilike("title", `%${searchName}%`)
            .limit(5);

          if (playlists && playlists.length > 0) {
            const playlist = playlists[0];
            
            if (isPlayMode) {
              // Fetch tracks and play from first
              const { data: ptData } = await supabase
                .from("playlist_tracks")
                .select("track_id, position")
                .eq("playlist_id", playlist.id)
                .order("position", { ascending: true });
              
              if (ptData && ptData.length > 0) {
                const trackIds = ptData.map(pt => pt.track_id);
                const { data: tracks } = await supabase.from("tracks").select("*").in("id", trackIds);
                if (tracks && tracks.length > 0) {
                  // Order by position
                  const ordered = trackIds.map(id => tracks.find(t => t.id === id)).filter(Boolean);
                  playPlaylist(ordered as any[], 0);
                  toast.success(`▶ Odtwarzam playlistę "${playlist.title}" — ${ordered.length} utworów`, { id: "voice-playlist", duration: 4000 });
                  await safeSpeakAndResume(`Odtwarzam playlistę ${playlist.title}, ${ordered.length} utworów. Pierwszy to ${(ordered[0] as any)?.title}`);
                  return;
                }
              }
              toast.error(`Playlista "${playlist.title}" jest pusta`, { id: "voice-playlist" });
              await safeSpeakAndResume(`Playlista ${playlist.title} jest pusta`);
            } else {
              // Navigate to playlist detail
              navigate(`/playlist/${playlist.id}`);
              toast.success(`📋 Otwieram playlistę: ${playlist.title}`, { id: "voice-playlist" });
              await safeSpeakAndResume(`Otwieram playlistę ${playlist.title}`);
            }
          } else {
            toast.error(`Nie znaleziono playlisty: "${searchName}"`, { id: "voice-playlist" });
            await safeSpeakAndResume(`Nie znalazłem playlisty o nazwie ${searchName}`);
          }
        } catch {
          toast.error("Błąd szukania playlisty", { id: "voice-playlist" });
        }
        return;
      }
    }

    // ==========================================
    // GENRE FOLDER OPEN / PLAY COMMANDS (multilingual)
    // ==========================================
    const genreFolderOpenMatch = lower.match(/(?:otwórz|otworz|pokaż|pokaz|wyświetl|wyswietl|open|show|toon|відкрий|покажи)\s+(?:katalog|folder|gatunek|genre|category|categorie|map|жанр|папк)\s+(.+)/i);
    const genreFolderPlayMatch = lower.match(/(?:plej|play|puść|pusc|odtwórz|odtworz|włącz|wlacz|zagraj|graj|odpal|leć|lec|dawaj|speel|draai|грай|увімкни)\s+(?:katalog|folder|gatunek|genre|category|categorie|map|z\s+katalogu|z\s+folderu|from\s+folder|from\s+genre|uit\s+map|з\s+папк|жанр)\s+(.+)/i);

    if (genreFolderOpenMatch || genreFolderPlayMatch) {
      const isPlayMode = !!genreFolderPlayMatch;
      const genreName = (genreFolderPlayMatch?.[1] || genreFolderOpenMatch?.[1] || "").trim();
      
      if (genreName) {
        if (isPlayMode) {
          // Fetch tracks from genre and play
          toast.loading(`🎵 Pobieram utwory z katalogu "${genreName}"...`, { id: "voice-genre" });
          const { data: tracks } = await supabase
            .from("tracks")
            .select("*")
            .ilike("genre", `%${genreName}%`)
            .not("audio_url", "is", null)
            .limit(50);
          
          if (tracks && tracks.length > 0) {
            playPlaylist(tracks, 0);
            toast.success(`▶ Odtwarzam katalog "${genreName}" — ${tracks.length} utworów`, { id: "voice-genre", duration: 4000 });
            await safeSpeakAndResume(`Odtwarzam katalog ${genreName}, ${tracks.length} utworów`);
          } else {
            toast.error(`Brak utworów w katalogu "${genreName}"`, { id: "voice-genre" });
            await safeSpeakAndResume(`Katalog ${genreName} jest pusty`);
          }
        } else {
          // Navigate to library with genre filter
          navigate(`/library?genre=${encodeURIComponent(genreName)}`);
          toast.success(`📂 Otwieram katalog: ${genreName}`, { id: "voice-genre" });
          await safeSpeakAndResume(`Otwieram katalog ${genreName}`);
        }
        return;
      }
    }

    // ==========================================
    // SEARCH COMMAND - multilingual
    // ==========================================
    const searchMatch = lower.match(/(?:poszukaj|znajdź|znajdz|wyszukaj|szukaj|search|find|look for|zoek|zoek naar|знайди|шукай)\s+(.+)/i);
    if (searchMatch) {
      const query = searchMatch[1].trim();
      if (query) {
        await searchAndPlay(query);
        return;
      }
    }

    // Navigation (general) - multilingual triggers
    if (includesAny(lower, ["otwórz", "włącz", "pokaż", "przejdź", "idź", "open", "show", "go to", "navigate", "toon", "ga naar", "відкрий", "покажи", "перейди"])) {
      if (tryNavigate(lower)) return;
    }
    if (tryNavigate(lower)) return;

    // ==========================================
    // FAVORITES PLAY COMMAND - multilingual
    // ==========================================
    const wantsFavorites = /ulubionych|polubion|z\s+ulubionych|z\s+polubionych|ulubione|liked|favorites?|favorieten|geliked|улюблен/i.test(lower);
    if (wantsFavorites) {
      const count = parseNumber(lower) || 5;
      toast.loading(`❤️ Pobieram ${count} z ulubionych...`, { id: "voice-cmd" });
      try {
        const { data: liked } = await supabase
          .from("liked_songs")
          .select("track_id")
          .eq("user_id", user!.id)
          .order("liked_at", { ascending: false })
          .limit(count);
        if (liked && liked.length > 0) {
          const ids = liked.map(l => l.track_id);
          const { data: tracks } = await supabase.from("tracks").select("*").in("id", ids);
          if (tracks && tracks.length > 0) {
            const ordered = ids.map(id => tracks.find(t => t.id === id)).filter(Boolean);
            playPlaylist(ordered as any[], 0);
            toast.success(`❤️ Odtwarzam ${ordered.length} ulubionych`, { id: "voice-cmd", duration: 4000 });
            await safeSpeakAndResume(`Odtwarzam ${ordered.length} utworów z ulubionych`);
            return;
          }
        }
        toast.error("Brak ulubionych utworów", { id: "voice-cmd" });
        await safeSpeakAndResume("Nie masz jeszcze żadnych ulubionych utworów. Polub kilka piosenek!");
      } catch {
        toast.error("Błąd pobierania ulubionych", { id: "voice-cmd" });
      }
      return;
    }

    // ==========================================
    // RECENT UPLOADS PLAY COMMAND
    // ==========================================
    const wantsRecent = /ostatni[echm]?\s+(?:wgrany|wrzucon|dodany|piosen|utw)|najnowsz|z\s+serwera|ostatnie\s+\d|śwież|swiez|newest|recent|latest|nieuwste|recent|laatste|останн|нові|свіж/i.test(lower);
    if (wantsRecent) {
      const count = parseNumber(lower) || 10;
      toast.loading(`📥 Pobieram ${count} ostatnich wgranych...`, { id: "voice-cmd" });
      try {
        const { data: tracks } = await supabase
          .from("tracks")
          .select("*")
          .not("audio_url", "is", null)
          .order("created_at", { ascending: false })
          .limit(count);
        if (tracks && tracks.length > 0) {
          playPlaylist(tracks, 0);
          toast.success(`📥 Odtwarzam ${tracks.length} najnowszych`, { id: "voice-cmd", duration: 4000 });
          await safeSpeakAndResume(`Odtwarzam ${tracks.length} ostatnio wgranych utworów. Pierwszy to ${tracks[0].title}`);
          return;
        }
        toast.error("Brak utworów w bibliotece", { id: "voice-cmd" });
        await safeSpeakAndResume("Biblioteka jest pusta. Wgraj jakieś utwory!");
      } catch {
        toast.error("Błąd pobierania", { id: "voice-cmd" });
      }
      return;
    }

    // ==========================================
    // MOVE/TRANSFER TRACK COMMAND (delegate to AI)
    // ==========================================
    const wantsMove = /(?:przenieś|przenies|wytnij|dodaj|wrzuć|wrzuc|usuń|usun|move|transfer|add|remove|verplaats|voeg toe|verwijder|перенеси|додай|видали).*(?:do\s+(?:katalogu|playlisty|folderu)|z\s+(?:katalogu|playlisty|folderu)|to\s+(?:playlist|folder)|from\s+(?:playlist|folder)|naar\s+(?:afspeellijst|map)|uit\s+(?:afspeellijst|map)|до\s+(?:плейліст|папк)|з\s+(?:плейліст|папк))/i.test(lower);
    if (wantsMove) {
      toast.loading(`📁 Zarządzam playlistą...`, { id: "voice-cmd" });
      try {
        const { data: aiData } = await invokeHubAI({
          message: command,
          history: [],
          userContext: { userId: user?.id, userName: user?.email?.split("@")[0] || "Użytkownik" }
        });
        if (aiData?.response) {
          toast.success(`📁 ${aiData.response.slice(0, 100)}`, { id: "voice-cmd", duration: 5000 });
          await safeSpeakAndResume(aiData.response.slice(0, 200));
        } else {
          toast.info("Nie udało się wykonać operacji", { id: "voice-cmd" });
          await safeSpeakAndResume("Nie udało mi się przenieść utworu. Spróbuj bardziej precyzyjnie.");
        }
      } catch {
        toast.error("Błąd zarządzania playlistą", { id: "voice-cmd" });
      }
      return;
    }

    // ==========================================
    // GENERAL QUESTION DETECTION → route to Grok AI voice answer
    // Must be BEFORE play commands to avoid false matches (e.g. "daj" inside "Amster*daj*")
    // ==========================================
    const isGeneralQuestion = (
      /(?:powiedz|opowiedz|wytłumacz|wytlumacz|wyjaśnij|wyjasnij|co to jest|co to|kto to|czym jest|jak działa|jak dziala|ile wynosi|kiedy |gdzie |dlaczego |czy .{5,}\?|jaki |jaka |jakie )/i.test(lower) ||
      /(?:tell me|explain|what is|who is|how does|how to|what are|why |when did|where is|how much|how many)/i.test(lower) ||
      /(?:vertel|uitleggen|wat is|wie is|hoe werkt|waarom|wanneer|waar is)/i.test(lower) ||
      /(?:розкажи|поясни|що таке|хто це|як працює|чому|коли|де є)/i.test(lower) ||
      /(?:co tam|co słychać|co slychac|co nowego|jak tam|how's it going|what's up|what's new|hoe gaat het|як справи|що нового)/i.test(lower) ||
      (lower.includes("?") && lower.length > 10 && !/(?:puść|pusc|graj|zagraj|play|włącz|wlacz|speel|грай)/i.test(lower))
    );

    if (isGeneralQuestion) {
      toast.loading(`🧠 Myślę...`, { id: "voice-cmd" });
      try {
        const lang = getAppLanguage();
        const { data: voiceData, error: voiceError } = await invokeHubAI({ question: command, language: lang });
        if (!voiceError && voiceData?.answer) {
          toast.success(`🌐 ${voiceData.answer.slice(0, 120)}`, { id: "voice-cmd", duration: 8000 });
          await safeSpeakAndResume(voiceData.answer);
        } else {
          await safeSpeakAndResume("Przepraszam, nie udało mi się znaleźć odpowiedzi.");
        }
      } catch {
        await safeSpeakAndResume("Przepraszam, wystąpił błąd.");
      }
      return;
    }

    // Search & play - multilingual verbs
    const PLAY_VERBS = [
      // PL
      "włącz", "puść", "zagraj", "odtwórz", "graj", "startuj", "daj", "leć", "dawaj", "odpal", "wrzuć", "kręć", "zrób", "rób",
      // EN
      "play", "start", "put on", "give me", "make",
      // NL
      "speel", "draai", "zet op", "geef", "maak",
      // UA
      "грай", "увімкни", "постав", "давай", "зроби",
    ];
    const hasPlayVerb = PLAY_VERBS.some(v => lower.includes(v));
    const playMatch = lower.match(/(?:włącz|puść|zagraj|odtwórz|graj|play|start|startuj|daj|leć|dawaj|odpal|wrzuć|kręć|zrób|rób|make|speel|draai|zet\s+op|geef|maak|грай|увімкни|постав|давай|зроби|put\s+on|give\s+me)\s+(.+)/i);
    
    // Also match number+songs pattern - multilingual
    const hasCountWord = parseNumber(lower) !== undefined;
    const hasSongWord = /piosen|utw|track|song|numer|kawalk|nummer|liedje|lied|трек|пісн/i.test(lower);
    const hasGenreWord = GENRE_KEYWORDS.some(g => lower.includes(g));
    
    const shouldPlay = playMatch || (hasCountWord && (hasSongWord || hasGenreWord)) || (hasPlayVerb && !playMatch);
    
    if (shouldPlay) {
      const rawQuery = playMatch ? playMatch[1].replace(/w\s+playerze/i, "").replace(/in\s+the\s+player/i, "").replace(/in\s+de\s+speler/i, "").trim() : lower;
      console.log("[Voice] Play command detected, raw query:", rawQuery);
      const count = parseNumber(rawQuery);
      const cleanQuery = rawQuery
        .replace(/\d+/g, "")
        .replace(/(?:włącz|puść|zagraj|odtwórz|graj|play|start|startuj|daj|leć|dawaj|odpal|wrzuć|kręć|zrób|rób|make|speel|draai|zet\s+op|geef|maak|грай|увімкни|постав|давай|зроби|put\s+on|give\s+me)\s*/gi, "")
        .replace(/(?:jeden|jedną|jedno|dwa|dwie|dwóch|dwoch|trzy|trzech|cztery|czterech|pięć|piec|pieciu|pięciu|sześć|szesc|sześciu|szesciu|siedem|siedmiu|osiem|ośmiu|osmiu|dziewięć|dziewiec|dziewięciu|dziesięć|dziesiec|dziesięciu|piętnaście|pietnascie|dwadzieścia|dwadziescia|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|een|één|twee|drie|vier|vijf|zes|zeven|acht|negen|tien|twaalf|vijftien|twintig)\s*/gi, "")
        .replace(/\s*(utw\w*|piosen\w*|track\w*|song\w*|numer\w*|kawalk\w*|nummer\w*|liedje\w*|lied\w*|трек\w*|пісн\w*)\s*/gi, "")
        .replace(/\s*(mi|mnie|jakieś|jakies|jakiś|tam|no|to|me|some|wat|mij|які)\s*/gi, " ")
        .trim();
      
      // If no genre/query specified, play random mix
      const finalQuery = cleanQuery || "mix";
      console.log("[Voice] Clean query:", finalQuery, "count:", count);
      await searchAndPlay(finalQuery, count || 10);
      return;
    }

    // "wybierz X rock/pop/etc" - genre-based selection (number + genre words)
    const selectMatch = lower.match(/(?:wybierz|select|choose|pick|kies|selecteer|вибери)\s+(.+)/i);
    if (selectMatch) {
      const rest = selectMatch[1].replace(/i\s+włącz.*/i, "").replace(/w\s+playerze/i, "").trim();
      const count = parseNumber(rest);
      const cleanQuery = rest
        .replace(/\d+/g, "")
        .replace(/(?:jeden|jedną|jedno|dwa|dwie|dwóch|dwoch|trzy|trzech|cztery|czterech|pięć|piec|pieciu|pięciu|sześć|szesc|sześciu|szesciu|siedem|siedmiu|osiem|ośmiu|osmiu|dziewięć|dziewiec|dziewięciu|dziesięć|dziesiec|dziesięciu|piętnaście|pietnascie|dwadzieścia|dwadziescia)\s*/gi, "")
        .replace(/\s*(utw\w*|piosen\w*|track\w*|song\w*)\s*/gi, "")
        .trim();
      if (cleanQuery) {
        await searchAndPlay(cleanQuery, count || 5);
        return;
      }
    }

    // Mood-based requests - multilingual
    const MOOD_PHRASES: Record<string, string> = {
      // PL
      "zly dzien": "happy", "zle sie czuje": "chill", "smutno": "happy",
      "popraw": "happy", "humor": "happy", "wesolo": "happy",
      "energi": "energetic", "spokojn": "chill", "relaks": "chill",
      "imprez": "energetic", "tanc": "energetic",
      "romantycz": "romantic", "milosc": "romantic",
      // EN
      "bad day": "happy", "feel sad": "happy", "cheer me up": "happy",
      "happy": "happy", "excited": "energetic", "calm": "chill",
      "relax": "chill", "party": "energetic", "dance": "energetic",
      "romantic": "romantic", "love": "romantic", "energy": "energetic",
      "chill": "chill", "peaceful": "chill",
      // NL
      "slecht dag": "happy", "verdrietig": "happy", "blij": "happy",
      "vrolijk": "happy", "rustig": "chill", "ontspannen": "chill",
      "feest": "energetic", "dansen": "energetic", "romantisch": "romantic",
      "liefde": "romantic", "energie": "energetic",
      // UA
      "поганий день": "happy", "сумно": "happy", "веселий": "happy",
      "спокійно": "chill", "релакс": "chill", "енергія": "energetic",
      "вечірка": "energetic", "танц": "energetic", "романтика": "romantic",
      "кохання": "romantic",
    };

    const detectedMood = Object.entries(MOOD_PHRASES).find(([phrase]) => normalized.includes(normalizeCommand(phrase)));
    if (detectedMood) {
      const [, moodValue] = detectedMood;
      toast.loading(`🎵 Szukam muzyki na poprawę nastroju...`, { id: "voice-cmd" });
      const { data: moodTracks } = await supabase
        .from("tracks")
        .select("*")
        .ilike("mood", `%${moodValue}%`)
        .limit(10);
      
      if (moodTracks && moodTracks.length > 0) {
        const shuffled = moodTracks.sort(() => Math.random() - 0.5);
        playPlaylist(shuffled, 0);
        await safeSpeakAndResume(`Rozumiem, puszczam muzykę żeby poprawić Ci nastrój! Oto ${shuffled.length} utworów dla Ciebie.`);
        toast.success(`🎵 Odtwarzam ${shuffled.length} utworów na poprawę humoru`, { id: "voice-cmd", duration: 4000 });
        return;
      }
    }

    // ==========================================
    // SAMOUCZĄCY SIĘ RESOLVER — czego reguły nie złapały, rozumie AI i UCZY SIĘ
    // (zapamiętuje frazę→akcję w hubie; następnym razem wykona od razu)
    // ==========================================
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tok = sess?.session?.access_token;
      if (tok) {
        const ir = await fetch("https://bmwtydwpevzhbdplilbr.supabase.co/functions/v1/voice-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
          body: JSON.stringify({ command, lang }),
        });
        const intent = await ir.json().catch(() => null);
        if (intent?.ok && intent.action && intent.action !== "answer") {
          const p = intent.params || {};
          const done = async (fallbackMsg?: string) => { await safeSpeakAndResume(intent.say || fallbackMsg || "Zrobione"); };
          switch (intent.action) {
            case "play": resumePlayback(); await done("Odtwarzam"); return;
            case "pause": pausePlayback(); await done("Zatrzymuję"); return;
            case "next": nextTrack(); await done("Następny"); return;
            case "previous": prevTrack(); await done("Poprzedni"); return;
            case "restart": restartCurrentTrack(); await done("Od początku"); return;
            case "seek_end": if ((audioElement?.duration || 0) > 0) { seek(98); await done("Na koniec"); } return;
            case "seek_forward":
            case "seek_back": {
              const dur = audioElement?.duration || 0, cur = audioElement?.currentTime || 0;
              if (dur > 0) { const sec = Number(p.seconds) || 30; const delta = intent.action === "seek_back" ? -sec : sec; seek((Math.max(0, Math.min(dur, cur + delta)) / dur) * 100); await done("Przewijam"); }
              return;
            }
            case "volume_set": setVolume(Math.max(0, Math.min(100, Number(p.percent) || 50))); await done("Głośność ustawiona"); return;
            case "volume_up": setVolume(85); await done("Głośniej"); return;
            case "volume_down": setVolume(25); await done("Ciszej"); return;
            case "mute": setVolume(0); await done("Wyciszono"); return;
            case "repeat_toggle": toggleRepeat(); await done("Powtarzanie"); return;
            case "shuffle_toggle": toggleShuffle(); await done("Losowo"); return;
            case "add_queue": if (currentTrack) { addToQueue(currentTrack); await done("Dodano do kolejki"); } return;
            case "split_stems": if (currentTrack?.audio_url) { window.dispatchEvent(new CustomEvent("grouai:open-stems", { detail: { audioUrl: currentTrack.audio_url, title: currentTrack.title } })); await done("Rozdzielam na ścieżki"); } return;
            case "like_current":
              if (currentTrack && user) {
                await supabase.from("liked_songs").upsert({ user_id: user.id, track_id: currentTrack.id }, { onConflict: "user_id,track_id" });
                window.dispatchEvent(new CustomEvent("track-like-changed", { detail: { trackId: currentTrack.id, liked: true } }));
                await done("Polubiono");
              }
              return;
            case "navigate": {
              const map: Record<string, string> = { home: "/", search: "/search", library: "/library", liked: "/liked", server: "/server", movies: "/movies", radio: "/radio-live", settings: "/settings", mood: "/mood-history", playlists: "/playlist-manager" };
              const r = map[String(p.page || "").toLowerCase()];
              if (r) { navigate(r); await done("Otwieram"); }
              return;
            }
            case "search_play": { const q = String(p.query || "").trim(); if (q) { await searchAndPlay(q, Number(p.count) || 10); } return; }
            case "play_favorites":
            case "play_recent": {
              const count = Number(p.count) || (intent.action === "play_recent" ? 10 : 5);
              if (intent.action === "play_favorites" && user) {
                const { data: liked } = await supabase.from("liked_songs").select("track_id").eq("user_id", user.id).order("liked_at", { ascending: false }).limit(count);
                const ids = (liked || []).map((l: any) => l.track_id);
                if (ids.length) { const { data: tr } = await supabase.from("tracks").select("*").in("id", ids); const ordered = ids.map((id: string) => tr?.find((t: any) => t.id === id)).filter(Boolean); if (ordered.length) { playPlaylist(ordered as any[], 0); await done("Ulubione"); return; } }
              } else {
                const { data: tr } = await supabase.from("tracks").select("*").not("audio_url", "is", null).order("created_at", { ascending: false }).limit(count);
                if (tr?.length) { playPlaylist(tr, 0); await done("Ostatnio wgrane"); return; }
              }
              return;
            }
          }
        }
      }
    } catch { /* resolver padł → normalna odpowiedź niżej */ }

    // AI fallback — answer ANY question via Grok/AI voice endpoint
    try {
      toast.loading(`🧠 Myślę...`, { id: "voice-cmd" });
      
      // First try music AI for play commands
      if (isAIEnabled) {
        const requestedCount = parseNumber(command);
        const result = await processVoiceCommand(command);
        if (result.action === "play" && result.tracks?.length) {
          const limitedTracks = requestedCount ? result.tracks.slice(0, requestedCount) : result.tracks.slice(0, 10);
          playPlaylist(limitedTracks, 0);
          toast.success(`🎵 Odtwarzam ${limitedTracks.length} utworów`, { id: "voice-cmd", duration: 4000 });
          await safeSpeakAndResume(`Odtwarzam ${limitedTracks.length} utworów`);
          return;
        } else if (result.action === "pause") {
          pausePlayback(); await safeSpeakAndResume("Pauza");
          toast.success("⏸️ Pauza", { id: "voice-cmd" });
          return;
        }
      }

      // Universal voice answer — calls Grok for ANY question (weather, facts, general knowledge, etc.)
      const lang = getAppLanguage();
      const { data: voiceData, error: voiceError } = await invokeHubAI({ question: command, language: lang });

      if (!voiceError && voiceData?.answer) {
        const answer = voiceData.answer;
        toast.success(`🌐 ${answer.slice(0, 120)}...`, { id: "voice-cmd", duration: 8000 });
        await safeSpeakAndResume(answer);
      } else {
        // Last resort fallback
        const errMsgs: Record<Language, string> = {
          pl: "Przepraszam, nie udało mi się znaleźć odpowiedzi. Spróbuj ponownie.",
          en: "Sorry, I couldn't find an answer. Please try again.",
          nl: "Sorry, ik kon geen antwoord vinden. Probeer het opnieuw.",
          ua: "Вибачте, не вдалося знайти відповідь. Спробуйте ще раз.",
        };
        await safeSpeakAndResume(errMsgs[lang]);
        toast.info(`🤖 ${errMsgs[lang]}`, { id: "voice-cmd" });
      }
    } catch {
      const lang = getAppLanguage();
      const errMsgs: Record<Language, string> = {
        pl: "Przepraszam, wystąpił błąd. Spróbuj ponownie.",
        en: "Sorry, an error occurred. Please try again.",
        nl: "Sorry, er is een fout opgetreden. Probeer het opnieuw.",
        ua: "Вибачте, сталася помилка. Спробуйте ще раз.",
      };
      await safeSpeakAndResume(errMsgs[lang]);
      toast.error(errMsgs[lang], { id: "voice-cmd" });
    }
    } finally {
      isProcessingCommandRef.current = false;
    }
  }, [isAIEnabled, processVoiceCommand, playPlaylist, nextTrack, prevTrack, setVolume, tryNavigate, searchAndPlay, resetSilenceTimer, assistantName, fetchAISuggestions, shutdownMic, showSuggestions, aiSuggestions, pausePlayback, resumePlayback, restartCurrentTrack, parseNumber, handlePlayFromAI, safeSpeakAndResume, seek, audioElement, toggleRepeat, toggleShuffle, currentTrack, addToQueue, user]);

  const startListening = useCallback(() => {
    if (!user) return;
    const SpeechAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechAPI) { toast.error("Brak wsparcia mowy w przeglądarce"); return; }
    if (recognitionRef.current) { try { recognitionRef.current.abort(); } catch {} recognitionRef.current = null; }

    try {
      const rec = new SpeechAPI() as SpeechRecognitionInstance;
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = LANG_TO_RECOGNITION[getAppLanguage()] || "en-US";
      rec.onresult = (event: SpeechRecognitionEvent) => {
        // Guard: ignore anything picked up while TTS is speaking
        if (isSpeakingRef.current) return;

        // Keep microphone session alive while user is speaking
        resetSilenceTimer();

        const last = event.results[event.results.length - 1];
        if (last?.isFinal) {
          const transcript = last[0].transcript.trim();
          // Deduplicate: ignore if same text as last processed command within 3s
          if (transcript === lastProcessedRef.current.text && Date.now() - lastProcessedRef.current.time < 3000) {
            console.log("[Voice] Duplicate ignored:", transcript);
            return;
          }
          lastProcessedRef.current = { text: transcript, time: Date.now() };
          console.log("[Voice] Final transcript:", transcript);
          processCommand(transcript);
        }
      };
      rec.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.log("[Voice] Recognition error:", event.error);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setAutoListenEnabled(false); localStorage.setItem("auto-voice-listen", "false");
          setIsListening(false); toast.error("🎙️ Brak dostępu do mikrofonu"); return;
        }
        if (event.error === "aborted") return;
        if (event.error === "no-speech") {
          // Don't restart here — onend will handle it
          return;
        }
        setIsListening(false);
      };
      rec.onend = () => {
        console.log("[Voice] Recognition ended, speakRestarting:", speakRestartingRef.current, "autoListen:", autoListenRef.current);
        setIsListening(false);
        // If safeSpeakAndResume is handling restart, don't interfere
        if (speakRestartingRef.current) return;
        if (isSpeakingRef.current) return;
        
        if (autoListenRef.current) {
          // Create a fresh recognition instance instead of reusing aborted one
          restartTimeoutRef.current = window.setTimeout(() => {
            console.log("[Voice] Auto-restarting recognition from onend");
            startListeningRef.current?.();
          }, 400);
        }
      };
      rec.start();
      recognitionRef.current = rec;
      setIsListening(true);
      resetSilenceTimer();
      console.log("[Voice] Recognition started successfully");
    } catch (e) {
      console.error("[Voice] Failed to start recognition:", e);
      toast.error("Nie udało się uruchomić mikrofonu");
    }
  }, [user, processCommand, resetSilenceTimer]);

  // Keep ref in sync so safeSpeakAndResume can restart listening
  useEffect(() => { startListeningRef.current = startListening; }, [startListening]);

  // Auto-wznowienie nasłuchu przy wejściu na stronę: jeśli mikrofon był włączony
  // w poprzedniej sesji (zapamiętane w localStorage), włącz go od razu — bez
  // czekania aż użytkownik ręcznie kliknie przycisk mikrofonu.
  const autoResumedListeningRef = useRef(false);
  useEffect(() => {
    if (autoResumedListeningRef.current) return;
    if (!user || !autoListenEnabled) return;
    if (recognitionRef.current) return;
    autoResumedListeningRef.current = true;
    startListening();
  }, [user, autoListenEnabled, startListening]);

  // Restart recognition when app language changes so it listens in the correct locale
  useEffect(() => {
    const onLangChange = () => {
      if (recognitionRef.current && isListening) {
        console.log("[Voice] Language changed, restarting recognition");
        try { recognitionRef.current.abort(); } catch {}
        recognitionRef.current = null;
        setTimeout(() => startListeningRef.current?.(), 300);
      }
    };
    window.addEventListener("grooveai-language-change", onLangChange);
    return () => window.removeEventListener("grooveai-language-change", onLangChange);
  }, [isListening]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) { try { recognitionRef.current.abort(); } catch {} }
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (showIndicator) {
      const t = setTimeout(() => setShowIndicator(false), 4000);
      return () => clearTimeout(t);
    }
  }, [showIndicator, lastTranscript]);

  const handleNameSubmit = useCallback(async (name: string) => {
    setShowNamingModal(false);
    await saveAssistantName(name);
    autoResumedListeningRef.current = true; // ten start obsługujemy tu ręcznie z powitaniem
    setAutoListenEnabled(true);
    localStorage.setItem("auto-voice-listen", "true");
    toast.success(`🎤 ${name} aktywowany!`, { duration: 5000 });
    // Speak greeting FIRST, then start listening (prevents mic from hearing its own TTS)
    isSpeakingRef.current = true;
    await speak(`Cześć! Miło mi że mnie tak nazwałeś — ${name}. Jestem Twoim asystentem muzycznym. Powiedz moje imię kiedy będziesz mnie potrzebować!`);
    await new Promise(r => setTimeout(r, 600));
    isSpeakingRef.current = false;
    startListening();
  }, [saveAssistantName, startListening]);

  const toggleAutoListen = useCallback(async () => {
    const next = !autoListenEnabled;
    autoResumedListeningRef.current = true; // ten start (jeśli next) obsługujemy tu ręcznie z powitaniem
    setAutoListenEnabled(next);
    localStorage.setItem("auto-voice-listen", String(next));
    if (next) {
      toast.success("🎙️ Mikrofon AI włączony");
      // Speak greeting FIRST, then start listening (prevents mic from hearing its own TTS)
      isSpeakingRef.current = true;
      await speak(`Mikrofon włączony.${assistantName ? ` Jestem ${assistantName}.` : ""} Słucham.`);
      await new Promise(r => setTimeout(r, 600));
      isSpeakingRef.current = false;
      startListening();
    } else {
      shutdownMic();
    }
  }, [autoListenEnabled, startListening, assistantName, shutdownMic]);

  // Listen for toggle from InfinityWidget
  useEffect(() => {
    const handler = () => toggleAutoListen();
    window.addEventListener("toggle-voice-mic", handler);
    return () => window.removeEventListener("toggle-voice-mic", handler);
  }, [toggleAutoListen]);

  // Broadcast mic state to InfinityWidget — use autoListenEnabled so it stays orange during TTS pauses
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("voice-mic-state", { detail: autoListenEnabled }));
  }, [autoListenEnabled]);

  const playSuggestion = async (track: any) => {
    playPlaylist([{ id: track.id, title: track.title, artist: track.artist, album: null, audio_url: null, cover_url: null, genre: track.genre, mood: track.mood, duration: 180 }], 0);
    setShowSuggestions(false);
    await safeSpeakAndResume(`Odtwarzam ${track.title}`);
  };

  if (!user) return null;

  return (
    <>
      <AssistantNamingModal open={showNamingModal} onSubmit={handleNameSubmit} />

      {/* Mic button removed - now in InfinityAssistantWidget */}

      {/* AI Suggestions Panel */}
      <AnimatePresence>
        {showSuggestions && aiSuggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-44 md:bottom-48 right-4 z-50 w-[280px] rounded-2xl p-3 space-y-2"
            style={{
              background: 'rgba(0,0,0,0.3)',
              backdropFilter: 'blur(40px) saturate(200%)',
              WebkitBackdropFilter: 'blur(40px) saturate(200%)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-semibold text-foreground/80">
                {assistantName || "AI"} proponuje na dziś
              </span>
            </div>
            {aiSuggestions.map((s: any, i: number) => (
              <motion.button
                key={s.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => playSuggestion(s)}
                className="w-full flex items-center gap-2 p-2 rounded-xl transition-colors text-left"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
                whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.08)' }}
              >
                <Music className="h-3 w-3 text-primary/70 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-medium text-foreground/90 truncate">{s.title}</p>
                  <p className="text-[9px] text-muted-foreground/60 truncate">{s.artist} · {s.reason}</p>
                </div>
              </motion.button>
            ))}
            <motion.button
              onClick={async () => {
                const tracks = aiSuggestions.map((s: any) => ({ id: s.id, title: s.title, artist: s.artist, album: null, audio_url: null, cover_url: null, genre: s.genre, mood: s.mood, duration: 180 }));
                playPlaylist(tracks, 0);
                setShowSuggestions(false);
                await safeSpeakAndResume("Odtwarzam wszystkie propozycje!");
              }}
              className="w-full py-1.5 rounded-xl text-[10px] font-semibold text-primary-foreground"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--primary) / 0.5), hsl(var(--accent) / 0.3))',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              ▶ Puść wszystkie
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice feedback popup */}
      <AnimatePresence>
        {showIndicator && lastTranscript && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-44 md:bottom-48 right-4 z-40 max-w-[240px] rounded-xl p-2.5"
            style={{
              background: 'rgba(0,0,0,0.25)',
              backdropFilter: 'blur(30px)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <Sparkles className="h-3 w-3 text-primary/70" />
              <span className="text-[9px] font-semibold text-primary/80">{assistantName || "AI"}</span>
            </div>
            <p className="text-[10px] text-foreground/80">"{lastTranscript}"</p>
            {isProcessing && <p className="text-[9px] text-muted-foreground/60 mt-0.5 animate-pulse">Przetwarzam...</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
