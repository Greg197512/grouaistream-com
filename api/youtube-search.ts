// Wyszukiwanie w CAŁYM YouTube — funkcja serverless Vercel (deploy automatyczny
// z repo). Zwraca tylko filmy OSADZALNE i muzyczne, żeby na pewno dało się je
// odtworzyć w rolkach. Ustaw w Vercel zmienną środowiskową YOUTUBE_API_KEY.
/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1200");
  try {
    const q = (req.query?.q || "").toString().trim();
    const key = process.env.YOUTUBE_API_KEY;
    if (!key) return res.status(200).json({ items: [], error: "missing YOUTUBE_API_KEY" });
    if (!q) return res.status(200).json({ items: [] });
    // Domyślnie: muzyka (kat. 10) do rolek. Opcjonalnie news: cat=25, order=date,
    // days=N (tylko świeże z ostatnich N dni). Wstecznie zgodne — bez parametrów gra jak dawniej.
    const cat = (req.query?.cat || "10").toString().replace(/[^0-9]/g, "") || "10";
    const order = (req.query?.order || "").toString() === "date" ? "date" : "";
    const days = Math.max(0, Math.min(30, parseInt((req.query?.days || "0").toString(), 10) || 0));
    let url =
      "https://www.googleapis.com/youtube/v3/search" +
      `?part=snippet&type=video&videoEmbeddable=true&videoCategoryId=${cat}&safeSearch=none&maxResults=10` +
      `&q=${encodeURIComponent(q)}&key=${key}`;
    if (order) url += `&order=${order}`;
    if (days > 0) url += `&publishedAfter=${new Date(Date.now() - days * 864e5).toISOString()}`;
    const r = await fetch(url);
    const data: any = await r.json();
    const items = (data.items || [])
      .map((it: any) => ({ videoId: it.id?.videoId, title: it.snippet?.title, author: it.snippet?.channelTitle }))
      .filter((x: any) => x.videoId);
    return res.status(200).json({ items });
  } catch (e) {
    return res.status(200).json({ items: [], error: String(e) });
  }
}
