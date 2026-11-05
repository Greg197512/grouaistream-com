/**
 * „Czego słucha świat” — prawdziwe listy przebojów (Apple Music, publiczny feed RSS, bez kluczy)
 * + 30-sekundowe fragmenty z iTunes (lookup po id, bez kluczy) do odsłuchu w naszym odtwarzaczu.
 * GET /api/world-charts?c=world|pl|us|gb|nl|ua  → { country, items:[{rank,id,title,artist,cover,preview,url}] }
 * Cache CDN 6 h — jedno pobranie na kraj na 6 h dla wszystkich słuchaczy. Zero kosztów.
 */
export const config = { runtime: "edge" };

type Rss = { feed?: { results?: { id: string; name: string; artistName: string; artworkUrl100?: string; url?: string }[] } };
type Look = { results?: { trackId: number; previewUrl?: string; trackViewUrl?: string; artworkUrl100?: string }[] };

const COUNTRIES = ["world", "pl", "us", "gb", "nl", "ua"] as const;
const WORLD_MIX = ["us", "gb", "de", "br", "mx", "jp", "fr"];

async function feed(cc: string, n: number) {
  for (const host of ["rss.marketingtools.apple.com", "rss.applemarketingtools.com"]) {
    try {
      const r = await fetch(`https://${host}/api/v2/${cc}/music/most-played/${n}/songs.json`, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) continue;
      const j = (await r.json()) as Rss;
      const list = j.feed?.results ?? [];
      if (list.length) return list;
    } catch { /* następny host */ }
  }
  return [];
}

export default async function handler(req: Request): Promise<Response> {
  const c = (new URL(req.url).searchParams.get("c") || "world").toLowerCase();
  const country = (COUNTRIES as readonly string[]).includes(c) ? c : "world";

  let rows: { id: string; name: string; artistName: string; artworkUrl100?: string; url?: string }[] = [];
  if (country === "world") {
    // Świat = przeplot topów z kilku dużych rynków, bez duplikatów (ten sam utwór liczy się raz, wyżej).
    const lists = await Promise.all(WORLD_MIX.map((cc) => feed(cc, 15)));
    const seen = new Set<string>();
    for (let i = 0; i < 15 && rows.length < 25; i++) {
      for (const l of lists) {
        const t = l[i];
        if (!t) continue;
        const key = `${t.name}|${t.artistName}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key); rows.push(t);
        if (rows.length >= 25) break;
      }
    }
  } else {
    rows = await feed(country, 25);
  }

  // Fragmenty 30 s: jeden lookup na wszystkie id.
  const previews = new Map<string, { preview?: string; url?: string; art?: string }>();
  if (rows.length) {
    try {
      const lc = country === "world" ? "us" : country;
      const r = await fetch(`https://itunes.apple.com/lookup?id=${rows.map((x) => x.id).join(",")}&entity=song&country=${lc}`, { signal: AbortSignal.timeout(8000) });
      const j = (await r.json()) as Look;
      for (const t of j.results ?? []) previews.set(String(t.trackId), { preview: t.previewUrl, url: t.trackViewUrl, art: t.artworkUrl100 });
    } catch { /* bez fragmentów — zostaje link do Apple Music */ }
  }

  const big = (u?: string) => (u ? u.replace(/\/\d+x\d+(bb)?\.(jpg|png|webp)$/i, "/600x600bb.jpg") : null);
  const items = rows.slice(0, 25).map((t, i) => {
    const p = previews.get(t.id);
    return { rank: i + 1, id: t.id, title: t.name, artist: t.artistName, cover: big(t.artworkUrl100 || p?.art), preview: p?.preview ?? null, url: p?.url || t.url || null };
  });

  return new Response(JSON.stringify({ country, updated: new Date().toISOString(), items }), {
    headers: {
      "content-type": "application/json",
      // Lista jest wspólna dla wszystkich — CDN trzyma ją 6 h (jedno pobranie z Apple na kraj).
      "cache-control": items.length ? "public, s-maxage=21600, stale-while-revalidate=43200" : "no-store",
    },
  });
}
