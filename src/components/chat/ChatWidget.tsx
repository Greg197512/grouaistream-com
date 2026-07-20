import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, Send, X, ArrowLeft, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type UserRow = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
};

type ChatMsg = {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  is_broadcast: boolean;
  content: string;
  created_at: string;
  read_at: string | null;
};

const MUSIC_EMOJIS = ["🎵", "🎶", "🎸", "🎹", "🥁", "🎤", "🎧", "🎷", "🎺", "🎻", "🪕", "🪗", "💿", "📀", "🔊", "❤️‍🔥", "✨", "🔥"];

const BROADCAST_ID = "__broadcast__";

export const ChatWidget = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Presence — everyone joins the same channel while widget is mounted
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel("grouai-presence", {
      config: { presence: { key: user.id } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnline(new Set(Object.keys(state)));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Load user list once open
  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .neq("user_id", user.id)
        .order("display_name", { ascending: true })
        .limit(500);
      setUsers((data as UserRow[]) ?? []);
    })();
  }, [open, user]);

  // Play notification bell sound
  const playBell = () => {
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const now = ctx.currentTime;
      [880, 1320, 1760].forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, now + i * 0.12);
        g.gain.exponentialRampToValueAtTime(0.25, now + i * 0.12 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.35);
        o.connect(g).connect(ctx.destination);
        o.start(now + i * 0.12);
        o.stop(now + i * 0.12 + 0.4);
      });
      setTimeout(() => ctx.close(), 1500);
    } catch {}
  };

  // Subscribe to new incoming messages globally for unread counter + toast
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("chat-inbox")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        async (payload) => {
          const m = payload.new as ChatMsg;
          if (m.sender_id === user.id) return;
          // only messages relevant to me
          if (!m.is_broadcast && m.recipient_id !== user.id) return;

          // If matching current open view, just append
          const belongsToOpenView =
            open &&
            activeId &&
            ((activeId === BROADCAST_ID && m.is_broadcast) ||
              (activeId !== BROADCAST_ID &&
                !m.is_broadcast &&
                (m.sender_id === activeId || m.recipient_id === activeId)));

          if (belongsToOpenView) {
            setMessages((prev) => [...prev, m]);
            return;
          }

          // Unread + bell + toast
          setUnread((u) => u + 1);
          playBell();

          // Lookup sender name
          let senderName = "Ktoś";
          const known = users.find((x) => x.user_id === m.sender_id);
          if (known?.display_name) {
            senderName = known.display_name;
          } else {
            const { data: p } = await supabase
              .from("profiles")
              .select("display_name")
              .eq("user_id", m.sender_id)
              .maybeSingle();
            if (p?.display_name) senderName = p.display_name;
          }

          toast(`🔔 Masz wiadomość od ${senderName}`, {
            description: m.content.slice(0, 80) + (m.content.length > 80 ? "…" : ""),
            duration: 8000,
            action: {
              label: "Odbierz",
              onClick: () => {
                setActiveId(m.is_broadcast ? BROADCAST_ID : m.sender_id);
                setOpen(true);
              },
            },
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, open, activeId, users]);

  // Load conversation on active change
  useEffect(() => {
    if (!user || !activeId) return;
    (async () => {
      let q = supabase.from("chat_messages").select("*").order("created_at", { ascending: true }).limit(200);
      if (activeId === BROADCAST_ID) {
        q = q.eq("is_broadcast", true);
      } else {
        q = q.eq("is_broadcast", false).or(
          `and(sender_id.eq.${user.id},recipient_id.eq.${activeId}),and(sender_id.eq.${activeId},recipient_id.eq.${user.id})`
        );
      }
      const { data } = await q;
      setMessages((data as ChatMsg[]) ?? []);
    })();
  }, [user, activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, activeId]);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const ao = online.has(a.user_id) ? 0 : 1;
      const bo = online.has(b.user_id) ? 0 : 1;
      if (ao !== bo) return ao - bo;
      return (a.display_name ?? "").localeCompare(b.display_name ?? "");
    });
  }, [users, online]);

  const activeUser = activeId && activeId !== BROADCAST_ID ? users.find((u) => u.user_id === activeId) : null;

  const send = async (broadcast = false) => {
    if (!user || !text.trim()) return;
    const target = broadcast ? BROADCAST_ID : activeId;
    if (!target) {
      toast.error("Wybierz osobę lub 'Wyślij do wszystkich'");
      return;
    }
    const payload = {
      sender_id: user.id,
      recipient_id: target === BROADCAST_ID ? null : target,
      is_broadcast: target === BROADCAST_ID,
      content: text.trim(),
    };
    setText("");
    const { data, error } = await supabase.from("chat_messages").insert(payload).select("*").single();
    if (error) {
      toast.error("Nie wysłano: " + error.message);
      return;
    }
    if (broadcast) setActiveId(BROADCAST_ID);
    if (data && (activeId === (broadcast ? BROADCAST_ID : target))) {
      setMessages((p) => [...p, data as ChatMsg]);
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Trigger: animowana gadająca buźka */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="Czat GrouAI"
        aria-label="Otwórz czat"
        className="group relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-accent/20 border border-primary/50 hover:border-accent transition-all hover:scale-110 shadow-[0_0_12px_hsl(38_100%_50%/0.5)] hover:shadow-[0_0_22px_hsl(38_100%_50%/0.9)]"
      >
        {/* Pulsujący pierścień */}
        <span className="absolute inset-0 rounded-full border border-accent/60 animate-ping opacity-40" />

        {/* Buźka SVG */}
        <svg viewBox="0 0 40 40" className="h-7 w-7 drop-shadow-[0_0_4px_hsl(38_100%_50%/0.8)]">
          {/* twarz */}
          <circle cx="20" cy="20" r="16" fill="hsl(38 100% 55%)" stroke="hsl(38 100% 30%)" strokeWidth="1.2" />
          {/* oczy — mrugają */}
          <g fill="#0a0a0a">
            <ellipse cx="14" cy="16" rx="1.6" ry="2.2">
              <animate attributeName="ry" values="2.2;0.15;2.2;2.2;2.2" keyTimes="0;0.05;0.1;0.9;1" dur="4s" repeatCount="indefinite" />
            </ellipse>
            <ellipse cx="26" cy="16" rx="1.6" ry="2.2">
              <animate attributeName="ry" values="2.2;0.15;2.2;2.2;2.2" keyTimes="0;0.05;0.1;0.9;1" dur="4s" repeatCount="indefinite" />
            </ellipse>
          </g>
          {/* usta — gadają */}
          <ellipse cx="20" cy="25" rx="4.5" ry="1.5" fill="#0a0a0a">
            <animate attributeName="ry" values="1;3;1.5;3.5;1;2.5;1" dur="1.1s" repeatCount="indefinite" />
            <animate attributeName="rx" values="4.5;3.5;5;3;4.5;4;4.5" dur="1.1s" repeatCount="indefinite" />
          </ellipse>
          {/* rumieńce */}
          <circle cx="11" cy="22" r="1.4" fill="hsl(0 80% 60% / 0.55)" />
          <circle cx="29" cy="22" r="1.4" fill="hsl(0 80% 60% / 0.55)" />
        </svg>

        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-accent text-[10px] font-bold text-black flex items-center justify-center animate-pulse">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              className="fixed z-[9999] bottom-20 right-2 sm:right-6 w-[min(380px,calc(100vw-1rem))] h-[min(560px,calc(100dvh-6rem))] rounded-2xl border border-primary/30 bg-black/95 backdrop-blur-xl shadow-[0_0_40px_hsl(38_100%_50%/0.25)] flex flex-col overflow-hidden"
            >
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-gradient-to-r from-primary/10 to-transparent">
              {activeId && (
                <button
                  onClick={() => setActiveId(null)}
                  className="p-1 hover:bg-white/10 rounded"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate">
                  {activeId === BROADCAST_ID
                    ? "📢 Do wszystkich"
                    : activeUser
                    ? activeUser.display_name || "Bez nazwy"
                    : "GrouAI Czat"}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {activeId === BROADCAST_ID
                    ? "Wiadomość publiczna"
                    : activeUser
                    ? online.has(activeUser.user_id)
                      ? "● online"
                      : "offline"
                    : `${online.size} online · ${users.length} użytkowników`}
                </div>
              </div>
              <button
                onClick={() => setActiveId(BROADCAST_ID)}
                title="Do wszystkich"
                className="p-1.5 rounded hover:bg-white/10 text-accent"
              >
                <Users className="h-4 w-4" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1 hover:bg-white/10 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            {!activeId ? (
              <div className="flex-1 overflow-y-auto">
                {sortedUsers.length === 0 && (
                  <div className="p-6 text-center text-sm text-muted-foreground">Ładowanie...</div>
                )}
                {sortedUsers.map((u) => {
                  const isOn = online.has(u.user_id);
                  return (
                    <button
                      key={u.user_id}
                      onClick={() => setActiveId(u.user_id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors border-b border-border/20 text-left"
                    >
                      <div className="relative">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/40 to-accent/40 flex items-center justify-center text-sm font-bold overflow-hidden">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            (u.display_name?.[0] ?? "?").toUpperCase()
                          )}
                        </div>
                        <span
                          className={cn(
                            "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-black",
                            isOn ? "bg-emerald-500 shadow-[0_0_8px_rgb(16_185_129/0.9)] animate-pulse" : "bg-muted-foreground/40"
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{u.display_name || "Bez nazwy"}</div>
                        <div className="text-[10px] text-muted-foreground">{isOn ? "dostępny" : "niedostępny"}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
                  {messages.length === 0 && (
                    <div className="text-center text-xs text-muted-foreground pt-8">
                      Brak wiadomości. Napisz coś fajnego 🎶
                    </div>
                  )}
                  {messages.map((m) => {
                    const mine = m.sender_id === user.id;
                    return (
                      <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[75%] rounded-2xl px-3 py-2 text-sm break-words",
                            mine
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-white/10 text-foreground rounded-bl-sm"
                          )}
                        >
                          {m.is_broadcast && !mine && (
                            <div className="text-[9px] uppercase tracking-wider text-accent mb-0.5">📢 broadcast</div>
                          )}
                          <div className="whitespace-pre-wrap">{m.content}</div>
                          <div className="text-[9px] opacity-60 mt-0.5 text-right">
                            {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Emoji panel */}
                <AnimatePresence>
                  {emojiOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-border/50 bg-black/60 overflow-hidden"
                    >
                      <div className="grid grid-cols-9 gap-1 p-2">
                        {MUSIC_EMOJIS.map((e) => (
                          <button
                            key={e}
                            onClick={() => {
                              setText((t) => t + e);
                              inputRef.current?.focus();
                            }}
                            className="text-2xl aspect-square rounded hover:bg-white/10 transition-transform hover:scale-125 hover:-translate-y-0.5"
                            style={{ textShadow: "0 2px 6px rgba(255,140,0,0.5), 0 0 12px rgba(255,140,0,0.3)" }}
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Composer */}
                <div className="border-t border-border/50 p-2 bg-black/40">
                  <div className="flex items-end gap-1">
                    <button
                      onClick={() => setEmojiOpen((v) => !v)}
                      className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-white/10 text-lg"
                      title="Emotki muzyczne"
                    >
                      🎵
                    </button>
                    <textarea
                      ref={inputRef}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send(false);
                        }
                      }}
                      rows={1}
                      placeholder="Napisz wiadomość..."
                      className="flex-1 resize-none bg-white/5 border border-border/50 rounded-2xl px-3 py-2 text-sm focus:outline-none focus:border-primary/60 max-h-24"
                    />
                    <button
                      onClick={() => send(false)}
                      disabled={!text.trim()}
                      className="h-9 w-9 flex items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40 hover:brightness-110"
                      title="Wyślij"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => send(true)}
                    disabled={!text.trim()}
                    className="mt-1.5 w-full text-[11px] py-1 rounded-full border border-accent/40 text-accent hover:bg-accent/10 disabled:opacity-40"
                  >
                    📢 Wyślij do wszystkich
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ChatWidget;
