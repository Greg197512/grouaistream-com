import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Loader2, Sparkles, Music, Play, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { supabase } from "@/integrations/supabase/client";
import { uploadToR2 } from "@/lib/r2Upload";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  audioUrl?: string;
  title?: string;
}

const SUGGESTIONS = [
  "Lo-fi do nauki, spokojny piano",
  "Energetyczny rock z gitarą elektryczną",
  "Smutna ballada akustyczna",
  "Klubowy house z mocnym basem",
];

export const FloatingMusicChat = () => {
  const { user } = useAuth();
  const { playTrack } = usePlayer();
  const [enabled, setEnabled] = useState(true);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Cześć! 🎶 Opisz utwór jakim chcesz – np. „melancholijny lo-fi z deszczem” – a stworzę go dla Ciebie przez ElevenLabs.",
    },
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Persist enabled state
  useEffect(() => {
    const stored = localStorage.getItem("groua-floating-chat-enabled");
    if (stored !== null) setEnabled(stored === "true");
  }, []);

  useEffect(() => {
    localStorage.setItem("groua-floating-chat-enabled", String(enabled));
  }, [enabled]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const generateFromText = async (rawText: string) => {
    if (!user) {
      toast.error("Zaloguj się, aby generować utwory");
      return;
    }
    if (busy) return;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: rawText };
    setMessages((m) => [...m, userMsg]);
    setBusy(true);

    try {
      // Detect duration in text (e.g., "30 sekund", "1 minute")
      const durationMatch = rawText.match(/(\d+)\s*(sek|s\b|min)/i);
      let duration = 30;
      if (durationMatch) {
        const n = parseInt(durationMatch[1], 10);
        duration = /min/i.test(durationMatch[2]) ? Math.min(120, n * 60) : Math.min(120, Math.max(10, n));
      }

      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `🎼 Generuję utwór (${duration}s)... daj mi chwilę.`,
        },
      ]);

      // Build a clean musical prompt from user's natural-language input
      const musicPrompt = `${rawText}, professional studio quality, rich layered production`;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-music`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ prompt: musicPrompt, duration, vocals: false }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 402) {
          throw new Error(err.message || "Brak kredytów ElevenLabs Music.");
        }
        if (response.status === 400 && err.error === "bad_prompt") {
          throw new Error(err.message || "Prompt odrzucony przez ElevenLabs. Spróbuj prostszego opisu.");
        }
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.success || !data.music) throw new Error("Brak danych audio");

      // Decode base64 → blob
      const binary = atob(data.music);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const blobUrl = URL.createObjectURL(blob);

      // Upload to R2
      let publicUrl = blobUrl;
      const title = rawText.slice(0, 40).trim() || "Chat Track";
      try {
        const safe = title.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 40);
        const file = new File([blob], `${safe}_${Date.now()}.mp3`, { type: "audio/mpeg" });
        const up = await uploadToR2({ file, folder: `chat/${user.id}` });
        publicUrl = up.publicUrl;
      } catch (e) {
        console.warn("[FloatingMusicChat] R2 upload failed, using blob:", e);
      }

      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `✅ Gotowe! „${title}” — naciśnij ▶ aby posłuchać lub 💾 aby zapisać do biblioteki.`,
          audioUrl: publicUrl,
          title,
        },
      ]);
    } catch (err: any) {
      console.error("[FloatingMusicChat] error:", err);
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `❌ ${err.message || "Coś poszło nie tak. Spróbuj ponownie."}`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const handlePlay = (msg: ChatMessage) => {
    if (!msg.audioUrl) return;
    playTrack({
      id: msg.id,
      title: msg.title || "Chat Track",
      artist: "GrouAI Chat",
      album: "AI Generated",
      duration: 30,
      audio_url: msg.audioUrl,
      cover_url: null,
      genre: "AI",
      mood: null,
    } as any);
  };

  const handleSave = async (msg: ChatMessage) => {
    if (!msg.audioUrl || !user) return;
    try {
      const { error } = await supabase.from("tracks").insert({
        title: msg.title || "Chat Track",
        artist: "GrouAI Chat",
        album: "AI Generated",
        duration: 30,
        audio_url: msg.audioUrl,
        genre: "AI",
        mood: "generated",
        user_id: user.id,
      });
      if (error) throw error;
      toast.success(`💾 „${msg.title}” dodano do biblioteki!`);
    } catch (e: any) {
      toast.error("Błąd zapisu: " + e.message);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const t = input.trim();
    if (!t) return;
    setInput("");
    generateFromText(t);
  };

  // Disabled state — small toggle button only
  if (!enabled) {
    return (
      <button
        onClick={() => setEnabled(true)}
        title="Włącz GrouAI Chat"
        className="fixed bottom-28 right-4 z-40 w-10 h-10 rounded-full bg-secondary/80 border border-border backdrop-blur flex items-center justify-center text-muted-foreground hover:text-foreground transition"
      >
        <MessageCircle className="h-4 w-4" />
      </button>
    );
  }

  return (
    <>
      {/* Floating launcher button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-28 right-4 z-40 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-2xl"
            style={{
              background: "linear-gradient(135deg, #FF6B00, #FF9500)",
              boxShadow: "0 0 30px rgba(255, 107, 0, 0.5)",
            }}
            title="GrouAI Music Chat"
          >
            <Sparkles className="h-6 w-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-28 right-4 z-40 w-[calc(100vw-2rem)] sm:w-[380px] max-h-[70vh] rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden"
            style={{ boxShadow: "0 0 40px rgba(255, 107, 0, 0.25)" }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b border-border"
              style={{ background: "linear-gradient(135deg, rgba(255,107,0,0.15), rgba(255,149,0,0.05))" }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #FF6B00, #FF9500)" }}
                >
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold">GrouAI Music Chat</p>
                  <p className="text-[10px] text-muted-foreground">Opisz utwór – zrobię go</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEnabled(false)}
                  title="Wyłącz chat"
                  className="text-[10px] px-2 py-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition"
                >
                  Wyłącz
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px]">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-secondary text-foreground rounded-bl-sm"
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    {msg.audioUrl && (
                      <div className="mt-2 flex gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => handlePlay(msg)}
                        >
                          <Play className="h-3 w-3" /> Odtwórz
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => handleSave(msg)}
                        >
                          <Download className="h-3 w-3" /> Zapisz
                        </Button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  <div className="bg-secondary rounded-2xl rounded-bl-sm px-3 py-2 text-sm flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-muted-foreground text-xs">ElevenLabs pracuje...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Suggestions (only when fresh) */}
            {messages.length <= 1 && !busy && (
              <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => generateFromText(s)}
                    className="text-[10px] px-2 py-1 rounded-full border border-border bg-secondary/50 text-muted-foreground hover:text-foreground hover:border-primary transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-3 border-t border-border flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="np. mroczny trap z 808, 30 sekund"
                disabled={busy}
                className="flex-1 h-9 text-sm"
              />
              <Button
                type="submit"
                size="sm"
                disabled={busy || !input.trim()}
                className="h-9 w-9 p-0"
                style={{
                  background: "linear-gradient(135deg, #FF6B00, #FF9500)",
                  color: "white",
                }}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
