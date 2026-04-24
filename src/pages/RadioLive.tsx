import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, Wifi, Music, Volume2, VolumeX, ArrowLeft, Heart, Sparkles, MessageCircle, Send, X, Trash2, Smile, Play } from "lucide-react";
import { RadioMoodDetector } from "@/components/radio/RadioMoodDetector";
import { VerifiedStreamsCard } from "@/components/radio/VerifiedStreamsCard";
import { FeatureGate } from "@/components/ui/FeatureGate";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayer } from "@/contexts/PlayerContext";

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
  lang: string | null;
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
  const { t, language } = useLanguage();
  const { pausePlayback } = usePlayer();
  const [config, setConfig] = useState<RadioConfig | null>(null);
  const [rawSchedule, setRawSchedule] = useState<ScheduleTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
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
  const playbackTokenRef = useRef(0);
  const fallbackTimerRef = useRef<number | null>(null);
  const heartIdRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Filter announcements by selected language. Tracks (lang === null) are always kept.
  // Announcement items with `lang` set are kept ONLY when matching the user's UI language.
  const schedule = useMemo(() => rawSchedule.filter((item) => {
    if (item.item_type === "announcement" && item.lang && item.lang !== language) return false;
    return true;
  }), [rawSchedule, language]);

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
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) setIsLoading(false);
    }, 10000);

    const fetchData = async () => {
      try {
        const configRes = await supabase.from("radio_config").select("*").limit(1).single();
        if (cancelled) return;
        if (configRes.data) setConfig(configRes.data as any);

        const scheduleRes = await supabase
          .from("radio_schedule")
          .select("position, item_type, custom_title, custom_duration, custom_audio_url, lang, track:tracks(id, title, artist, duration, audio_url, cover_url)")
          .order("position", { ascending: true })
          .limit(1000);
        if (cancelled) return;
        if (scheduleRes.data) setRawSchedule(scheduleRes.data as any);
      } catch (err) {
        console.error("[RadioLive] Fetch error:", err);
      } finally {
        clearTimeout(timeout);
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; clearTimeout(timeout); };
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
    const labels: Record<string, string> = {
      jingle: "🎵 Jingiel",
      ad: "📢 Reklama",
      talk: "🎙️ Rozmowa",
      announcement: "📰 Zapowiedź GrouAI",
    };
    return labels[item.item_type] || item.item_type;
  };

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const stopCurrentAudio = useCallback(() => {
    clearFallbackTimer();
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.removeAttribute("src");
    audioRef.current.load();
    audioRef.current = null;
  }, [clearFallbackTimer]);

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

  // Helper: find next announcement index after current position
  const findNextAnnouncementIndex = useCallback((fromIndex: number): number | null => {
    for (let i = fromIndex + 1; i < schedule.length; i++) {
      if (schedule[i]?.item_type === "announcement") return i;
    }
    // wrap-around
    for (let i = 0; i <= fromIndex && i < schedule.length; i++) {
      if (schedule[i]?.item_type === "announcement") return i;
    }
    return null;
  }, [schedule]);

  const startPlayback = useCallback(
    (index: number, offset = 0) => {
      const item = schedule[index];
      if (!item) return;
      const token = ++playbackTokenRef.current;
      const audioUrl = getItemAudioUrl(item);
      stopCurrentAudio();

      // 🎙️ Force-jump to nearest announcement after 3:20 (only for tracks, not announcements)
      const isAnnouncementItem = item.item_type === "announcement";
      if (!isAnnouncementItem) {
        window.setTimeout(() => {
          if (playbackTokenRef.current !== token) return;
          const annIndex = findNextAnnouncementIndex(index);
          if (annIndex === null) return;
          console.log("[RadioLive] ⏰ 3:20 reached — jumping to announcement at index", annIndex);
          setCurrentIndex(annIndex);
          startPlayback(annIndex);
        }, 200_000); // 3 min 20 sec
      }

      if (!audioUrl) {
        setIsPlaying(true);
        setProgress(Math.min(100, (offset / getItemDuration(item)) * 100));
        const remaining = Math.max(0.25, getItemDuration(item) - offset);
        fallbackTimerRef.current = window.setTimeout(() => {
          if (playbackTokenRef.current !== token) return;
          const nextIndex = (index + 1) % schedule.length;
          setCurrentIndex(nextIndex);
          startPlayback(nextIndex);
        }, remaining * 1000);
        return;
      }
      const audio = new Audio(audioUrl);
      audio.crossOrigin = "anonymous";
      audio.preload = "auto";
      audio.preservesPitch = false;
      audio.volume = muted ? 0 : volume / 100;
      audioRef.current = audio;
      audio.addEventListener("loadedmetadata", () => {
        if (playbackTokenRef.current !== token) return;
        if (Number.isFinite(offset) && offset > 0 && Number.isFinite(audio.duration)) {
          audio.currentTime = Math.min(offset, Math.max(0, audio.duration - 0.25));
        }
      }, { once: true });
      audio.addEventListener("canplay", () => {
        if (playbackTokenRef.current !== token) return;
        audio.play().then(() => {
          if (playbackTokenRef.current !== token) return;
          setIsPlaying(true);
          setAutoplayBlocked(false);
        }).catch(() => {
          if (playbackTokenRef.current !== token) return;
          setAutoplayBlocked(true);
          setIsPlaying(false);
        });
      }, { once: true });
      audio.addEventListener("timeupdate", () => {
        if (playbackTokenRef.current !== token) return;
        if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100);
      });
      audio.addEventListener("ended", () => {
        if (playbackTokenRef.current !== token) return;
        const nextIndex = (index + 1) % schedule.length;
        setCurrentIndex(nextIndex);
        startPlayback(nextIndex);
      });
      audio.load();
    },
    [schedule, volume, muted, stopCurrentAudio, findNextAnnouncementIndex]
  );

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = muted ? 0 : volume / 100;
  }, [volume, muted]);

  useEffect(() => {
    pausePlayback();
  }, [pausePlayback]);

  // 🕐 Scheduled announcements & music stories per language
  // Blog audio: 08:00/14:00 PL · 08:15/14:15 EN · 08:30/14:30 NL · 08:45/14:45 UA
  // Music story: 17:00/23:00 PL · 17:15/23:15 EN · 17:30/23:30 NL · 17:45/23:45 UA
  const scheduledFiredRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!schedule.length) return;

    const LANG_OFFSET: Record<string, number> = { pl: 0, en: 15, nl: 30, ua: 45 };
    const offset = LANG_OFFSET[language] ?? 0;
    // hour:minute pairs in Europe/Warsaw local time
    const slots = [
      { h: 8, m: offset, kind: "blog" },
      { h: 14, m: offset, kind: "blog" },
      { h: 17, m: offset, kind: "story" },
      { h: 23, m: offset, kind: "story" },
    ];

    const fadeAudio = (target: number, duration = 1500): Promise<void> => {
      return new Promise((resolve) => {
        const audio = audioRef.current;
        if (!audio) return resolve();
        const start = audio.volume;
        const startTime = performance.now();
        const step = (now: number) => {
          const t = Math.min(1, (now - startTime) / duration);
          if (audioRef.current) audioRef.current.volume = start + (target - start) * t;
          if (t < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });
    };

    const tick = async () => {
      const now = new Date();
      // Convert to Europe/Warsaw via Intl
      const fmt = new Intl.DateTimeFormat("pl-PL", {
        timeZone: "Europe/Warsaw",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(now);
      const [hStr, mStr] = fmt.split(":");
      const h = parseInt(hStr, 10);
      const m = parseInt(mStr, 10);
      const hit = slots.find((s) => s.h === h && s.m === m);
      if (!hit) return;

      const dayKey = now.toISOString().slice(0, 10);
      const fireKey = `${dayKey}-${hit.h}:${hit.m}-${language}`;
      if (scheduledFiredRef.current.has(fireKey)) return;
      scheduledFiredRef.current.add(fireKey);

      const annIndex = findNextAnnouncementIndex(currentIndex - 1);
      if (annIndex === null) {
        console.warn("[RadioLive] ⏰ scheduled slot but no announcement in queue", hit);
        return;
      }

      console.log(`[RadioLive] ⏰ ${hit.kind} slot ${hit.h}:${String(hit.m).padStart(2, "0")} [${language}] → fade out + play announcement`);

      // Fade out current music
      await fadeAudio(0, 1200);
      setCurrentIndex(annIndex);
      startPlayback(annIndex);
      // Restore volume after a brief delay so the announcement plays at full level
      setTimeout(() => {
        if (audioRef.current) audioRef.current.volume = muted ? 0 : volume / 100;
      }, 1500);
    };

    // Run immediately, then every 20s (catches the minute window reliably)
    tick();
    const id = window.setInterval(tick, 20_000);
    return () => window.clearInterval(id);
  }, [schedule, language, currentIndex, findNextAnnouncementIndex, startPlayback, volume, muted]);

  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  const currentItem = schedule[currentIndex];
  const currentTitle = currentItem ? getItemTitle(currentItem) : "";
  const currentArtist = currentItem ? getItemArtist(currentItem) : "";
  const currentCover = currentItem?.track?.cover_url || null;
  const isOffAir = !config?.is_active || schedule.length === 0;
  const isTrack = currentItem?.item_type === "track" || !currentItem?.item_type;
  const isAnnouncement = currentItem?.item_type === "announcement";
  const announcementLang = currentItem?.lang || null;
  const LANG_FLAG: Record<string, string> = { pl: "🇵🇱", en: "🇬🇧", nl: "🇳🇱", ua: "🇺🇦" };
  const LANG_LABEL: Record<string, string> = { pl: "Polski", en: "English", nl: "Nederlands", ua: "Українська" };

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-4">
          <div className="h-16 w-16 rounded-full groove-gradient-bg flex items-center justify-center mx-auto animate-pulse">
            <Radio className="h-8 w-8 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground text-sm">Ładowanie radia...</p>
        </motion.div>
      </div>
    );
  }

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
                  className="rounded-xl bg-muted/30 border border-border/30 p-3 group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-primary">{msg.display_name}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">{formatTime(msg.created_at)}</span>
                      {(msg.user_id === userId || isAdmin) && (
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                          title={t("radio.deleteWish")}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm">{msg.message}</p>
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border/50">
              {userId ? (
                <div className="space-y-2">
                  {/* Emoji picker */}
                  <AnimatePresence>
                    {showEmojis && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex flex-wrap gap-1 overflow-hidden"
                      >
                        {EMOJI_LIST.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => setNewMessage((prev) => prev + emoji)}
                            className="text-lg hover:scale-125 transition-transform p-0.5 rounded hover:bg-muted/50"
                          >
                            {emoji}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowEmojis(!showEmojis)}
                      className={`p-2 rounded-full transition-colors ${showEmojis ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
                    >
                      <Smile className="h-5 w-5" />
                    </button>
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
        <div className="fixed bottom-[88px] md:bottom-[72px] left-0 right-0 z-[60] bg-black/30 backdrop-blur-md border-t border-white/10 py-2.5 overflow-hidden">
          <motion.div
            className="flex gap-10 whitespace-nowrap px-4"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: Math.max(20, messages.length * 5), repeat: Infinity, ease: "linear" }}
          >
            {[...messages.slice(-20), ...messages.slice(-20)].map((msg, i) => (
              <span key={`${msg.id}-${i}`} className="inline-flex items-center gap-2 text-sm">
                <span className="text-primary font-bold" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>{msg.display_name}:</span>
                <span className="text-white/90 font-medium" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>{msg.message}</span>
                <Sparkles className="h-3 w-3 text-yellow-400 shrink-0" />
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
          <div className={`rounded-2xl overflow-hidden border bg-card transition-all ${isAnnouncement ? "border-primary/60 shadow-[0_0_30px_hsl(var(--primary)/0.4)]" : "border-border/50"}`}>
            <div className="h-1 w-full groove-gradient-bg" />
            {isAnnouncement ? (
              <div className="relative w-full h-48 groove-gradient-bg flex flex-col items-center justify-center overflow-hidden">
                <motion.div
                  animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <Radio className="h-24 w-24 text-primary-foreground/30" />
                </motion.div>
                {/* Animated EQ bars */}
                <div className="absolute bottom-4 left-0 right-0 flex items-end justify-center gap-1.5 h-10">
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 bg-primary-foreground rounded-full"
                      animate={{ height: ["20%", "100%", "30%", "80%", "20%"] }}
                      transition={{ duration: 0.8 + i * 0.1, repeat: Infinity, delay: i * 0.05 }}
                    />
                  ))}
                </div>
                <div className="relative z-10 text-center px-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-primary-foreground/80 mb-1">
                    🎙️ Audycja na żywo {announcementLang && `· ${LANG_FLAG[announcementLang] || ""} ${LANG_LABEL[announcementLang] || announcementLang.toUpperCase()}`}
                  </p>
                  <p className="text-sm font-semibold text-primary-foreground/90">George · GrouAI Stream</p>
                </div>
              </div>
            ) : currentCover ? (
              <img src={currentCover} alt={currentTitle} className="w-full h-48 object-cover" />
            ) : null}
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    {isAnnouncement ? "🎙️ Teraz w eterze (audycja)" : t("radio.nowPlaying")}
                  </p>
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
                <motion.div className={`h-full ${isAnnouncement ? "bg-primary" : "groove-gradient-bg"}`} style={{ width: `${progress}%` }} />
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
              {/* Manual play button when autoplay blocked */}
              {autoplayBlocked && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="pt-2"
                >
                  <Button
                    onClick={() => {
                      if (audioRef.current) {
                        audioRef.current.play().then(() => {
                          setIsPlaying(true);
                          setAutoplayBlocked(false);
                        }).catch(() => {});
                      }
                    }}
                    className="w-full gap-2 groove-gradient-bg text-primary-foreground font-bold text-lg h-12 animate-pulse"
                  >
                    <Play className="h-5 w-5" />
                    Odblokuj dźwięk
                  </Button>
                </motion.div>
              )}
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
                .map((item, i) => {
                  const itemIsAnnouncement = item.item_type === "announcement";
                  return (
                    <div
                      key={(item.track?.id || item.custom_title || "") + "-" + i}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 border ${itemIsAnnouncement ? "bg-primary/10 border-primary/30" : "bg-card/50 border-border/30"}`}
                    >
                      {itemIsAnnouncement ? (
                        <Radio className="h-3 w-3 text-primary shrink-0" />
                      ) : (
                        <Music className="h-3 w-3 text-muted-foreground shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm truncate ${itemIsAnnouncement ? "font-semibold text-primary" : ""}`}>
                          {itemIsAnnouncement && "🎙️ "}{getItemTitle(item)}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{getItemArtist(item)}</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Mood Detection Module — Pro feature */}
        <FeatureGate requiredPlan="pro" featureName="Radio Mood Detection">
          <RadioMoodDetector />
        </FeatureGate>

        {/* Verified Human Streams */}
        <VerifiedStreamsCard />

        <p className="text-center text-xs text-muted-foreground">{t("radio.poweredBy")}</p>
      </motion.div>

      {/* Sticky now-playing schedule bar (always visible) */}
      {currentItem && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`fixed bottom-0 left-0 right-0 z-[55] backdrop-blur-xl border-t px-4 py-2.5 ${
            isAnnouncement
              ? "bg-primary/20 border-primary/50 shadow-[0_-4px_20px_hsl(var(--primary)/0.3)]"
              : "bg-card/90 border-border/40"
          }`}
          style={messages.length > 0 ? { bottom: "52px" } : undefined}
        >
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            {isAnnouncement ? (
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0"
              >
                <Radio className="h-4 w-4 text-primary-foreground" />
              </motion.div>
            ) : (
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Music className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className={`text-[10px] uppercase tracking-wider font-bold ${isAnnouncement ? "text-primary" : "text-muted-foreground"}`}>
                {isAnnouncement
                  ? `🎙️ AUDYCJA NA ŻYWO ${announcementLang ? `· ${LANG_FLAG[announcementLang] || ""} ${LANG_LABEL[announcementLang] || announcementLang.toUpperCase()}` : ""}`
                  : "🎵 W ROZKŁADZIE DNIA · UTWÓR"}
              </p>
              <p className="text-sm font-semibold truncate">{currentTitle}</p>
              <p className="text-xs text-muted-foreground truncate">{currentArtist}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-muted-foreground uppercase">Pozycja</p>
              <p className="text-sm font-bold tabular-nums">{currentIndex + 1}/{schedule.length}</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default RadioLive;
