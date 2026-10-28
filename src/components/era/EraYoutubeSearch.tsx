import { useState } from "react";
import { Search, Youtube } from "lucide-react";
import type { Era } from "@/lib/eraEngine";
import type { Language } from "@/i18n/translations";

// Wyszukiwanie w YouTube bez klucza API: wyniki otwierają się w nowej karcie.
// Epoki bez prawdziwych wykonawców (NOW, FUTURE) nie dostają podpowiedzi artystów.
const NO_ARTIST_ERAS = ["now", "future"];

const TEXT: Record<Language, { title: string; sub: string; placeholder: string; button: string; genres: string; artists: string }> = {
  pl: {
    title: "Szukaj więcej muzyki",
    sub: "Wpisz, czego chcesz posłuchać. Wyniki otworzą się w YouTube.",
    placeholder: "np. disco 1978, ballada, Donna Summer…",
    button: "Szukaj",
    genres: "Gatunki epoki",
    artists: "Wykonawcy epoki",
  },
  en: {
    title: "Search for more music",
    sub: "Type what you want to hear. Results open in YouTube.",
    placeholder: "e.g. disco 1978, ballad, Donna Summer…",
    button: "Search",
    genres: "Genres of the era",
    artists: "Artists of the era",
  },
  nl: {
    title: "Zoek meer muziek",
    sub: "Typ wat je wilt horen. Resultaten openen in YouTube.",
    placeholder: "bijv. disco 1978, ballad, Donna Summer…",
    button: "Zoeken",
    genres: "Genres van het tijdperk",
    artists: "Artiesten van het tijdperk",
  },
  ua: {
    title: "Шукай більше музики",
    sub: "Введи, що хочеш послухати. Результати відкриються в YouTube.",
    placeholder: "напр. disco 1978, балада, Donna Summer…",
    button: "Шукати",
    genres: "Жанри епохи",
    artists: "Виконавці епохи",
  },
};

const youtubeSearchUrl = (query: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

export const EraYoutubeSearch = ({ era, lang }: { era: Era; lang: Language }) => {
  const [query, setQuery] = useState("");
  const t = TEXT[lang];
  const suffix = era.key === "future" ? "" : era.decade;
  const artists = NO_ARTIST_ERAS.includes(era.key) ? [] : era.artists;

  const search = (term: string) => {
    const q = term.trim();
    if (!q) return;
    window.open(youtubeSearchUrl(`${q} ${suffix}`.trim()), "_blank", "noopener,noreferrer");
  };

  const chipClass = "text-[12px] px-3 py-1.5 rounded-full border transition-colors hover:bg-white/[0.08]";

  return (
    <div className="rounded-2xl border p-4 sm:p-5 space-y-4" style={{ borderColor: `${era.palette.accent}30`, background: "rgba(255,255,255,.02)" }}>
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Search className="h-5 w-5" style={{ color: era.palette.accent }} />
          {t.title}
        </h2>
        <p className="text-xs text-gray-500">{t.sub}</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          search(query);
        }}
        className="flex gap-2"
      >
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.placeholder}
          className="flex-1 min-w-0 h-11 rounded-xl border border-white/15 bg-black/30 px-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-white/50"
        />
        <button
          type="submit"
          disabled={!query.trim()}
          className="shrink-0 inline-flex items-center gap-2 px-4 h-11 rounded-xl text-sm font-semibold text-black disabled:opacity-40"
          style={{ background: era.palette.accent }}
        >
          <Youtube className="h-4 w-4" />
          {t.button}
        </button>
      </form>

      <div className="space-y-2">
        <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500">{t.genres}</div>
        <div className="flex flex-wrap gap-1.5">
          {era.genres.slice(0, 8).map((g) => (
            <button key={g} type="button" onClick={() => search(g)} className={chipClass}
              style={{ borderColor: `${era.palette.accent}40`, color: "rgba(255,255,255,.85)" }}>
              {g}
            </button>
          ))}
        </div>
      </div>

      {artists.length > 0 && (
        <div className="space-y-2">
          <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500">{t.artists}</div>
          <div className="flex flex-wrap gap-1.5">
            {artists.map((a) => (
              <button key={a} type="button" onClick={() => search(a)} className={chipClass}
                style={{ borderColor: `${era.palette.accent}40`, color: era.palette.accent }}>
                {a}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
