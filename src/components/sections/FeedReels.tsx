import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Plus, Check, ChevronUp, ChevronDown, Play, Pause, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { HQCover } from "@/components/ui/HQCover";
import { loadYT } from "@/lib/youtubeIframe";
import { ReelSearchPopup } from "@/components/reels/ReelSearchPopup";
import { logReelWatch } from "@/lib/reelHistory";
import type { YtHit } from "@/lib/reelSearch";
import type { Language } from "@/i18n/translations";
import { toast } from "sonner";

export type YtItem = { kind: "yt"; videoId: string; title: string; artist: string; genre?: string };

const FAV_KEY = "grouai-reel-favs-v1";
const SEL = "id,title,artist,album,duration,cover_url,audio_url,video_url,genre,mood";

// Ujednolicone „Rolki" (TikTok-style): pionowo, na CAŁY ekran telefonu, bez
// widocznego playera YouTube (controls ukryte), auto-start. Zakładki u góry
// przełączają źródło: teledyski z playlisty YouTube „bez końca" oraz nasze
// wszystkie utwory z aplikacji. Swipe = następny/poprzedni, tap = pauza/play,
// ➕ dodaje do playlisty (nasze utwory → Supabase liked_songs, YT → lokalnie).
export const FeedReels = ({
  ytTab,
  includeOurSongs = true,
  lang,
  onClose,
}: {
  ytTab?: { label: string; playlistId?: string; videoIds?: string[]; items?: YtItem[] };
  includeOurSongs?: boolean;
  lang: Language;
  onClose: () => void;
}) => {
  const { playTrack, pausePlayback, togglePlay, isPlaying, currentTrack } = usePlayer();
  const { user } = useAuth();
  const L = (pl: string, en: string, nl: string, ua: string) =>
    lang === "en" ? en : lang === "nl" ? nl : lang === "ua" ? ua : pl;

  const hasYt = !!(ytTab && (ytTab.playlistId || (ytTab.videoIds && ytTab.videoIds.length) || (ytTab.items && ytTab.items.length)));

  const [songs, setSongs] = useState<Track[]>([]);
  const [songsLoading, setSongsLoading] = useState(includeOurSongs);
  const [tabKey, setTabKey] = useState<"yt" | "songs">(hasYt ? "yt" : "songs");
  const [songIndex, setSongIndex] = useState(0);
  const [ytData, setYtData] = useState<{ title?: string; author?: string; video_id?: string }>({});
  const [ytPlaying, setYtPlaying] = useState(false);
  const [added, setAdded] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const pauseTimer = useRef<number | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const ytMountRef = useRef<HTMLDivElement>(null);
  const ytReadyRef = useRef(false);
  const tabKeyRef = useRef(tabKey);
  useEffect(() => { tabKeyRef.current = tabKey; }, [tabKey]);

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
        const list = Array.isArray(data) ? (data as unknown as Track[]) : [];
        // Teledyski (utwory z wideo) na przód.
        list.sort((a, b) => (b.video_url ? 1 : 0) - (a.video_url ? 1 : 0));
        if (alive) setSongs(list);
      } catch { if (alive) setSongs([]); }
      finally { if (alive) setSongsLoading(false); }
    })();
    return () => { alive = false; };
  }, [includeOurSongs]);

  const songTotal = songs.length;
  const songSafe = songTotal ? ((songIndex % songTotal) + songTotal) % songTotal : 0;
  const song = songs[songSafe];

  const tabs = useMemo(() => {
    const out: { key: "yt" | "songs"; label: string }[] = [];
    if (hasYt) out.push({ key: "yt", label: ytTab!.label });
    if (includeOurSongs && songTotal) out.push({ key: "songs", label: L("Nasze utwory", "Our songs", "Onze nummers", "Наші треки") });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasYt, includeOurSongs, songTotal, lang]);

  const activateYt = () => {
    pausePlayback();
    if (!ytReadyRef.current || !playerRef.current) return;
    try {
      if (ytTab?.playlistId) playerRef.current.loadPlaylist({ list: ytTab.playlistId, listType: "playlist", index: 0 });
      else if (ytTab?.videoIds?.length) playerRef.current.loadPlaylist({ playlist: ytTab.videoIds, index: 0 });
      else if (ytTab?.items?.length) playerRef.current.loadPlaylist({ playlist: ytTab.items.map((i) => i.videoId), index: 0 });
    } catch { /* */ }
  };

  // Utwórz odtwarzacz YouTube raz (bez kontrolek, auto-start).
  useEffect(() => {
    if (!hasYt) return;
    let cancelled = false;
    loadYT().then((YT) => {
      if (cancelled || !ytMountRef.current) return;
      playerRef.current = new YT.Player(ytMountRef.current, {
        width: "100%", height: "100%",
        playerVars: {
          autoplay: 1, controls: 0, disablekb: 1, fs: 0, rel: 0,
          modestbranding: 1, playsinline: 1, iv_load_policy: 3,
          list: ytTab?.playlistId, listType: ytTab?.playlistId ? "playlist" : undefined,
        },
        events: {
          onReady: () => { ytReadyRef.current = true; if (tabKeyRef.current === "yt") { activateYt(); try { playerRef.current.playVideo(); } catch { /* */ } } },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onStateChange: (e: any) => {
            setYtPlaying(e.data === 1);
            try {
              const d = playerRef.current?.getVideoData?.();
              if (d?.video_id) {
                setYtData(d);
                if (e.data === 1) logReelWatch(user?.id || null, { source: "youtube", videoId: d.video_id, title: d.title, artist: d.author });
              }
            } catch { /* */ }
            // Pauza „na dłużej" (tylko w rolce YT) → po chwili popup wyszukiwania.
            if (e.data === 2) {
              if (pauseTimer.current) window.clearTimeout(pauseTimer.current);
              pauseTimer.current = window.setTimeout(() => { if (tabKeyRef.current === "yt") setShowSearch(true); }, 3500);
            } else if (e.data === 1) {
              if (pauseTimer.current) window.clearTimeout(pauseTimer.current);
              setShowSearch(false);
            }
          },
          // Film niedostępny (404 / brak osadzania) → pomiń na następny.
          onError: () => { try { playerRef.current?.nextVideo?.(); } catch { /* */ } },
        },
      });
    });
    return () => { cancelled = true; if (pauseTimer.current) window.clearTimeout(pauseTimer.current); try { playerRef.current?.destroy?.(); } catch { /* */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Przełączenie zakładki — gra tylko aktywne źródło.
  useEffect(() => {
    setAdded(false);
    if (tabKey === "yt") { activateYt(); try { playerRef.current?.playVideo?.(); } catch { /* */ } }
    else { try { playerRef.current?.pauseVideo?.(); } catch { /* */ } if (song) playTrack(song, "reels"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabKey]);

  // Zmiana utworu w zakładce „Nasze utwory".
  useEffect(() => {
    if (tabKey !== "songs" || !song) return;
    try { playerRef.current?.pauseVideo?.(); } catch { /* */ }
    playTrack(song, "reels");
    logReelWatch(user?.id || null, { source: "track", trackId: song.id, title: song.title, artist: song.artist });
    setAdded(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songSafe]);

  // Pauza w zakładce „Nasze utwory" → po chwili popup wyszukiwania.
  useEffect(() => {
    if (tabKey !== "songs") return;
    if (isPlaying) { if (pauseTimer.current) window.clearTimeout(pauseTimer.current); setShowSearch(false); return; }
    const t = window.setTimeout(() => setShowSearch(true), 3500);
    return () => window.clearTimeout(t);
  }, [isPlaying, tabKey]);

  // Wynik wyszukiwania na pauzie:
  const playOurSong = (t: Track) => { try { playerRef.current?.pauseVideo?.(); } catch { /* */ } playTrack(t, "reels-search"); setShowSearch(false); };
  const playYtHit = (hit: YtHit) => {
    try { pausePlayback(); playerRef.current?.loadVideoById?.(hit.videoId); playerRef.current?.playVideo?.(); } catch { /* */ }
    setShowSearch(false);
  };

  const go = (d: number) => {
    if (tabKey === "yt") { try { if (d > 0) playerRef.current?.nextVideo?.(); else playerRef.current?.previousVideo?.(); } catch { /* */ } setAdded(false); }
    else { setSongIndex((i) => i + d); }
  };
  const switchTab = (k: "yt" | "songs") => { if (k !== tabKey) setTabKey(k); };

  const togglePlayback = () => {
    if (tabKey === "yt") {
      try { const st = playerRef.current?.getPlayerState?.(); if (st === 1) playerRef.current?.pauseVideo?.(); else playerRef.current?.playVideo?.(); } catch { /* */ }
    } else { togglePlay(); }
  };

  const addToPlaylist = async () => {
    if (tabKey === "songs") {
      if (!song) return;
      if (!user) { toast.error(L("Zaloguj się, aby dodać do playlisty", "Log in to add to your playlist", "Log in om toe te voegen", "Увійдіть, щоб додати")); return; }
      try {
        const { data: existing } = await supabase.from("liked_songs").select("id").eq("user_id", user.id).eq("track_id", song.id).maybeSingle();
        if (!existing) await supabase.from("liked_songs").insert({ user_id: user.id, track_id: song.id });
        setAdded(true);
        toast.success(L("Dodano do Twojej playlisty (Polubione)", "Added to your playlist (Liked)", "Toegevoegd (Leuk)", "Додано (Вподобані)"), { description: song.title });
      } catch { toast.error(L("Nie udało się dodać", "Couldn't add", "Toevoegen mislukt", "Не вдалося додати")); }
    } else {
      try {
        const d = playerRef.current?.getVideoData?.();
        if (!d?.video_id) return;
        const raw = localStorage.getItem(FAV_KEY);
        const list: { video_id: string }[] = raw ? JSON.parse(raw) : [];
        if (!list.find((x) => x.video_id === d.video_id)) {
          list.unshift({ video_id: d.video_id, title: d.title, artist: d.author } as never);
          localStorage.setItem(FAV_KEY, JSON.stringify(list.slice(0, 200)));
        }
        setAdded(true);
        toast.success(L("Zapisano teledysk", "Video saved", "Video opgeslagen", "Відео збережено"), { description: d.title });
      } catch { /* */ }
    }
  };

  const onYt = tabKey === "yt";
  const isTrackPlaying = !onYt && song && currentTrack?.id === song.id && isPlaying;
  const playingNow = onYt ? ytPlaying : isTrackPlaying;
  const title = onYt ? (ytData.title || "…") : (song?.title || "");
  const artist = onYt ? (ytData.author || "") : (song?.artist || "");

  return (
    <motion.div className="fixed inset-0 z-[9990] bg-black" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {/* Player YouTube na CAŁY ekran (cover-fill, kontrolki ukryte) */}
      {hasYt && (
        <div className="absolute inset-0 overflow-hidden" style={{ opacity: onYt ? 1 : 0, pointerEvents: onYt ? "auto" : "none" }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "100vw", height: "56.25vw", minHeight: "100vh", minWidth: "177.78vh" }}>
            <div ref={ytMountRef} className="w-full h-full" />
          </div>
        </div>
      )}

      {/* Nasz utwór: okładka na cały ekran */}
      {!onYt && song && (
        <div className="absolute inset-0">
          <HQCover src={song.cover_url} alt={song.title} genre={song.genre} artist={song.artist} videoUrl={song.video_url} className="absolute inset-0 w-full h-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/40" />
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
          {playingNow ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-white" />}
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
          {!onYt && songTotal ? ` · ${songSafe + 1}/${songTotal}` : ""}
        </div>
      </div>

      {songsLoading && tabs.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-white/70 gap-2 z-10">
          <Loader2 className="h-5 w-5 animate-spin" /> {L("Ładuję…", "Loading…", "Laden…", "Завантаження…")}
        </div>
      )}

      {/* Popup wyszukiwania po dłuższej pauzie */}
      {showSearch && (
        <ReelSearchPopup lang={lang} onClose={() => setShowSearch(false)} onPlayTrack={playOurSong} onPlayYt={playYtHit}
          currentArtist={onYt ? (ytData.author || "") : (song?.artist || "")}
          currentTitle={onYt ? (ytData.title || "") : (song?.title || "")} />
      )}
    </motion.div>
  );
};
