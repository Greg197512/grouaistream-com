// youtube-search — wyszukiwanie w CAŁYM YouTube przez Data API v3.
// Zwraca tylko filmy OSADZALNE (videoEmbeddable=true) i muzyczne (kategoria 10),
// żeby na pewno dało się je odtworzyć w rolkach ("tylko który działa").
// Wymaga sekretu YOUTUBE_API_KEY w projekcie Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (o: unknown) =>
    new Response(JSON.stringify(o), { headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const body = await req.json().catch(() => ({}));
    const q = (body?.q || "").toString().trim();
    const key = Deno.env.get("YOUTUBE_API_KEY");
    if (!key) return json({ items: [], error: "missing YOUTUBE_API_KEY" });
    if (!q) return json({ items: [] });
    const url =
      "https://www.googleapis.com/youtube/v3/search" +
      "?part=snippet&type=video&videoEmbeddable=true&videoCategoryId=10&safeSearch=none&maxResults=8" +
      `&q=${encodeURIComponent(q)}&key=${key}`;
    const r = await fetch(url);
    const data = await r.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = (data.items || [])
      .map((it: any) => ({ videoId: it.id?.videoId, title: it.snippet?.title, author: it.snippet?.channelTitle }))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((x: any) => x.videoId);
    return json({ items });
  } catch (e) {
    return json({ items: [], error: String(e) });
  }
});
