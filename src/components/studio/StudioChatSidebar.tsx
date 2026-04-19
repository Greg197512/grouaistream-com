import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Send,
  Loader2,
  Music2,
  Wand2,
  Brain,
  Zap,
  X,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type AIEngine = "our_ai" | "elevenlabs";
type Msg = { role: "user" | "assistant"; content: string };

interface QuickAction {
  id: string;
  label: string;
  icon: typeof Sparkles;
  prompt: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "make_like_my_10",
    label: "Brzmiej jak moje top 10",
    icon: Brain,
    prompt: "Wygeneruj utwór brzmiący jak moje ostatnie 10 ulubionych — weź mój ulubiony BPM, key i mood.",
  },
  {
    id: "suggest_mood",
    label: "Co teraz pasuje?",
    icon: Wand2,
    prompt: "Sprawdź mój bieżący mood i zaproponuj 3 utwory które wygenerujemy teraz.",
  },
  {
    id: "banger",
    label: "Zrób mi banger",
    icon: Zap,
    prompt: "Zrób mi banger — pełna struktura (intro, verse, chorus, bridge, drop, outro), 30s, najmocniejszy gatunek z mojej historii.",
  },
];

interface Props {
  isOpen: boolean;
  onToggle: () => void;
}

export const StudioChatSidebar = ({ isOpen, onToggle }: Props) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: "Cześć 🎧 Jestem GrouAI Studio. Powiedz co chcesz stworzyć — gatunek, mood, długość — albo użyj jednego z szybkich działań poniżej.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [aiEngine, setAiEngine] = useState<AIEngine>("our_ai");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll do dołu
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;
    if (!user) {
      toast.error("Zaloguj się żeby porozmawiać z AI");
      return;
    }

    const userMsg: Msg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("brak sesji");

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/studio-chat`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: [...messages, userMsg].slice(-12),
          ai_engine: aiEngine,
        }),
      });

      if (!resp.ok) {
        if (resp.status === 429) {
          toast.error("Za dużo zapytań — spróbuj za chwilę");
        } else if (resp.status === 402) {
          toast.error("Brak kredytów AI — doładuj plan");
        } else {
          toast.error("Błąd AI gateway");
        }
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      if (!resp.body) throw new Error("brak strumienia");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantSoFar = "";
      let started = false;
      let streamDone = false;

      const upsertAssistant = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages((prev) => {
          if (!started) {
            started = true;
            return [...prev, { role: "assistant", content: assistantSoFar }];
          }
          return prev.map((m, i) =>
            i === prev.length - 1 && m.role === "assistant"
              ? { ...m, content: assistantSoFar }
              : m
          );
        });
      };

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Zapisz finalną odpowiedź assistant do historii
      if (assistantSoFar && user) {
        await supabase.from("studio_chat_messages").insert({
          user_id: user.id,
          role: "assistant",
          content: assistantSoFar.substring(0, 4000),
          ai_model: aiEngine,
        });
      }
    } catch (e) {
      console.error("[StudioChat] error:", e);
      toast.error(e instanceof Error ? e.message : "Błąd połączenia");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsStreaming(false);
    }
  }, [messages, isStreaming, user, aiEngine]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <>
      {/* Toggle button — zawsze widoczny */}
      <motion.button
        onClick={onToggle}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 h-24 w-8 rounded-l-2xl bg-gradient-to-b from-primary/90 to-primary/60 flex items-center justify-center shadow-lg backdrop-blur-md"
        whileHover={{ scale: 1.05, x: -2 }}
        whileTap={{ scale: 0.95 }}
        aria-label={isOpen ? "Zamknij chat AI" : "Otwórz chat AI"}
      >
        {isOpen ? <ChevronRight className="h-5 w-5 text-primary-foreground" /> : <ChevronLeft className="h-5 w-5 text-primary-foreground" />}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.aside
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 z-30 flex h-full w-full max-w-md flex-col border-l border-primary/20 bg-background/95 backdrop-blur-xl shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/50 bg-gradient-to-r from-primary/10 via-purple-500/5 to-transparent px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold tracking-tight">GrouAI Studio Chat</h2>
                  <p className="text-[10px] text-muted-foreground">
                    {aiEngine === "our_ai" ? "Trenowany na Twoich danych" : "ElevenLabs Music v2"}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onToggle} className="h-7 w-7">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Engine switch */}
            <div className="flex items-center justify-between border-b border-border/30 px-4 py-2.5 bg-card/30">
              <div className="flex items-center gap-2">
                <Music2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">Silnik AI</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAiEngine("our_ai")}
                  className={`text-[11px] font-medium transition-colors ${
                    aiEngine === "our_ai" ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  Nasz AI
                </button>
                <Switch
                  checked={aiEngine === "elevenlabs"}
                  onCheckedChange={(checked) => setAiEngine(checked ? "elevenlabs" : "our_ai")}
                  aria-label="Przełącznik silnika AI"
                />
                <button
                  onClick={() => setAiEngine("elevenlabs")}
                  className={`text-[11px] font-medium transition-colors ${
                    aiEngine === "elevenlabs" ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  ElevenLabs
                </button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-4 py-3" ref={scrollRef as any}>
              <div className="space-y-3">
                {messages.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/60 text-foreground"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm prose-invert max-w-none text-sm [&_p]:my-1 [&_p]:leading-relaxed">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      )}
                    </div>
                  </motion.div>
                ))}
                {isStreaming && (
                  <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>{aiEngine === "our_ai" ? "Nasz AI" : "ElevenLabs"} myśli…</span>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Quick actions */}
            <div className="border-t border-border/30 px-3 py-2 bg-card/30">
              <div className="flex flex-wrap gap-1.5">
                {QUICK_ACTIONS.map((action) => (
                  <Badge
                    key={action.id}
                    variant="secondary"
                    onClick={() => !isStreaming && send(action.prompt)}
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-[10px] gap-1 py-1"
                  >
                    <action.icon className="h-2.5 w-2.5" />
                    {action.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="border-t border-border/50 p-3 bg-background/95">
              <div className="flex items-end gap-2 rounded-2xl border border-border bg-card/50 px-3 py-2 focus-within:border-primary/60 transition-colors">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Opisz utwór: gatunek, mood, BPM, lyrics..."
                  rows={1}
                  disabled={isStreaming}
                  className="min-h-[24px] max-h-[120px] resize-none border-0 bg-transparent p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim() || isStreaming}
                  className="h-8 w-8 shrink-0 rounded-full"
                >
                  {isStreaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="mt-1.5 text-center text-[9px] text-muted-foreground">
                Shift + Enter = nowa linia · Enter = wyślij
              </p>
            </form>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
};
