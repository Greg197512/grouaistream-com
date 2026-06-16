import { useState, useRef, useEffect } from "react";
import { X, Send, Sparkles, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  id: string;
  role: "user" | "muse";
  content: string;
}

const SUGGESTIONS = [
  "Zaproponuj plan contentu",
  "Które agenty uruchomić dziś?",
  "Analizuj moje imperium",
];

interface Props {
  onClose: () => void;
}

export function MuseChat({ onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      role: "muse",
      content: "Cześć! Jestem Aurorą — AI doradcą Twojego imperium. Czym mogę pomóc? ✨",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = messages.slice(-8).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const { data, error } = await supabase.functions.invoke("empire-aurora-chat", {
        body: { message: text, history },
      });

      const reply: string =
        !error && data?.ok && data?.reply
          ? data.reply
          : "Przepraszam, mam chwilowy problem z połączeniem. Spróbuj ponownie za chwilę! 🔄";

      setMessages((m) => [
        ...m,
        { id: (Date.now() + 1).toString(), role: "muse", content: reply },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: (Date.now() + 1).toString(),
          role: "muse",
          content: "Błąd połączenia. Sprawdź internet i spróbuj ponownie! 🔄",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#070a12]/95 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-purple-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Aurora AI</p>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              <p className="text-[11px] text-teal-400">Online</p>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-white/30 hover:text-white/70 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "flex",
                m.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                  m.role === "user"
                    ? "bg-gradient-to-br from-teal-600 to-purple-600 text-white"
                    : "bg-white/8 text-white/85 border border-white/10"
                )}
              >
                {m.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-white/8 border border-white/10 rounded-2xl px-4 py-3">
              <Loader2 className="w-4 h-4 text-teal-400 animate-spin" />
            </div>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      <div className="px-4 pb-2 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-3 py-1.5 text-white/55 hover:text-white/90 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="px-4 pb-4">
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 focus-within:border-teal-500/40 transition-colors"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Zapytaj Aurorę…"
            className="flex-1 bg-transparent text-sm text-white/80 placeholder:text-white/30 outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="text-teal-400 hover:text-teal-300 disabled:opacity-30 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
