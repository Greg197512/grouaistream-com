import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, Wifi, Music, Volume2, VolumeX, ArrowLeft, Heart, Sparkles, MessageCircle, Send, X, Trash2, Smile } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

interface RadioConfig {
  is_active: boolean;
  mode: string;
  start_time: string | null;
  end_time: string | null;
  started_at: string | null;
  station_name: string;
}

interface ScheduleTrack {
  position: number;
  item_type: string;
  custom_title: string | null;
  custom_duration: number;
  custom_audio_url: string | null;
  track: {
    id: string;
    title: string;
    artist: string;
    duration: number;
    audio_url: string | null;
    cover_url: string | null;
  } | null;
}

interface FloatingHeart {
  id: number;
  x: number;
  size: number;
  color: string;
  delay: number;
  drift: number;
  sparkle: boolean;
}

interface RadioMessage {
  id: string;
  user_id?: string;
  display_name: string;
  message: string;
  created_at: string;
}

const EMOJI_LIST = ["❤️", "🔥", "🎵", "🎶", "👏", "🙌", "💃", "🕺", "🎧", "🎤", "✨", "💫", "🌟", "😍", "🥰", "😎", "🤩", "🎉", "🎊", "👍", "💯", "🫶", "🎸", "🎹"];

const HEART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
  "hsl(var(--accent))",
  "#ff6b81",
  "#ff4757",
  "#ff6348",
  "#ffa502",
  "#ff4081",
  "#e84393",
  "#fd79a8",
  "#e17055",
  "#fab1a0",
];

const RadioLive = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [config, setConfig] = useState<RadioConfig | null>(null);
  const [schedule, setSchedule] = useState<ScheduleTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(80);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeart[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("Anonim");
  const [likesCount, setLikesCount] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<RadioMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const heartIdRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auth
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id || null;
      setUserId(uid);
      if (uid) {
        const [profileRes, roleRes] = await Promise.all([
          supabase.from("profiles").select("display_name").eq("user_id", uid).maybeSingle(),
          supabase.rpc("has_role", { _user_id: uid, _role: "admin" }),
        ]);
        if (profileRes.data?.display_name) setDisplayName(profileRes.data.display_name);
        if (roleRes.data) setIsAdmin(true);
      }
    });
  }, []);

  // Fetch config + schedule
  useEffect(() => {
    const fetchData = async () => {
      const [configRes, scheduleRes] = await Promise.all([
        supabase.from("radio_config").select("*").limit(1).single(),
        supabase
          .from("radio_schedule")
          .select("position, item_type, custom_title, custom_duration, custom_audio_url, track:tracks(id, title, artist, duration, audio_url, cover_url)")
          .order("position", { ascending: true }),
      ]);
      if (configRes.data) setConfig(configRes.data as any);
      if (scheduleRes.data) setSchedule(scheduleRes.data as any);
    };
    fetchData();
  }, []);

  // Fetch likes count for current track
  const fetchLikesCount = useCallback(async (trackId: string) => {
    const { count } = await supabase
      .from("radio_likes")
      .select("*", { count: "exact", head: true })
      .eq("track_id", trackId);
    setLikesCount(count || 0);
  }, []);

  useEffect(() => {
    const trackId = schedule[currentIndex]?.track?.id;
    if (trackId) fetchLikesCount(trackId);
  }, [currentIndex, schedule, fetchLikesCount]);

  // Realtime likes subscription
  useEffect(() => {
    const channel = supabase
      .channel("radio-likes-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "radio_likes" }, () => {
        const trackId = schedule[currentIndex]?.track?.id;
        if (trackId) fetchLikesCount(trackId);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentIndex, schedule, fetchLikesCount]);

  // Fetch messages
  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("radio_messages")
        .select("id, user_id, display_name, message, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) setMessages(data.reverse());
    };
    fetchMessages();

    const channel = supabase
      .channel("radio-messages-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "radio_messages" }, (payload) => {
        const newMsg = payload.new as RadioMessage;
        setMessages((prev) => [...prev.slice(-49), newMsg]);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "radio_messages" }, (payload) => {
        const deletedId = (payload.old as any).id;
        setMessages((prev) => prev.filter((m) => m.id !== deletedId));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatOpen]);

  // Check if current track is liked
  useEffect(() => {
    const checkLiked = async () => {
      if (!userId || !schedule[currentIndex]?.track?.id) {
        setIsLiked(false);
        return;
      }
      const { data } = await supabase
        .from("liked_songs")
        .select("id")
        .eq("user_id", userId)
        .eq("track_id", schedule[currentIndex].track!.id)
        .maybeSingle();
      setIsLiked(!!data);
    };
    checkLiked();
  }, [userId, currentIndex, schedule]);

  const getItemDuration = (item: ScheduleTrack) => {
    if (item.item_type === "track" || !item.item_type) return item.track?.duration || 180;
    return item.custom_duration || 30;
  };

  const getItemAudioUrl = (item: ScheduleTrack) => {
    if (item.item_type === "track" || !item.item_type) return item.track?.audio_url || null;
    return item.custom_audio_url || null;
  };

  const getItemTitle = (item: ScheduleTrack) => {
    if (item.item_type === "track" || !item.item_type) return item.track?.title || "Nieznany";
    return item.custom_title || item.item_type;
  };

  const getItemArtist = (item: ScheduleTrack) => {
    if (item.item_type === "track" || !item.item_type) return item.track?.artist || "";
    const labels: Record<string, string> = { jingle: "🎵 Jingiel", ad: "📢 Reklama", talk: "🎙️ Rozmowa" };
    return labels[item.item_type] || item.item_type;
  };

  const spawnHearts = () => {
    const newHearts: FloatingHeart[] = [];
    const count = 18 + Math.floor(Math.random() * 15);
    for (let i = 0; i < count; i++) {
      newHearts.push({
        id: heartIdRef.current++,
        x: 15 + Math.random() * 70,
        size: 12 + Math.random() * 28,
        color: HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)],
        delay: Math.random() * 0.6,
        drift: (Math.random() - 0.5) * 60,
        sparkle: Math.random() > 0.5,
      });
    }
    setFloatingHearts((prev) => [...prev, ...newHearts]);
    setTimeout(() => {
      setFloatingHearts((prev) => prev.filter((h) => !newHearts.find((nh) => nh.id === h.id)));
    }, 4500);
  };

  const handleLike = async () => {
    const currentTrack = schedule[currentIndex]?.track;
    spawnHearts();
    if (!currentTrack?.id) return;

    if (!userId) {
      toast({ title: t("radio.loginToLike"), description: t("radio.loginToLikeDesc"), variant: "destructive" });
      return;
    }

    try {
      if (isLiked) {
        await supabase.from("liked_songs").delete().eq("user_id", userId).eq("track_id", currentTrack.id);
        await supabase.from("radio_likes").delete().eq("user_id", userId).eq("track_id", currentTrack.id);
        setIsLiked(false);
        toast({ title: t("radio.unliked") });
      } else {
        const { data: existing } = await supabase
          .from("liked_songs").select("id").eq("user_id", userId).eq("track_id", currentTrack.id).maybeSingle();
        if (!existing) {
          await supabase.from("liked_songs").insert({ user_id: userId, track_id: currentTrack.id });
        }
        // Add to radio_likes for counter
        await supabase.from("radio_likes").upsert({ user_id: userId, track_id: currentTrack.id }, { onConflict: "track_id,user_id" });
        // AI memory
        await supabase.from("listening_history").insert({
          user_id: userId,
          track_id: currentTrack.id,
          duration_played: Math.floor((progress / 100) * getItemDuration(schedule[currentIndex])),
          mood_detected: "radio_like",
          skipped: false,
        });
        setIsLiked(true);
        toast({ title: t("radio.liked"), description: `${currentTrack.title} — ${t("radio.likedDesc")}` });
      }
    } catch (e) {
      console.error("Like error:", e);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !userId || sendingMessage) return;
    setSendingMessage(true);
    try {
      await supabase.from("radio_messages").insert({
        user_id: userId,
        display_name: displayName,
        message: newMessage.trim(),
      });
      setNewMessage("");
      setShowEmojis(false);
    } catch (e) {
      console.error("Message error:", e);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    try {
      await supabase.from("radio_messages").delete().eq("id", msgId);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
    } catch (e) {
      console.error("Delete message error:", e);
    }
  };

  useEffect(() => {
    if (!config?.is_active || !config.started_at || schedule.length === 0) return;
    const startedAt = new Date(config.started_at).getTime();
    const now = Date.now();
    let elapsed = (now - startedAt) / 1000;
    const totalDuration = schedule.reduce((s, t) => s + getItemDuration(t), 0);
    if (totalDuration <= 0) return;
    if (config.mode === "24h") elapsed = elapsed % totalDuration;
    let cumulative = 0;
    for (let i = 0; i < schedule.length; i++) {
      const dur = getItemDuration(schedule[i]);
      if (cumulative + dur > elapsed) {
        setCurrentIndex(i);
        startPlayback(i, elapsed - cumulative);
        return;
      }
      cumulative += dur;
    }
    setCurrentIndex(0);
  }, [config, schedule]);

  const startPlayback = useCallback(
    (index: number, offset = 0) => {
      const item = schedule[index];
      if (!item) return;
      const audioUrl = getItemAudioUrl(item);
      if (audioRef.current) audioRef.current.pause();
      if (!audioUrl) {
        setIsPlaying(true);
        const remaining = getItemDuration(item) - offset;
        const timer = setTimeout(() => {
          const nextIndex = (index + 1) % schedule.length;
          setCurrentIndex(nextIndex);
          startPlayback(nextIndex);
        }, remaining * 1000);
        return () => clearTimeout(timer);
      }
      const audio = new Audio(audioUrl);
      audio.crossOrigin = "anonymous";
      audio.preload = "auto";
      audio.volume = muted ? 0 : volume / 100;
      audioRef.current = audio;
      audio.addEventListener("loadeddata", () => {
        audio.currentTime = offset;
        audio.play().catch(() => {});
        setIsPlaying(true);
      });
      audio.addEventListener("timeupdate", () => {
        if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100);
      });
      audio.addEventListener("ended", () => {
        const nextIndex = (index + 1) % schedule.length;
        setCurrentIndex(nextIndex);
        startPlayback(nextIndex);
      });
      audio.load();
    },
    [schedule, volume, muted]
  );

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = muted ? 0 : volume / 100;
  }, [volume, muted]);

  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  const currentItem = schedule[currentIndex];
  const currentTitle = currentItem ? getItemTitle(currentItem) : "";
  const currentArtist = currentItem ? getItemArtist(currentItem) : "";
  const currentCover = currentItem?.track?.cover_url || null;
  const isOffAir = !config?.is_active || schedule.length === 0;
  const isTrack = currentItem?.item_type === "track" || !currentItem?.item_type;

  const isInSchedule = () => {
    if (!config || config.mode !== "scheduled" || !config.start_time || !config.end_time) return true;
    const now = new Date();
    const h = now.getHours().toString().padStart(2, "0");
    const m = now.getMinutes().toString().padStart(2, "0");
    const current = `${h}:${m}`;
    return current >= config.start_time && current <= config.end_time;
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  if (isOffAir || !isInSchedule()) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Button variant="ghost" size="sm" className="absolute top-4 left-4 gap-2" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" /> {t("radio.backHome")}
        </Button>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-4">
          <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto">
            <Radio className="h-10 w-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold">{config?.station_name || "GrouaRadio"}</h1>
          <p className="text-muted-foreground">{t("radio.stationOff")}</p>
          {config?.mode === "scheduled" && config.start_time && (
            <p className="text-sm text-muted-foreground">{t("radio.broadcasting")}: {config.start_time} – {config.end_time}</p>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Back button */}
      <Button variant="ghost" size="sm" className="absolute top-4 left-4 gap-2 z-20" onClick={() => navigate("/")}>
        <ArrowLeft className="h-4 w-4" /> {t("radio.backHome")}
      </Button>

      {/* Chat toggle button */}
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-4 right-4 gap-2 z-20"
        onClick={() => setChatOpen(!chatOpen)}
      >
        <MessageCircle className="h-4 w-4" />
        {t("radio.wishes")}
        {messages.length > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold">
            {messages.length}
          </span>
        )}
      </Button>

      {/* Floating Hearts */}
      <div className="fixed inset-0 pointer-events-none z-30">
        <AnimatePresence>
          {floatingHearts.map((heart) => (
            <motion.div
              key={heart.id}
              initial={{ opacity: 0, y: 0, scale: 0.2 }}
              animate={{
                opacity: [0, 1, 1, 0.9, 0.6, 0],
                y: [0, -80, -200, -400, -600, -900],
                x: [0, heart.drift * 0.3, heart.drift * 0.6, heart.drift, heart.drift * 1.2],
                scale: [0.2, 0.8, 1.3, 1.1, 0.8, 0.4],
                rotate: [0, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 50, (Math.random() - 0.5) * 70],
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 3.5 + Math.random() * 1.5, ease: "easeOut", delay: heart.delay }}
              className="absolute bottom-32"
              style={{ left: `${heart.x}%` }}
            >
              {heart.sparkle ? (
                <div className="relative">
                  <Heart className="fill-current drop-shadow-lg" style={{ width: heart.size, height: heart.size, color: heart.color, filter: `drop-shadow(0 0 6px ${heart.color})` }} />
                  <Sparkles className="absolute -top-1 -right-1 text-yellow-300" style={{ width: heart.size * 0.5, height: heart.size * 0.5 }} />
                </div>
              ) : (
                <Heart className="fill-current drop-shadow-lg" style={{ width: heart.size, height: heart.size, color: heart.color, filter: `drop-shadow(0 0 4px ${heart.color})` }} />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Wishes Chat Panel */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-sm z-40 flex flex-col bg-card/95 backdrop-blur-xl border-l border-border/50 shadow-2xl"
          >
            {/* Chat Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <h3 className="font-bold text-sm">{t("radio.wishesTitle")}</h3>
              <button onClick={() => setChatOpen(false)} className="p-1 rounded-full hover:bg-muted/50">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 groove-scrollbar">
              {messages.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">{t("radio.noWishes")}</p>
              )}
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl bg-muted/30 border border-border/30 p-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-primary">{msg.display_name}</span>
                    <span className="text-[10px] text-muted-foreground">{formatTime(msg.created_at)}</span>
                  </div>
                  <p className="text-sm">{msg.message}</p>
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border/50">
              {userId ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    placeholder={t("radio.wishPlaceholder")}
                    maxLength={200}
                    className="flex-1 rounded-full bg-muted/50 border border-border/50 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <Button
                    size="sm"
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sendingMessage}
                    className="rounded-full groove-gradient-bg h-9 w-9 p-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <p className="text-center text-sm text-muted-foreground">{t("radio.loginToChat")}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scrolling wishes ticker */}
      {messages.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-card/80 backdrop-blur-md border-t border-border/30 py-2 overflow-hidden">
          <motion.div
            className="flex gap-8 whitespace-nowrap"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: Math.max(20, messages.length * 5), repeat: Infinity, ease: "linear" }}
          >
            {[...messages.slice(-20), ...messages.slice(-20)].map((msg, i) => (
              <span key={`${msg.id}-${i}`} className="inline-flex items-center gap-2 text-sm">
                <span className="text-primary font-semibold">{msg.display_name}:</span>
                <span className="text-foreground/80">{msg.message}</span>
                <Sparkles className="h-3 w-3 text-yellow-400/60 shrink-0" />
              </span>
            ))}
          </motion.div>
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm space-y-6 pb-12">
        {/* Station Header */}
        <div className="text-center space-y-2">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="h-16 w-16 rounded-full groove-gradient-bg flex items-center justify-center mx-auto shadow-lg"
            style={{ boxShadow: "var(--groove-glow)" }}
          >
            <Radio className="h-8 w-8 text-primary-foreground" />
          </motion.div>
          <h1 className="text-xl font-bold">{config?.station_name}</h1>
          <div className="flex items-center justify-center gap-2">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/20 text-destructive text-xs font-semibold animate-pulse">
              <Wifi className="h-3 w-3" /> {t("radio.live")}
            </span>
            {/* Likes counter */}
            {likesCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-semibold"
              >
                <Heart className="h-3 w-3 fill-current" />
                {likesCount} {t("radio.likesCount")}
              </motion.span>
            )}
          </div>
        </div>

        {/* Now Playing */}
        {currentItem && (
          <div className="rounded-2xl overflow-hidden border border-border/50 bg-card">
            <div className="h-1 w-full groove-gradient-bg" />
            {currentCover && (
              <img src={currentCover} alt={currentTitle} className="w-full h-48 object-cover" />
            )}
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("radio.nowPlaying")}</p>
                  <h2 className="font-bold text-lg truncate">{currentTitle}</h2>
                  <p className="text-sm text-muted-foreground truncate">{currentArtist}</p>
                </div>
                {isTrack && currentItem.track?.id && (
                  <motion.button
                    whileTap={{ scale: 1.5 }}
                    onClick={handleLike}
                    className="flex-shrink-0 p-2 rounded-full hover:bg-muted/50 transition-colors relative"
                  >
                    <Heart
                      className={`h-7 w-7 transition-all duration-300 ${
                        isLiked
                          ? "fill-destructive text-destructive drop-shadow-[0_0_8px_hsl(var(--destructive))]"
                          : "text-muted-foreground hover:text-destructive"
                      }`}
                    />
                  </motion.button>
                )}
              </div>

              {/* Progress */}
              <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                <motion.div className="h-full groove-gradient-bg" style={{ width: `${progress}%` }} />
              </div>

              {/* Volume */}
              <div className="flex items-center gap-3">
                <button onClick={() => setMuted(!muted)} className="text-muted-foreground hover:text-foreground">
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
                <Slider
                  value={[muted ? 0 : volume]}
                  max={100}
                  step={1}
                  onValueChange={([v]) => { setVolume(v); setMuted(false); }}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        )}

        {/* Up Next */}
        {schedule.length > 1 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider px-1">{t("radio.upNext")}</p>
            <div className="space-y-1">
              {schedule
                .slice(currentIndex + 1, currentIndex + 4)
                .concat(schedule.slice(0, Math.max(0, 3 - (schedule.length - currentIndex - 1))))
                .slice(0, 3)
                .map((item, i) => (
                  <div key={(item.track?.id || item.custom_title || "") + "-" + i} className="flex items-center gap-3 rounded-lg px-3 py-2 bg-card/50 border border-border/30">
                    <Music className="h-3 w-3 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{getItemTitle(item)}</p>
                      <p className="text-xs text-muted-foreground truncate">{getItemArtist(item)}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">{t("radio.poweredBy")}</p>
      </motion.div>
    </div>
  );
};

export default RadioLive;
