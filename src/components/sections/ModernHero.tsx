import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Play, Radio, Sparkles, Zap, TrendingUp, Music2, Users, Headphones, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "@/contexts/PlayerContext";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/withTimeout";
import { AuroraBackground } from "@/components/effects/AuroraBackground";
import { toast } from "sonner";

type MiniTrack = { id: string; title: string; artist: string; cover_url: string | null; genre?: string | null };

const MOODS = [
  { label: "Chill", emoji: "🌊" },
  { label: "Energia", emoji: "⚡" },
  { label: "Focus", emoji: "🎯" },
  { label: "Impreza", emoji: "🎉" },
  { label: "Sen", emoji: "🌙" },
];

const GENRE_GRADIENTS = [
  "from-orange-500 to-rose-600",
  "from-amber-500 to-orange-600",
  "from-fuchsia-500 to-orange-500",
  "from-cyan-500 to-blue-600",
  "from-emerald-500 to-teal-600",
];

export const ModernHero = () => {
  const navigate = useNavigate();
  const { playPlaylist } = usePlayer();
  const [loading, setLoading] = useState(false);
  const [tracks, setTracks] = useState<MiniTrack[]>([]);
  const [stats, setStats] = useState<{ tracks: number | null; artists: number | null }>({ tracks: null, artists: null });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await withTimeout(
          supabase
            .from("tracks")
            .select("id,title,artist,cover_url,genre")
            .not("audio_url", "is", null)
            .order("created_at", { ascending: false })
            .limit(6),
          8000,
          "Hero tracks",
        );
        if (alive && data) setTracks(data as MiniTrack[]);
      } catch { /* backend cichy — pokaż fallback */ }
      try {
        const { count } = await withTimeout(
          supabase.from("tracks").select("id", { count: "exact", head: true }),
          8000,
          "Hero count",
        );
        if (alive) setStats((s) => ({ ...s, tracks: count ?? null }));
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, []);

  const startListening = async () => {
    setLoading(true);
    try {
      const { data } = await withTimeout(
        supabase
          .from("tracks")
          .select("id,title,artist,album,cover_url,audio_url,video_url,duration,genre,mood")
          .not("audio_url", "is", null)
          .order("created_at", { ascending: false })
          .limit(20),
        12000,
        "Start listening",
      );
      if (data && data.length) {
        playPlaylist([...data].sort(() => Math.random() - 0.5) as any);
        toast.success("▶️ Odtwarzam dla Ciebie");
      } else {
        toast.info("Brak utworów do odtworzenia");
      }
    } catch {
      toast.error("Nie udało się załadować muzyki (backend może spać)");
    } finally {
      setLoading(false);
    }
  };

  const featured = tracks[0];

  return (
    <section className="relative overflow-hidden rounded-b-3xl">
      {/* Tło */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 opacity-50 mix-blend-screen"><AuroraBackground /></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(24_100%_55%/0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(38_100%_50%/0.14),transparent_55%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
      </div>

      <div className="relative px-6 md:px-10 py-14 md:py-20">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-10 items-center max-w-7xl mx-auto">
          {/* LEWA — hero */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full border border-orange-400/40 bg-orange-500/10 backdrop-blur px-4 py-1.5 text-xs font-medium text-orange-300 mb-6"
            >
              <Sparkles className="h-3.5 w-3.5" /> Platforma muzyczna nowej generacji · AI
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="font-display text-5xl md:text-7xl font-extrabold leading-[1.02] tracking-tight"
            >
              <span className="block text-foreground">Muzyka, która</span>
              <span className="block bg-gradient-to-br from-orange-300 via-orange-400 to-amber-500 bg-clip-text text-transparent">
                naprawdę Cię czuje.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="mt-5 text-lg text-muted-foreground max-w-xl leading-relaxed"
            >
              Streaming z AI, który dobiera dźwięk do Twojego nastroju. Prawdziwe odsłuchy,
              uczciwe zarobki dla artystów, radio 24/7 i własne Studio.
            </motion.p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                size="lg"
                onClick={startListening}
                disabled={loading}
                className="groove-gradient-bg text-primary-foreground hover:opacity-90 gap-2 rounded-full px-8 h-14 font-semibold text-base shadow-[0_8px_30px_hsl(24_100%_50%/0.45)]"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5 fill-current" />}
                Słuchaj teraz
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/radio-live")}
                className="gap-2 rounded-full px-6 h-14 font-semibold text-base border-orange-400/40 hover:bg-orange-500/10"
              >
                <Radio className="h-5 w-5 text-orange-400" /> Radio na żywo
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap gap-2.5">
              {[
                { icon: Zap, label: "Prawdziwe odsłuchy" },
                { icon: Sparkles, label: "AI nastroju" },
                { icon: Users, label: "Uczciwe zarobki" },
              ].map((c) => (
                <span key={c.label} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/50 backdrop-blur px-3.5 py-1.5 text-xs text-muted-foreground">
                  <c.icon className="h-3.5 w-3.5 text-orange-400" /> {c.label}
                </span>
              ))}
            </div>
          </div>

          {/* PRAWA — control deck (szkło) */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="relative"
          >
            <div className="absolute -inset-[2px] rounded-3xl bg-gradient-to-br from-orange-400/40 via-amber-500/25 to-orange-600/40 opacity-60 blur-xl" />
            <div className="relative rounded-3xl border border-orange-400/25 bg-card/60 backdrop-blur-2xl p-5 shadow-[0_10px_50px_hsl(24_100%_45%/0.25),inset_0_1px_0_hsl(44_100%_82%/0.2)]">
              {/* Teraz gra / featured */}
              <div className="flex items-center gap-4 rounded-2xl bg-background/40 border border-border/60 p-3">
                <div className={`relative h-16 w-16 flex-shrink-0 rounded-xl overflow-hidden bg-gradient-to-br ${GENRE_GRADIENTS[0]}`}>
                  {featured?.cover_url && <img src={featured.cover_url} alt="" className="h-full w-full object-cover" />}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="flex gap-0.5 items-end h-6">
                      {[0,1,2,3,4].map((i) => (
                        <motion.span
                          key={i}
                          className="w-1 rounded-full bg-white/90"
                          animate={{ height: ["30%","90%","45%","100%","35%"] }}
                          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
                          style={{ height: "40%" }}
                        />
                      ))}
                    </span>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wider text-orange-300/80 font-semibold">Teraz na serwerze</p>
                  <p className="font-semibold truncate">{featured?.title ?? "Odkryj nowości"}</p>
                  <p className="text-sm text-muted-foreground truncate">{featured?.artist ?? "AI + artyści GrouAI"}</p>
                </div>
                <button onClick={startListening} className="h-10 w-10 flex-shrink-0 grid place-items-center rounded-full groove-gradient-bg text-primary-foreground shadow-lg">
                  <Play className="h-4 w-4 fill-current" />
                </button>
              </div>

              {/* Statystyki */}
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  { icon: Music2, label: "Utwory", value: stats.tracks != null ? String(stats.tracks) : "—" },
                  { icon: Radio, label: "Na żywo", value: "24/7" },
                  { icon: Headphones, label: "Bez botów", value: "100%" },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl bg-background/40 border border-border/60 p-3 text-center">
                    <s.icon className="h-4 w-4 mx-auto text-orange-400 mb-1" />
                    <p className="text-lg font-bold leading-none">{s.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Nastroje */}
              <div className="mt-4">
                <p className="text-xs text-muted-foreground mb-2">Zagraj wg nastroju</p>
                <div className="flex flex-wrap gap-2">
                  {MOODS.map((m) => (
                    <button
                      key={m.label}
                      onClick={() => navigate("/create-playlist")}
                      className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-background/40 px-3 py-1.5 text-sm hover:border-orange-400/60 hover:bg-orange-500/10 transition-all"
                    >
                      <span>{m.emoji}</span>
                      <span className="group-hover:text-orange-200">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mini kafelki nowości */}
              <div className="mt-4 grid grid-cols-5 gap-2">
                {(tracks.slice(1, 6).length ? tracks.slice(1, 6) : Array.from({ length: 5 })).map((tk: any, i: number) => (
                  <motion.button
                    key={tk?.id ?? i}
                    onClick={startListening}
                    whileHover={{ y: -3 }}
                    className={`aspect-square rounded-lg overflow-hidden bg-gradient-to-br ${GENRE_GRADIENTS[i % GENRE_GRADIENTS.length]} relative`}
                  >
                    {tk?.cover_url && <img src={tk.cover_url} alt="" className="h-full w-full object-cover" />}
                    <span className="absolute inset-0 bg-black/10 group-hover:bg-black/0" />
                  </motion.button>
                ))}
              </div>

              <button
                onClick={() => navigate("/library")}
                className="mt-4 w-full inline-flex items-center justify-center gap-1.5 text-sm text-orange-300 hover:text-orange-200 transition-colors"
              >
                Przeglądaj całą bibliotekę <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            {/* Dryfujące okładki w tle */}
            <motion.div
              className="absolute -right-6 -top-8 h-20 w-20 rounded-2xl bg-gradient-to-br from-orange-500 to-rose-600 shadow-xl hidden xl:block"
              animate={{ y: [0, -12, 0], rotate: [0, 4, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute -left-8 bottom-6 h-16 w-16 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 shadow-xl hidden xl:block"
              animate={{ y: [0, 10, 0], rotate: [0, -5, 0] }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
};
