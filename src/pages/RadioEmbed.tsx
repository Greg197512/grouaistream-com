import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Radio, Volume2, VolumeX, Play, Pause } from "lucide-react";

interface RadioConfig {
  is_active: boolean;
  mode: string;
  start_time: string | null;
  end_time: string | null;
  started_at: string | null;
  station_name: string;
}

interface ScheduleTrack {
  id: string;
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

const RadioEmbed = () => {
  const [config, setConfig] = useState<RadioConfig | null>(null);
  const [rawSchedule, setRawSchedule] = useState<ScheduleTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [userStarted, setUserStarted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const silentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Embed uses the same raw schedule as admin and /radio-live, no filtering or reordering.
  const schedule = useMemo(() => rawSchedule, [rawSchedule]);

  useEffect(() => {
    const fetchData = async () => {
      const [configRes, scheduleRes] = await Promise.all([
        supabase.from("radio_config").select("*").limit(1).single(),
        supabase
          .from("radio_schedule")
          .select("id, position, item_type, custom_title, custom_duration, custom_audio_url, lang, track:tracks(id, title, artist, duration, audio_url, cover_url)")
          .order("position", { ascending: true }),
      ]);
      if (configRes.data) setConfig(configRes.data as any);
      if (scheduleRes.data) setRawSchedule(scheduleRes.data as any);
    };
    fetchData();
  }, []);

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

  useEffect(() => {
    if (!config?.is_active || schedule.length === 0) return;
    const scheduleId = schedule[currentIndex]?.id ?? null;
    (supabase as any)
      .rpc("set_radio_current_schedule", { _schedule_id: scheduleId })
      .then(({ error }) => {
        if (error) console.warn("[RadioEmbed] sync current_schedule_id failed:", error.message);
      });
  }, [currentIndex, schedule, config?.is_active]);

  const startPlayback = useCallback(
    (index: number, offset = 0) => {
      const item = schedule[index];
      if (!item) return;
      const audioUrl = getItemAudioUrl(item);

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (silentTimerRef.current) {
        clearTimeout(silentTimerRef.current);
        silentTimerRef.current = null;
      }

      if (!audioUrl) {
        setIsPlaying(true);
        const remaining = getItemDuration(item) - offset;
        silentTimerRef.current = setTimeout(() => {
          const nextIndex = (index + 1) % schedule.length;
          setCurrentIndex(nextIndex);
          startPlayback(nextIndex);
        }, remaining * 1000);
        return;
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

      audio.addEventListener("ended", () => {
        const nextIndex = (index + 1) % schedule.length;
        setCurrentIndex(nextIndex);
        startPlayback(nextIndex);
      });

      audio.load();
    },
    [schedule, volume, muted]
  );

  const syncAndPlay = useCallback(() => {
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
        startPlayback(i, elapsed - cumulative);
        return;
      }
      cumulative += dur;
    }
    setCurrentIndex(0);
    startPlayback(0);
  }, [config, schedule, startPlayback]);

  const handlePlayPause = () => {
    if (!userStarted) {
      setUserStarted(true);
      syncAndPlay();
      return;
    }
    if (isPlaying) {
      audioRef.current?.pause();
      if (silentTimerRef.current) clearTimeout(silentTimerRef.current);
      setIsPlaying(false);
    } else {
      syncAndPlay();
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume / 100;
    }
  }, [volume, muted]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (silentTimerRef.current) clearTimeout(silentTimerRef.current);
    };
  }, []);

  const currentItem = schedule[currentIndex];
  const currentTitle = currentItem ? getItemTitle(currentItem) : "";
  const currentArtist = currentItem ? getItemArtist(currentItem) : "";
  const currentCover = currentItem?.track?.cover_url || null;
  const isOffAir = !config?.is_active || schedule.length === 0;

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
      <div className="flex items-center gap-3 p-3 bg-[#1a1a2e] text-white rounded-xl font-sans" style={{ minWidth: 280 }}>
        <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
          <Radio className="h-5 w-5 text-white/50" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{config?.station_name || "GrouaRadio"}</p>
          <p className="text-xs text-white/50">Offline</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-[#1a1a2e] text-white rounded-xl font-sans" style={{ minWidth: 300, maxWidth: 420 }}>
      {/* Cover / Play button */}
      <button
        onClick={handlePlayPause}
        className="relative h-12 w-12 rounded-lg overflow-hidden shrink-0 group cursor-pointer border-0 bg-transparent p-0"
      >
        {currentCover ? (
          <img src={currentCover} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
            <Radio className="h-5 w-5 text-white" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          {isPlaying ? <Pause className="h-5 w-5 text-white" /> : <Play className="h-5 w-5 text-white" />}
        </div>
        {isPlaying && (
          <div className="absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
        )}
      </button>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-bold truncate">{config?.station_name}</p>
          {isPlaying && (
            <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider animate-pulse">LIVE</span>
          )}
        </div>
        <p className="text-[11px] text-white/80 truncate">{currentTitle}</p>
        <p className="text-[10px] text-white/50 truncate">{currentArtist}</p>
      </div>

      {/* Volume */}
      <button
        onClick={() => setMuted(!muted)}
        className="text-white/60 hover:text-white transition-colors shrink-0 bg-transparent border-0 cursor-pointer p-1"
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>
    </div>
  );
};

export default RadioEmbed;
