// Rozbudowany serwis informacyjny do radia z PUBLICZNEGO RSS (Google News) —
// bez płatnego klucza. Zbiera NAGŁÓWKI z wielu działów (kraj, świat, biznes,
// technologia, sport, kultura, nauka, zdrowie), czyści je ze źródła ("- Onet",
// "- PolsatNews.pl" itp.), dedupikuje. Radio czyta to na głos (segmentami),
// więc serwis może trwać kilka–kilkanaście minut. Cache CDN → współdzielone.
/* eslint-disable @typescript-eslint/no-explicit-any */

function decode(s: string): string {
  return (s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
}

// Usuń dopisek źródła: "Nagłówek - Onet" / "Nagłówek – PolsatNews.pl".
function stripSource(title: string): string {
  const m = title.match(/^(.*\S)\s[-–—]\s([^-–—]{1,32})$/);
  if (m && !/[.!?]$/.test(m[2])) return m[1].trim();
  return title.trim();
}

function parseTitles(xml: string, max: number): string[] {
  const out: string[] = [];
  const items = xml.split(/<item>/i).slice(1);
  for (const raw of items) {
    const block = raw.split(/<\/item>/i)[0] || "";
    const tm = block.match(/<title>([\s\S]*?)<\/title>/i);
    const title = stripSource(decode(tm?.[1] || ""));
    if (title.length > 12) out.push(title);
    if (out.length >= max) break;
  }
  return out;
}

async function fetchFeed(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; GrouAIRadio/1.0)" } });
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; }
}

export default async function handler(req: any, res: any) {
  try {
    const lang = String(req.query?.lang || "pl").slice(0, 2).toLowerCase();
    const geo = lang === "pl" ? "hl=pl&gl=PL&ceid=PL:pl"
      : lang === "nl" ? "hl=nl&gl=NL&ceid=NL:nl"
      : lang === "ua" ? "hl=uk&gl=UA&ceid=UA:uk"
      : "hl=en-US&gl=US&ceid=US:en";
    const base = "https://news.google.com/rss";

    // Działy: nazwa PL + topic Google News. Top jako pierwszy.
    const NAMES: Record<string, string> = lang === "pl"
      ? { TOP: "Najważniejsze", NATION: "Kraj", WORLD: "Świat", BUSINESS: "Biznes",
          TECHNOLOGY: "Technologia", SPORTS: "Sport", ENTERTAINMENT: "Kultura i rozrywka",
          SCIENCE: "Nauka", HEALTH: "Zdrowie" }
      : { TOP: "Top", NATION: "Nation", WORLD: "World", BUSINESS: "Business",
          TECHNOLOGY: "Technology", SPORTS: "Sport", ENTERTAINMENT: "Culture",
          SCIENCE: "Science", HEALTH: "Health" };
    const topics = ["TOP", "NATION", "WORLD", "BUSINESS", "TECHNOLOGY", "SPORTS", "ENTERTAINMENT", "SCIENCE", "HEALTH"];

    const results = await Promise.all(topics.map(async (tp) => {
      const url = tp === "TOP" ? `${base}?${geo}` : `${base}/headlines/section/topic/${tp}?${geo}`;
      const xml = await fetchFeed(url);
      return { tp, titles: xml ? parseTitles(xml, 12) : [] };
    }));

    // Dedup globalny (te same newsy w kilku działach).
    const seen = new Set<string>();
    const sections: { name: string; items: string[] }[] = [];
    for (const { tp, titles } of results) {
      const uniq: string[] = [];
      for (const t of titles) {
        const k = t.toLowerCase().slice(0, 40);
        if (seen.has(k)) continue;
        seen.add(k); uniq.push(t);
      }
      if (uniq.length) sections.push({ name: NAMES[tp] || tp, items: uniq });
    }
    const total = sections.reduce((n, s) => n + s.items.length, 0);
    if (total < 3) return res.status(200).json({ ok: false, error: "no_items" });

    res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");
    return res.status(200).json({ ok: true, source: "Google News", sections });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e) });
  }
}
