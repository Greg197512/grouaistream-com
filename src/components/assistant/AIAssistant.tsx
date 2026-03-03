import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { Send, Loader2, ExternalLink, Music, Power, GripHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "react-router-dom";
import aiAssistantAvatar from "@/assets/ai-assistant-avatar.jpg";

interface Message {
  role: "user" | "assistant";
  content: string;
  trackLink?: { id: string; title: string; artist: string };
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userName, setUserName] = useState("Użytkownik");
  const [listeningStats, setListeningStats] = useState<{ topGenres: string[]; topMoods: string[]; recentTracks: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { playTrack, currentTrack } = usePlayer();
  const { user } = useAuth();
  const location = useLocation();
  const dragControls = useDragControls();
  const hasGreeted = useRef(false);

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
        morning: `Dzień dobry ${userName}! ☀️ Gotowy na poranną dawkę muzyki? `,
        afternoon: `Hej ${userName}! 🌤️ Co chcesz dziś posłuchać? `,
        evening: `Dobry wieczór ${userName}! 🌅 Czas na wieczorny chill? `,
        night: `Hej ${userName}! 🌙 Nocna sesja muzyczna? `,
      };
      let greeting = greetings[time] || `Hej ${userName}! 🎵 `;
      if (listeningStats?.topGenres?.length) {
        greeting += `Widzę, że lubisz ${listeningStats.topGenres.join(", ")} - mam dla Ciebie propozycje! `;
      }
      greeting += "Jestem Twoim muzycznym przewodnikiem - zapytaj o cokolwiek! 🎶";
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
    currentTrack: currentTrack ? { title: currentTrack.title, artist: currentTrack.artist } : null,
    timeOfDay: getTimeOfDay(),
  }), [location.pathname, listeningStats, userName, currentTrack]);

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

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: { message: userMessage, history: messages, userContext }
      });
      if (error) throw error;
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.response,
        trackLink: data.trackLink
      }]);
    } catch (error) {
      console.error("AI Assistant error:", error);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Przepraszam, wystąpił błąd. Spróbuj ponownie za chwilę. 😔"
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Bubble */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            onClick={() => setIsOpen(true)}
            className="fixed bottom-40 right-4 z-40 w-10 h-10 rounded-full overflow-hidden shadow-lg border border-primary/30 hover:border-primary transition-all bg-background/80 backdrop-blur-sm"
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <img src={aiAssistantAvatar} alt="AI Assistant" className="w-full h-full object-cover" />
            <motion.div
              className="absolute bottom-0 right-0 w-3 h-3 bg-primary rounded-full border-2 border-background"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            drag dragControls={dragControls} dragMomentum={false} dragElastic={0}
            dragConstraints={{ left: -window.innerWidth + 380, right: 0, top: -window.innerHeight + 520, bottom: 0 }}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-40 right-4 z-50 w-[360px] h-[480px] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              backdropFilter: 'blur(40px) saturate(200%)',
              WebkitBackdropFilter: 'blur(40px) saturate(200%)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            {/* Drag Handle */}
            <motion.div
              onPointerDown={(e) => dragControls.start(e)}
              className="absolute top-0 left-0 right-0 h-6 flex items-center justify-center cursor-grab active:cursor-grabbing z-10"
            >
              <GripHorizontal className="h-4 w-4 text-muted-foreground/50" />
            </motion.div>

            {/* Header */}
            <div className="flex items-center gap-3 p-3 pt-6 border-b border-border/30 bg-gradient-to-r from-primary/10 to-accent/10">
              <div className="relative w-9 h-9 rounded-full overflow-hidden border border-primary/30">
                <img src={aiAssistantAvatar} alt="AI" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm flex items-center gap-1">
                  GrooveAI <Sparkles className="h-3 w-3 text-primary" />
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  {currentTrack ? `🎵 ${currentTrack.title}` : "Twój muzyczny przyjaciel • Online"}
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.1, rotate: 180 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-destructive/20 hover:bg-destructive/40 flex items-center justify-center transition-colors"
              >
                <Power className="h-4 w-4 text-destructive" />
              </motion.button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-3" ref={scrollRef}>
              <div className="space-y-3">
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-secondary/80 text-secondary-foreground rounded-bl-sm"
                    }`}>
                      <p className="whitespace-pre-wrap text-xs">{msg.content}</p>
                      {msg.trackLink && (
                        <motion.button
                          onClick={() => handlePlayTrack(msg.trackLink!.id)}
                          className="mt-2 flex items-center gap-2 w-full p-2 rounded-lg bg-primary/20 hover:bg-primary/30 transition-colors"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Music className="h-3 w-3 text-primary" />
                          <div className="text-left flex-1 min-w-0">
                            <p className="font-medium text-[10px] truncate">{msg.trackLink.title}</p>
                            <p className="text-[9px] text-muted-foreground truncate">{msg.trackLink.artist}</p>
                          </div>
                          <ExternalLink className="h-2.5 w-2.5 text-primary" />
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                ))}
                {isLoading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                    <div className="bg-secondary/80 rounded-2xl rounded-bl-sm px-3 py-2">
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    </div>
                  </motion.div>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-3 border-t border-border/50 bg-card/50">
              <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={`Zapytaj mnie, ${userName}...`}
                  className="flex-1 bg-secondary/50 border-0 h-8 text-xs"
                  disabled={isLoading}
                />
                <Button type="submit" size="icon" disabled={!input.trim() || isLoading} className="shrink-0 h-8 w-8">
                  <Send className="h-3 w-3" />
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
