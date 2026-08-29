// GROUAI HUB — night-story-now: generuje JEDNO nocne opowiadanie z najnowszego
// wpisu bloga (OpenRouter), czyta darmowym Google TTS (PL), wgrywa na dysk huba
// i zwraca publiczny link do odsłuchu. Do ręcznego odpalenia.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const SYSTEM =
  "Jestes nocnym lektorem radia GrouAI Stream. Jest 22:40, pora na spokojne, kameralne czytanie. " +
  "Na podstawie wpisu z bloga stworz NOCNE OPOWIADANIE do przeczytania na zywo: cieple, refleksyjne, plynne, " +
  "jakbys opowiadal sluchaczowi przy jednym swietle nocnej lampki. Zacznij od cichego powitania. " +
  "Prowadz mysl jak gawede, sama proza, bez wypunktowan i naglowkow. Trzymaj sie faktow z wpisu. " +
  "Na koncu delikatnie zapros na grouaistream.com i powiedz dobranoc. Dlugosc 250-380 slow. Zwroc TYLKO tekst.";

async function tts(text: string): Promise<Uint8Array> {
  const clean = text.split(String.fromCharCode(10)).join(" ").split(String.fromCharCode(13)).join(" ");
  const words = clean.split(" ").filter((w) => w.length > 0);
  const chunks: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > 180) { if (cur) chunks.push(cur.trim()); cur = w; }
    else cur = (cur + " " + w).trim();
  }
  if (cur) chunks.push(cur.trim());

  const parts: Uint8Array[] = [];
  for (const c of chunks) {
    const url = "https://translate.google.com/translate_tts?ie=UTF-8&tl=pl&client=tw-ob&q=" + encodeURIComponent(c.slice(0, 200));
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }, signal: AbortSignal.timeout(20000) });
    if (r.ok) parts.push(new Uint8Array(await r.arrayBuffer()));
    await new Promise((res) => setTimeout(res, 140));
  }
  const total = parts.reduce((n, b) => n + b.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const b of parts) { out.set(b, off); off += b.length; }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cfgRows } = await db.from("hub_config").select("key, value");
  const cfg: Record<string, string> = {};
  for (const row of cfgRows || []) cfg[row.key] = row.value ?? "";

  const url = new URL(req.url);
  const token = url.searchParams.get("t") || "";
  if (!cfg["hub_token"] || token !== cfg["hub_token"]) return json({ error: "unauthorized" }, 401);

  try {
    const { data: post } = await db.from("hub_blog_posts").select("title, description, content")
      .eq("is_published", true).order("created_at", { ascending: false }).limit(1).single();
    if (!post) return json({ error: "no_post" }, 404);

    const apiKey = cfg["openrouter_api_key"];
    const ai = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0.7,
        max_tokens: 1200,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: "Tytul: " + post.title + " . Zajawka: " + (post.description || "") + " . Tresc: " + String(post.content || "").slice(0, 3000) },
        ],
      }),
    });
    const aiData = await ai.json();
    let script = (aiData.choices?.[0]?.message?.content || "").trim();
    if (script.length < 120) script = "Dobry wieczor, tu GrouAI Stream. Jest 22:40. Dzis na blogu: " + post.title + ". " + (post.description || "") + " Zostan ze mna na chwile. Pelny tekst na grouaistream.com. Dobranoc.";

    const audio = await tts(script);
    if (audio.length < 500) return json({ error: "tts_empty" }, 502);

    const buckets = await db.storage.listBuckets();
    if (!buckets.data?.find((b) => b.name === "night-audio")) {
      await db.storage.createBucket("night-audio", { public: true });
    }
    const path = Date.now() + "-nocne-czytanie.mp3";
    const up = await db.storage.from("night-audio").upload(path, audio, { contentType: "audio/mpeg", upsert: true });
    if (up.error) return json({ error: "upload_failed", detail: up.error.message }, 500);
    const pub = db.storage.from("night-audio").getPublicUrl(path).data.publicUrl;

    await db.from("hub_log").insert({ source: "night-story-now", level: "info", message: "Nocne czytanie: " + post.title, data: { url: pub } });
    return json({ ok: true, title: post.title, url: pub, script, bytes: audio.length });
  } catch (e) {
    return json({ error: "exception", message: String(e).slice(0, 200) }, 500);
  }
});
