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

const NAV_MAP: Record<string, string> = {
  "stron": "/", "główn": "/", "home": "/",
  "szukaj": "/search", "wyszuk": "/search", "search": "/search",
  "bibliotek": "/library", "library": "/library",
  "polubionych": "/liked", "polubion": "/liked", "liked": "/liked",
  "serwer": "/server", "server": "/server", "medi": "/server",
  "film": "/movies", "movie": "/movies",
  "radio": "/radio",
  "ustawien": "/settings", "settings": "/settings",
  "nastro": "/mood-history", "mood": "/mood-history",
  "playlist": "/playlist-manager",
  "admin": "/admin",
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

  /**
   * Pause recognition → speak → resume recognition.
   * This prevents the mic from picking up what the assistant says.
   */
  const safeSpeakAndResume = useCallback(async (text: string) => {
    isSpeakingRef.current = true;
    // Pause recognition while speaking
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }
    setIsListening(false);

    await speak(text);

    // Small extra gap to let echo fade
    await new Promise(r => setTimeout(r, 600));
    isSpeakingRef.current = false;

    // Restart recognition if auto-listen is still on
    if (autoListenEnabled) {
      restartTimeoutRef.current = window.setTimeout(() => {
        startListeningRef.current?.();
      }, 300);
    }
  }, [autoListenEnabled]);

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
          "/radio": "Radio", "/settings": "Ustawienia", "/mood-history": "Historia nastroju",
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
      toast.loading(`🔍 Szukam: "${query}"...`, { id: "voice-search" });

      const lowerQuery = query.toLowerCase().trim();
      const matchedGenre = GENRE_KEYWORDS.find(g => lowerQuery.includes(g));

      let tracks: any[] | null = null;

      if (matchedGenre) {
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
    if (normalized.length < 3) return;

    // Guard: ignore if TTS is still speaking (mic echo protection)
    if (isSpeakingRef.current) return;

    // Guard: ignore if already processing a command
    if (isProcessingCommandRef.current) {
      console.log("[Voice] Ignoring command, already processing:", command);
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

    // Navigation
    if (lower.includes("otwórz") || lower.includes("włącz") || lower.includes("pokaż") || lower.includes("przejdź") || lower.includes("idź")) {
      if (tryNavigate(lower)) return;
    }
    if (tryNavigate(lower)) return;

    // Search & play - "puść/zagraj X" or "puść 5 rock"
    const playMatch = lower.match(/(?:włącz|puść|zagraj|odtwórz|graj|play)\s+(.+)/i);
    if (playMatch) {
      const query = playMatch[1].replace(/w\s+playerze/i, "").trim();
      const count = parsePolishNumber(query);
      const cleanQuery = query
        .replace(/\d+/g, "")
        .replace(/(?:jeden|jedną|jedno|dwa|dwie|dwóch|dwoch|trzy|trzech|cztery|czterech|pięć|piec|pieciu|pięciu|sześć|szesc|sześciu|szesciu|siedem|siedmiu|osiem|ośmiu|osmiu|dziewięć|dziewiec|dziewięciu|dziesięć|dziesiec|dziesięciu|piętnaście|pietnascie|dwadzieścia|dwadziescia)\s*/gi, "")
        .replace(/\s*(utw\w*|piosen\w*|track\w*|song\w*)\s*/gi, "")
        .trim();
      await searchAndPlay(cleanQuery || query, count);
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
        if (last?.isFinal) processCommand(last[0].transcript);
      };
      rec.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setAutoListenEnabled(false); localStorage.setItem("auto-voice-listen", "false");
          setIsListening(false); toast.error("🎙️ Brak dostępu do mikrofonu"); return;
        }
        if (event.error === "aborted") return;
        if (event.error === "no-speech") {
          if (autoListenEnabled) {
            restartTimeoutRef.current = window.setTimeout(() => {
              try { rec.start(); setIsListening(true); } catch {}
            }, 300);
          }
          return;
        }
        setIsListening(false);
      };
      rec.onend = () => {
        setIsListening(false);
        if (autoListenEnabled) {
          restartTimeoutRef.current = window.setTimeout(() => {
            if (autoListenEnabled && recognitionRef.current) {
              try { rec.start(); setIsListening(true); } catch {}
            }
          }, 500);
        }
      };
      rec.start();
      recognitionRef.current = rec;
      setIsListening(true);
      resetSilenceTimer();
    } catch {
      toast.error("Nie udało się uruchomić mikrofonu");
    }
  }, [user, processCommand, autoListenEnabled, resetSilenceTimer]);

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
    setTimeout(() => {
      speak(`Cześć! Miło mi że mnie tak nazwałeś — ${name}. Jestem Twoim asystentem muzycznym. Powiedz moje imię kiedy będziesz mnie potrzebować!`);
      toast.success(`🎤 ${name} aktywowany!`, { duration: 5000 });
    }, 500);
    setAutoListenEnabled(true);
    localStorage.setItem("auto-voice-listen", "true");
    setTimeout(() => startListening(), 1000);
  }, [saveAssistantName, startListening]);

  const toggleAutoListen = () => {
    const next = !autoListenEnabled;
    setAutoListenEnabled(next);
    localStorage.setItem("auto-voice-listen", String(next));
    if (next) {
      startListening();
      speak(`Mikrofon włączony.${assistantName ? ` Jestem ${assistantName}.` : ""} Słucham.`);
      toast.success("🎙️ Mikrofon AI włączony");
    } else {
      shutdownMic();
    }
  };

  const playSuggestion = async (track: any) => {
    playPlaylist([{ id: track.id, title: track.title, artist: track.artist, album: null, audio_url: null, cover_url: null, genre: track.genre, mood: track.mood, duration: 180 }], 0);
    speak(`Odtwarzam ${track.title}`);
    setShowSuggestions(false);
  };

  if (!user) return null;

  return (
    <>
      <AssistantNamingModal open={showNamingModal} onSubmit={handleNameSubmit} />

      {/* Iridescent mic button */}
      <motion.button
        onClick={toggleAutoListen}
        className={cn(
          "fixed bottom-24 right-4 z-40 w-11 h-11 rounded-full flex items-center justify-center transition-all",
          isListening ? "shadow-[0_0_20px_hsl(var(--primary)/0.5)]" : ""
        )}
        style={{
          background: isListening
            ? 'linear-gradient(135deg, hsl(var(--primary) / 0.7), hsl(var(--accent) / 0.5), hsl(var(--primary) / 0.6))'
            : 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(30px) saturate(200%)',
          WebkitBackdropFilter: 'blur(30px) saturate(200%)',
          border: isListening ? '1px solid hsl(var(--primary) / 0.4)' : '1px solid rgba(255,255,255,0.1)',
        }}
        whileHover={{ scale: 1.12 }}
        whileTap={{ scale: 0.88 }}
        title={autoListenEnabled ? "Wyłącz" : "Włącz asystenta głosowego"}
      >
        {isListening ? (
          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}>
            <Mic className="h-4 w-4 text-primary-foreground" />
          </motion.div>
        ) : (
          <MicOff className="h-4 w-4 text-muted-foreground/70" />
        )}
        {/* Shimmer ring when listening */}
        {isListening && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ border: '1px solid hsl(var(--primary) / 0.3)' }}
              animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
            />
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ border: '1px solid hsl(var(--accent) / 0.2)' }}
              animate={{ scale: [1, 2], opacity: [0.4, 0] }}
              transition={{ repeat: Infinity, duration: 2.5, ease: "easeOut", delay: 0.3 }}
            />
          </>
        )}
        {assistantName && (
          <span className="absolute -top-1 -right-1 text-[7px] rounded-full px-1 py-0.5 font-bold"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--primary) / 0.6), hsl(var(--accent) / 0.4))',
              color: 'hsl(var(--primary-foreground))',
              backdropFilter: 'blur(10px)',
            }}
          >
            {assistantName.slice(0, 3)}
          </span>
        )}
      </motion.button>

      {/* AI Suggestions Panel */}
      <AnimatePresence>
        {showSuggestions && aiSuggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-40 right-4 z-50 w-[280px] rounded-2xl p-3 space-y-2"
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
            className="fixed bottom-40 right-4 z-40 max-w-[240px] rounded-xl p-2.5"
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
