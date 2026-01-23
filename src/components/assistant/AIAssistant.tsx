import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2, ExternalLink, Music } from "lucide-react";
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
      {/* Floating Avatar Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-36 right-6 z-50 w-16 h-16 rounded-full overflow-hidden shadow-lg border-2 border-primary/50 hover:border-primary transition-all"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <img 
          src={aiAssistantAvatar} 
          alt="AI Assistant"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/30 to-transparent" />
        <motion.div
          className="absolute bottom-1 right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </motion.button>

      {/* Chat Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-36 right-6 z-50 w-[380px] h-[520px] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-border bg-card/95 backdrop-blur">
              <div className="w-10 h-10 rounded-full overflow-hidden border border-primary/30">
                <img 
                  src={aiAssistantAvatar} 
                  alt="AI Assistant"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm">GrooveAI Assistant</h3>
                <p className="text-xs text-muted-foreground">Twój przewodnik muzyczny</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-secondary text-secondary-foreground rounded-bl-sm"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      
                      {/* Track Play Link */}
                      {msg.trackLink && (
                        <motion.button
                          onClick={() => handlePlayTrack(msg.trackLink!.id)}
                          className="mt-2 flex items-center gap-2 w-full p-2 rounded-lg bg-primary/20 hover:bg-primary/30 transition-colors"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Music className="h-4 w-4 text-primary" />
                          <div className="text-left flex-1 min-w-0">
                            <p className="font-medium text-xs truncate">{msg.trackLink.title}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{msg.trackLink.artist}</p>
                          </div>
                          <ExternalLink className="h-3 w-3 text-primary" />
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
                    <div className="bg-secondary rounded-2xl rounded-bl-sm px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  </motion.div>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t border-border bg-card/95 backdrop-blur">
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
                  placeholder="Zapytaj o piosenkę, vinyl, współpracę..."
                  className="flex-1 bg-secondary/50 border-0"
                  disabled={isLoading}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim() || isLoading}
                  className="shrink-0"
                >
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
