import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { Send, Loader2, ExternalLink, Music, Power, GripHorizontal, Sparkles, Maximize2, Minimize2, Radio, Waves, Copy, Check, Paperclip, Image, X, FileAudio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/contexts/PlayerContext";
import { useDJMode } from "@/hooks/useDJMode";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import aiAssistantAvatar from "@/assets/ai-assistant-avatar.jpg";
import { generateMusic, type GeneratedTrack } from "@/utils/musicGenerator";
import { mixAudioFiles, type MixStyle } from "@/utils/audioMixer";
import { WaveformPlayer } from "@/components/studio/WaveformPlayer";
import { toast } from "sonner";

interface ChatAttachment {
  type: "image" | "audio";
  url: string; // object URL or uploaded URL
  name: string;
  file?: File;
}

interface PlaylistTrackInfo {
  id: string;
  title: string;
  artist: string;
  genre?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
  trackLink?: { id: string; title: string; artist: string };
  playlistTracks?: PlaylistTrackInfo[];
  isDJMode?: boolean;
  radioUpdate?: { genre: string; trackCount: number };
  radioWish?: { wishText: string };
  radioTrackMod?: { action: "added" | "removed"; tracks: string[]; count: number };
  radioDedication?: { trackName: string; recipientName: string; senderName: string };
  generatedTrack?: { audioUrl: string; title: string; genre: string; duration: number };
}

const getTimeOfDay = () => {
  const h = new Date().getHours();
  if (h < 6) return "night";
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
};

const CopyButton = ({ text, isUser }: { text: string; isUser: boolean }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <motion.button
      onClick={handleCopy}
      whileHover={{ scale: 1.15 }}
      whileTap={{ scale: 0.9 }}
      className={`absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-md flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity ${
        isUser ? "bg-primary-foreground/20 hover:bg-primary-foreground/40" : "bg-white/10 hover:bg-white/20"
      }`}
      title="Kopiuj"
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-400" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </motion.button>
  );
};

export const AIAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userName, setUserName] = useState("Użytkownik");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [listeningStats, setListeningStats] = useState<{ topGenres: string[]; topMoods: string[]; recentTracks: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { playTrack, playPlaylist, currentTrack } = usePlayer();
  const { startDJSession, isDJActive, parseDJCommand } = useDJMode();
  const { user } = useAuth();
  const location = useLocation();
  const dragControls = useDragControls();
  const hasGreeted = useRef(false);

  // Listen for toggle from InfinityWidget
  useEffect(() => {
    const handler = () => setIsOpen(prev => !prev);
    window.addEventListener("toggle-chat-assistant", handler);
    return () => window.removeEventListener("toggle-chat-assistant", handler);
  }, []);

  // Broadcast open state
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("chat-open-state", { detail: isOpen }));
  }, [isOpen]);

  // Fetch user profile and stats
  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [profileRes, historyRes] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
        supabase.from("listening_history").select("tracks(genre, mood)").eq("user_id", user.id).order("played_at", { ascending: false }).limit(50),
      ]);
      if (profileRes.data?.display_name) setUserName(profileRes.data.display_name);
      if (historyRes.data) {
        const genres: Record<string, number> = {};
        const moods: Record<string, number> = {};
        historyRes.data.forEach((h: any) => {
          const t = h.tracks as { genre: string | null; mood: string | null } | null;
          if (t?.genre) genres[t.genre] = (genres[t.genre] || 0) + 1;
          if (t?.mood) moods[t.mood] = (moods[t.mood] || 0) + 1;
        });
        setListeningStats({
          topGenres: Object.entries(genres).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g]) => g),
          topMoods: Object.entries(moods).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m]) => m),
          recentTracks: historyRes.data.length,
        });
      }
    };
    fetchData();
  }, [user]);

  // Set initial greeting when opened
  useEffect(() => {
    if (isOpen && !hasGreeted.current) {
      hasGreeted.current = true;
      const time = getTimeOfDay();
      const lang = localStorage.getItem("grooveai-language") || "en";
      
      const greetingsByLang: Record<string, Record<string, string>> = {
        pl: {
          morning: `Dzień dobry **${userName}**! ☀️ Gotowy na poranną dawkę muzyki?`,
          afternoon: `Hej **${userName}**! 🌤️ Co chcesz dziś posłuchać?`,
          evening: `Dobry wieczór **${userName}**! 🌅 Czas na wieczorny chill?`,
          night: `Hej **${userName}**! 🌙 Nocna sesja muzyczna?`,
        },
        en: {
          morning: `Good morning **${userName}**! ☀️ Ready for your morning music?`,
          afternoon: `Hey **${userName}**! 🌤️ What do you want to listen to?`,
          evening: `Good evening **${userName}**! 🌅 Time for an evening chill?`,
          night: `Hey **${userName}**! 🌙 Late night music session?`,
        },
        nl: {
          morning: `Goedemorgen **${userName}**! ☀️ Klaar voor je ochtendmuziek?`,
          afternoon: `Hey **${userName}**! 🌤️ Waar heb je zin in?`,
          evening: `Goedenavond **${userName}**! 🌅 Tijd voor avondmuziek?`,
          night: `Hey **${userName}**! 🌙 Nachtelijke muziek sessie?`,
        },
        ua: {
          morning: `Доброго ранку **${userName}**! ☀️ Готовий до ранкової музики?`,
          afternoon: `Привіт **${userName}**! 🌤️ Що хочеш послухати?`,
          evening: `Добрий вечір **${userName}**! 🌅 Час на вечірній чіл?`,
          night: `Привіт **${userName}**! 🌙 Нічна музична сесія?`,
        },
      };
      
      const greetings = greetingsByLang[lang] || greetingsByLang.en;
      let greeting = greetings[time] || `Hey **${userName}**! 🎵 `;
      
      const statsText: Record<string, string> = {
        pl: `\n\nWidzę, że lubisz **${listeningStats?.topGenres?.join(", ")}** — mam dla Ciebie propozycje!`,
        en: `\n\nI see you like **${listeningStats?.topGenres?.join(", ")}** — I have suggestions for you!`,
        nl: `\n\nIk zie dat je van **${listeningStats?.topGenres?.join(", ")}** houdt — ik heb suggesties!`,
        ua: `\n\nБачу, що тобі подобається **${listeningStats?.topGenres?.join(", ")}** — маю пропозиції!`,
      };
      
      if (listeningStats?.topGenres?.length) {
        greeting += statsText[lang] || statsText.en;
      }
      
      const introText: Record<string, string> = {
        pl: "\n\nJestem Twoim asystentem AI — mogę rozmawiać o **muzyce, technologii, nauce, kulturze** i wszystkim innym. Zapytaj o cokolwiek! 🎶",
        en: "\n\nI'm your AI assistant — I can talk about **music, technology, science, culture** and anything else. Ask me anything! 🎶",
        nl: "\n\nIk ben je AI-assistent — ik kan praten over **muziek, technologie, wetenschap, cultuur** en alles. Vraag me alles! 🎶",
        ua: "\n\nЯ твій AI асистент — можу говорити про **музику, технології, науку, культуру** та все інше. Запитуй! 🎶",
      };
      greeting += introText[lang] || introText.en;
      setMessages([{ role: "assistant", content: greeting }]);
    }
  }, [isOpen, userName, listeningStats]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const userContext = useMemo(() => {
    const appLang = localStorage.getItem("grooveai-language") || "en";
    const langMap: Record<string, string> = { pl: "polski", en: "English", nl: "Nederlands", ua: "Українська" };
    return {
      currentPage: location.pathname,
      topGenres: listeningStats?.topGenres || [],
      topMoods: listeningStats?.topMoods || [],
      recentTracks: listeningStats?.recentTracks || 0,
      currentMood: null,
      userName,
      userId: user?.id || null,
      currentTrack: currentTrack ? { title: currentTrack.title, artist: currentTrack.artist } : null,
      timeOfDay: getTimeOfDay(),
      language: appLang,
      languageName: langMap[appLang] || "English",
    };
  }, [location.pathname, listeningStats, userName, user?.id, currentTrack]);

  const handlePlayTrack = async (trackId: string) => {
    try {
      const { data: track } = await supabase.from("tracks").select("*").eq("id", trackId).single();
      if (track) {
        playTrack({
          id: track.id, title: track.title, artist: track.artist,
          album: track.album || undefined, duration: track.duration,
          cover_url: track.cover_url || undefined, audio_url: track.audio_url || undefined,
          video_url: track.video_url || undefined, genre: track.genre || undefined,
          mood: track.mood || undefined,
        });
      }
    } catch (error) {
      console.error("Error playing track:", error);
    }
  };

  const handleAutoPlayTracks = async (trackIds: string[], isDJ = false): Promise<PlaylistTrackInfo[]> => {
    try {
      const { data: tracks } = await supabase
        .from("tracks")
        .select("*")
        .in("id", trackIds)
        .not("audio_url", "is", null);
      
      if (tracks && tracks.length > 0) {
        const orderedTracks = trackIds
          .map(id => tracks.find(t => t.id === id))
          .filter(Boolean)
          .map(t => ({
            id: t!.id, title: t!.title, artist: t!.artist,
            album: t!.album || undefined, duration: t!.duration,
            cover_url: t!.cover_url || undefined, audio_url: t!.audio_url || undefined,
            video_url: t!.video_url || undefined, genre: t!.genre || undefined,
            mood: t!.mood || undefined,
          }));
        
        if (orderedTracks.length > 0) {
          playPlaylist(orderedTracks);
        }

        return orderedTracks.map(t => ({
          id: t.id, title: t.title, artist: t.artist, genre: t.genre as string | undefined,
        }));
      }
    } catch (error) {
      console.error("Error auto-playing tracks:", error);
    }
    return [];
  };

  // Ref to store playlist tracks to attach to the next assistant message
  const pendingPlaylistRef = useRef<{ tracks: PlaylistTrackInfo[]; isDJ: boolean } | null>(null);
  const pendingRadioUpdateRef = useRef<{ genre: string; trackCount: number } | null>(null);
  const pendingRadioWishRef = useRef<{ wishText: string } | null>(null);
  const pendingRadioTrackModRef = useRef<{ action: "added" | "removed"; tracks: string[]; count: number } | null>(null);
  const pendingDedicationRef = useRef<{ trackName: string; recipientName: string; senderName: string } | null>(null);
  const pendingGeneratedTrackRef = useRef<{ audioUrl: string; title: string; genre: string; duration: number } | null>(null);

  // File handling
  const handleFiles = useCallback((files: FileList | File[]) => {
    const fileArr = Array.from(files);
    const newAttachments: ChatAttachment[] = [];
    for (const file of fileArr) {
      if (file.type.startsWith("image/")) {
        newAttachments.push({ type: "image", url: URL.createObjectURL(file), name: file.name, file });
      } else if (file.type.startsWith("audio/") || file.name.match(/\.(mp3|wav|ogg|flac|m4a|aac|wma)$/i)) {
        newAttachments.push({ type: "audio", url: URL.createObjectURL(file), name: file.name, file });
      } else {
        toast.error(`Nieobsługiwany format: ${file.name}`);
      }
    }
    if (newAttachments.length) {
      setAttachments(prev => [...prev, ...newAttachments]);
      toast.success(`📎 Dodano ${newAttachments.length} plik(ów)`);
    }
  }, []);

  const removeAttachment = useCallback((idx: number) => {
    setAttachments(prev => {
      const removed = prev[idx];
      if (removed?.url?.startsWith("blob:")) URL.revokeObjectURL(removed.url);
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  // Drag & drop handler for the chat window
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  // Paste handler for images
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file" && (item.type.startsWith("image/") || item.type.startsWith("audio/"))) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length) {
      e.preventDefault();
      handleFiles(files);
    }
  }, [handleFiles]);

  // Upload attachment to storage, returns public URL
  const uploadAttachment = async (att: ChatAttachment): Promise<string> => {
    if (!att.file) return att.url;
    const ext = att.name.split(".").pop() || "bin";
    const path = `chat/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("music").upload(path, att.file);
    if (error) throw error;
    const { data } = supabase.storage.from("music").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSend = useCallback(async () => {
    if ((!input.trim() && attachments.length === 0) || isLoading) return;
    const userMessage = input.trim();
    const currentAttachments = [...attachments];
    setInput("");
    setAttachments([]);

    // Upload attachments (with graceful fallback to blob URLs)
    const uploadedAttachments: ChatAttachment[] = [];
    for (const att of currentAttachments) {
      try {
        const publicUrl = await uploadAttachment(att);
        uploadedAttachments.push({ type: att.type, url: publicUrl, name: att.name });
      } catch (err: any) {
        console.warn("Upload failed, using local URL:", err?.message);
        // Keep the blob URL as fallback — works for local mixing/playback
        uploadedAttachments.push({ type: att.type, url: att.url, name: att.name });
      }
    }

    setMessages(prev => [...prev, { role: "user", content: userMessage || (uploadedAttachments.length > 0 ? `📎 ${uploadedAttachments.map(a => a.name).join(", ")}` : ""), attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined }]);
    setIsLoading(true);

    let assistantContent = "";
    let currentTrackLink: Message["trackLink"] = undefined;

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ 
          message: userMessage, 
          history: messages, 
          userContext,
          attachments: uploadedAttachments.length > 0 ? uploadedAttachments.map(a => ({ type: a.type, url: a.url, name: a.name })) : undefined,
        }),
      });

      if (!resp.ok) {
        throw new Error(`Error ${resp.status}`);
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(jsonStr);
            
            // Handle radio update event
            if (parsed.type === "radio_updated") {
              pendingPlaylistRef.current = null;
              // Store radio update info to attach to the next assistant message
              pendingRadioUpdateRef.current = { genre: parsed.data.genre, trackCount: parsed.data.trackCount };
              continue;
            }

            // Handle radio wish event
            if (parsed.type === "radio_wish_sent") {
              pendingRadioWishRef.current = { wishText: parsed.data.wishText };
              continue;
            }

            // Handle radio track add/remove event
            if (parsed.type === "radio_tracks_modified") {
              pendingRadioTrackModRef.current = parsed.data;
              continue;
            }

            // Handle radio dedication event
            if (parsed.type === "radio_dedication") {
              pendingDedicationRef.current = {
                trackName: parsed.data.trackName,
                recipientName: parsed.data.recipientName,
                senderName: parsed.data.senderName,
              };
              continue;
            }

            // Handle music generation event - generate locally with AI-parsed params
            if (parsed.type === "music_generate") {
              const genData = parsed.data;
              try {
                const track = await generateMusic({
                  style: genData.style,
                  style2: genData.style2 || undefined,
                  blendRatio: genData.blendRatio || undefined,
                  durationSeconds: 30,
                  instrumental: genData.instrumental,
                  title: genData.title || undefined,
                  prompt: genData.prompt || undefined,
                  mood: genData.mood || undefined,
                  energy: genData.energy || undefined,
                  tempoOverride: genData.tempoOverride || undefined,
                });
                pendingGeneratedTrackRef.current = {
                  audioUrl: track.audioUrl,
                  title: track.title,
                  genre: track.style,
                  duration: 30,
                };
                toast.success(`🎶 Wygenerowano "${track.title}"!`);
              } catch (err: any) {
                console.error("Generation error in chat:", err);
                toast.error("❌ Błąd generowania: " + (err?.message || "Nieznany błąd"));
                // Add error message to chat
                setMessages(prev => [...prev, {
                  role: "assistant",
                  content: `❌ **Błąd generowania muzyki**: ${err?.message || "Nieznany błąd"}\n\nSpróbuj ponownie z prostszym opisem, np. *"stwórz utwór elektroniczny"*.`
                }]);
              }
              continue;
            }

            // Handle audio mix event
            if (parsed.type === "audio_mix") {
              const mixData = parsed.data;
              try {
                toast.info("🎧 Miksuję pliki audio...");
                const mixResult = await mixAudioFiles(
                  mixData.urls[0],
                  mixData.urls[1],
                  { style: mixData.style as MixStyle }
                );
                pendingGeneratedTrackRef.current = {
                  audioUrl: mixResult.audioUrl,
                  title: mixResult.title,
                  genre: `Mix (${mixData.style})`,
                  duration: mixResult.duration,
                };
                toast.success(`🎧 Mix gotowy! ${mixResult.duration}s`);
              } catch (err) {
                console.error("Mix error in chat:", err);
                toast.error("Błąd miksowania plików");
              }
              continue;
            }

            // Handle auto-play multiple tracks (normal + DJ mode)
            if (parsed.type === "auto_play_tracks" || parsed.type === "dj_mode_tracks") {
              const trackIds = parsed.data.map((t: any) => t.id);
              const isDJ = parsed.type === "dj_mode_tracks";
              const playedTracks = await handleAutoPlayTracks(trackIds, isDJ);
              if (playedTracks.length > 0) {
                pendingPlaylistRef.current = { tracks: playedTracks, isDJ };
                if (isDJ) {
                  const djCmd = parseDJCommand(userMessage);
                  startDJSession({
                    genres: djCmd.genres,
                    partyType: djCmd.partyType || "party",
                    trackCount: playedTracks.length,
                    customPrompt: userMessage,
                  });
                }
              }
              continue;
            }

            // Handle custom track_link event
            if (parsed.type === "track_link") {
              currentTrackLink = parsed.data;
              continue;
            }

            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              const pending = pendingPlaylistRef.current;
              const radioUpdate = pendingRadioUpdateRef.current;
              const radioWish = pendingRadioWishRef.current;
              const radioTrackMod = pendingRadioTrackModRef.current;
              const dedication = pendingDedicationRef.current;
              const genTrack = pendingGeneratedTrackRef.current;
              setMessages(prev => {
                const msgData: Message = {
                  role: "assistant",
                  content: assistantContent,
                  trackLink: currentTrackLink,
                  playlistTracks: pending?.tracks,
                  isDJMode: pending?.isDJ,
                  radioUpdate: radioUpdate || undefined,
                  radioWish: radioWish || undefined,
                  radioTrackMod: radioTrackMod || undefined,
                  radioDedication: dedication || undefined,
                  generatedTrack: genTrack || undefined,
                };
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && prev.length > 1 && prev[prev.length - 2]?.role === "user") {
                  return prev.map((m, i) => i === prev.length - 1 ? msgData : m);
                }
                return [...prev, msgData];
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Final flush
      if (buffer.trim()) {
        for (let raw of buffer.split("\n")) {
          if (!raw || !raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m));
            }
          } catch { /* ignore */ }
        }
      }

    } catch (error) {
      console.error("AI Assistant error:", error);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Przepraszam, wystąpił błąd. Spróbuj ponownie za chwilę. 😔"
      }]);
    } finally {
      pendingPlaylistRef.current = null;
      pendingRadioUpdateRef.current = null;
      pendingRadioWishRef.current = null;
      pendingRadioTrackModRef.current = null;
      pendingDedicationRef.current = null;
      pendingGeneratedTrackRef.current = null;
      setIsLoading(false);
    }
  }, [input, isLoading, messages, userContext, startDJSession, parseDJCommand, attachments]);

  const chatWidth = isExpanded ? "w-[calc(100vw-2rem)] sm:w-[600px]" : "w-[calc(100vw-2rem)] sm:w-[400px]";
  const chatHeight = isExpanded ? "h-[calc(100vh-8rem)] sm:h-[700px]" : "h-[calc(100vh-8rem)] sm:h-[520px]";

  return (
    <>
      {/* Chat Modal - triggered by InfinityWidget */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            drag dragControls={dragControls} dragMomentum={false} dragElastic={0}
            dragConstraints={{ left: -(window.innerWidth - 60), right: 0, top: -(window.innerHeight - 100), bottom: 0 }}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`fixed bottom-20 md:bottom-24 right-2 md:right-4 z-50 ${chatWidth} ${chatHeight} rounded-2xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden transition-all duration-300 ${isDragOver ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
            style={{
              background: 'rgba(10, 10, 15, 0.85)',
              backdropFilter: 'blur(40px) saturate(200%)',
              WebkitBackdropFilter: 'blur(40px) saturate(200%)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            {/* Drag Handle */}
            <motion.div
              onPointerDown={(e) => dragControls.start(e)}
              className="absolute top-0 left-0 right-0 h-6 flex items-center justify-center cursor-grab active:cursor-grabbing z-10"
            >
              <GripHorizontal className="h-4 w-4 text-muted-foreground/30" />
            </motion.div>

            {/* Header */}
            <div className="flex items-center gap-3 p-3 pt-6 border-b border-white/5 bg-gradient-to-r from-primary/5 to-accent/5">
              <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-primary/30 shadow-lg shadow-primary/20">
                <img src={aiAssistantAvatar} alt="AI" className="w-full h-full object-cover" />
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm flex items-center gap-1.5">
                  GrooveAI <Sparkles className="h-3.5 w-3.5 text-primary" />
                </h3>
                <p className="text-[10px] text-muted-foreground truncate">
                  {currentTrack ? `🎵 ${currentTrack.title}` : "Zaawansowany asystent AI • Online"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  {isExpanded ? <Minimize2 className="h-3.5 w-3.5 text-muted-foreground" /> : <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 180 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsOpen(false)}
                  className="w-7 h-7 rounded-full bg-destructive/20 hover:bg-destructive/40 flex items-center justify-center transition-colors"
                >
                  <Power className="h-3.5 w-3.5 text-destructive" />
                </motion.button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-6 h-6 rounded-full overflow-hidden mr-2 mt-1 shrink-0 border border-primary/20">
                        <img src={aiAssistantAvatar} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className={`relative max-w-[88%] rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-white/5 text-foreground rounded-bl-sm border border-white/5"
                    }`}>
                      {/* Copy button */}
                      <CopyButton text={msg.content} isUser={msg.role === "user"} />
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm prose-invert max-w-none text-[13px] leading-relaxed [&_p]:mb-2 [&_ul]:mb-2 [&_ol]:mb-2 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:mt-3 [&_h3]:mb-1 [&_code]:bg-white/10 [&_code]:px-1 [&_code]:rounded [&_blockquote]:border-primary/30 [&_blockquote]:text-muted-foreground [&_a]:text-primary">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <>
                          {msg.content && <p className="whitespace-pre-wrap text-[13px]">{msg.content}</p>}
                          {/* Inline attachments */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-2 space-y-2">
                              {msg.attachments.map((att, ai) => (
                                <div key={ai}>
                                  {att.type === "image" && (
                                    <img src={att.url} alt={att.name} className="max-w-full max-h-40 rounded-lg object-cover" />
                                  )}
                                  {att.type === "audio" && (
                                    <div className="flex items-center gap-2 p-2 rounded-lg bg-primary-foreground/10">
                                      <FileAudio className="h-4 w-4 shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[10px] truncate">{att.name}</p>
                                        <audio src={att.url} controls className="w-full h-7 mt-1" style={{ filter: "invert(1)" }} />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                      {msg.trackLink && (
                        <motion.button
                          onClick={() => handlePlayTrack(msg.trackLink!.id)}
                          className="mt-2 flex items-center gap-2 w-full p-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 transition-colors border border-primary/20"
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                        >
                          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                            <Music className="h-4 w-4 text-primary" />
                          </div>
                          <div className="text-left flex-1 min-w-0">
                            <p className="font-medium text-xs truncate">{msg.trackLink.title}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{msg.trackLink.artist}</p>
                          </div>
                          <ExternalLink className="h-3 w-3 text-primary shrink-0" />
                        </motion.button>
                      )}
                      {/* Visual playlist track list */}
                      {msg.playlistTracks && msg.playlistTracks.length > 0 && (
                        <div className="mt-3 space-y-1">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Music className="h-3 w-3 text-primary" />
                            <span className="text-[10px] font-semibold text-primary">
                              {msg.isDJMode ? "🎧 DJ Set" : "🎵 Playlista"} • {msg.playlistTracks.length} utworów
                            </span>
                          </div>
                          <div className="max-h-[200px] overflow-y-auto space-y-1 pr-1">
                            {msg.playlistTracks.map((track, idx) => (
                              <motion.button
                                key={track.id}
                                onClick={() => handlePlayTrack(track.id)}
                                className="flex items-center gap-2 w-full p-1.5 rounded-lg bg-primary/5 hover:bg-primary/15 transition-colors text-left group"
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.03 }}
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.98 }}
                              >
                                <div className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center shrink-0 group-hover:bg-primary/40 transition-colors">
                                  <span className="text-[9px] font-bold text-primary group-hover:hidden">{idx + 1}</span>
                                  <Music className="h-3 w-3 text-primary hidden group-hover:block" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-medium truncate text-foreground/90">{track.title}</p>
                                  <p className="text-[9px] text-muted-foreground truncate">{track.artist}{track.genre ? ` • ${track.genre}` : ""}</p>
                                </div>
                              </motion.button>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Radio update badge */}
                      {msg.radioUpdate && (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-3 flex items-center gap-2 p-2.5 rounded-xl bg-accent/10 border border-accent/20"
                        >
                          <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                            <Radio className="h-4 w-4 text-accent-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium">📻 Radio: {msg.radioUpdate.genre}</p>
                            <p className="text-[10px] text-muted-foreground">{msg.radioUpdate.trackCount} utworów załadowanych</p>
                          </div>
                        </motion.div>
                      )}
                      {/* Radio wish badge */}
                      {msg.radioWish && (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-3 flex items-center gap-2 p-2.5 rounded-xl bg-primary/10 border border-primary/20"
                        >
                          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                            <span className="text-sm">📨</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium">Życzenie wysłane do radia</p>
                            <p className="text-[10px] text-muted-foreground truncate">"{msg.radioWish.wishText}"</p>
                          </div>
                        </motion.div>
                      )}
                      {/* Radio track add/remove badge */}
                      {msg.radioTrackMod && (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-3 p-2.5 rounded-xl bg-accent/10 border border-accent/20"
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <Radio className="h-4 w-4 text-accent-foreground" />
                            <p className="text-xs font-medium">
                              {msg.radioTrackMod.action === "added" ? "➕ Dodano do ramówki" : "➖ Usunięto z ramówki"} ({msg.radioTrackMod.count})
                            </p>
                          </div>
                          <div className="space-y-0.5">
                            {msg.radioTrackMod.tracks.slice(0, 5).map((t, i) => (
                              <p key={i} className="text-[10px] text-muted-foreground truncate">• {t}</p>
                            ))}
                            {msg.radioTrackMod.tracks.length > 5 && (
                              <p className="text-[10px] text-muted-foreground">...i {msg.radioTrackMod.tracks.length - 5} więcej</p>
                            )}
                          </div>
                        </motion.div>
                      )}
                      {/* Dedication badge */}
                      {msg.radioDedication && (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-3 p-3 rounded-xl bg-gradient-to-r from-pink-500/10 to-red-500/10 border border-pink-500/20"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">💝</span>
                            <p className="text-xs font-bold text-foreground">Dedykacja muzyczna</p>
                          </div>
                          <p className="text-[11px] text-foreground/80">
                            🎵 <strong>{msg.radioDedication.trackName}</strong>
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Dla <strong>{msg.radioDedication.recipientName}</strong> od <strong>{msg.radioDedication.senderName}</strong>
                          </p>
                        </motion.div>
                      )}
                      {/* Generated track inline player */}
                      {msg.generatedTrack && (
                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ type: "spring", stiffness: 200, damping: 20 }}
                          className="mt-3 p-3 rounded-xl border border-[#FF6B00]/30 bg-[#1a1a2e]/80 space-y-2"
                          style={{ boxShadow: "0 0 20px #FF6B0015" }}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                              style={{ background: "linear-gradient(135deg, #FF6B00, #FF9500)" }}
                            >
                              <Waves className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-white truncate">{msg.generatedTrack.title}</p>
                              <p className="text-[10px] text-[#FF9500]/70">GrouAI Studio • {msg.generatedTrack.genre} • {msg.generatedTrack.duration}s</p>
                            </div>
                          </div>
                          <WaveformPlayer
                            audioUrl={msg.generatedTrack.audioUrl}
                            title={msg.generatedTrack.title}
                            genre={msg.generatedTrack.genre}
                            compact
                          />
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                ))}
                {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                    <div className="w-6 h-6 rounded-full overflow-hidden mr-2 mt-1 shrink-0 border border-primary/20">
                      <img src={aiAssistantAvatar} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="bg-white/5 rounded-2xl rounded-bl-sm px-4 py-3 border border-white/5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </ScrollArea>

            {/* Attachment previews */}
            {attachments.length > 0 && (
              <div className="px-3 pt-2 flex gap-2 flex-wrap">
                {attachments.map((att, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative group"
                  >
                    {att.type === "image" ? (
                      <img src={att.url} alt={att.name} className="w-14 h-14 rounded-lg object-cover border border-white/10" />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-white/5 border border-white/10 flex flex-col items-center justify-center">
                        <FileAudio className="h-5 w-5 text-primary" />
                        <span className="text-[7px] text-muted-foreground mt-0.5 max-w-[48px] truncate">{att.name}</span>
                      </div>
                    )}
                    <button
                      onClick={() => removeAttachment(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity"
                    >
                      <X className="h-2.5 w-2.5 text-destructive-foreground" />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-white/5 bg-black/20">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,audio/*"
                multiple
                className="hidden"
                onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }}
              />
              <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-1.5 items-center">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  className="shrink-0 h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground"
                  disabled={isLoading}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onPaste={handlePaste}
                  placeholder={`Zapytaj mnie o cokolwiek, ${userName}...`}
                  className="flex-1 bg-white/5 border-white/10 focus:border-primary/50 h-10 text-sm rounded-xl"
                  disabled={isLoading}
                />
                <Button type="submit" size="icon" disabled={(!input.trim() && attachments.length === 0) || isLoading} className="shrink-0 h-10 w-10 rounded-xl">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
