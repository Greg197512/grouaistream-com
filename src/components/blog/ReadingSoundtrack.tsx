// „Soundtrack do czytania” (wzór: Fader/Pitchfork — muzyka gra, gdy czytasz). Utwór z NASZEGO katalogu
// dobrany do kategorii artykułu; gra w głównym odtwarzaczu strony (nie przerywa się przy przewijaniu).
import { useEffect, useState } from "react";
import { Disc3, Play, Shuffle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerOptional, type Track } from "@/contexts/PlayerContext";

const GENRES: Record<string, string[]> = {
  ai_news: ["Electronic", "Techno", "House"],
  tech_news: ["Electronic", "Synthwave", "Techno"],
  sound_chronicles: ["Rock", "Jazz", "Pop", "Disco"],
  psychology: ["Chill", "Ambient", "Lo-Fi", "Lofi"],
  industry: ["Hip-Hop", "Pop", "Rap"],
  monetization: ["Hip-Hop", "Pop"],
  trends: ["Pop", "Dance", "Electronic"],
};
const TXT: Record<string, { h: string; sub: string; play: string; other: string }> = {
  pl: { h: "Soundtrack do czytania", sub: "Utwór z GrouAI dobrany do tematu — gra dalej, gdy przewijasz.", play: "Graj", other: "Inny" },
  en: { h: "Reading soundtrack", sub: "A GrouAI track picked for this topic — keeps playing while you scroll.", play: "Play", other: "Another" },
  nl: { h: "Leessoundtrack", sub: "Een GrouAI-track bij dit onderwerp — speelt door terwijl je scrolt.", play: "Speel", other: "Andere" },
  ua: { h: "Саундтрек для читання", sub: "Трек GrouAI до теми — грає, поки ти гортаєш.", play: "Грати", other: "Інший" },
};

const COLS = "id,title,artist,album,duration,audio_url,cover_url,genre,mood";

export function ReadingSoundtrack({ category, lang, compact = false }: { category?: string; lang: string; compact?: boolean }) {
  const t = TXT[lang] ?? TXT.pl;
  const player = usePlayerOptional();
  const [pool, setPool] = useState<Track[]>([]);
  const [i, setI] = useState(0);

  useEffect(() => {
    let off = false;
    (async () => {
      const genres = (category && GENRES[category]) || null;
      let q = supabase.from("tracks").select(COLS).not("audio_url", "is", null).not("audio_url", "ilike", "%cdn1.suno.ai%").not("catalog_hidden", "is", true).limit(40);
      if (genres) q = q.in("genre", genres);
      let { data } = await q.order("total_streams", { ascending: false });
      if (!data?.length) ({ data } = await supabase.from("tracks").select(COLS).not("audio_url", "is", null).not("audio_url", "ilike", "%cdn1.suno.ai%").not("catalog_hidden", "is", true).order("total_streams", { ascending: false }).limit(40));
      if (off || !data?.length) return;
      const list = (data as unknown as Track[]).filter((x) => x.audio_url);
      setPool(list);
      setI(Math.floor(Math.random() * Math.min(list.length, 12)));
    })().catch(() => {});
    return () => { off = true; };
  }, [category]);

  const tr = pool[i];
  if (!tr || !player) return null;
  const playing = player.currentTrack?.id === tr.id && player.isPlaying;
  const go = () => player.playTrack(tr, "blog");
  const next = () => setI((v) => (pool.length > 1 ? (v + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length : v));

  return (
    <div className={`group relative overflow-hidden rounded-2xl border border-border/50 bg-card/60 ${compact ? "p-3" : "p-4"}`}>
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/25 blur-3xl" />
      <div className="relative flex items-center gap-3">
        <div className={`relative shrink-0 ${compact ? "h-12 w-12" : "h-16 w-16"}`}>
          {tr.cover_url
            ? <img src={tr.cover_url} alt="" className={`h-full w-full rounded-full object-cover ring-2 ring-primary/40 ${playing ? "animate-[spin_6s_linear_infinite] motion-reduce:animate-none" : ""}`} />
            : <Disc3 className="h-full w-full text-primary" />}
          <span aria-hidden className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background ring-1 ring-border" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">{t.h}</p>
          <p className="truncate font-semibold leading-tight">{tr.title}</p>
          <p className="truncate text-xs text-muted-foreground">{tr.artist}{tr.genre ? ` · ${tr.genre}` : ""}</p>
        </div>
        <button type="button" onClick={go} aria-label={`${t.play}: ${tr.title}`}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.4)] transition hover:scale-105">
          <Play className="h-4 w-4" /> {t.play}
        </button>
        {pool.length > 1 && (
          <button type="button" onClick={next} aria-label={t.other} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/60 hover:border-primary/50">
            <Shuffle className="h-4 w-4" />
          </button>
        )}
      </div>
      {!compact && <p className="relative mt-2 text-xs text-muted-foreground">{t.sub}</p>}
    </div>
  );
}
