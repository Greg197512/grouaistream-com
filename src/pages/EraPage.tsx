import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Play, Sparkles, Clock, ArrowLeft, Wand2, Radio, Shuffle, Compass, Loader2, RefreshCw } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { HQCover } from "@/components/ui/HQCover";
import {
  ERAS, getEra, isAiTrack, eraStudioLink, trackBelongsToEra, bestEra, eraArtUrl,
  eraYears, eraDefaultYear, trackYear, eraSpotifyPlaylist, type Era,
} from "@/lib/eraEngine";
import { eraTextFor, eraUi } from "@/lib/eraContent";
import { freshEraFact } from "@/lib/aiText";
import type { Language } from "@/i18n/translations";

interface DbTrack {
  id: string; title: string; artist: string; album: string | null;
  duration: number | null; cover_url: string | null; audio_url: string | null;
  video_url: string | null; genre: string | null; mood: string | null; bpm: number | null;
  created_at: string | null;
}

const TRACK_SELECT = "id,title,artist,album,duration,cover_url,audio_url,video_url,genre,mood,bpm,created_at";

// Rok utworu: najpierw z tytułu/albumu (np. "GROUA ERA 2025"), a w razie braku —
// z daty dodania. Dzięki temu świeże uploady trafiają pod rok, w którym powstały.
function effectiveYear(t: DbTrack): number | undefined {
  const ty = trackYear(t);
  if (ty) return ty;
  if (t.created_at) {
    const y = new Date(t.created_at).getFullYear();
    if (y >= 1970 && y <= 2099) return y;
  }
  return undefined;
}

const fmt = (s: number | null) => {
  const v = Math.max(0, Math.round(s || 0));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
};

const toPlayerTrack = (t: DbTrack): Track => ({
  id: t.id, title: t.title, artist: t.artist, album: t.album,
  duration: t.duration || 0, audio_url: t.audio_url, video_url: t.video_url,
  cover_url: t.cover_url, genre: t.genre, mood: t.mood,
});

// Cache katalogu w pamięci sesji — jedno pobranie na całą podróż po epokach.
let CATALOG: DbTrack[] | null = null;
async function loadCatalog(): Promise<DbTrack[]> {
  if (CATALOG) return CATALOG;
  const { data } = await supabase
    .from("tracks").select(TRACK_SELECT)
    .or("audio_url.not.is.null,video_url.not.is.null").limit(800);
  CATALOG = (data as DbTrack[]) || [];
  return CATALOG;
}

/* ── Oś czasu ── */
const TimelineStrip = ({ activeKey, lang }: { activeKey?: string; lang: Language }) => (
  <div className="flex rounded-xl overflow-hidden border border-white/10 font-mono text-[11px]">
    {ERAS.map((e) => (
      <Link key={e.key} to={`/era/${e.key}`}
        className="flex-1 min-w-0 text-center py-2 px-1 border-r border-white/10 last:border-r-0 transition-colors"
        style={{
          background: e.key === activeKey ? e.palette.accentSoft : "transparent",
          color: e.key === activeKey ? e.palette.accent : "rgba(255,255,255,.5)",
          fontWeight: e.key === activeKey ? 600 : 400,
        }}>
        <span className="block truncate">{eraTextFor(e, lang).label}</span>
      </Link>
    ))}
  </div>
);

/* ── Szkielet ładowania ── */
const CardSkeleton = () => (
  <div className="rounded-xl border border-white/10 bg-white/[.03] p-2.5">
    <div className="aspect-square rounded-lg mb-2 bg-white/[.05] animate-pulse" />
    <div className="h-3 w-3/4 rounded bg-white/[.05] animate-pulse mb-1.5" />
    <div className="h-2.5 w-1/2 rounded bg-white/[.04] animate-pulse" />
  </div>
);

/* ══════════════ Nostalgia DNA ══════════════ */
const NostalgiaDna = ({ lang }: { lang: Language }) => {
  const { user } = useAuth();
  const [dna, setDna] = useState<{ era: Era; pct: number }[] | null>(null);

  useEffect(() => {
    if (!user) { setDna(null); return; }
    let alive = true;
    (async () => {
      const { data: hist } = await supabase
        .from("listening_history").select("track_id")
        .eq("user_id", user.id).order("played_at", { ascending: false }).limit(400);
      if (!alive) return;
      const rows = (hist as { track_id: string }[]) || [];
      if (!rows.length) { setDna(null); return; }
      const counts = new Map<string, number>();
      for (const r of rows) counts.set(r.track_id, (counts.get(r.track_id) || 0) + 1);
      const ids = [...counts.keys()];
      const { data: tr } = await supabase.from("tracks").select("id,genre,mood,bpm").in("id", ids);
      if (!alive) return;
      const meta = new Map((tr as DbTrack[] || []).map((t) => [t.id, t]));
      const tally = new Map<string, number>();
      let total = 0;
      for (const [tid, c] of counts) {
        const m = meta.get(tid);
        if (!m) continue;
        const e = bestEra(m);
        if (!e) continue;
        tally.set(e.key, (tally.get(e.key) || 0) + c);
        total += c;
      }
      if (!total) { setDna(null); return; }
      const ranked = [...tally.entries()]
        .map(([k, v]) => ({ era: getEra(k)!, pct: Math.round((v / total) * 100) }))
        .filter((x) => x.era).sort((a, b) => b.pct - a.pct).slice(0, 4);
      setDna(ranked.length ? ranked : null);
    })();
    return () => { alive = false; };
  }, [user]);

  if (!dna) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/10 p-5 sm:p-6"
      style={{ background: "linear-gradient(150deg, rgba(255,138,42,.08), rgba(169,139,255,.06) 70%, transparent)" }}>
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="h-4 w-4 text-[#FF8A2A]" />
        <h3 className="font-bold text-white">{eraUi(lang, "dnaTitle")}</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">{eraUi(lang, "dnaSub")}</p>
      <div className="space-y-2.5">
        {dna.map(({ era, pct }) => {
          const et = eraTextFor(era, lang);
          return (
            <Link key={era.key} to={`/era/${era.key}`} className="block group">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-white group-hover:underline">{era.emoji} {et.label} <span className="text-gray-500">· {et.tagline}</span></span>
                <span className="font-mono" style={{ color: era.palette.accent }}>{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/[.06] overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: "easeOut" }}
                  className="h-full rounded-full" style={{ background: era.palette.accent, boxShadow: `0 0 10px ${era.palette.glow}` }} />
              </div>
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
};

/* ══════════════ HUB: /era ══════════════ */
const EraHub = ({ lang }: { lang: Language }) => {
  const { playPlaylist } = usePlayer();
  const [journeyLoading, setJourneyLoading] = useState(false);

  const startJourney = useCallback(async () => {
    setJourneyLoading(true);
    try {
      const cat = await loadCatalog();
      const journey: DbTrack[] = [];
      for (const era of ERAS) {
        const picks = cat
          .map((t) => ({ t, s: trackBelongsToEra(t, era.key) }))
          .filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 3).map((x) => x.t);
        journey.push(...picks);
      }
      if (journey.length) playPlaylist(journey.map(toPlayerTrack), 0, "era:journey");
    } finally {
      setJourneyLoading(false);
    }
  }, [playPlaylist]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-9">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4">
        <span className="font-mono text-xs tracking-[.2em] uppercase text-[#FF8A2A]">{eraUi(lang, "brand")}</span>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white">{eraUi(lang, "enterTitle")}</h1>
        <p className="text-gray-400 max-w-xl mx-auto">{eraUi(lang, "hubSubtitle")}</p>
        <button onClick={startJourney} disabled={journeyLoading}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-black transition-transform hover:scale-105 disabled:opacity-60"
          style={{ background: "linear-gradient(135deg,#FF8A2A,#A98BFF)", boxShadow: "0 0 22px rgba(255,138,42,.35)" }}>
          {journeyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Compass className="h-4 w-4" />}
          {eraUi(lang, "journey")}
        </button>
      </motion.div>

      <NostalgiaDna lang={lang} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {ERAS.map((e, i) => {
          const et = eraTextFor(e, lang);
          return (
            <motion.div key={e.key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Link to={`/era/${e.key}`}
                className="group relative flex flex-col justify-end overflow-hidden rounded-2xl border h-56 transition-transform hover:-translate-y-1"
                style={{ borderColor: `${e.palette.accent}55`, boxShadow: `0 0 30px ${e.palette.glow}` }}>
                <img src={eraArtUrl(e, 480, 560)} alt="" loading="lazy" decoding="async"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  onError={(ev) => { (ev.currentTarget as HTMLImageElement).style.display = "none"; }} />
                <div className="absolute inset-0 -z-10" style={{ background: `linear-gradient(160deg, ${e.palette.accentSoft}, ${e.palette.bg})` }} />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,.9) 0%, rgba(0,0,0,.4) 50%, rgba(0,0,0,.1) 100%)" }} />
                <div className="relative z-10 p-5">
                  <div className="text-3xl mb-2 drop-shadow-lg">{e.emoji}</div>
                  <div className="font-extrabold text-2xl text-white leading-none drop-shadow-lg" style={{ letterSpacing: "-.02em" }}>{et.label}</div>
                  <div className="mt-1 text-sm font-semibold drop-shadow-lg" style={{ color: e.palette.accent }}>{et.tagline}</div>
                  <div className="mt-2 font-mono text-[10px] tracking-wide text-white/60">{e.yearStart}–{e.yearEnd === 2100 ? "…" : e.yearEnd}</div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      <p className="text-center text-xs text-gray-600">{eraUi(lang, "hubFooter")}</p>
    </div>
  );
};

/* ══════════════ SZCZEGÓŁ: /era/:key ══════════════ */
const EraDetail = ({ era, lang }: { era: Era; lang: Language }) => {
  const navigate = useNavigate();
  const { playPlaylist } = usePlayer();
  const et = useMemo(() => eraTextFor(era, lang), [era, lang]);
  const years = useMemo(() => eraYears(era), [era]);
  const [year, setYear] = useState<number | undefined>(() => eraDefaultYear(era));
  const [rows, setRows] = useState<DbTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [fact, setFact] = useState<string | null>(null);
  const [factLoading, setFactLoading] = useState(false);

  // Reset wybranego roku przy zmianie epoki.
  useEffect(() => { setYear(eraDefaultYear(era)); }, [era.key]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadCatalog().then((data) => { if (!alive) return; setRows(data); setLoading(false); });
    return () => { alive = false; };
  }, [era.key]);

  const factKey = `era-fact-${era.key}-${year ?? "all"}-${lang}`;
  const loadFact = useCallback(async (fresh: boolean) => {
    setFactLoading(true);
    const f = await freshEraFact(et.label, et.vibe, fresh ? Math.floor(Math.random() * 1e6) : undefined, lang, year);
    setFact(f);
    if (f) { try { sessionStorage.setItem(factKey, f); } catch { /* */ } }
    setFactLoading(false);
  }, [factKey, lang, year, et.label, et.vibe]);

  useEffect(() => {
    let cached: string | null = null;
    try { cached = sessionStorage.getItem(factKey); } catch { /* */ }
    if (cached) { setFact(cached); return; }
    setFact(null);
    loadFact(false);
  }, [factKey, loadFact]);

  const { nowTracks, aiTracks } = useMemo(() => {
    const ELECTRONIC = new Set([
      "electronic", "techno", "house", "trance", "edm", "trap", "dance",
      "eurodance", "hardstyle", "dnb", "drum and bass", "idm", "hard techno", "hardcore",
    ]);
    const isEl = (t: DbTrack) => ELECTRONIC.has((t.genre || "").toLowerCase().trim());

    // Kandydaci: NOW = cały żywy katalog (elektronika/techno na przód);
    // pozostałe epoki = dopasowanie po brzmieniu.
    let candidates: DbTrack[];
    if (era.key === "now") {
      candidates = [...rows].sort((a, b) => (isEl(b) ? 1 : 0) - (isEl(a) ? 1 : 0));
    } else {
      candidates = rows.map((t) => ({ t, s: trackBelongsToEra(t, era.key) }))
        .filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.t);
    }

    // Wybrany rok: utwory z tego roku (rok w tytule/albumie LUB data dodania)
    // idą na sam przód — świeże uploady lądują pod właściwym rokiem.
    if (year) {
      const exact = rows.filter((t) => effectiveYear(t) === year);
      const seen = new Set(exact.map((t) => t.id));
      candidates = [...exact, ...candidates.filter((t) => !seen.has(t.id))];
    }

    const now: DbTrack[] = [];
    const ai: DbTrack[] = [];
    const seen = new Set<string>();
    for (const t of candidates) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      (isAiTrack(t) ? ai : now).push(t);
    }
    return { nowTracks: now.slice(0, 60), aiTracks: ai.slice(0, 30) };
  }, [rows, era, year]);

  const shuffle = (list: DbTrack[]) => {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };

  const Grid = ({ list }: { list: DbTrack[] }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {list.map((t, i) => (
        <button key={t.id} onClick={() => playPlaylist(list.map(toPlayerTrack), i, `era:${era.key}`)}
          className="group text-left rounded-xl border border-white/10 bg-white/[.03] p-2.5 hover:bg-white/[.06] transition-colors">
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
  );

  const SectionHead = ({ title, sub, icon, list }: { title: string; sub: string; icon: React.ReactNode; list: DbTrack[] }) => (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">{icon}{title}</h2>
        <p className="text-xs text-gray-500">{sub}</p>
      </div>
      {list.length > 0 && (
        <div className="flex gap-2">
          <button onClick={() => playPlaylist(list.map(toPlayerTrack), 0, `era:${era.key}`)}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-black transition-transform hover:scale-105"
            style={{ background: era.palette.accent, boxShadow: `0 0 18px ${era.palette.glow}` }}>
            <Play className="h-4 w-4 fill-black" /> {eraUi(lang, "play")}
          </button>
          <button onClick={() => playPlaylist(shuffle(list).map(toPlayerTrack), 0, `era:${era.key}`)}
            title={eraUi(lang, "shuffle")} className="flex items-center justify-center h-9 w-9 rounded-full border border-white/15 text-white hover:bg-white/10">
            <Shuffle className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ background: `linear-gradient(180deg, ${era.palette.bg}, #0B0A0E 60%)` }}>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div className="space-y-4">
          <button onClick={() => navigate("/era")} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> {eraUi(lang, "back")}
          </button>
          <TimelineStrip activeKey={era.key} lang={lang} />
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border p-6 sm:p-8 relative overflow-hidden min-h-[240px] flex flex-col justify-end"
          style={{ background: `linear-gradient(150deg, ${era.palette.accentSoft}, ${era.palette.bg})`, borderColor: `${era.palette.accent}40`, boxShadow: `0 0 40px ${era.palette.glow}` }}>
          {/* Grafika AI epoki/roku jako atmosferyczne tło */}
          <img key={year ?? "era"} src={eraArtUrl(era, 1200, 480, year)} alt="" loading="lazy" decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
            onError={(ev) => { (ev.currentTarget as HTMLImageElement).style.display = "none"; }} />
          <div className="absolute inset-0" style={{ background: `linear-gradient(120deg, ${era.palette.bg}F2 0%, ${era.palette.bg}CC 40%, rgba(0,0,0,.45) 100%)` }} />
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "repeating-linear-gradient(0deg, #fff 0, #fff 1px, transparent 2px, transparent 4px)" }} />
          <div className="relative">
            <div className="text-5xl mb-3">{era.emoji}</div>
            <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight" style={{ letterSpacing: "-.03em" }}>
              GROUA ERA <span style={{ color: era.palette.accent }}>{year ?? et.label}</span>
            </h1>
            <p className="mt-2 text-lg" style={{ color: era.palette.accent }}>
              {year ? <span className="text-white/60 font-normal text-base mr-2">{et.label} ·</span> : null}{et.tagline}
            </p>
            <p className="mt-3 text-gray-300 max-w-2xl">{et.vibe}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {era.genres.slice(0, 6).map((g) => (
                <span key={g} className="font-mono text-[11px] px-3 py-1 rounded-full border" style={{ borderColor: `${era.palette.accent}40`, color: era.palette.accent, background: "rgba(0,0,0,.2)" }}>{g}</span>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Wybór konkretnego roku — grafika i ciekawostka dobierają się pod rok */}
        {years.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {years.map((y) => (
              <button key={y} onClick={() => setYear(y)}
                className="shrink-0 px-3.5 py-2 rounded-xl font-mono text-sm font-semibold border transition-colors"
                style={year === y
                  ? { background: era.palette.accent, color: "#000", borderColor: era.palette.accent, boxShadow: `0 0 14px ${era.palette.glow}` }
                  : { background: "rgba(255,255,255,.03)", color: "rgba(255,255,255,.7)", borderColor: "rgba(255,255,255,.12)" }}>
                {y}
              </button>
            ))}
          </div>
        )}

        {/* POSŁUCHAJ DEKADY NA SPOTIFY — wbudowany odtwarzacz + pełny odsłuch */}
        {(() => {
          const pid = eraSpotifyPlaylist(era);
          if (!pid) return null;
          const t = {
            title: { pl: "Posłuchaj epoki na Spotify", en: "Listen to this era on Spotify", nl: "Luister naar dit tijdperk op Spotify", ua: "Слухай епоху на Spotify" }[lang] || "Listen to this era on Spotify",
            sub: { pl: `Największe hity dekady ${era.decade} — okładki, wykonawcy i pełne albumy.`, en: `The biggest hits of the ${era.decade} — covers, artists and full albums.`, nl: `De grootste hits van de ${era.decade} — hoezen, artiesten en volledige albums.`, ua: `Найбільші хіти ${era.decade} — обкладинки, виконавці та повні альбоми.` }[lang] || `The biggest hits of the ${era.decade}.`,
            openFull: { pl: "Otwórz całość w Spotify", en: "Open full in Spotify", nl: "Open volledig in Spotify", ua: "Відкрити повністю у Spotify" }[lang] || "Open full in Spotify",
            note: { pl: "Całe utwory grają po zalogowaniu do Spotify. Bez logowania Spotify daje tu tylko krótkie zapowiedzi — pełne albumy odtworzysz przyciskiem powyżej.", en: "Full tracks play when you're logged into Spotify. Without login Spotify only allows short previews here — use the button above for full albums.", nl: "Volledige nummers spelen wanneer je bij Spotify bent ingelogd. Zonder login alleen previews — gebruik de knop hierboven voor volledige albums.", ua: "Повні треки грають після входу в Spotify. Без входу — лише короткі прев'ю; повні альбоми через кнопку вище." }[lang] || "",
            artists: { pl: "Wykonawcy epoki", en: "Artists of the era", nl: "Artiesten van het tijdperk", ua: "Виконавці епохи" }[lang] || "Artists of the era",
          };
          return (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border p-4 sm:p-5 space-y-3"
              style={{ borderColor: `${era.palette.accent}30`, background: "rgba(255,255,255,.02)" }}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#1DB954", boxShadow: "0 0 10px #1DB95488" }} />
                    {t.title}
                  </h2>
                  <p className="text-xs text-gray-500">{t.sub}</p>
                </div>
                <a href={`https://open.spotify.com/playlist/${pid}`} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-black transition-transform hover:scale-105 whitespace-nowrap"
                  style={{ background: "#1DB954", boxShadow: "0 0 16px #1DB95455" }}>
                  <Play className="h-4 w-4 fill-black" /> {t.openFull}
                </a>
              </div>
              <iframe
                title={`Spotify · ${era.label}`}
                src={`https://open.spotify.com/embed/playlist/${pid}?utm_source=generator&theme=0`}
                width="100%"
                height={420}
                frameBorder={0}
                loading="lazy"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                style={{ borderRadius: 12 }}
                className="w-full"
              />
              <p className="text-[11px] text-gray-500 leading-relaxed">🔒 {t.note}</p>
              {era.artists.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[10px] tracking-wider uppercase text-gray-500 mr-1">{t.artists}:</span>
                  {era.artists.map((a) => (
                    <span key={a} className="text-[11px] px-2.5 py-1 rounded-md border" style={{ borderColor: `${era.palette.accent}30`, color: era.palette.accent }}>{a}</span>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })()}

        {/* O EPOCE — warstwa wiedzy */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2 rounded-2xl border border-white/10 bg-white/[.02] p-5 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-white mb-1">{eraUi(lang, "aboutTitle")}</h2>
              <p className="text-sm text-gray-300 leading-relaxed">{et.description}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] tracking-wider uppercase text-gray-500 mb-2">{eraUi(lang, "soundmarksLabel")}</p>
              <div className="flex flex-wrap gap-2">
                {et.soundmarks.map((s) => (
                  <span key={s} className="text-[11px] px-2.5 py-1 rounded-full bg-white/[.05] border border-white/10 text-gray-300">{s}</span>
                ))}
              </div>
            </div>
            <div className="p-3 rounded-xl" style={{ background: era.palette.accentSoft }}>
              <div className="flex items-start gap-2">
                <span className="text-base">💡</span>
                <p className="text-xs text-gray-300 flex-1">
                  <span className="font-semibold" style={{ color: era.palette.accent }}>{eraUi(lang, "didYouKnowLabel")}</span>{" "}
                  {factLoading && !fact ? <span className="text-gray-500">{eraUi(lang, "factLoading")}</span> : (fact || et.didYouKnow)}
                </p>
              </div>
              <div className="flex items-center justify-between mt-2 pl-6">
                <span className="font-mono text-[9px] uppercase tracking-wider text-gray-600">{fact ? eraUi(lang, "factTagAI") : eraUi(lang, "factTagStatic")}</span>
                <button onClick={() => loadFact(true)} disabled={factLoading}
                  className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-white disabled:opacity-50 transition-colors" title={eraUi(lang, "refresh")}>
                  <RefreshCw className={`h-3 w-3 ${factLoading ? "animate-spin" : ""}`} /> {eraUi(lang, "refresh")}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[.02] p-5">
              <p className="font-mono text-[10px] tracking-wider uppercase text-gray-500 mb-3">{eraUi(lang, "contextLabel")}</p>
              <div className="space-y-2.5">
                {et.culture.map((c) => (
                  <div key={c.label} className="flex gap-3 text-sm">
                    <span className="w-24 shrink-0 text-gray-500">{c.label}</span>
                    <span className="text-gray-300">{c.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[.02] p-5">
              <p className="font-mono text-[10px] tracking-wider uppercase text-gray-500 mb-2">{eraUi(lang, "artistsLabel")}</p>
              <div className="flex flex-wrap gap-1.5">
                {era.artists.map((a) => (
                  <span key={a} className="text-[11px] px-2.5 py-1 rounded-md border" style={{ borderColor: `${era.palette.accent}30`, color: era.palette.accent }}>{a}</span>
                ))}
              </div>
              <p className="text-[10px] text-gray-600 mt-3 leading-relaxed">{eraUi(lang, "artistsNote")}</p>
            </div>
          </div>
        </motion.div>

        {/* NOW */}
        <div className="space-y-3">
          <SectionHead title={eraUi(lang, "nowTitle")} sub={eraUi(lang, "nowSub")}
            icon={<Radio className="h-5 w-5" style={{ color: era.palette.accent }} />} list={nowTracks} />
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}</div>
          ) : nowTracks.length ? <Grid list={nowTracks} /> : (
            <div className="rounded-xl border border-white/10 bg-white/[.02] p-6 text-sm text-gray-500">{eraUi(lang, "nowEmpty")}</div>
          )}
        </div>

        {/* AI ERA */}
        <div className="rounded-2xl border p-5 sm:p-6 space-y-4" style={{ borderColor: `${era.palette.accent}30`, background: "rgba(255,255,255,.02)" }}>
          <SectionHead title={eraUi(lang, "aiTitle")} sub={eraUi(lang, "aiSub")}
            icon={<Sparkles className="h-5 w-5" style={{ color: era.palette.accent }} />} list={aiTracks} />
          {loading ? null : aiTracks.length ? <Grid list={aiTracks} /> : (
            <div className="rounded-xl border border-white/10 bg-white/[.02] p-6 text-sm text-gray-500">{eraUi(lang, "aiEmpty")}</div>
          )}
          <Link to={eraStudioLink(era, year)}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-black transition-transform hover:scale-[1.01]"
            style={{ background: era.palette.accent, boxShadow: `0 0 20px ${era.palette.glow}` }}>
            <Wand2 className="h-5 w-5" /> {eraUi(lang, "createInAI")}
          </Link>
        </div>
      </div>
    </div>
  );
};

const EraPage = () => {
  const { key } = useParams();
  const { language } = useLanguage();
  const era = getEra(key);
  return (
    <MainLayout>
      {era ? <EraDetail era={era} lang={language} /> : <EraHub lang={language} />}
    </MainLayout>
  );
};

export default EraPage;
