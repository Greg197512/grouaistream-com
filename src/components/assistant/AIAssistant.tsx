import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { Send, Loader2, ExternalLink, Music, Power, GripHorizontal, Sparkles, Maximize2, Minimize2, Radio } from "lucide-react";
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

interface PlaylistTrackInfo {
  id: string;
  title: string;
  artist: string;
  genre?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  trackLink?: { id: string; title: string; artist: string };
  playlistTracks?: PlaylistTrackInfo[];
  isDJMode?: boolean;
  radioUpdate?: { genre: string; trackCount: number };
  radioWish?: { wishText: string };
  radioTrackMod?: { action: "added" | "removed"; tracks: string[]; count: number };
}

const getTimeOfDay = () => {
  const h = new Date().getHours();
  if (h < 6) return "night";
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
};

export const AIAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userName, setUserName] = useState("Użytkownik");
  const [listeningStats, setListeningStats] = useState<{ topGenres: string[]; topMoods: string[]; recentTracks: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
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
      const greetings: Record<string, string> = {
        morning: `Dzień dobry **${userName}**! ☀️ Gotowy na poranną dawkę muzyki?`,
        afternoon: `Hej **${userName}**! 🌤️ Co chcesz dziś posłuchać?`,
        evening: `Dobry wieczór **${userName}**! 🌅 Czas na wieczorny chill?`,
        night: `Hej **${userName}**! 🌙 Nocna sesja muzyczna?`,
      };
      let greeting = greetings[time] || `Hej **${userName}**! 🎵 `;
      if (listeningStats?.topGenres?.length) {
        greeting += `\n\nWidzę, że lubisz **${listeningStats.topGenres.join(", ")}** — mam dla Ciebie propozycje!`;
      }
      greeting += "\n\nJestem Twoim asystentem AI — mogę rozmawiać o **muzyce, technologii, nauce, kulturze** i wszystkim innym. Zapytaj o cokolwiek! 🎶";
      setMessages([{ role: "assistant", content: greeting }]);
    }
  }, [isOpen, userName, listeningStats]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const userContext = useMemo(() => ({
    currentPage: location.pathname,
    topGenres: listeningStats?.topGenres || [],
    topMoods: listeningStats?.topMoods || [],
    recentTracks: listeningStats?.recentTracks || 0,
    currentMood: null,
    userName,
    userId: user?.id || null,
    currentTrack: currentTrack ? { title: currentTrack.title, artist: currentTrack.artist } : null,
    timeOfDay: getTimeOfDay(),
  }), [location.pathname, listeningStats, userName, user?.id, currentTrack]);

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

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
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
        body: JSON.stringify({ message: userMessage, history: messages, userContext }),
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
              setMessages(prev => {
                const msgData: Message = {
                  role: "assistant",
                  content: assistantContent,
                  trackLink: currentTrackLink,
                  playlistTracks: pending?.tracks,
                  isDJMode: pending?.isDJ,
                  radioUpdate: radioUpdate || undefined,
                  radioWish: radioWish || undefined,
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
      setIsLoading(false);
    }
  }, [input, isLoading, messages, userContext, startDJSession, parseDJCommand]);

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
            className={`fixed bottom-20 md:bottom-24 right-2 md:right-4 z-50 ${chatWidth} ${chatHeight} rounded-2xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden transition-all duration-300`}
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
                    <div className={`max-w-[88%] rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-white/5 text-foreground rounded-bl-sm border border-white/5"
                    }`}>
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm prose-invert max-w-none text-[13px] leading-relaxed [&_p]:mb-2 [&_ul]:mb-2 [&_ol]:mb-2 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:mt-3 [&_h3]:mb-1 [&_code]:bg-white/10 [&_code]:px-1 [&_code]:rounded [&_blockquote]:border-primary/30 [&_blockquote]:text-muted-foreground [&_a]:text-primary">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap text-[13px]">{msg.content}</p>
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

            {/* Input */}
            <div className="p-3 border-t border-white/5 bg-black/20">
              <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={`Zapytaj mnie o cokolwiek, ${userName}...`}
                  className="flex-1 bg-white/5 border-white/10 focus:border-primary/50 h-10 text-sm rounded-xl"
                  disabled={isLoading}
                />
                <Button type="submit" size="icon" disabled={!input.trim() || isLoading} className="shrink-0 h-10 w-10 rounded-xl">
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
