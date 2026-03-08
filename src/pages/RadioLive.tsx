import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, Wifi, Music, Volume2, VolumeX, ArrowLeft, Heart } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

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
}

const HEART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
  "hsl(var(--accent))",
  "#ff6b81",
  "#ff4757",
  "#ff6348",
  "#ffa502",
  "#ff4081",
];

const RadioLive = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const heartIdRef = useRef(0);

  // Check auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

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

  // Spawn floating hearts
  const spawnHearts = () => {
    const newHearts: FloatingHeart[] = [];
    const count = 8 + Math.floor(Math.random() * 8); // 8-15 hearts
    for (let i = 0; i < count; i++) {
      newHearts.push({
        id: heartIdRef.current++,
        x: 30 + Math.random() * 40, // 30-70% horizontal spread
        size: 14 + Math.random() * 20, // 14-34px
        color: HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)],
      });
    }
    setFloatingHearts((prev) => [...prev, ...newHearts]);
    // Clean up after animation
    setTimeout(() => {
      setFloatingHearts((prev) => prev.filter((h) => !newHearts.find((nh) => nh.id === h.id)));
    }, 2500);
  };

  const handleLike = async () => {
    const currentTrack = schedule[currentIndex]?.track;
    
    // Always spawn hearts for everyone
    spawnHearts();

    if (!currentTrack?.id) return;

    if (!userId) {
      toast({ title: "Zaloguj się", description: "Aby polubić utwór, musisz się zalogować.", variant: "destructive" });
      return;
    }

    try {
      if (isLiked) {
        // Unlike
        await supabase.from("liked_songs").delete().eq("user_id", userId).eq("track_id", currentTrack.id);
        setIsLiked(false);
        toast({ title: "💔 Usunięto z polubionych" });
      } else {
        // Like - save to liked_songs
        const { data: existing } = await supabase
          .from("liked_songs")
          .select("id")
          .eq("user_id", userId)
          .eq("track_id", currentTrack.id)
          .maybeSingle();

        if (!existing) {
          await supabase.from("liked_songs").insert({ user_id: userId, track_id: currentTrack.id });
        }

        // Save to listening history for AI memory
        await supabase.from("listening_history").insert({
          user_id: userId,
          track_id: currentTrack.id,
          duration_played: Math.floor((progress / 100) * getItemDuration(schedule[currentIndex])),
          mood_detected: "radio_like",
          skipped: false,
        });

        setIsLiked(true);
        toast({ title: "❤️ Polubiono!", description: `${currentTrack.title} dodano do pamięci AI` });
      }
    } catch (e) {
      console.error("Like error:", e);
    }
  };

  useEffect(() => {
    if (!config?.is_active || !config.started_at || schedule.length === 0) return;

    const startedAt = new Date(config.started_at).getTime();
    const now = Date.now();
    let elapsed = (now - startedAt) / 1000;

    const totalDuration = schedule.reduce((s, t) => s + getItemDuration(t), 0);
    if (totalDuration <= 0) return;

    if (config.mode === "24h") {
      elapsed = elapsed % totalDuration;
    }

    let cumulative = 0;
    for (let i = 0; i < schedule.length; i++) {
      const dur = getItemDuration(schedule[i]);
      if (cumulative + dur > elapsed) {
        setCurrentIndex(i);
        const offset = elapsed - cumulative;
        startPlayback(i, offset);
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

      if (audioRef.current) {
        audioRef.current.pause();
      }

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
        if (audio.duration) {
          setProgress((audio.currentTime / audio.duration) * 100);
        }
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
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume / 100;
    }
  }, [volume, muted]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
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

  if (isOffAir || !isInSchedule()) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Button variant="ghost" size="sm" className="absolute top-4 left-4 gap-2" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" /> Strona główna
        </Button>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-4">
          <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto">
            <Radio className="h-10 w-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold">{config?.station_name || "GrouaRadio"}</h1>
          <p className="text-muted-foreground">Stacja jest obecnie wyłączona</p>
          {config?.mode === "scheduled" && config.start_time && (
            <p className="text-sm text-muted-foreground">
              Nadawanie: {config.start_time} – {config.end_time}
            </p>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Back button */}
      <Button variant="ghost" size="sm" className="absolute top-4 left-4 gap-2 z-20" onClick={() => navigate("/")}>
        <ArrowLeft className="h-4 w-4" /> Strona główna
      </Button>

      {/* Floating Hearts Layer */}
      <div className="fixed inset-0 pointer-events-none z-30">
        <AnimatePresence>
          {floatingHearts.map((heart) => (
            <motion.div
              key={heart.id}
              initial={{ opacity: 1, y: 0, x: `${heart.x}%`, scale: 0.5 }}
              animate={{
                opacity: [1, 1, 0.8, 0],
                y: [0, -150, -400, -700],
                x: `${heart.x + (Math.random() - 0.5) * 20}%`,
                scale: [0.5, 1.2, 1, 0.6],
                rotate: [0, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 60],
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2 + Math.random() * 0.8, ease: "easeOut" }}
              className="absolute bottom-32"
              style={{ left: 0 }}
            >
              <Heart
                className="fill-current"
                style={{ width: heart.size, height: heart.size, color: heart.color }}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm space-y-6">
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
          <div className="flex items-center justify-center gap-1">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/20 text-destructive text-xs font-semibold animate-pulse">
              <Wifi className="h-3 w-3" /> NA ŻYWO
            </span>
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
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Teraz gra</p>
                  <h2 className="font-bold text-lg truncate">{currentTitle}</h2>
                  <p className="text-sm text-muted-foreground truncate">{currentArtist}</p>
                </div>
                {/* Like button - only for tracks */}
                {isTrack && currentItem.track?.id && (
                  <motion.button
                    whileTap={{ scale: 1.4 }}
                    onClick={handleLike}
                    className="flex-shrink-0 p-2 rounded-full hover:bg-muted/50 transition-colors"
                  >
                    <Heart
                      className={`h-6 w-6 transition-colors ${
                        isLiked ? "fill-destructive text-destructive" : "text-muted-foreground hover:text-destructive"
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
                  onValueChange={([v]) => {
                    setVolume(v);
                    setMuted(false);
                  }}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        )}

        {/* Up Next */}
        {schedule.length > 1 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider px-1">Następne w programie</p>
            <div className="space-y-1">
              {schedule
                .slice(currentIndex + 1, currentIndex + 4)
                .concat(schedule.slice(0, Math.max(0, 3 - (schedule.length - currentIndex - 1))))
                .slice(0, 3)
                .map((item, i) => (
                  <div
                    key={(item.track?.id || item.custom_title || "") + "-" + i}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 bg-card/50 border border-border/30"
                  >
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

        <p className="text-center text-xs text-muted-foreground">Powered by GrouAI Stream</p>
      </motion.div>
    </div>
  );
};

export default RadioLive;
