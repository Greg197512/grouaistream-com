import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Flame, Loader2, RefreshCw, ChevronLeft, ChevronRight,
  Music2, Waves, Zap, Disc3, Guitar, Radio, Mic2, Drum, Sparkles
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import { HQCover } from "@/components/ui/HQCover";
import { LikeButton, TrackOptionsMenu } from "@/components/menus/TrackOptionsMenu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { withTimeout } from "@/lib/withTimeout";

const FETCH_TIMEOUT_MS = 25_000;
const PROFILE_FETCH_TIMEOUT_MS = 8_000;
const TRACK_SELECT = "id,title,artist,album,duration,cover_url,audio_url,video_url,genre,mood,created_at,user_id";
const CARDS_VISIBLE = 4;
const AUTO_MS = 10000;

interface UploaderProfile {
  display_name: string | null;
  avatar_url: string | null;
}
interface ServerTrack extends Track {
  created_at: string;
  user_id: string | null;
  uploader?: UploaderProfile | null;
}

// ─── Genre theme map ───────────────────────────────────────────────────────────
const GENRE_THEMES: Record<string, { g1: string; g2: string; g3: string; Icon: typeof Music2; pulse: string }> = {
  electronic: { g1: "#0f0c29", g2: "#302b63", g3: "#24243e", Icon: Zap,      pulse: "#a78bfa" },
  "hip-hop":  { g1: "#0d0d0d", g2: "#1a1a2e", g3: "#16213e", Icon: Mic2,     pulse: "#f59e0b" },
  rock:       { g1: "#1a0000", g2: "#3d0000", g3: "#2d0000", Icon: Guitar,   pulse: "#ef4444" },
  metal:      { g1: "#111111", g2: "#292929", g3: "#1a1a1a", Icon: Guitar,   pulse: "#6b7280" },
  pop:        { g1: "#fc466b", g2: "#3f5efb", g3: "#c31432", Icon: Disc3,    pulse: "#f9a8d4" },
  jazz:       { g1: "#1a1005", g2: "#4a3728", g3: "#2d1f12", Icon: Music2,   pulse: "#d97706" },
  classical:  { g1: "#0d1117", g2: "#1a2332", g3: "#0a0f1e", Icon: Waves,    pulse: "#93c5fd" },
  ambient:    { g1: "#0f2027", g2: "#203a43", g3: "#2c5364", Icon: Waves,    pulse: "#67e8f9" },
  soul:       { g1: "#2d1b69", g2: "#11998e", g3: "#38ef7d", Icon: Mic2,     pulse: "#a78bfa" },
  "r&b":      { g1: "#360033", g2: "#0b8793", g3: "#1a0019", Icon: Disc3,    pulse: "#c084fc" },
  reggae:     { g1: "#0f4c0f", g2: "#0f9b58", g3: "#004d20", Icon: Music2,   pulse: "#4ade80" },
  blues:      { g1: "#021b79", g2: "#0575e6", g3: "#00091a", Icon: Guitar,   pulse: "#60a5fa" },
  folk:       { g1: "#2c3e50", g2: "#4ca1af", g3: "#1a2535", Icon: Guitar,   pulse: "#86efac" },
  drum:       { g1: "#1f1f1f", g2: "#434343", g3: "#1a1a1a", Icon: Drum,     pulse: "#fbbf24" },
  radio:      { g1: "#1c1c3a", g2: "#4a4a8a", g3: "#0e0e2a", Icon: Radio,   pulse: "#818cf8" },
  ai:         { g1: "#7f00ff", g2: "#e100ff", g3: "#3d007a", Icon: Zap,      pulse: "#e879f9" },
  default:    { g1: "#1a1040", g2: "#2d1b69", g3: "#0d0a20", Icon: Music2,   pulse: "#a78bfa" },
};

const getTheme = (genre: string | null) => {
  if (!genre) return GENRE_THEMES.default;
  const g = genre.toLowerCase();
  for (const [k, v] of Object.entries(GENRE_THEMES)) {
    if (g.includes(k)) return v;
  }
  return GENRE_THEMES.default;
};

// ─── Themed cover fallback ─────────────────────────────────────────────────────
const ThemedCover = ({ genre, title, artist }: { genre: string | null; title: string; artist: string }) => {
  const t = getTheme(genre);
  const { Icon } = t;
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${t.g1}, ${t.g2}, ${t.g3})` }}
    >
      {/* background pulse ring */}
      <motion.div
        className="absolute rounded-full"
        style={{ width: 140, height: 140, border: `2px solid ${t.pulse}22`, top: "50%", left: "50%", x: "-50%", y: "-50%" }}
        animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.1, 0.3] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute rounded-full"
        style={{ width: 90, height: 90, border: `1px solid ${t.pulse}44`, top: "50%", left: "50%", x: "-50%", y: "-50%" }}
        animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0.15, 0.5] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      />
      {/* floating particles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full"
          style={{ background: t.pulse, left: `${15 + i * 12}%`, top: `${20 + (i % 3) * 20}%` }}
          animate={{ y: [-4, 4, -4], opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 2 + i * 0.3, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
      <div className="z-10 flex flex-col items-center gap-2">
        <motion.div
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <Icon className="h-10 w-10" style={{ color: t.pulse }} />
        </motion.div>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: t.pulse }}>
          {genre || "Music"}
        </p>
      </div>
      {/* bottom gradient text */}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
        <p className="text-[9px] text-white/60 truncate text-center">{artist}</p>
      </div>
    </div>
  );
};

// ─── Main component ────────────────────────────────────────────────────────────
export const NewOnServer = () => {
  const [tracks, setTracks] = useState<ServerTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [page, setPage] = useState(0);
  const [direction, setDirection] = useState(1); // 1=forward -1=backward
  const [isPaused, setIsPaused] = useState(false);
  const { playPlaylist, currentTrack, isPlaying } = usePlayer();
  const navigate = useNavigate();
  const mountedRef = useRef(true);
  const timerRef = useRef<number | null>(null);
  const wheelCooldownRef = useRef(false);

  const totalPages = Math.max(1, Math.ceil(tracks.length / CARDS_VISIBLE));
  const currentCards = tracks.slice(page * CARDS_VISIBLE, (page + 1) * CARDS_VISIBLE);

  const goTo = useCallback((nextPage: number, dir: number) => {
    setDirection(dir);
    setPage(nextPage);
  }, []);

  const advance = useCallback(() => {
    setDirection(1);
    setPage(p => (p + 1) % totalPages);
  }, [totalPages]);

  // auto-advance — zatrzymuje się gdy isPaused
  useEffect(() => {
    if (tracks.length === 0 || isPaused) {
      if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }
    timerRef.current = window.setInterval(advance, AUTO_MS);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [advance, tracks.length, isPaused]);

  const resetTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (!isPaused) timerRef.current = window.setInterval(advance, AUTO_MS);
  };

  // kółko myszy → przełącza strony
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (wheelCooldownRef.current) return;
    wheelCooldownRef.current = true;
    setTimeout(() => { wheelCooldownRef.current = false; }, 600);
    if (e.deltaX > 30 || e.deltaY > 30) {
      goTo((page + 1) % totalPages, 1);
    } else if (e.deltaX < -30 || e.deltaY < -30) {
      goTo((page - 1 + totalPages) % totalPages, -1);
    }
  }, [page, totalPages, goTo]);

  const fetchLatest = useCallback(async () => {
    if (!mountedRef.current) return;
    setLoading(true);
    setHasError(false);
    try {
      const { data, error } = await withTimeout(
        supabase.from("tracks").select(TRACK_SELECT)
          .or("audio_url.not.is.null,video_url.not.is.null")
          .order("created_at", { ascending: false })
          .limit(8),
        FETCH_TIMEOUT_MS, "NewOnServer tracks"
      );
      if (!mountedRef.current) return;
      if (error) throw error;
      const tracksData = (data || []) as ServerTrack[];
      const userIds = Array.from(new Set(tracksData.map(t => t.user_id).filter(Boolean))) as string[];
      let profilesMap: Record<string, UploaderProfile> = {};
      if (userIds.length > 0) {
        try {
          const { data: profiles } = await withTimeout(
            supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", userIds),
            PROFILE_FETCH_TIMEOUT_MS, "NewOnServer profiles"
          );
          profilesMap = (profiles || []).reduce((acc, p) => {
            if (p.user_id) acc[p.user_id] = { display_name: p.display_name, avatar_url: p.avatar_url };
            return acc;
          }, {} as Record<string, UploaderProfile>);
        } catch { /* profiles optional */ }
      }
      if (mountedRef.current) {
        setTracks(tracksData.map(t => ({ ...t, uploader: t.user_id ? profilesMap[t.user_id] || null : null })));
      }
    } catch (err) {
      console.error("[NewOnServer]", err);
      if (mountedRef.current) setHasError(true);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void fetchLatest();
    const channel = supabase.channel("new-tracks-home")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tracks" }, () => void fetchLatest())
      .subscribe();
    // Odśwież kafelki po zmianach z menu utworu (np. nowa okładka, usunięcie)
    const onListChanged = () => void fetchLatest();
    window.addEventListener("track-list-changed", onListChanged);
    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
      window.removeEventListener("track-list-changed", onListChanged);
    };
  }, [fetchLatest]);

  if (loading) return (
    <section className="px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Flame className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl font-bold">🔥 Nowe na serwerze</h2>
      </div>
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </section>
  );

  if (hasError) return (
    <section className="px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Flame className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl font-bold">🔥 Nowe na serwerze</h2>
      </div>
      <div className="flex flex-col items-center py-8 gap-3">
        <p className="text-sm text-muted-foreground">Nie udało się załadować</p>
        <button onClick={() => void fetchLatest()} className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-primary/10 hover:bg-primary/20 text-primary transition-colors">
          <RefreshCw className="h-4 w-4" /> Ponów
        </button>
      </div>
    </section>
  );

  if (tracks.length === 0) return null;

  return (
    <section className="px-6 py-8 select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Flame className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl font-bold">🔥 Nowe na serwerze</h2>
          {isPaused && (
            <span className="text-[10px] text-muted-foreground/60 font-medium">⏸ zatrzymano</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Page dots */}
          <div className="flex gap-1.5 mr-2">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => { goTo(i, i > page ? 1 : -1); resetTimer(); }}
                className={`rounded-full transition-all duration-300 ${i === page ? "w-5 h-2 bg-primary" : "w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/60"}`}
              />
            ))}
          </div>
          <button
            onClick={() => { goTo((page - 1 + totalPages) % totalPages, -1); resetTimer(); }}
            className="p-1.5 rounded-full hover:bg-secondary/80 transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => { goTo((page + 1) % totalPages, 1); resetTimer(); }}
            className="p-1.5 rounded-full hover:bg-secondary/80 transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button onClick={() => navigate("/server")} className="text-sm text-primary hover:underline ml-1">
            Wszystkie →
          </button>
        </div>
      </div>

      {/* Cards carousel */}
      <div
        className="relative overflow-hidden"
        style={{ minHeight: 320 }}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onWheel={handleWheel}
      >
        <AnimatePresence mode="popLayout" custom={direction} initial={false}>
          <motion.div
            key={page}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4"
          >
            {currentCards.map((track, i) => {
              const isLast = i === currentCards.length - 1;
              const isActive = currentTrack?.id === track.id && isPlaying;

              return (
                <motion.div
                  key={track.id}
                  custom={direction}
                  initial={{
                    x: direction > 0 ? 180 + i * 35 : -(180 + i * 35),
                    opacity: 0,
                    rotate: direction > 0 ? 7 + i * 1.5 : -(7 + i * 1.5),
                    scale: 0.86,
                  }}
                  animate={{
                    x: 0, opacity: 1, rotate: 0, scale: 1,
                    transition: {
                      type: "spring", stiffness: 280, damping: 26,
                      delay: i * 0.09,
                      opacity: { duration: 0.25, delay: i * 0.09 },
                    }
                  }}
                  exit={{
                    x: direction > 0
                      ? (isLast ? -320 : -(120 + i * 28))
                      : (isLast ? 320 : 120 + i * 28),
                    opacity: 0,
                    rotate: direction > 0
                      ? (isLast ? -30 : -(5 + i * 3))
                      : (isLast ? 30 : 5 + i * 3),
                    y: isLast ? -60 : 0,
                    scale: isLast ? 0.55 : 0.88,
                    transition: {
                      duration: isLast ? 0.65 : 0.32,
                      delay: isLast ? (currentCards.length - 1) * 0.05 : i * 0.04,
                      ease: isLast ? [0.4, 0, 0.2, 1] : "easeIn",
                    }
                  }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className="group relative rounded-xl overflow-hidden bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer"
                  onClick={() => playPlaylist(tracks, page * CARDS_VISIBLE + i)}
                >
                  {/* Cover art */}
                  <div className="relative aspect-square overflow-hidden">
                    {track.cover_url?.trim() ? (
                      <HQCover
                        src={track.cover_url}
                        alt={track.title}
                        genre={track.genre}
                        artist={track.artist}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ThemedCover genre={track.genre} title={track.title} artist={track.artist} />
                    )}

                    {/* Play overlay */}
                    <div className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                      {isActive ? (
                        <div className="flex gap-1">
                          {[1, 2, 3].map(j => (
                            <motion.div key={j} className="w-1 bg-primary rounded-full"
                              animate={{ height: [8, 24, 8] }}
                              transition={{ duration: 0.5, repeat: Infinity, delay: j * 0.1 }}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center shadow-lg">
                          <Play className="h-5 w-5 text-primary-foreground fill-current ml-0.5" />
                        </div>
                      )}
                    </div>

                    {/* NEW badge + oznaczenie GrouAI Studio (dla utworów z generatora) */}
                    <div className="absolute top-2 left-2 pointer-events-none flex flex-col items-start gap-1">
                      <motion.span
                        animate={{ opacity: [1, 0.35, 1] }}
                        transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                        className="font-display text-[9px] font-extrabold italic tracking-[0.2em] px-1.5 py-[2px] rounded-[3px] bg-[#00A3FF] text-white shadow-[0_0_8px_#00A3FF,0_0_14px_rgba(0,163,255,0.6)]"
                      >
                        NEW
                      </motion.span>
                      {(track.mood === "generated" || track.album === "AI Generated") && (
                        <motion.span
                          animate={{
                            opacity: [0.4, 1, 0.4],
                            boxShadow: [
                              "0 0 4px rgba(255,107,0,0.3)",
                              "0 0 14px rgba(255,107,0,0.9), 0 0 22px rgba(147,51,234,0.6)",
                              "0 0 4px rgba(255,107,0,0.3)",
                            ],
                          }}
                          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                          className="inline-flex items-center gap-1 text-[8px] font-bold tracking-wide px-1.5 py-[2px] rounded-full text-white"
                          style={{ background: "linear-gradient(135deg, #FF6B00, #9333EA)" }}
                        >
                          <Sparkles className="h-2 w-2" /> GrouAI Studio
                        </motion.span>
                      )}
                    </div>

                    {/* Time badge */}
                    <div className="absolute bottom-2 right-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white/80 backdrop-blur-sm">
                        {formatDistanceToNow(new Date(track.created_at), { addSuffix: true, locale: pl })}
                      </span>
                    </div>

                    {/* Genre badge bottom-left */}
                    {track.genre && !track.cover_url?.trim() && (
                      <div className="absolute bottom-2 left-2">
                        <span
                          className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                          style={{ background: `${getTheme(track.genre).pulse}33`, color: getTheme(track.genre).pulse }}
                        >
                          {track.genre}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <p className="font-semibold text-sm truncate">{track.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                    {track.uploader?.display_name && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Avatar className="h-4 w-4">
                          {track.uploader.avatar_url && <AvatarImage src={track.uploader.avatar_url} alt={track.uploader.display_name} />}
                          <AvatarFallback className="text-[8px] bg-primary/20 text-primary">
                            {track.uploader.display_name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-[10px] text-muted-foreground truncate">@{track.uploader.display_name}</span>
                      </div>
                    )}
                    {track.genre && track.cover_url?.trim() && (
                      <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {track.genre}
                      </span>
                    )}
                  </div>

                  {/* Hover actions */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    <LikeButton trackId={track.id} />
                    <TrackOptionsMenu
                      trackId={track.id}
                      trackTitle={track.title}
                      trackArtist={track.artist}
                      trackUrl={track.video_url || track.audio_url}
                      size="sm"
                    />
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};
