import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Sparkles, Music } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAI } from "@/contexts/AIContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAssistantConfig } from "@/hooks/useAssistantConfig";
import { AssistantNamingModal } from "@/components/modals/AssistantNamingModal";
import { speak, isTTSSpeaking } from "@/utils/tts";
import { supabase } from "@/integrations/supabase/client";
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
  const { processVoiceCommand, isAIEnabled, isProcessing } = useAI();
  const { playPlaylist, nextTrack, prevTrack, setVolume, pausePlayback, resumePlayback, restartCurrentTrack } = usePlayer();
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

    await speak(text, { mode: "assistant" });

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
          "/playlist-manager": "Playlisty", "/admin": "Admin"
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

  const POLISH_NUMBERS: Record<string, number> = {
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
  };

  const parsePolishNumber = useCallback((text: string): number | undefined => {
    // Try digit first
    const digitMatch = text.match(/(\d+)/);
    if (digitMatch) return parseInt(digitMatch[1]);
    // Try Polish word
    const normalized = normalizeCommand(text);
    for (const [word, num] of Object.entries(POLISH_NUMBERS)) {
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
        const { data } = await supabase
          .from("tracks")
          .select("*")
          .or(`title.ilike.%${query}%,artist.ilike.%${query}%`)
          .limit(count || 10);
        tracks = data;
      }

      if (tracks && tracks.length > 0) {
        const toPlay = count ? tracks.slice(0, count) : tracks;
        playPlaylist(toPlay, 0);
        toast.success(`🎵 Odtwarzam ${toPlay.length} utworów: ${toPlay[0].title}`, { id: "voice-search", duration: 4000 });
        await safeSpeakAndResume(`Odtwarzam ${toPlay.length} utworów ${matchedGenre || ""}, ${toPlay[0].title}`);
      } else {
        toast.loading(`🌐 Szukam w sieci: "${query}"...`, { id: "voice-search" });
        try {
          const { data: aiData, error: aiError } = await supabase.functions.invoke("ai-assistant", {
            body: { 
              message: `Znajdź YouTube video ID (11 znaków) dla utworu: "${query}". Odpowiedz TYLKO w formacie: VIDEOID:xxxxxxxxxxx albo NOTFOUND jeśli nie znasz.`,
              history: [] 
            }
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
    // STOP command - HIGHEST PRIORITY - check first before anything else
    const stopRequested = includesAny(normalized, [
      "stop", "stopp", "stup", "stap",
      "zatrzymaj",
      "pauza", "pauze", "pause",
      "wstrzymaj",
      "wylacz player", "wylacz muzyk",
      "cisza", "ucisz",
    ]) || includesAny(lower, ["stop", "pauza", "zatrzymaj", "wstrzymaj", "pause"]);

    if (stopRequested) {
      pausePlayback();
      await safeSpeakAndResume("Zatrzymuję");
      toast.info("⏹️ Zatrzymano");
      return;
    }

    // Shutdown commands
    if (lower.includes("wyłącz się") || (lower.includes("wyłącz") && lower.includes("asystent")) || lower.includes("zamknij się")) {
      shutdownMic();
      return;
    }

    // DJ Mode commands
    const djResult = parseDJCommand(command);
    if (djResult.isDJCommand) {
      toast.loading("🎧 DJ GrooveAI przygotowuje set...", { id: "dj-voice" });
      await startDJSession({
        genres: djResult.genres,
        partyType: djResult.partyType,
        trackCount: djResult.trackCount,
        customPrompt: djResult.customPrompt,
      });
      toast.success(`🎧 DJ GrooveAI startuje set! ${djResult.trackCount} utworów`, { id: "dj-voice", duration: 5000 });
      return;
    }

    // Stop DJ
    if (isDJActive && includesAny(normalized, ["stop dj", "wylacz dj", "koniec setu", "zakoncz set"])) {
      await stopDJSession();
      return;
    }

    // Weather command (online)
    if (includesAny(normalized, ["pogoda", "prognoza", "jaka pogoda", "sprawdz pogode"])) {
      toast.loading("🌤️ Sprawdzam pogodę w sieci...", { id: "voice-weather" });
      try {
        const weatherSummary = await getWeatherSummary(command);
        toast.success(`🌤️ ${weatherSummary.slice(0, 80)}...`, { id: "voice-weather", duration: 4500 });
        await safeSpeakAndResume(weatherSummary);
      } catch {
        toast.error("Nie udało się pobrać pogody", { id: "voice-weather" });
        await safeSpeakAndResume("Nie udało mi się sprawdzić pogody. Spróbuj ponownie za chwilę.");
      }
      return;
    }

    if (includesAny(normalized, ["wznow", "kontynuuj", "graj dalej", "resume"])) {
      resumePlayback();
      await safeSpeakAndResume("Wznawiam odtwarzanie");
      return;
    }

    if (includesAny(normalized, ["od poczatku", "zacznij od poczatku", "od nowa"])) {
      restartCurrentTrack();
      await safeSpeakAndResume("Uruchamiam od początku");
      return;
    }

    if (lower.includes("graj") && !lower.includes("następ") && !lower.includes("odtwarz") && lower.split(" ").length <= 2) { resumePlayback(); await safeSpeakAndResume("Odtwarzam"); return; }
    if (lower.includes("następn") || lower.includes("dalej") || lower.includes("skip")) { nextTrack(); await safeSpeakAndResume("Następny utwór"); return; }
    if (lower.includes("poprzedni") || lower.includes("cofnij") || lower.includes("wstecz")) { prevTrack(); await safeSpeakAndResume("Poprzedni utwór"); return; }
    if (lower.includes("głośniej") || lower.includes("louder")) { setVolume(85); await safeSpeakAndResume("Głośniej"); return; }
    if (lower.includes("ciszej") || lower.includes("cicho")) { setVolume(25); await safeSpeakAndResume("Ciszej"); return; }
    if (lower.includes("wycisz") || lower.includes("mute")) { setVolume(0); await safeSpeakAndResume("Wyciszono"); return; }

    // ==========================================
    // PLAYLIST OPEN / PLAY COMMANDS
    // ==========================================
    const playlistOpenMatch = lower.match(/(?:otwórz|otworz|pokaż|pokaz|wyświetl|wyswietl)\s+(?:playlist[ęeay]?|plej\s*list[ęeay]?)\s+(.+)/i);
    const playlistPlayMatch = lower.match(/(?:plej|play|puść|pusc|odtwórz|odtworz|włącz|wlacz|zagraj|graj|odpal|leć|lec|dawaj)\s+(?:playlist[ęeay]?|plej\s*list[ęeay]?)\s+(.+)/i);
    // Also match "playlistę X" without verb (just name after "playlistę")
    const playlistNameOnly = !playlistOpenMatch && !playlistPlayMatch && lower.match(/(?:playlist[ęeay]?|plej\s*list[ęeay]?)\s+(.+)/i);

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
    // GENRE FOLDER OPEN / PLAY COMMANDS
    // ==========================================
    const genreFolderOpenMatch = lower.match(/(?:otwórz|otworz|pokaż|pokaz|wyświetl|wyswietl)\s+(?:katalog|folder|gatunek)\s+(.+)/i);
    const genreFolderPlayMatch = lower.match(/(?:plej|play|puść|pusc|odtwórz|odtworz|włącz|wlacz|zagraj|graj|odpal|leć|lec|dawaj)\s+(?:katalog|folder|gatunek|z\s+katalogu|z\s+folderu)\s+(.+)/i);

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
    // SEARCH COMMAND ("poszukaj X", "znajdź X", "szukaj X")
    // ==========================================
    const searchMatch = lower.match(/(?:poszukaj|znajdź|znajdz|wyszukaj|szukaj|search|find)\s+(.+)/i);
    if (searchMatch) {
      const query = searchMatch[1].trim();
      if (query) {
        await searchAndPlay(query);
        return;
      }
    }

    // Navigation (general)
    if (lower.includes("otwórz") || lower.includes("włącz") || lower.includes("pokaż") || lower.includes("przejdź") || lower.includes("idź")) {
      if (tryNavigate(lower)) return;
    }
    if (tryNavigate(lower)) return;

    // ==========================================
    // FAVORITES PLAY COMMAND
    // ==========================================
    const wantsFavorites = /ulubionych|polubion|z\s+ulubionych|z\s+polubionych|ulubione|liked|favorite/i.test(lower);
    if (wantsFavorites) {
      const count = parsePolishNumber(lower) || 5;
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
    const wantsRecent = /ostatni[echm]?\s+(?:wgrany|wrzucon|dodany|piosen|utw)|najnowsz|z\s+serwera|ostatnie\s+\d|śwież|swiez|newest|recent|ostatnio\s+(?:wgran|dodan|wrzucon)/i.test(lower);
    if (wantsRecent) {
      const count = parsePolishNumber(lower) || 10;
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
    const wantsMove = /(?:przenieś|przenies|wytnij|dodaj|wrzuć|wrzuc|usuń|usun).*(?:do\s+(?:katalogu|playlisty|folderu)|z\s+(?:katalogu|playlisty|folderu))/i.test(lower);
    if (wantsMove) {
      toast.loading(`📁 Zarządzam playlistą...`, { id: "voice-cmd" });
      try {
        const { data: aiData } = await supabase.functions.invoke("ai-assistant", {
          body: { 
            message: command, 
            history: [],
            userContext: { userId: user?.id, userName: user?.email?.split("@")[0] || "Użytkownik" }
          }
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

    // Search & play - expanded triggers including "start", "daj", "leć", number+genre patterns
    const PLAY_VERBS = ["włącz", "puść", "zagraj", "odtwórz", "graj", "play", "start", "startuj", "daj", "leć", "dawaj", "odpal", "wrzuć", "kręć"];
    const hasPlayVerb = PLAY_VERBS.some(v => lower.includes(v));
    const playMatch = lower.match(/(?:włącz|puść|zagraj|odtwórz|graj|play|start|startuj|daj|leć|dawaj|odpal|wrzuć|kręć)\s+(.+)/i);
    
    // Also match number+songs pattern anywhere, e.g. "dziesięć piosenek rock", "10 piosenek", "rock 10 piosenek"
    const hasCountWord = parsePolishNumber(lower) !== undefined;
    const hasSongWord = /piosen|utw|track|song|numer|kawalk/i.test(lower);
    const hasGenreWord = GENRE_KEYWORDS.some(g => lower.includes(g));
    
    // Match if: has play verb, OR has count+songs pattern, OR has count+genre
    const shouldPlay = playMatch || (hasCountWord && (hasSongWord || hasGenreWord)) || (hasPlayVerb && !playMatch);
    
    if (shouldPlay) {
      // Extract everything useful from the command
      const rawQuery = playMatch ? playMatch[1].replace(/w\s+playerze/i, "").trim() : lower;
      console.log("[Voice] Play command detected, raw query:", rawQuery);
      const count = parsePolishNumber(rawQuery);
      const cleanQuery = rawQuery
        .replace(/\d+/g, "")
        .replace(/(?:włącz|puść|zagraj|odtwórz|graj|play|start|startuj|daj|leć|dawaj|odpal|wrzuć|kręć)\s*/gi, "")
        .replace(/(?:jeden|jedną|jedno|dwa|dwie|dwóch|dwoch|trzy|trzech|cztery|czterech|pięć|piec|pieciu|pięciu|sześć|szesc|sześciu|szesciu|siedem|siedmiu|osiem|ośmiu|osmiu|dziewięć|dziewiec|dziewięciu|dziesięć|dziesiec|dziesięciu|piętnaście|pietnascie|dwadzieścia|dwadziescia)\s*/gi, "")
        .replace(/\s*(utw\w*|piosen\w*|track\w*|song\w*|numer\w*|kawalk\w*)\s*/gi, "")
        .replace(/\s*(mi|mnie|jakieś|jakies|jakiś|tam|no|to)\s*/gi, " ")
        .trim();
      
      // If no genre/query specified, play random mix
      const finalQuery = cleanQuery || "mix";
      console.log("[Voice] Clean query:", finalQuery, "count:", count);
      await searchAndPlay(finalQuery, count || 10);
      return;
    }

    // "wybierz X rock/pop/etc" - genre-based selection (number + genre words)
    const selectMatch = lower.match(/wybierz\s+(.+)/i);
    if (selectMatch) {
      const rest = selectMatch[1].replace(/i\s+włącz.*/i, "").replace(/w\s+playerze/i, "").trim();
      const count = parsePolishNumber(rest);
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

    // Mood-based requests
    const MOOD_PHRASES: Record<string, string> = {
      "zly dzien": "happy",
      "zle sie czuje": "chill",
      "smutno": "happy",
      "popraw": "happy",
      "humor": "happy",
      "wesolo": "happy",
      "energi": "energetic",
      "spokojn": "chill",
      "relaks": "chill",
      "imprez": "energetic",
      "tanc": "energetic",
      "romantycz": "romantic",
      "milosc": "romantic",
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

    // AI fallback
    try {
      toast.loading(`🎙️ AI analizuje...`, { id: "voice-cmd" });
      
      if (isAIEnabled) {
        const requestedCount = parsePolishNumber(command);
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

      // General AI assistant fallback
      const { data: aiData, error: aiError } = await supabase.functions.invoke("ai-assistant", {
        body: { message: command, history: [] }
      });
      if (!aiError && aiData?.response) {
        const response = aiData.response;
        await safeSpeakAndResume(response.slice(0, 300));
        toast.success(`🤖 ${response.slice(0, 120)}...`, { id: "voice-cmd", duration: 6000 });
        
        if (aiData.trackLink) {
          await handlePlayFromAI(aiData.trackLink.id);
        }
      } else {
        await safeSpeakAndResume("Przepraszam, nie rozumiem. Możesz powtórzyć?");
        toast.info("🤖 Przepraszam, nie rozumiem. Możesz powtórzyć?", { id: "voice-cmd" });
      }
    } catch {
      await safeSpeakAndResume("Przepraszam, nie rozumiem. Możesz powtórzyć?");
      toast.error("Przepraszam, nie rozumiem. Możesz powtórzyć?", { id: "voice-cmd" });
    }
    } finally {
      isProcessingCommandRef.current = false;
    }
  }, [isAIEnabled, processVoiceCommand, playPlaylist, nextTrack, prevTrack, setVolume, tryNavigate, searchAndPlay, resetSilenceTimer, assistantName, fetchAISuggestions, shutdownMic, showSuggestions, aiSuggestions, pausePlayback, resumePlayback, restartCurrentTrack, parsePolishNumber, handlePlayFromAI, safeSpeakAndResume]);

  const startListening = useCallback(() => {
    if (!user) return;
    const SpeechAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechAPI) { toast.error("Brak wsparcia mowy w przeglądarce"); return; }
    if (recognitionRef.current) { try { recognitionRef.current.abort(); } catch {} recognitionRef.current = null; }

    try {
      const rec = new SpeechAPI() as SpeechRecognitionInstance;
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "pl-PL";
      rec.onresult = (event: SpeechRecognitionEvent) => {
        // Guard: ignore anything picked up while TTS is speaking
        if (isSpeakingRef.current) return;

        // Keep microphone session alive while user is speaking
        resetSilenceTimer();

        const last = event.results[event.results.length - 1];
        if (last?.isFinal) {
          console.log("[Voice] Final transcript:", last[0].transcript);
          processCommand(last[0].transcript);
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
    speak(`Odtwarzam ${track.title}`);
    setShowSuggestions(false);
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
            className="fixed bottom-36 md:bottom-40 right-4 z-50 w-[280px] rounded-2xl p-3 space-y-2"
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
              onClick={() => {
                const tracks = aiSuggestions.map((s: any) => ({ id: s.id, title: s.title, artist: s.artist, album: null, audio_url: null, cover_url: null, genre: s.genre, mood: s.mood, duration: 180 }));
                playPlaylist(tracks, 0);
                speak("Odtwarzam wszystkie propozycje!");
                setShowSuggestions(false);
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
            className="fixed bottom-36 md:bottom-40 right-4 z-40 max-w-[240px] rounded-xl p-2.5"
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
