import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2, ExternalLink, Music, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/contexts/PlayerContext";
import aiAssistantAvatar from "@/assets/ai-assistant-avatar.jpg";

interface Message {
  role: "user" | "assistant";
  content: string;
  trackLink?: { id: string; title: string; artist: string };
}

export const AIAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Cześć! Jestem Twoim przewodnikiem po GrooveAI Stream 🎵 Zapytaj mnie o dowolną piosenkę - opiszę ją, podam informacje i wrzucę link do odtworzenia! Mogę też pomóc Ci znaleźć vinyl w sekcji Hubs lub odpowiedzieć na pytania o współpracę."
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { playTrack } = usePlayer();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handlePlayTrack = async (trackId: string) => {
    try {
      const { data: track } = await supabase
        .from("tracks")
        .select("*")
        .eq("id", trackId)
        .single();
      
      if (track) {
        playTrack({
          id: track.id,
          title: track.title,
          artist: track.artist,
          album: track.album || undefined,
          duration: track.duration,
          cover_url: track.cover_url || undefined,
          audio_url: track.audio_url || undefined,
          video_url: track.video_url || undefined,
          genre: track.genre || undefined,
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
        body: { message: userMessage, history: messages }
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: "assistant",
        content: data.response,
        trackLink: data.trackLink
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("AI Assistant error:", error);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Przepraszam, wystąpił błąd. Spróbuj ponownie za chwilę."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Tiny Floating Bubble Button - doesn't interfere with anything */}
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
            <img 
              src={aiAssistantAvatar} 
              alt="AI Assistant"
              className="w-full h-full object-cover"
            />
            {/* Online indicator */}
            <motion.div
              className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background"
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
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-40 right-4 z-50 w-[360px] h-[480px] bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header with avatar and power off button */}
            <div className="flex items-center gap-3 p-3 border-b border-border/50 bg-gradient-to-r from-primary/10 to-accent/10">
              <div className="relative w-9 h-9 rounded-full overflow-hidden border border-primary/30">
                <img 
                  src={aiAssistantAvatar} 
                  alt="AI Assistant"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm">GrooveAI Assistant</h3>
                <p className="text-[10px] text-muted-foreground">by Groua • Online</p>
              </div>
              {/* Power off button */}
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
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-secondary/80 text-secondary-foreground rounded-bl-sm"
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-xs">{msg.content}</p>
                      
                      {/* Track Play Link */}
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
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div className="bg-secondary/80 rounded-2xl rounded-bl-sm px-3 py-2">
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    </div>
                  </motion.div>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-3 border-t border-border/50 bg-card/50">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex gap-2"
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Zapytaj..."
                  className="flex-1 bg-secondary/50 border-0 h-8 text-xs"
                  disabled={isLoading}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim() || isLoading}
                  className="shrink-0 h-8 w-8"
                >
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
