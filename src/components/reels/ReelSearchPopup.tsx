import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Search, Loader2, Play, Sparkles } from "lucide-react";
import type { Track } from "@/contexts/PlayerContext";
import type { Language } from "@/i18n/translations";
import { searchOurSongs, searchYouTube, looseSuggestion, type YtHit } from "@/lib/reelSearch";
import { askAssistantOnce } from "@/lib/assistantClient";

// Małe okienko na pauzie: „Może chcesz jakiś utwór, wykonawcę lub specjalny rok?".
// Po zatwierdzeniu szukamy: najpierw u nas w piosenkach, potem w całym YouTube
// (tylko działające/osadzalne). Gdy nic — proponujemy i włączamy po potwierdzeniu.
export const ReelSearchPopup = ({
  lang, onClose, onPlayTrack, onPlayYt, currentArtist, currentTitle,
}: {
  lang: Language;
  onClose: () => void;
  onPlayTrack: (t: Track) => void;
  onPlayYt: (hit: YtHit) => void;
  currentArtist?: string;
  currentTitle?: string;
}) => {
  const L = (pl: string, en: string, nl: string, ua: string) =>
    lang === "en" ? en : lang === "nl" ? nl : lang === "ua" ? ua : pl;
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState<Track | null>(null);
  const [empty, setEmpty] = useState(false);
  const [infoBusy, setInfoBusy] = useState(false);
  const [info, setInfo] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const about = (currentArtist || currentTitle || "").trim();
  const askAbout = async () => {
    if (infoBusy || !about) return;
    setInfoBusy(true); setInfo("");
    const prompt = L(
      `Opowiedz krótko (2-3 zdania) o ${currentArtist ? "wykonawcy " + currentArtist : "utworze"}${currentTitle ? ` i utworze „${currentTitle}"` : ""}. Ciekawostki, rok, gatunek.`,
      `Tell me briefly (2-3 sentences) about ${currentArtist ? "the artist " + currentArtist : "this track"}${currentTitle ? ` and the track "${currentTitle}"` : ""}. Fun facts, year, genre.`,
      `Vertel kort over ${currentArtist || currentTitle}.`,
      `Розкажи коротко про ${currentArtist || currentTitle}.`,
    );
    const ans = await askAssistantOnce(prompt);
    setInfo(ans || L("Nie udało się pobrać informacji.", "Couldn't fetch info.", "Geen info.", "Не вдалося отримати."));
    setInfoBusy(false);
  };

  const run = async () => {
    const query = q.trim();
    if (!query || busy) return;
    setBusy(true); setSuggestion(null); setEmpty(false);
    try {
      const ours = await searchOurSongs(query);
      if (ours.length) { onPlayTrack(ours[0]); onClose(); return; }
      const yt = await searchYouTube(query);
      if (yt.length) { onPlayYt(yt[0]); onClose(); return; }
      const sug = await looseSuggestion(query);
      if (sug) setSuggestion(sug); else setEmpty(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      className="absolute inset-0 z-[60] flex items-end sm:items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      <motion.div
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-[#14101c]/95 p-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)]"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h4 className="font-bold text-white text-base leading-snug">
              {L("Może chcesz jakiś utwór?", "Want a specific track?", "Een specifiek nummer?", "Хочеш конкретний трек?")}
            </h4>
            <p className="text-xs text-white/60 mt-0.5">
              {L("Wpisz utwór, wykonawcę lub specjalny rok", "Type a track, artist or a special year", "Nummer, artiest of jaar", "Трек, виконавець або рік")}
            </p>
          </div>
          <button onClick={onClose} aria-label="Zamknij" className="shrink-0 h-8 w-8 rounded-full bg-white/10 border border-white/20 text-white flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") run(); }}
            autoFocus
            placeholder={L("np. Daft Punk, disco, 1994…", "e.g. Daft Punk, disco, 1994…", "bijv. Daft Punk, 1994…", "напр. Daft Punk, 1994…")}
            className="flex-1 min-w-0 rounded-full bg-white/10 border border-white/20 px-4 h-11 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/50"
          />
          <button onClick={run} disabled={busy || !q.trim()}
            className="shrink-0 h-11 px-4 rounded-full font-semibold text-black flex items-center gap-1.5 disabled:opacity-50"
            style={{ background: "hsl(331 100% 62%)" }}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {L("Szukaj", "Search", "Zoek", "Пошук")}
          </button>
        </div>

        {/* Asystent: opowiedz o tym, co oglądasz */}
        {about && (
          <div className="mt-3">
            <button onClick={askAbout} disabled={infoBusy}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/90 rounded-full border border-white/20 bg-white/[0.07] px-3 py-1.5 hover:bg-white/[0.14] disabled:opacity-50">
              {infoBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {L(`Opowiedz o ${currentArtist || "tym utworze"}`, `Tell me about ${currentArtist || "this"}`, `Vertel over ${currentArtist || "dit"}`, `Розкажи про ${currentArtist || "це"}`)}
            </button>
            {info && <p className="mt-2 text-[13px] text-white/85 leading-relaxed">{info}</p>}
          </div>
        )}

        {suggestion && (
          <div className="mt-3 rounded-xl border border-white/12 bg-white/[0.05] p-3">
            <p className="text-[11px] text-white/60 mb-1.5">
              {L("Nie znalazłem dokładnie. Proponuję:", "No exact match. Suggestion:", "Geen match. Voorstel:", "Немає точного. Пропозиція:")}
            </p>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">{suggestion.title}</div>
                <div className="text-xs text-white/60 truncate">{suggestion.artist}</div>
              </div>
              <button onClick={() => { onPlayTrack(suggestion); onClose(); }}
                className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-full font-semibold text-black"
                style={{ background: "#22c55e" }}>
                <Play className="h-4 w-4 fill-black" /> {L("Włącz", "Play", "Speel", "Увімкнути")}
              </button>
            </div>
          </div>
        )}

        {empty && (
          <p className="mt-3 text-xs text-white/60">
            {L("Nic nie znalazłem — spróbuj inaczej.", "Nothing found — try another phrase.", "Niets gevonden — probeer anders.", "Нічого не знайдено — спробуй інакше.")}
          </p>
        )}
      </motion.div>
    </motion.div>
  );
};
