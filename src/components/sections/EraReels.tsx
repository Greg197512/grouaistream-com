import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Plus, Check, ChevronUp, ChevronDown } from "lucide-react";
import { ERAS, eraYoutubePlaylist, type Era } from "@/lib/eraEngine";
import { eraTextFor } from "@/lib/eraContent";
import { loadYT } from "@/lib/youtubeIframe";
import type { Language } from "@/i18n/translations";
import { toast } from "sonner";

const FAV_KEY = "grouai-era-favs-v1";

// „Rolki epoki" — pionowy tryb jak TikTok/rolki: teledysk dekady gra na cały ekran,
// przewijasz w górę do następnego, ➕ dodajesz do swojej playlisty, u góry przełączasz
// epoki. Filmy pochodzą z playlisty YouTube danej dekady (całe utwory).
export const EraReels = ({ startEra, lang, onClose }: { startEra: Era; lang: Language; onClose: () => void }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const [era, setEra] = useState<Era>(startEra);
  const [added, setAdded] = useState(false);

  const erasWithVideos = ERAS.filter((e) => eraYoutubePlaylist(e));
  const L = (pl: string, en: string, nl: string, ua: string) =>
    lang === "en" ? en : lang === "nl" ? nl : lang === "ua" ? ua : pl;

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
          onReady: (e: any) => { try { e.target.playVideo(); } catch { /* */ } },
          onStateChange: () => setAdded(false),
        },
      });
    });
    return () => { cancelled = true; try { playerRef.current?.destroy?.(); } catch { /* */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchEra = (e: Era) => {
    setEra(e);
    setAdded(false);
    const id = eraYoutubePlaylist(e);
    if (id) { try { playerRef.current?.loadPlaylist?.({ list: id, listType: "playlist", index: 0 }); } catch { /* */ } }
  };
  const next = () => { try { playerRef.current?.nextVideo?.(); } catch { /* */ } setAdded(false); };
  const prev = () => { try { playerRef.current?.previousVideo?.(); } catch { /* */ } setAdded(false); };
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

      {/* Góra: przełączanie epok + zamknięcie */}
      <div className="absolute top-0 left-0 right-0 p-3 flex items-center gap-2 z-20 bg-gradient-to-b from-black/70 to-transparent">
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
    </motion.div>
  );
};
