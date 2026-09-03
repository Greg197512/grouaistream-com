import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Plus, Check, ChevronUp, ChevronDown } from "lucide-react";
import { ERAS, eraYoutubePlaylist, type Era } from "@/lib/eraEngine";
import { eraTextFor } from "@/lib/eraContent";
import { loadYT } from "@/lib/youtubeIframe";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer, type Track } from "@/contexts/PlayerContext";
import { ReelSearchPopup } from "@/components/reels/ReelSearchPopup";
import { logReelWatch } from "@/lib/reelHistory";
import type { YtHit } from "@/lib/reelSearch";
import type { Language } from "@/i18n/translations";
import { toast } from "sonner";

const FAV_KEY = "grouai-era-favs-v1";
const POS_KEY = "grouai-reel-pos-v1";       // pozycja (kto co ogląda) per użytkownik+epoka

// Wyciągnij wykonawcę, tytuł i rok z tytułu filmu YouTube (best-effort).
function parseVid(raw: { title?: string; author?: string }, fallbackDecade: string) {
  const full = (raw.title || "").trim();
  let artist = (raw.author || "").replace(/\s*-\s*Topic$/i, "").trim();
  let title = full;
  const dash = full.split(/\s[-–—]\s/);
  if (dash.length >= 2) { artist = dash[0].trim(); title = dash.slice(1).join(" - ").trim(); }
  title = title
    .replace(/\((?:official[^)]*|lyric[^)]*|audio|visuali[sz]er|hd|hq|4k|remaster[^)]*|explicit)\)/gi, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s{2,}/g, " ").trim();
  const ym = full.match(/\b(19[5-9]\d|20[0-2]\d)\b/);
  const year = ym ? ym[1] : fallbackDecade;
  return { artist, title: title || full, year };
}

// „Kto co ogląda": zapamiętaj pozycję w playliście epoki (per użytkownik).
function savePos(userKey: string, eraKey: string, index: number) {
  try {
    const raw = localStorage.getItem(POS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[`${userKey}::${eraKey}`] = index;
    localStorage.setItem(POS_KEY, JSON.stringify(map));
  } catch { /* */ }
}
function readPos(userKey: string, eraKey: string): number {
  try {
    const raw = localStorage.getItem(POS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    const v = map[`${userKey}::${eraKey}`];
    return typeof v === "number" && v >= 0 ? v : 0;
  } catch { return 0; }
}

// „Rolki epoki" — pionowy tryb jak TikTok/rolki: teledysk dekady gra na cały ekran,
// przewijasz w górę do następnego, ➕ dodajesz do swojej playlisty, u góry przełączasz
// epoki. Filmy pochodzą z playlisty YouTube danej dekady (całe utwory).
export const EraReels = ({ startEra, lang, onClose }: { startEra: Era; lang: Language; onClose: () => void }) => {
  const { user } = useAuth();
  const { playTrack, pausePlayback } = usePlayer();
  const userKey = user?.id || "anon";
  const [showSearch, setShowSearch] = useState(false);
  const pauseTimer = useRef<number | null>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const [era, setEra] = useState<Era>(startEra);
  const eraRef = useRef<Era>(startEra);
  useEffect(() => { eraRef.current = era; }, [era]);
  const [added, setAdded] = useState(false);
  const [vid, setVid] = useState<{ artist: string; title: string; year: string }>({ artist: "", title: "", year: "" });

  const erasWithVideos = ERAS.filter((e) => eraYoutubePlaylist(e));
  const L = (pl: string, en: string, nl: string, ua: string) =>
    lang === "en" ? en : lang === "nl" ? nl : lang === "ua" ? ua : pl;

  // Aktualizuj górny pasek (wykonawca · tytuł · rok) + „kto co ogląda".
  const refreshMeta = () => {
    try {
      const d = playerRef.current?.getVideoData?.();
      if (!d?.video_id) return;
      const e = eraRef.current;
      const parsed = parseVid(d, e.decade);
      setVid(parsed);
      const idx = playerRef.current?.getPlaylistIndex?.();
      if (typeof idx === "number" && idx >= 0) savePos(userKey, e.key, idx);
      logReelWatch(user?.id || null, { source: "youtube", videoId: d.video_id, title: parsed.title, artist: parsed.artist, era: e.key });
    } catch { /* */ }
  };

  useEffect(() => {
    let cancelled = false;
    loadYT().then((YT) => {
      if (cancelled || !mountRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      playerRef.current = new (YT as any).Player(mountRef.current, {
        width: "100%",
        height: "100%",
        playerVars: {
          listType: "playlist",
          list: eraYoutubePlaylist(startEra) || undefined,
          autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1,
          controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3,
        },
        events: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onReady: (e: any) => {
            try {
              // Wznów tam, gdzie ten użytkownik skończył w tej epoce.
              const id = eraYoutubePlaylist(startEra);
              const pos = readPos(userKey, startEra.key);
              if (id && pos > 0) e.target.loadPlaylist({ list: id, listType: "playlist", index: pos });
              e.target.playVideo();
            } catch { /* */ }
            setTimeout(refreshMeta, 400);
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onStateChange: (ev: any) => {
            setAdded(false);
            // Zmiana filmu (grający/pauza) → odśwież meta + zapisz „kto co ogląda".
            if (ev?.data === 1 || ev?.data === 5 || ev?.data === 3) refreshMeta();
            // Pauza „na dłużej" → po chwili proponuj wyszukiwanie.
            if (ev?.data === 2) {
              if (pauseTimer.current) window.clearTimeout(pauseTimer.current);
              pauseTimer.current = window.setTimeout(() => setShowSearch(true), 3500);
            } else if (ev?.data === 1) {
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

  const switchEra = (e: Era) => {
    setEra(e);
    eraRef.current = e;
    setAdded(false);
    const id = eraYoutubePlaylist(e);
    if (id) { try { playerRef.current?.loadPlaylist?.({ list: id, listType: "playlist", index: readPos(userKey, e.key) }); } catch { /* */ } setTimeout(refreshMeta, 500); }
  };
  const next = () => { try { playerRef.current?.nextVideo?.(); } catch { /* */ } setAdded(false); setTimeout(refreshMeta, 400); };
  const prev = () => { try { playerRef.current?.previousVideo?.(); } catch { /* */ } setAdded(false); setTimeout(refreshMeta, 400); };

  // Głosowe „w górę" / „w dół" (AutoVoiceListener) — te same akcje co swipe.
  useEffect(() => {
    const onVoiceNav = (e: Event) => {
      const dir = (e as CustomEvent).detail?.direction;
      if (dir === "next") next(); else if (dir === "prev") prev();
    };
    window.addEventListener("grouai:reel-nav", onVoiceNav);
    return () => window.removeEventListener("grouai:reel-nav", onVoiceNav);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wynik wyszukiwania na pauzie:
  const playOurSong = (t: Track) => { try { playerRef.current?.pauseVideo?.(); } catch { /* */ } playTrack(t, "reels-search"); setShowSearch(false); };
  const playYtHit = (hit: YtHit) => {
    try { pausePlayback(); playerRef.current?.loadVideoById?.(hit.videoId); playerRef.current?.playVideo?.(); } catch { /* */ }
    setShowSearch(false); setTimeout(refreshMeta, 600);
  };
  const togglePlay = () => {
    try {
      const st = playerRef.current?.getPlayerState?.();
      if (st === 1) playerRef.current?.pauseVideo?.(); else playerRef.current?.playVideo?.();
    } catch { /* */ }
  };

  const addFav = () => {
    try {
      const d = playerRef.current?.getVideoData?.();
      if (!d?.video_id) { toast.error(L("Poczekaj, aż film się załaduje", "Wait for the video to load", "Wacht tot de video laadt", "Зачекайте завантаження")); return; }
      const raw = localStorage.getItem(FAV_KEY);
      const list: { video_id: string }[] = raw ? JSON.parse(raw) : [];
      if (!list.find((x) => x.video_id === d.video_id)) {
        list.unshift({ video_id: d.video_id, title: d.title, author: d.author, era: era.key, ts: Date.now() } as never);
        localStorage.setItem(FAV_KEY, JSON.stringify(list.slice(0, 200)));
      }
      setAdded(true);
      toast.success(L("Dodano do Twojej playlisty", "Added to your playlist", "Toegevoegd aan je playlist", "Додано до плейлиста"), {
        description: d.title,
      });
    } catch { toast.error("—"); }
  };

  return (
    <motion.div className="fixed inset-0 z-[9990] bg-black" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {/* Odtwarzacz na CAŁY ekran (cover-fill, kontrolki ukryte) */}
      <div className="absolute inset-0 overflow-hidden">
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "100vw", height: "56.25vw", minHeight: "100vh", minWidth: "177.78vh" }}>
          <div ref={mountRef} className="w-full h-full" />
        </div>
      </div>

      {/* Warstwa gestów: swipe w górę = następny, w dół = poprzedni, tap = pauza/play */}
      <motion.div
        className="absolute inset-0"
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={(_e, info) => { if (info.offset.y < -60) next(); else if (info.offset.y > 60) prev(); }}
        onClick={togglePlay}
        style={{ touchAction: "none" }}
      />

      {/* Góra: wykonawca · tytuł · rok + przełączanie epok + zamknięcie */}
      <div className="absolute top-0 left-0 right-0 p-3 z-20 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {erasWithVideos.map((e) => (
              <button key={e.key} onClick={() => switchEra(e)}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap"
                style={e.key === era.key
                  ? { background: e.palette.accent, color: "#000", borderColor: e.palette.accent }
                  : { background: "rgba(255,255,255,.08)", color: "#fff", borderColor: "rgba(255,255,255,.22)" }}>
                {e.emoji} {eraTextFor(e, lang).label}
              </button>
            ))}
          </div>
          <button onClick={onClose} aria-label="Zamknij" className="shrink-0 h-9 w-9 rounded-full bg-black/50 border border-white/20 text-white flex items-center justify-center">
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* Wykonawca · tytuł · rok produkcji */}
        <div className="mt-2.5 pointer-events-none">
          <div className="text-base font-extrabold text-white drop-shadow truncate">{vid.artist || "…"}</div>
          <div className="text-sm text-white/85 drop-shadow truncate">
            {vid.title}
            {vid.year ? <span className="ml-2 font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: `${era.palette.accent}33`, color: era.palette.accent }}>{vid.year}</span> : null}
          </div>
        </div>
      </div>

      {/* Prawy pasek akcji (jak TikTok): ➕ dodaj do playlisty */}
      <div className="absolute right-3 bottom-28 z-20 flex flex-col items-center gap-5">
        <button onClick={addFav} className="flex flex-col items-center gap-1 text-white">
          <span className="h-14 w-14 rounded-full flex items-center justify-center transition-colors"
            style={{ background: added ? "#22c55e" : "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.35)", boxShadow: added ? "0 0 18px #22c55e88" : "none" }}>
            {added ? <Check className="h-7 w-7" /> : <Plus className="h-7 w-7" />}
          </span>
          <span className="text-[10px] font-semibold">{added ? L("Dodano", "Added", "Toegevoegd", "Додано") : L("Dodaj", "Add", "Toevoegen", "Додати")}</span>
        </button>
        <button onClick={prev} aria-label="Poprzedni" className="h-11 w-11 rounded-full bg-black/45 border border-white/20 text-white flex items-center justify-center">
          <ChevronUp className="h-5 w-5" />
        </button>
        <button onClick={next} aria-label="Następny" className="h-11 w-11 rounded-full bg-black/45 border border-white/20 text-white flex items-center justify-center">
          <ChevronDown className="h-5 w-5" />
        </button>
      </div>

      {/* Dół: etykieta epoki + podpowiedź gestu */}
      <div className="absolute left-3 bottom-6 z-20 text-white pointer-events-none">
        <div className="text-sm font-bold drop-shadow">{era.emoji} GROUA ERA {eraTextFor(era, lang).label}</div>
        <div className="text-[11px] text-white/75 flex items-center gap-1 drop-shadow">
          <ChevronUp className="h-3 w-3" /> {L("Przewiń w górę = następny", "Swipe up = next", "Veeg omhoog = volgende", "Гортай вгору = далі")}
        </div>
      </div>

      {/* Popup wyszukiwania po dłuższej pauzie */}
      {showSearch && (
        <ReelSearchPopup lang={lang} onClose={() => setShowSearch(false)} onPlayTrack={playOurSong} onPlayYt={playYtHit}
          currentArtist={vid.artist} currentTitle={vid.title} />
      )}
    </motion.div>
  );
};
