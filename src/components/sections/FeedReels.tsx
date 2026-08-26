import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Plus, Check, ChevronUp, ChevronDown, Play, Pause, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { HQCover } from "@/components/ui/HQCover";
import { loadYT } from "@/lib/youtubeIframe";
import type { Language } from "@/i18n/translations";
import { toast } from "sonner";

export type YtItem = { kind: "yt"; videoId: string; title: string; artist: string; genre?: string };
type TrackItem = { kind: "track"; track: Track };
type ReelItem = YtItem | TrackItem;
type ReelTab = { key: string; label: string; items: ReelItem[] };

const FAV_KEY = "grouai-reel-favs-v1";
const SEL = "id,title,artist,album,duration,cover_url,audio_url,video_url,genre,mood";

// Ujednolicone „Rolki" (TikTok-style): pionowo, pełny ekran.
// Zakładki u góry przełączają źródło (np. teledyski AI „Na czasie" oraz nasze
// wszystkie utwory z aplikacji). Swipe w górę = następny, tap = pauza/play,
// ➕ dodaje do playlisty (nasze utwory → Supabase liked_songs, YT → lokalnie).
export const FeedReels = ({
  ytTab,
  includeOurSongs = true,
  lang,
  onClose,
}: {
  ytTab?: { label: string; items: YtItem[] };
  includeOurSongs?: boolean;
  lang: Language;
  onClose: () => void;
}) => {
  const { playTrack, pausePlayback, togglePlay, isPlaying, currentTrack } = usePlayer();
  const { user } = useAuth();
  const L = (pl: string, en: string, nl: string, ua: string) =>
    lang === "en" ? en : lang === "nl" ? nl : lang === "ua" ? ua : pl;

  const [songs, setSongs] = useState<Track[]>([]);
  const [songsLoading, setSongsLoading] = useState(includeOurSongs);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const ytMountRef = useRef<HTMLDivElement>(null);
  const ytReadyRef = useRef(false);

  // Pobierz wszystkie nasze utwory z aplikacji (katalog).
  useEffect(() => {
    if (!includeOurSongs) return;
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase
          .from("tracks").select(SEL)
          .or("audio_url.not.is.null,video_url.not.is.null")
          .order("created_at", { ascending: false }).limit(300);
        if (alive) setSongs(Array.isArray(data) ? (data as unknown as Track[]) : []);
      } catch { if (alive) setSongs([]); }
      finally { if (alive) setSongsLoading(false); }
    })();
    return () => { alive = false; };
  }, [includeOurSongs]);

  const tabs: ReelTab[] = useMemo(() => {
    const out: ReelTab[] = [];
    if (ytTab && ytTab.items.length) out.push({ key: "yt", label: ytTab.label, items: ytTab.items });
    if (includeOurSongs && songs.length) out.push({ key: "songs", label: L("Nasze utwory", "Our songs", "Onze nummers", "Наші треки"), items: songs.map((t) => ({ kind: "track", track: t })) });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytTab, includeOurSongs, songs, lang]);

  const [tabKey, setTabKey] = useState<string>(() => (ytTab && ytTab.items.length ? "yt" : "songs"));
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(0);
  const [added, setAdded] = useState(false);

  const activeTab = tabs.find((t) => t.key === tabKey) || tabs[0];
  const total = activeTab ? activeTab.items.length : 0;
  const safe = total ? ((index % total) + total) % total : 0;
  const item: ReelItem | undefined = activeTab?.items[safe];

  // Utwórz odtwarzacz YouTube (raz).
  useEffect(() => {
    let cancelled = false;
    loadYT().then((YT) => {
      if (cancelled || !ytMountRef.current) return;
      playerRef.current = new YT.Player(ytMountRef.current, {
        width: "100%", height: "100%",
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, controls: 1 },
        events: { onReady: () => { ytReadyRef.current = true; syncPlayback(); } },
      });
    });
    return () => { cancelled = true; try { playerRef.current?.destroy?.(); } catch { /* */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dbaj, by grało tylko aktywne źródło (YouTube albo nasz player), nie oba naraz.
  const syncPlayback = () => {
    if (!item) return;
    if (item.kind === "yt") {
      pausePlayback();
      if (ytReadyRef.current) { try { playerRef.current?.loadVideoById?.(item.videoId); } catch { /* */ } }
    } else {
      try { playerRef.current?.pauseVideo?.(); } catch { /* */ }
      playTrack(item.track, "reels");
    }
  };
  useEffect(() => { setAdded(false); syncPlayback(); /* eslint-disable-next-line */ }, [tabKey, safe, item?.kind, (item as YtItem)?.videoId, (item as TrackItem)?.track?.id]);

  const go = (d: number) => { setDir(d); setIndex((i) => i + d); };
  const switchTab = (k: string) => { if (k === tabKey) return; setDir(0); setTabKey(k); setIndex(0); };

  const togglePlayback = () => {
    if (!item) return;
    if (item.kind === "yt") {
      try {
        const st = playerRef.current?.getPlayerState?.();
        if (st === 1) playerRef.current?.pauseVideo?.(); else playerRef.current?.playVideo?.();
      } catch { /* */ }
    } else {
      togglePlay();
    }
  };

  const addToPlaylist = async () => {
    if (!item) return;
    if (item.kind === "track") {
      if (!user) { toast.error(L("Zaloguj się, aby dodać do playlisty", "Log in to add to your playlist", "Log in om toe te voegen", "Увійдіть, щоб додати")); return; }
      try {
        const { data: existing } = await supabase.from("liked_songs").select("id").eq("user_id", user.id).eq("track_id", item.track.id).maybeSingle();
        if (!existing) await supabase.from("liked_songs").insert({ user_id: user.id, track_id: item.track.id });
        setAdded(true);
        toast.success(L("Dodano do Twojej playlisty (Polubione)", "Added to your playlist (Liked)", "Toegevoegd (Leuk)", "Додано (Вподобані)"), { description: item.track.title });
      } catch { toast.error(L("Nie udało się dodać", "Couldn't add", "Toevoegen mislukt", "Не вдалося додати")); }
    } else {
      try {
        const raw = localStorage.getItem(FAV_KEY);
        const list: { video_id: string }[] = raw ? JSON.parse(raw) : [];
        if (!list.find((x) => x.video_id === item.videoId)) {
          list.unshift({ video_id: item.videoId, title: item.title, artist: item.artist } as never);
          localStorage.setItem(FAV_KEY, JSON.stringify(list.slice(0, 200)));
        }
        setAdded(true);
        toast.success(L("Zapisano teledysk", "Video saved", "Video opgeslagen", "Відео збережено"), { description: item.title });
      } catch { /* */ }
    }
  };

  const isTrackPlaying = item?.kind === "track" && currentTrack?.id === item.track.id && isPlaying;
  const title = item ? (item.kind === "yt" ? item.title : item.track.title) : "";
  const artist = item ? (item.kind === "yt" ? item.artist : item.track.artist) : "";

  return (
    <motion.div className="fixed inset-0 z-[9990] bg-black" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {/* Odtwarzacz YouTube (widoczny tylko dla teledysków) */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ opacity: item?.kind === "yt" ? 1 : 0, pointerEvents: item?.kind === "yt" ? "auto" : "none" }}>
        <div className="w-full" style={{ aspectRatio: "16 / 9", maxHeight: "100%" }}>
          <div ref={ytMountRef} className="w-full h-full" />
        </div>
      </div>

      {/* Nasz utwór: okładka na cały ekran */}
      {item?.kind === "track" && (
        <div className="absolute inset-0">
          <HQCover src={item.track.cover_url} alt={item.track.title} genre={item.track.genre} artist={item.track.artist} videoUrl={item.track.video_url} className="absolute inset-0 w-full h-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/40" />
          {!isTrackPlaying && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="h-20 w-20 rounded-full bg-white/15 backdrop-blur border border-white/30 flex items-center justify-center">
                <Play className="h-9 w-9 text-white fill-white ml-1" />
              </span>
            </div>
          )}
        </div>
      )}

      {/* Warstwa gestów: swipe góra/dół = następny/poprzedni, tap = pauza/play */}
      <motion.div
        className="absolute inset-0"
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={(_e, info) => { if (info.offset.y < -60) go(1); else if (info.offset.y > 60) go(-1); }}
        onClick={togglePlayback}
        style={{ touchAction: "none" }}
      />

      {/* Góra: zakładki źródeł + zamknięcie */}
      <div className="absolute top-0 left-0 right-0 p-3 flex items-center gap-2 z-20 bg-gradient-to-b from-black/70 to-transparent">
        <div className="flex-1 flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {tabs.map((tb) => (
            <button key={tb.key} onClick={() => switchTab(tb.key)}
              className="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap"
              style={tb.key === tabKey
                ? { background: "hsl(331 100% 62%)", color: "#000", borderColor: "hsl(331 100% 62%)" }
                : { background: "rgba(255,255,255,.08)", color: "#fff", borderColor: "rgba(255,255,255,.22)" }}>
              {tb.label}
            </button>
          ))}
        </div>
        <button onClick={onClose} aria-label="Zamknij" className="shrink-0 h-9 w-9 rounded-full bg-black/50 border border-white/20 text-white flex items-center justify-center">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Prawy pasek: ➕ dodaj do playlisty + nawigacja */}
      <div className="absolute right-3 bottom-28 z-20 flex flex-col items-center gap-5">
        <button onClick={addToPlaylist} className="flex flex-col items-center gap-1 text-white">
          <span className="h-14 w-14 rounded-full flex items-center justify-center transition-colors"
            style={{ background: added ? "#22c55e" : "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.35)", boxShadow: added ? "0 0 18px #22c55e88" : "none" }}>
            {added ? <Check className="h-7 w-7" /> : <Plus className="h-7 w-7" />}
          </span>
          <span className="text-[10px] font-semibold">{added ? L("Dodano", "Added", "Toegevoegd", "Додано") : L("Dodaj", "Add", "Toevoegen", "Додати")}</span>
        </button>
        <button onClick={togglePlayback} aria-label="Play/Pauza" className="h-11 w-11 rounded-full bg-black/45 border border-white/20 text-white flex items-center justify-center">
          {isTrackPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-white" />}
        </button>
        <button onClick={() => go(-1)} aria-label="Poprzedni" className="h-11 w-11 rounded-full bg-black/45 border border-white/20 text-white flex items-center justify-center">
          <ChevronUp className="h-5 w-5" />
        </button>
        <button onClick={() => go(1)} aria-label="Następny" className="h-11 w-11 rounded-full bg-black/45 border border-white/20 text-white flex items-center justify-center">
          <ChevronDown className="h-5 w-5" />
        </button>
      </div>

      {/* Dół: tytuł + wykonawca + podpowiedź */}
      <div className="absolute left-3 right-24 bottom-6 z-20 text-white pointer-events-none">
        <div className="text-base font-bold drop-shadow truncate">{title}</div>
        <div className="text-sm text-white/80 drop-shadow truncate">{artist}</div>
        <div className="text-[11px] text-white/65 flex items-center gap-1 mt-1 drop-shadow">
          <ChevronUp className="h-3 w-3" /> {L("Przewiń w górę = następny", "Swipe up = next", "Veeg omhoog = volgende", "Гортай вгору = далі")}
          {total > 0 ? ` · ${safe + 1}/${total}` : ""}
        </div>
      </div>

      {/* Ładowanie naszych utworów / pusto */}
      {songsLoading && tabs.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-white/70 gap-2 z-10">
          <Loader2 className="h-5 w-5 animate-spin" /> {L("Ładuję…", "Loading…", "Laden…", "Завантаження…")}
        </div>
      )}
    </motion.div>
  );
};
