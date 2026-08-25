import { useMemo, useState } from "react";
import { Play, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";

type Clip = { id: string; title: string; artist: string; genre: string };

// Kuratorska pula prawdziwych teledysków AI (disco / techno / hip-hop),
// znalezionych na YouTube. Aplikacja co tydzień automatycznie wybiera z niej
// 10 (deterministycznie wg numeru tygodnia) — dzięki temu zestaw sam się zmienia.
const POOL: Clip[] = [
  // Hip-Hop / Rap / Trap
  { id: "2Xy-ax7VyNI", title: "Mad Science", artist: "Nowhere Beach", genre: "Hip-Hop" },
  { id: "xOSW36TSsiQ", title: "Grow Up", artist: "DJAI", genre: "Hip-Hop" },
  { id: "1SWBizKojIw", title: "No Replay", artist: "AI Rap Duet", genre: "Trap" },
  { id: "dYW8tmnyh1c", title: "AI Rap", artist: "Artificial Rap", genre: "Rap" },
  { id: "0iGWxsKhxHo", title: "Futuristic Hip-Hop", artist: "AI Visuals", genre: "Hip-Hop" },
  { id: "P2b6tP25UWM", title: "GTA Type Beat", artist: "AI Beats", genre: "Hip-Hop" },
  // Techno / House / EDM
  { id: "JPGgtHuw2VA", title: "Neon Fractal Genesis", artist: "KYNTIC", genre: "Techno" },
  { id: "ix4m9ltlMsY", title: "I Love You", artist: "Bikini Club", genre: "Techno House" },
  { id: "EG-hGpguNyM", title: "Midnight Circuit", artist: "AI Cinematic", genre: "Techno" },
  { id: "Q9mxqoIQbkQ", title: "Nafile", artist: "Harmonic Flow", genre: "Techno" },
  { id: "uUwdopCxTNc", title: "Unusual", artist: "Harmonic Flow", genre: "Techno" },
  { id: "oZEkSGellX4", title: "All is Well", artist: "Harmonic Flow", genre: "Techno" },
  { id: "ECIrWFBuOMA", title: "Space Party", artist: "Fahri Yilmaz", genre: "Techno" },
  { id: "saagINxpPU0", title: "The Majestic Skies", artist: "AI Cinematic", genre: "Techno" },
  { id: "XEdYU7R5x4o", title: "Eclipse of Sound", artist: "ToneFlow", genre: "Techno" },
  { id: "nkQjcLwwPkg", title: "Burning Man", artist: "Techno Mix AI", genre: "Techno" },
  { id: "U1E_1Rkw4kY", title: "Go Now (Car & Girls)", artist: "Official AI", genre: "Techno" },
  // Disco / Funk / Nu-Disco
  { id: "cxPv3oC-Yis", title: "Make it Easy for Me", artist: "Oscar Morales", genre: "Disco-Funk" },
  { id: "2chbo8q6358", title: "Retro Disco 80s/90s", artist: "Disco AI", genre: "Disco" },
  { id: "phbEOC4U9qg", title: "Funky Firefly", artist: "Groove AI", genre: "Funk" },
  { id: "dg7BElt9ghQ", title: "Moonwalk", artist: "AIVA", genre: "Disco" },
  { id: "KlrKKmc64r0", title: "Dance AI Disco", artist: "Disco AI", genre: "Disco" },
  { id: "bX-XOGMbJKI", title: "AI Disco-Funk", artist: "Disco AI", genre: "Disco-Funk" },
  { id: "Z-TP3xFjyyI", title: "Soulful House", artist: "AI Session", genre: "Nu-Disco" },
];

const WEEKLY_COUNT = 10;

// Numer tygodnia (rośnie także między latami) — steruje cotygodniową rotacją.
const weekIndex = () => {
  const d = new Date();
  const oneJan = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - oneJan.getTime()) / 86400000);
  return d.getFullYear() * 53 + Math.floor((days + oneJan.getDay()) / 7);
};

// „Na czasie": JEDNA duża karta teledysku AI, przewijanie lewo/prawo,
// 10 najlepszych na tydzień (disco / techno / hip-hop), zmienia się co tydzień.
export const NaCzasieHits = () => {
  const { language } = useLanguage();
  const L = (pl: string, en: string, nl: string, ua: string) =>
    language === "en" ? en : language === "nl" ? nl : language === "ua" ? ua : pl;

  // Tygodniowy wybór 10 z puli (deterministyczny, więc zmienia się co tydzień).
  const clips = useMemo(() => {
    const start = (weekIndex() * WEEKLY_COUNT) % POOL.length;
    return Array.from({ length: Math.min(WEEKLY_COUNT, POOL.length) }, (_, i) => POOL[(start + i) % POOL.length]);
  }, []);

  const [[index, dir], setIndexDir] = useState<[number, number]>([0, 0]);
  const [playing, setPlaying] = useState(false);

  const total = clips.length;
  const safe = total ? ((index % total) + total) % total : 0;
  const clip = clips[safe];
  const go = (d: number) => {
    setPlaying(false);
    setIndexDir(([i]) => [i + d, d]);
  };

  if (total === 0) return null;

  const watchUrl = `https://www.youtube.com/watch?v=${clip.id}`;
  const thumb = `https://i.ytimg.com/vi/${clip.id}/hqdefault.jpg`;

  return (
    <section className="px-4 sm:px-6 max-w-6xl mx-auto mt-8 mb-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg sm:text-xl font-bold flex items-center gap-2">
          <span>🔥</span> {L("Na czasie", "Trending", "Trending", "У тренді")}
        </h3>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {safe + 1}/{total} · {L("Teledyski AI tygodnia", "AI videos of the week", "AI-clips van de week", "AI-кліпи тижня")}
        </span>
      </div>

      <div className="relative h-[300px] sm:h-[360px] select-none">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={clip.id}
            custom={dir}
            initial={{ opacity: 0, scale: 0.9, x: dir >= 0 ? 130 : -130, borderRadius: 44 }}
            animate={{ opacity: 1, scale: 1, x: 0, borderRadius: 24 }}
            exit={{ opacity: 0, scale: 0.8, x: dir >= 0 ? -130 : 130, borderRadius: 64 }}
            transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
            drag={playing ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={(_e, info) => {
              if (info.offset.x < -60) go(1);
              else if (info.offset.x > 60) go(-1);
            }}
            className="absolute inset-0 overflow-hidden border border-white/12 shadow-[0_24px_50px_-20px_rgba(0,0,0,0.85)] cursor-grab active:cursor-grabbing bg-black"
          >
            {playing ? (
              <iframe
                key={`yt-${clip.id}`}
                title={clip.title}
                src={`https://www.youtube-nocookie.com/embed/${clip.id}?autoplay=1&rel=0&playsinline=1&modestbranding=1`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
              />
            ) : (
              <>
                <img
                  src={thumb}
                  alt={clip.title}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/35" />

                <span className="absolute top-4 left-4 text-[11px] font-bold px-2.5 py-1 rounded-full bg-black/50 backdrop-blur text-white/85">
                  #{safe + 1}
                </span>
                <span className="absolute top-4 right-4 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/10 backdrop-blur border border-white/20 text-white/90">
                  {clip.genre}
                </span>

                <button
                  onClick={() => setPlaying(true)}
                  aria-label={L("Odtwórz", "Play", "Afspelen", "Відтворити")}
                  className="group absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-20 w-20 rounded-full text-white flex items-center justify-center shadow-[0_14px_34px_-8px_hsl(331_100%_62%/0.7)] hover:scale-110 active:scale-95 transition-transform"
                >
                  {/* fioletowa warstwa (domyślnie) */}
                  <span aria-hidden className="absolute inset-0 rounded-full groove-gradient-bg transition-opacity duration-150 group-active:opacity-0" />
                  {/* przezroczyste szkło (po wciśnięciu) */}
                  <span aria-hidden className="absolute inset-0 rounded-full bg-white/10 backdrop-blur-md border border-white/40 opacity-0 group-active:opacity-100 transition-opacity duration-150" />
                  <Play className="relative z-10 h-9 w-9 fill-current ml-1" />
                </button>

                <div className="absolute left-5 right-5 bottom-5 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-display text-2xl sm:text-3xl font-extrabold text-white drop-shadow truncate">
                      {clip.title}
                    </div>
                    <div className="text-sm text-white/80 mt-0.5 truncate">
                      {clip.artist} · {total} {L("teledysków", "videos", "clips", "кліпів")}
                    </div>
                  </div>
                  <a
                    href={watchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 inline-flex items-center gap-1 text-[11px] text-white/70 hover:text-white transition-colors"
                  >
                    YouTube <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {total > 1 && (
          <>
            <button
              onClick={() => go(-1)}
              aria-label="Poprzedni"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/45 backdrop-blur border border-white/15 text-white flex items-center justify-center hover:bg-black/65 transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => go(1)}
              aria-label="Następny"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/45 backdrop-blur border border-white/15 text-white flex items-center justify-center hover:bg-black/65 transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
    </section>
  );
};
