import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Play, Sparkles, Clock, ArrowLeft, Wand2, Radio } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { HQCover } from "@/components/ui/HQCover";
import {
  ERAS, getEra, matchEra, isAiTrack, eraStudioLink, ERA_MATCH_THRESHOLD, type Era,
} from "@/lib/eraEngine";

interface DbTrack {
  id: string; title: string; artist: string; album: string | null;
  duration: number | null; cover_url: string | null; audio_url: string | null;
  video_url: string | null; genre: string | null; mood: string | null; bpm: number | null;
}

const TRACK_SELECT = "id,title,artist,album,duration,cover_url,audio_url,video_url,genre,mood,bpm";

const fmt = (s: number | null) => {
  const v = Math.max(0, Math.round(s || 0));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
};

const toPlayerTrack = (t: DbTrack): Track => ({
  id: t.id, title: t.title, artist: t.artist, album: t.album,
  duration: t.duration || 0, audio_url: t.audio_url, video_url: t.video_url,
  cover_url: t.cover_url, genre: t.genre, mood: t.mood,
});

/* ── Wspólny pasek osi czasu ── */
const TimelineStrip = ({ activeKey }: { activeKey?: string }) => (
  <div className="flex rounded-xl overflow-hidden border border-white/10 font-mono text-[11px]">
    {ERAS.map((e) => (
      <Link
        key={e.key}
        to={`/era/${e.key}`}
        className="flex-1 min-w-0 text-center py-2 px-1 border-r border-white/10 last:border-r-0 transition-colors"
        style={{
          background: e.key === activeKey ? e.palette.accentSoft : "transparent",
          color: e.key === activeKey ? e.palette.accent : "rgba(255,255,255,.5)",
          fontWeight: e.key === activeKey ? 600 : 400,
        }}
      >
        <span className="block truncate">{e.label}</span>
      </Link>
    ))}
  </div>
);

/* ══════════════ HUB: /era ══════════════ */
const EraHub = () => {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <span className="font-mono text-xs tracking-[.2em] uppercase text-[#FF8A2A]">Groua Era · Nostalgia Engine</span>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white">Wejdź w epokę</h1>
        <p className="text-gray-400 max-w-xl mx-auto">
          Nie „odtwórz następny utwór". Wybierz czas, do którego chcesz wejść — a muzyka zabierze Cię w podróż.
        </p>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {ERAS.map((e, i) => (
          <motion.div
            key={e.key}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Link
              to={`/era/${e.key}`}
              className="group block rounded-2xl border p-5 h-full transition-transform hover:-translate-y-1"
              style={{
                background: `linear-gradient(160deg, ${e.palette.accentSoft}, ${e.palette.bg})`,
                borderColor: `${e.palette.accent}40`,
                boxShadow: `0 0 30px ${e.palette.glow}`,
              }}
            >
              <div className="text-3xl mb-3">{e.emoji}</div>
              <div className="font-extrabold text-2xl text-white leading-none" style={{ letterSpacing: "-.02em" }}>{e.label}</div>
              <div className="mt-1 text-sm font-medium" style={{ color: e.palette.accent }}>{e.tagline}</div>
              <div className="mt-2 font-mono text-[10px] tracking-wide text-white/40">
                {e.yearStart}–{e.yearEnd === 2100 ? "…" : e.yearEnd}
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      <p className="text-center text-xs text-gray-600">
        „Nie żyłeś w 1987? Nie szkodzi — możesz go odkryć." Każda epoka to <span className="text-gray-400">Współcześni twórcy</span> + <span className="text-gray-400">AI ERA</span>.
      </p>
    </div>
  );
};

/* ══════════════ SZCZEGÓŁ: /era/:key ══════════════ */
const EraDetail = ({ era }: { era: Era }) => {
  const navigate = useNavigate();
  const { playPlaylist } = usePlayer();
  const [rows, setRows] = useState<DbTrack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    supabase
      .from("tracks")
      .select(TRACK_SELECT)
      .or("audio_url.not.is.null,video_url.not.is.null")
      .limit(600)
      .then(({ data }) => {
        if (!alive) return;
        setRows((data as DbTrack[]) || []);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [era.key]);

  const { nowTracks, aiTracks } = useMemo(() => {
    const scored = rows
      .map((t) => ({ t, s: matchEra(t, era) }))
      .filter((x) => x.s >= ERA_MATCH_THRESHOLD)
      .sort((a, b) => b.s - a.s);
    const now: DbTrack[] = [];
    const ai: DbTrack[] = [];
    for (const { t } of scored) (isAiTrack(t) ? ai : now).push(t);
    return { nowTracks: now.slice(0, 40), aiTracks: ai.slice(0, 20) };
  }, [rows, era]);

  const playAll = (list: DbTrack[]) => {
    if (!list.length) return;
    playPlaylist(list.map(toPlayerTrack), 0, `era:${era.key}`);
  };

  const Section = ({ title, sub, icon, list, empty }: {
    title: string; sub: string; icon: React.ReactNode; list: DbTrack[]; empty: React.ReactNode;
  }) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">{icon}{title}</h2>
          <p className="text-xs text-gray-500">{sub}</p>
        </div>
        {list.length > 0 && (
          <button
            onClick={() => playAll(list)}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-black transition-transform hover:scale-105"
            style={{ background: era.palette.accent, boxShadow: `0 0 18px ${era.palette.glow}` }}
          >
            <Play className="h-4 w-4 fill-black" /> Odtwórz
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[.02] p-6 text-sm text-gray-500">{empty}</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {list.map((t, i) => (
            <button
              key={t.id}
              onClick={() => playPlaylist(list.map(toPlayerTrack), i, `era:${era.key}`)}
              className="group text-left rounded-xl border border-white/10 bg-white/[.03] p-2.5 hover:bg-white/[.06] transition-colors"
            >
              <div className="relative aspect-square rounded-lg overflow-hidden mb-2">
                <HQCover src={t.cover_url} alt={t.title} genre={t.genre} artist={t.artist} videoUrl={t.video_url} className="w-full h-full" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(0,0,0,.35)" }}>
                  <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ background: era.palette.accent }}>
                    <Play className="h-5 w-5 text-black fill-black" />
                  </div>
                </div>
              </div>
              <div className="text-sm font-medium text-white truncate">{t.title}</div>
              <div className="text-xs text-gray-500 truncate">{t.artist}</div>
              <div className="mt-1 font-mono text-[10px] text-gray-600 flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" /> {fmt(t.duration)}{t.genre ? ` · ${t.genre}` : ""}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ background: `linear-gradient(180deg, ${era.palette.bg}, #0B0A0E 60%)` }}>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Nawigacja + oś czasu */}
        <div className="space-y-4">
          <button onClick={() => navigate("/era")} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Wszystkie epoki
          </button>
          <TimelineStrip activeKey={era.key} />
        </div>

        {/* Nagłówek epoki */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border p-6 sm:p-8 relative overflow-hidden"
          style={{ background: `linear-gradient(150deg, ${era.palette.accentSoft}, ${era.palette.bg})`, borderColor: `${era.palette.accent}40`, boxShadow: `0 0 40px ${era.palette.glow}` }}
        >
          <div className="text-5xl mb-3">{era.emoji}</div>
          <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight" style={{ letterSpacing: "-.03em" }}>
            GROUA ERA <span style={{ color: era.palette.accent }}>{era.label}</span>
          </h1>
          <p className="mt-2 text-lg" style={{ color: era.palette.accent }}>{era.tagline}</p>
          <p className="mt-3 text-gray-300 max-w-2xl">{era.vibe}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {era.genres.slice(0, 6).map((g) => (
              <span key={g} className="font-mono text-[11px] px-3 py-1 rounded-full border" style={{ borderColor: `${era.palette.accent}40`, color: era.palette.accent, background: "rgba(0,0,0,.2)" }}>{g}</span>
            ))}
          </div>
        </motion.div>

        {/* NOW — współcześni twórcy w klimacie epoki */}
        <Section
          title="Brzmi jak ta epoka"
          sub="Współcześni twórcy trzymający ten sound — z żywego katalogu GrouAI"
          icon={<Radio className="h-5 w-5" style={{ color: era.palette.accent }} />}
          list={nowTracks}
          empty={loading ? "Wczytuję katalog…" : "Brak dopasowań w katalogu — spróbuj sąsiedniej epoki lub stwórz to brzmienie w AI poniżej."}
        />

        {/* AI ERA */}
        <div className="rounded-2xl border p-5 sm:p-6 space-y-4" style={{ borderColor: `${era.palette.accent}30`, background: "rgba(255,255,255,.02)" }}>
          <Section
            title="AI ERA"
            sub="Nowa muzyka AI w charakterze epoki — nie kopia, styl epoki nie osoby"
            icon={<Sparkles className="h-5 w-5" style={{ color: era.palette.accent }} />}
            list={aiTracks}
            empty={loading ? "Wczytuję…" : "Jeszcze nikt nie stworzył tej epoki w AI. Bądź pierwszy 👇"}
          />
          <Link
            to={eraStudioLink(era)}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-black transition-transform hover:scale-[1.01]"
            style={{ background: era.palette.accent, boxShadow: `0 0 20px ${era.palette.glow}` }}
          >
            <Wand2 className="h-5 w-5" /> Stwórz ten rok w AI — „tak brzmiałby, gdyby istniało AI"
          </Link>
        </div>
      </div>
    </div>
  );
};

const EraPage = () => {
  const { key } = useParams();
  const era = getEra(key);
  return (
    <MainLayout>
      {era ? <EraDetail era={era} /> : <EraHub />}
    </MainLayout>
  );
};

export default EraPage;
