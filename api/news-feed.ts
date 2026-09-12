// Serwis informacyjny do radia z PUBLICZNEGO, ogólnodostępnego źródła (Google
// News RSS) — bez płatnego klucza, bez API. Zwraca najnowsze NAGŁÓWKI (nie całe
// artykuły — RSS jest przeznaczony do syndykacji), które radio czyta na głos.
// PL biasuje w stronę Polsat News; gdy brak — ogólnopolskie czołówki.
// Cache CDN (s-maxage) → jedna pobiórka współdzielona przez słuchaczy.
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

function parseItems(xml: string, max: number): { title: string; source: string }[] {
  const out: { title: string; source: string }[] = [];
  const items = xml.split(/<item>/i).slice(1);
  for (const raw of items) {
    const block = raw.split(/<\/item>/i)[0] || "";
    const tm = block.match(/<title>([\s\S]*?)<\/title>/i);
    const sm = block.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
    let title = decode(tm?.[1] || "");
    let source = decode(sm?.[1] || "");
    // Google News: tytuł bywa "Nagłówek - Źródło" — rozdziel, gdy brak <source>.
    if (!source) {
      const i = title.lastIndexOf(" - ");
      if (i > 20) { source = title.slice(i + 3).trim(); title = title.slice(0, i).trim(); }
    }
    if (title.length > 12) out.push({ title, source });
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

    let items: { title: string; source: string }[] = [];
    // PL: najpierw materiały powiązane z Polsat News (ostatnie 2 dni), potem czołówki.
    if (lang === "pl") {
      const xml = await fetchFeed(`https://news.google.com/rss/search?q=${encodeURIComponent("Polsat News when:2d")}&${geo}`);
      if (xml) items = parseItems(xml, 6);
    }
    if (items.length < 3) {
      const xml = await fetchFeed(`https://news.google.com/rss?${geo}`);
      if (xml) items = parseItems(xml, 6);
    }
    if (!items.length) return res.status(200).json({ ok: false, error: "no_items" });

    res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");
    return res.status(200).json({ ok: true, source: "Google News", items });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e) });
  }
}
