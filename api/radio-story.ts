// Opowiadanie dnia dla radia — synteza RAZ, współdzielona przez wszystkich.
// Cache = CDN Vercela: odpowiedź audio jest cache'owana per (lang, data) na dobę
// (s-maxage), więc pierwszy słuchacz generuje, a reszta dostaje gotowe bajty.
// Głos: darmowy edge `elevenlabs-tts` (Azure Neural + fallback Google TTS) —
// jeden spójny głos, zero płatnego ElevenLabs, zero nowych sekretów, bez R2.
// Gdy czegokolwiek brak → zwraca JSON {ok:false}, a klient gra po staremu (speak()).
/* eslint-disable @typescript-eslint/no-explicit-any */

function stripToText(raw: string): string {
  return (raw || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~|]+/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function sentencesOf(text: string, max: number): string[] {
  return text.split(/(?<=[.!?…])\s+/).map((s) => s.trim())
    .filter((s) => s.length > 8 && s.length < 320).slice(0, max);
}

export default async function handler(req: any, res: any) {
  try {
    const lang = String(req.query?.lang || "pl").slice(0, 2).toLowerCase();
    const dParam = String(req.query?.d || "").slice(0, 10);
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!SUPABASE_URL || !ANON) return res.status(200).json({ ok: false, error: "no_supabase_env" });
    const H = { apikey: ANON, Authorization: `Bearer ${ANON}` };

    // 1) Wpisy z bloga (anon, tylko opublikowane)
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/seo_blog_posts?select=title,content&is_published=eq.true&order=created_at.desc&limit=80`,
      { headers: H },
    );
    if (!r.ok) return res.status(200).json({ ok: false, error: "blog_fetch_failed" });
    const rows = ((await r.json()) as any[]).filter((p) => stripToText(p?.content).length > 200);
    if (!rows.length) return res.status(200).json({ ok: false, error: "no_posts" });

    // 2) Opowiadanie dnia (ta sama rotacja co u klienta — deterministyczne)
    const dayMs = dParam ? Date.parse(dParam + "T00:00:00Z") : Date.now();
    const idx = Math.floor((Number.isFinite(dayMs) ? dayMs : Date.now()) / 864e5) % rows.length;
    const post = rows[idx];
    const body = sentencesOf(stripToText(post.content), 40).join(" ");
    if (body.length < 60) return res.status(200).json({ ok: false, error: "too_short" });
    const pl = lang === "pl";
    const intro = pl ? `Opowiadanie z bloga GrouAI. ${post.title}. ` : `A feature from the GrouAI blog. ${post.title}. `;
    const outro = pl ? ` To był wpis z bloga GrouAI. Wracamy do muzyki.` : ` That was a post from the GrouAI blog. Back to the music.`;
    const text = (intro + body + outro).slice(0, 1900); // edge tnie do 2000

    // 3) Synteza darmowym edge (Azure/Google) — jeden głos
    const t = await fetch(`${SUPABASE_URL}/functions/v1/elevenlabs-tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...H },
      body: JSON.stringify({ text, mode: "assistant", lang }),
    });
    const ct = t.headers.get("content-type") || "";
    if (!t.ok || !ct.includes("audio")) return res.status(200).json({ ok: false, error: "tts_failed" });
    const buf = Buffer.from(await t.arrayBuffer());
    if (buf.length < 512) return res.status(200).json({ ok: false, error: "tts_empty" });

    // 4) Zwróć MP3 — CDN Vercela trzyma to dobę per (lang, data): jedna generacja dla wszystkich
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=172800");
    res.setHeader("X-Story-Title", encodeURIComponent(post.title));
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e) });
  }
}
