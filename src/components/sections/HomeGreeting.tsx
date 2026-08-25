import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Play, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { HQCover } from "@/components/ui/HQCover";
import { useLanguage } from "@/contexts/LanguageContext";

const SEL = "id,title,artist,album,duration,cover_url,audio_url,video_url,genre,mood";

// Górny pasek: animowany status GrouAI + chipsy gatunków.
// Po wybraniu gatunku pokazuje poziomą karuzelę utworów (szklane karty) —
// przewijasz w lewo/prawo i klikasz play, żeby odtworzyć od danego utworu.
export const HomeGreeting = () => {
  const navigate = useNavigate();
  const { playPlaylist } = usePlayer();
  const { language } = useLanguage();
  const L = (pl: string, en: string, nl: string, ua: string) =>
    language === "en" ? en : language === "nl" ? nl : language === "ua" ? ua : pl;

  // Animowany status AI
  const states = [
    L("SŁUCHAM CIEBIE", "LISTENING TO YOU", "LUISTERT NAAR JOU", "СЛУХАЮ ТЕБЕ"),
    L("ANALIZUJĘ", "ANALYZING", "ANALYSEERT", "АНАЛІЗУЮ"),
    L("DOSTRAJAM", "ADAPTING", "PAST AAN", "АДАПТУЮ"),
    L("TWÓJ NASTRÓJ", "YOUR MOOD", "JOUW STEMMING", "ТВІЙ НАСТРІЙ"),
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % states.length), 2600);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [states.length]);

  // Chipsy gatunków
  const forYou = L("Dla Ciebie", "For You", "Voor jou", "Для тебе");
  const chips = [forYou, "Pop", "Hip-Hop", "Rap", "Techno", "Rock", "Electronic", "Chill", "GROUA ERA"];
  const [active, setActive] = useState<string>(forYou);

  // Utwory wybranego gatunku
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);

  const onChip = (c: string) => {
    if (c === "GROUA ERA") { navigate("/era"); return; }
    setActive(c);
    if (c === forYou) { setTracks([]); return; }
    loadGenre(c);
  };

  // Mapowanie chipów na pokrewne nazwy gatunków w bazie (elastyczne dopasowanie).
  const GENRE_ALIASES: Record<string, string[]> = {
    "Pop": ["pop", "synth-pop", "dance-pop"],
    "Hip-Hop": ["hip-hop", "hip hop", "rap", "trap"],
    "Rap": ["rap", "hip-hop", "hip hop", "trap", "drill"],
    "Techno": ["techno", "electronic", "edm", "house", "dance", "trance"],
    "Rock": ["rock", "metal", "punk", "alternative", "indie"],
    "Electronic": ["electronic", "edm", "techno", "house", "dance", "synth", "trance"],
    "Chill": ["chill", "chillout", "lofi", "lo-fi", "ambient", "relax", "downtempo"],
  };

  const loadGenre = async (genre: string) => {
    setLoading(true);
    setTracks([]);
    try {
      const keywords = GENRE_ALIASES[genre] || [genre.toLowerCase()];
      const orFilter = keywords.map((k) => `genre.ilike.%${k}%`).join(",");
      const { data } = await supabase
        .from("tracks")
        .select(SEL)
        .or(orFilter)
        .not("audio_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(40);
      setTracks(Array.isArray(data) ? (data as unknown as Track[]) : []);
    } catch {
      setTracks([]);
    } finally {
      setLoading(false);
    }
  };

  const showPanel = active !== forYou;

  return (
    <section className="px-4 sm:px-6 pt-5 max-w-6xl mx-auto">
      {/* Animowany status GrouAI */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="inline-flex items-center gap-2.5 rounded-full pl-2.5 pr-4 py-1.5 border border-white/12 bg-white/[0.04] backdrop-blur-md"
        style={{ boxShadow: "0 0 30px -12px hsl(268 100% 66% / 0.5)" }}
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </span>
        <span className="text-[11px] font-bold tracking-[0.18em] text-muted-foreground">GROUAI</span>
        <span className="text-white/30">·</span>
        <motion.span
          key={idx}
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.35 }}
          className="text-[11px] font-bold tracking-[0.14em] whitespace-nowrap bg-gradient-to-r from-[hsl(331_100%_66%)] to-[hsl(268_100%_72%)] bg-clip-text text-transparent"
        >
          {states[idx]}
        </motion.span>
      </motion.div>

      {/* Chipsy gatunków */}
      <div className="flex gap-2 overflow-x-auto pb-1 mt-3" style={{ scrollbarWidth: "none" }}>
        {chips.map((c) => {
          const on = c === active;
          return (
            <motion.button
              key={c}
              whileTap={{ scale: 0.94 }}
              onClick={() => onChip(c)}
              className={
                "flex-none px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all " +
                (on
                  ? "text-white border border-transparent groove-gradient-bg shadow-[0_8px_20px_-8px_hsl(331_100%_62%/0.6)]"
                  : "text-muted-foreground border border-white/10 bg-white/[0.03] hover:border-primary/40 hover:text-white")
              }
            >
              {c}
            </motion.button>
          );
        })}
      </div>

      {/* Okno "Na czasie" dla gatunku — pozioma karuzela utworów */}
      {showPanel && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mt-4 rounded-2xl border border-white/12 bg-white/[0.04] backdrop-blur-xl p-3 sm:p-4
                     shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_0_40px_-16px_hsl(280_100%_66%/0.5)]"
        >
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="font-display text-sm font-bold flex items-center gap-2">
              <span>🔥</span> {L("Na czasie", "Trending", "Trending", "У тренді")} · {active}
            </h3>
            <span className="text-[11px] text-muted-foreground">
              {loading ? L("ładuję…", "loading…", "laden…", "завантаження…") : `${tracks.length} ${L("utworów", "tracks", "nummers", "треків")}`}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> {L("Ładuję utwory…", "Loading tracks…", "Nummers laden…", "Завантаження…")}
            </div>
          ) : tracks.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm text-center px-4">
              {L("Brak utworów w tym gatunku — spróbuj innego.", "No tracks in this genre — try another.", "Geen nummers in dit genre.", "Немає треків у цьому жанрі.")}
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none", scrollSnapType: "x mandatory" }}>
              {tracks.map((tk, i) => (
                <div key={tk.id || i} className="flex-none w-[150px]" style={{ scrollSnapAlign: "start" }}>
                  <div className="relative w-[150px] h-[150px] rounded-2xl overflow-hidden border border-white/12
                                  shadow-[0_14px_30px_-14px_rgba(0,0,0,0.8),inset_0_0_0_1px_hsl(315_100%_72%/0.14)] group">
                    <HQCover src={tk.cover_url} alt={tk.title} genre={tk.genre} artist={tk.artist} className="w-full h-full transition-transform duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <button
                      onClick={() => playPlaylist(tracks, i, `genre:${active}`)}
                      aria-label={L("Odtwórz", "Play", "Afspelen", "Відтворити")}
                      className="absolute bottom-2 right-2 h-11 w-11 rounded-full groove-gradient-bg text-white
                                 flex items-center justify-center shadow-[0_8px_20px_-6px_hsl(331_100%_62%/0.7)]
                                 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all"
                    >
                      <Play className="h-5 w-5 fill-current ml-0.5" />
                    </button>
                  </div>
                  <div className="mt-2 px-0.5">
                    <div className="font-semibold text-[13px] truncate">{tk.title}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{tk.artist}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </section>
  );
};
