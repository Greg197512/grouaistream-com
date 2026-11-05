// „Czego słucha świat” — prawdziwe listy przebojów (Apple Music) z /api/world-charts:
// kraje do wyboru, poziomy pasek okładek, 30-sekundowe fragmenty w naszym odtwarzaczu + link do pełnej wersji.
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Play, ExternalLink, Globe2 } from "lucide-react";
import { usePlayer, type Track } from "@/contexts/PlayerContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

type Item = { rank: number; id: string; title: string; artist: string; cover: string | null; preview: string | null; url: string | null; country?: string };

const FLAG: Record<string, string> = { pl: "🇵🇱", us: "🇺🇸", gb: "🇬🇧", de: "🇩🇪", fr: "🇫🇷", es: "🇪🇸", it: "🇮🇹", nl: "🇳🇱", ua: "🇺🇦", br: "🇧🇷", jp: "🇯🇵" };
const key = (i: Item) => `${i.country ?? ""}-${i.id}`;

const COUNTRIES = [
  { c: "world", flag: "🌍" }, { c: "pl", flag: "🇵🇱" }, { c: "us", flag: "🇺🇸" },
  { c: "gb", flag: "🇬🇧" }, { c: "nl", flag: "🇳🇱" }, { c: "ua", flag: "🇺🇦" },
] as const;

const TXT = {
  pl: { top5: "top 5 z każdego kraju", names: { world: "Świat", pl: "Polska", us: "USA", gb: "UK", nl: "Holandia", ua: "Ukraina" }, play: "Graj listę", clip: "30 s", full: "Całość", empty: "Lista chwilowo niedostępna", src: "Listy przebojów: Apple Music" },
  en: { top5: "top 5 from every country", names: { world: "World", pl: "Poland", us: "USA", gb: "UK", nl: "Netherlands", ua: "Ukraine" }, play: "Play chart", clip: "30 s", full: "Full", empty: "Chart temporarily unavailable", src: "Charts: Apple Music" },
  nl: { top5: "top 5 uit elk land", names: { world: "Wereld", pl: "Polen", us: "VS", gb: "VK", nl: "Nederland", ua: "Oekraïne" }, play: "Speel lijst", clip: "30 s", full: "Volledig", empty: "Lijst tijdelijk niet beschikbaar", src: "Hitlijsten: Apple Music" },
  ua: { top5: "топ-5 кожної країни", names: { world: "Світ", pl: "Польща", us: "США", gb: "Британія", nl: "Нідерланди", ua: "Україна" }, play: "Грати чарт", clip: "30 с", full: "Повністю", empty: "Чарт тимчасово недоступний", src: "Чарти: Apple Music" },
} as const;

export function WorldCharts({ title, subtitle }: { title: string; subtitle?: string }) {
  const { language } = useLanguage();
  const t = TXT[(language as keyof typeof TXT)] ?? TXT.pl;
  const { playPlaylist } = usePlayer();
  const [country, setCountry] = useState<string>("world");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const railRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    let off = false;
    setLoading(true);
    fetch(`/api/world-charts?c=${country}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j) => { if (!off) { setItems(j.items ?? []); railRef.current?.scrollTo({ left: 0 }); } })
      .catch(() => { if (!off) setItems([]); })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [country]);

  const updateEdges = useCallback(() => {
    const el = railRef.current; if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);
  useEffect(updateEdges, [items, updateEdges]);
  const slide = (dir: 1 | -1) => railRef.current?.scrollBy({ left: dir * Math.max(160, railRef.current.clientWidth * 0.8), behavior: "smooth" });

  const playable = items.filter((i) => i.preview);
  const asTracks = (): Track[] => playable.map((i) => ({
    id: `chart-${key(i)}`, title: i.title, artist: i.artist, album: null, duration: 30,
    audio_url: i.preview, cover_url: i.cover, genre: null, mood: null,
  }));
  const playFrom = (item?: Item) => {
    const list = asTracks();
    if (!list.length) return;
    const idx = item ? Math.max(0, playable.findIndex((p) => key(p) === key(item))) : 0;
    playPlaylist(list, idx, "world-charts");
  };

  return (
    <section className="px-4 py-8 sm:px-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-2xl font-bold"><Globe2 className="h-5 w-5 text-primary" aria-hidden="true" />{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}{country === "world" ? ` · ${t.top5}` : ""}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => playFrom()} disabled={!playable.length}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-40">
            <Play className="h-4 w-4" /> {t.play}
          </button>
          <button type="button" onClick={() => slide(-1)} disabled={edges.start} aria-label="‹"
            className="hidden h-9 w-9 place-items-center rounded-full border border-border bg-secondary/60 disabled:opacity-30 sm:grid"><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" onClick={() => slide(1)} disabled={edges.end} aria-label="›"
            className="hidden h-9 w-9 place-items-center rounded-full border border-border bg-secondary/60 disabled:opacity-30 sm:grid"><ChevronRight className="h-5 w-5" /></button>
        </div>
      </div>

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Kraj">
        {COUNTRIES.map(({ c, flag }) => (
          <button key={c} type="button" role="tab" aria-selected={country === c} onClick={() => setCountry(c)}
            className={cn("h-9 shrink-0 rounded-full border px-3.5 text-sm font-semibold transition",
              country === c ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
            {flag} {t.names[c]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
      ) : !items.length ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t.empty}</p>
      ) : (
        <div ref={railRef} onScroll={updateEdges} role="list" aria-label={title}
          className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain scroll-smooth px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:gap-4 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((it) => (
            <div key={key(it)} role="listitem" className="group w-36 shrink-0 snap-start sm:w-44">
              <button type="button" onClick={() => playFrom(it)} disabled={!it.preview}
                className="relative block aspect-square w-full overflow-hidden rounded-2xl bg-secondary text-left disabled:cursor-default"
                aria-label={`${it.rank}. ${it.title} — ${it.artist}`}>
                {it.cover && <img src={it.cover} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition group-hover:scale-105" />}
                <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-black text-white">{it.country ? `${FLAG[it.country] ?? it.country.toUpperCase()} ` : ""}#{it.rank}</span>
                {it.preview && (
                  <span className="absolute bottom-2 right-2 grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg">
                    <Play className="ml-0.5 h-5 w-5" />
                  </span>
                )}
              </button>
              <p className="mt-2 line-clamp-1 text-sm font-semibold">{it.title}</p>
              <p className="line-clamp-1 text-xs text-muted-foreground">{it.artist}</p>
              <div className="mt-1 flex items-center gap-2 whitespace-nowrap text-[10px] text-muted-foreground">
                {it.preview && <span>{t.clip}</span>}
                {it.url && (
                  <a href={it.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:text-foreground">
                    {t.full} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-[10px] text-muted-foreground">{t.src}</p>
    </section>
  );
}
