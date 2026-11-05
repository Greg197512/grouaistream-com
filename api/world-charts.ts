/**
 * „Czego słucha świat” — prawdziwe listy przebojów (Apple Music, publiczny feed RSS, bez kluczy)
 * + 30-sekundowe fragmenty z iTunes (lookup po id, bez kluczy) do odsłuchu w naszym odtwarzaczu.
 * GET /api/world-charts?c=world|pl|us|gb|nl|ua  → { country, items:[{rank,id,title,artist,cover,preview,url}] }
 * Cache CDN 6 h — jedno pobranie na kraj na 6 h dla wszystkich słuchaczy. Zero kosztów.
 */
export const config = { runtime: "edge" };

type Rss = { feed?: { results?: { id: string; name: string; artistName: string; artworkUrl100?: string; url?: string }[] } };
type Look = { results?: { trackId: number; previewUrl?: string; trackViewUrl?: string; artworkUrl100?: string }[] };

const COUNTRIES = ["world", "pl", "us", "gb", "de", "fr", "es", "it", "nl", "ua", "br", "jp"] as const;
// „Świat” = czołowa piątka z każdego z tych krajów (kolejność = kolejność wyświetlania).
const WORLD_TOP5 = ["pl", "us", "gb", "de", "fr", "es", "it", "nl", "ua", "br", "jp"];

const trace: string[] = [];
async function hostFeed(host: string, cc: string, n: number) {
  const r = await fetch(`https://${host}/api/v2/${cc}/music/most-played/${n}/songs.json`, {
    signal: AbortSignal.timeout(12000), headers: { accept: "application/json", "user-agent": "Mozilla/5.0 (compatible; GrouAIStream/1.0)" },
  });
  trace.push(`${host}/${cc}: ${r.status}`);
  if (!r.ok) throw new Error(String(r.status));
  const list = ((await r.json()) as Rss).feed?.results ?? [];
  if (!list.length) throw new Error("empty");
  return list;
}
/** Oba adresy Apple naraz (wygrywa szybszy), przy porażce jedna ponowna próba. */
async function feed(cc: string, n: number) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await Promise.any(["rss.applemarketingtools.com", "rss.marketingtools.apple.com"].map((h) => hostFeed(h, cc, n)));
    } catch (e) { trace.push(`${cc} próba ${attempt + 1}: ${String(e).slice(0, 60)}`); }
  }
  return [];
}

type Item = { rank: number; id: string; title: string; artist: string; cover: string | null; preview: string | null; url: string | null; country?: string };

function out(body: Record<string, unknown>, cacheSec: number): Response {
  return new Response(JSON.stringify({ ...body, updated: new Date().toISOString(), ...(debugOn ? { trace } : {}) }), {
    headers: {
      "content-type": "application/json",
      "cache-control": cacheSec ? `public, s-maxage=${cacheSec}, stale-while-revalidate=${cacheSec * 2}` : "no-store",
    },
  });
}
let debugOn = false;

export default async function handler(req: Request): Promise<Response> {
  trace.length = 0;
  debugOn = new URL(req.url).searchParams.get("debug") === "1";
  const c = (new URL(req.url).searchParams.get("c") || "world").toLowerCase();
  const country = (COUNTRIES as readonly string[]).includes(c) ? c : "world";

  type Row = { id: string; name: string; artistName: string; artworkUrl100?: string; url?: string; cc?: string; ccRank?: number };
  let rows: Row[] = [];
  if (country === "world") {
    // Świat składamy z list krajów z pamięci CDN (/api/world-charts?c=XX, 6 h) — zamiast 11 zapytań do Apple naraz.
    const origin = new URL(req.url).origin;
    const lists = await Promise.all(WORLD_TOP5.map(async (cc) => {
      try {
        const r = await fetch(`${origin}/api/world-charts?c=${cc}`, { signal: AbortSignal.timeout(20000) });
        const j = (await r.json()) as { items?: Item[] };
        trace.push(`kraj ${cc}: ${j.items?.length ?? 0}`);
        return (j.items ?? []).slice(0, 5).map((it) => ({ ...it, country: cc }));
      } catch (e) { trace.push(`kraj ${cc}: ${String(e).slice(0, 60)}`); return [] as Item[]; }
    }));
    const items = lists.flat();
    const complete = lists.every((l) => l.length === 5);
    if (new URL(req.url).searchParams.get("summary") === "1") {
      const per: Record<string, number> = {};
      for (const it of items) per[it.country!] = (per[it.country!] ?? 0) + 1;
      return out({ country, count: items.length, withPreview: items.filter((i) => i.preview).length, per, complete }, 0);
    }
    return out({ country, items, complete }, items.length ? (complete ? 21600 : 3600) : 0);
  }
  rows = await feed(country, 25);

  // Fragmenty 30 s: lookup w sklepie właściwego kraju (lokalne hity bywają tylko tam), jeden na kraj.
  const previews = new Map<string, { preview?: string; url?: string; art?: string }>();
  const groups = new Map<string, string[]>();
  for (const r of rows) { const cc = r.cc ?? (country === "world" ? "us" : country); groups.set(cc, [...(groups.get(cc) ?? []), r.id]); }
  await Promise.all([...groups.entries()].map(async ([cc, ids]) => {
    try {
      const r = await fetch(`https://itunes.apple.com/lookup?id=${[...new Set(ids)].join(",")}&entity=song&country=${cc}`, { signal: AbortSignal.timeout(8000) });
      const j = (await r.json()) as Look;
      for (const t of j.results ?? []) if (t.previewUrl) previews.set(String(t.trackId), { preview: t.previewUrl, url: t.trackViewUrl, art: t.artworkUrl100 });
    } catch { /* bez fragmentów — zostaje link do Apple Music */ }
  }));

  const big = (u?: string) => (u ? u.replace(/\/\d+x\d+(bb)?\.(jpg|png|webp)$/i, "/600x600bb.jpg") : null);
  const items = rows.slice(0, country === "world" ? 80 : 25).map((t, i) => {
    const p = previews.get(t.id);
    return {
      rank: t.ccRank ?? i + 1, id: t.id, title: t.name, artist: t.artistName, cover: big(t.artworkUrl100 || p?.art),
      preview: p?.preview ?? null, url: p?.url || t.url || null, ...(t.cc ? { country: t.cc } : {}),
    };
  });

  if (new URL(req.url).searchParams.get("summary") === "1") {
    const per: Record<string, number> = {};
    for (const it of items) { const k = (it as { country?: string }).country ?? country; per[k] = (per[k] ?? 0) + 1; }
    return new Response(JSON.stringify({ country, count: items.length, withPreview: items.filter((i) => i.preview).length, per, trace }), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
  }
  const debug = new URL(req.url).searchParams.get("debug") === "1";
  return new Response(JSON.stringify({ country, updated: new Date().toISOString(), items, ...(debug ? { trace } : {}) }), {
    headers: {
      "content-type": "application/json",
      // Lista jest wspólna dla wszystkich — CDN trzyma ją 6 h (jedno pobranie z Apple na kraj).
      "cache-control": items.length ? "public, s-maxage=21600, stale-while-revalidate=43200" : "no-store",
    },
  });
}
