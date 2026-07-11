// GROUAI HUB — hub-blog-generate v1: świeży blog generowany na hubie (bez n8n, bez klucza bvstv).
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const TOPICS = [
  { topic: "Jak AI zmienia sposób, w jaki słuchamy muzyki w 2026", category: "trends", tags: ["AI","music","streaming"] },
  { topic: "Streaming muzyki bez botów — dlaczego prawdziwe odsłuchy mają znaczenie", category: "trends", tags: ["streaming","fair","verified"] },
  { topic: "Koniec ery Spotify? Nowa fala platform muzycznych z AI", category: "trends", tags: ["spotify","AI","alternatives"] },
  { topic: "Mikrogatunki w streamingu — dlaczego niszowa muzyka wygrywa", category: "trends", tags: ["niche","genres","discovery"] },
  { topic: "Detekcja nastroju w muzyce — przyszłość spersonalizowanego streamingu", category: "feature", tags: ["mood","AI","personalization"] },
  { topic: "Live radio z AI DJ-em — jak to działa i dlaczego to przyszłość", category: "feature", tags: ["radio","DJ","live"] },
  { topic: "Sterowanie muzyką głosem — koniec ery klikania", category: "feature", tags: ["voice","UX","AI"] },
  { topic: "Crossfade i mashup w czasie rzeczywistym — sztuka miksowania AI", category: "feature", tags: ["mixing","crossfade","AI"] },
  { topic: "Jak zarabiać na muzyce w erze AI — przewodnik dla niezależnych twórców", category: "monetization", tags: ["earnings","creators","monetization"] },
  { topic: "65% dla twórcy vs 30% Spotify — dlaczego model fair stream wygrywa", category: "monetization", tags: ["earnings","fair","streaming"] },
  { topic: "Tipy i mikropłatności — jak fani naprawdę wspierają artystów", category: "monetization", tags: ["tips","fans","support"] },
  { topic: "Jak stworzyć utwór muzyczny w 30 sekund używając AI", category: "tutorial", tags: ["AI generation","studio","tutorial"] },
  { topic: "Imprezy z AI DJ — jak zorganizować magiczną sesję muzyczną", category: "tutorial", tags: ["party","DJ","QR"] },
  { topic: "Jak zaimportować playlistę ze Spotify do GrouAI Stream", category: "tutorial", tags: ["import","spotify","tutorial"] },
  { topic: "Psychologia muzyki — co Twoje ulubione utwory mówią o Tobie", category: "psychology", tags: ["psychology","mood","analysis"] },
  { topic: "Muzyka i emocje — dlaczego jeden utwór potrafi zmienić cały dzień", category: "psychology", tags: ["emotions","mood","science"] },
  { topic: "Dopamina, basy i drop — neuronauka muzyki elektronicznej", category: "psychology", tags: ["neuroscience","electronic","dopamine"] },
  { topic: "Najlepsze AI tools dla twórców muzyki w 2026 — ranking", category: "tools", tags: ["tools","AI","ranking"] },
  { topic: "Suno vs Udio vs ElevenLabs Music — szczerze porównane", category: "tools", tags: ["suno","udio","elevenlabs"] },
  { topic: "AI a prawo autorskie w muzyce — co musisz wiedzieć w 2026", category: "industry", tags: ["copyright","AI","legal"] },
  { topic: "Independent artists w 2026 — koniec uzależnienia od labeli", category: "industry", tags: ["indie","labels","independence"] },
  { topic: "SEO dla muzyków — jak Twoje utwory mają być znalezione w Google", category: "marketing", tags: ["SEO","musicians","marketing"] },
  { topic: "Cover art generowany AI — jak wyróżnić utwór wizualnie", category: "marketing", tags: ["cover","art","AI"] },
  { topic: "Muzyka generowana w czasie rzeczywistym dla gier wideo", category: "future", tags: ["gaming","AI","procedural"] },
];

const UNSPLASH = {
  trends: ["1470225620780-dba8ba36b745","1493225457124-a3eb161ffa5f","1514320291840-2e0a9bf2a9ae","1505740420928-5e560c06d30e"],
  feature: ["1598488035139-bdbb2231ce04","1516450360452-9312f5e86fc7","1511671782779-c97d3d27a1d4","1485579149621-3123dd979885"],
  monetization: ["1553729459-efe14ef6055d","1454165804606-c3d57bc86b40","1507003211169-0a1dd7228f2d","1611532736597-de2d4265fba3"],
  tutorial: ["1598488035139-bdbb2231ce04","1505740420928-5e560c06d30e","1461749280684-dccba630e2f6","1516450360452-9312f5e86fc7"],
  psychology: ["1504892564858-48800e5aeb17","1451187580459-43490279c0fa","1485579149621-3123dd979885","1511671782779-c97d3d27a1d4"],
  tools: ["1598488035139-bdbb2231ce04","1516450360452-9312f5e86fc7","1505740420928-5e560c06d30e","1518770660439-4636190af475"],
  industry: ["1493225457124-a3eb161ffa5f","1526478806334-5fd488fcaabc","1459749411175-04bf5292ceea","1514320291840-2e0a9bf2a9ae"],
  marketing: ["1611532736597-de2d4265fba3","1507003211169-0a1dd7228f2d","1454165804606-c3d57bc86b40","1553729459-efe14ef6055d"],
  future: ["1451187580459-43490279c0fa","1677442135703-1787eea5ce01","1518770660439-4636190af475","1555255707-c07966088b7b"],
};

function slugify(s) {
  const map = { "ą":"a","ć":"c","ę":"e","ł":"l","ń":"n","ó":"o","ś":"s","ź":"z","ż":"z" };
  return s.toLowerCase().replace(/[ąćęłńóśźż]/g, (c) => map[c] || c)
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function curatedCover(category, slug) {
  const pool = UNSPLASH[category] || UNSPLASH.trends;
  const code = slug ? (slug.charCodeAt(slug.length - 1) + (slug.charCodeAt(slug.length - 2) || 0)) : 0;
  const id = pool[code % pool.length];
  return `https://images.unsplash.com/photo-${id}?w=1200&q=85&fit=crop&crop=center`;
}

async function generate(models, apiKey, topic) {
  const system = "Jesteś profesjonalnym copywriterem SEO i dziennikarzem AI/tech dla GrouAI Stream — premium platformy streamingowej z AI, mood detection, voice control, AI DJ, GrouAI Studio i monetyzacją dla twórców (grouaistream.com). Pisz po polsku, premium ale przystępnie, z emocjami, lekkim humorem i wciągającymi opisami. Używaj nagłówków H2/H3 (markdown), list, blockquotes, pogrubień. 1200-1800 słów. Każda sekcja H2 ma 2-4 akapity. Wpleć metafory, konkretne liczby, anegdoty. Zwróć obiekt JSON z polami: title (string), description (string, max 155 znaków, mocny hook), content (string, markdown; wszystkie znaki nowej linii jako \\n).";
  const user = `Napisz artykuł blogowy SEO na temat: "${topic.topic}". Naturalnie wpleć wzmianki o funkcjach GrouAI Stream (mood detection, AI DJ, komendy głosowe, Groua Radio, GrouAI Studio, monetyzacja 65% dla twórców) i zachętę do rejestracji na końcu. Kategoria: ${topic.category}.`;
  let lastErr = "";
  for (const model of models) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://grouaistream.com", "X-Title": "GrouAI Hub Blog" },
        body: JSON.stringify({ model, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: user }], max_tokens: 4000 }),
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) { lastErr = `HTTP ${res.status} [${model}]`; continue; }
      const out = await res.json();
      if (out.error) { lastErr = `[${model}] ${JSON.stringify(out.error).slice(0, 120)}`; continue; }
      const raw = out.choices?.[0]?.message?.content || "";
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      let parsed = null;
      try { parsed = JSON.parse(cleaned); } catch {
        const m = cleaned.match(/\{[\s\S]*\}/);
        if (m) { try { parsed = JSON.parse(m[0]); } catch { /* */ } }
      }
      if (parsed && parsed.title && parsed.content && parsed.content.length > 400) {
        return { title: String(parsed.title), description: String(parsed.description || "").slice(0, 160), content: String(parsed.content), model };
      }
      lastErr = `bad_json [${model}]`;
    } catch (e) { lastErr = `fetch [${model}]: ${String(e).slice(0, 100)}`; }
  }
  throw new Error(lastErr || "all_models_failed");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const db = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  const { data: cfgRows } = await db.from("hub_config").select("key, value");
  const cfg = {};
  for (const row of cfgRows || []) cfg[row.key] = row.value ?? "";

  const url = new URL(req.url);
  const token = url.searchParams.get("t") || req.headers.get("x-hub-token") || "";
  if (!cfg["hub_token"] || token !== cfg["hub_token"]) return json({ error: "unauthorized" }, 401);

  const apiKey = cfg["openrouter_api_key"];
  if (!apiKey) { await db.from("hub_log").insert({ source: "hub-blog-generate", level: "warn", message: "brak openrouter_api_key" }); return json({ error: "ai_not_configured" }, 503); }
  const models = (cfg["openrouter_models"] || cfg["openrouter_model"] || "meta-llama/llama-3.3-70b-instruct:free").split(",").map((m) => m.trim()).filter(Boolean);

  try {
    const { data: recent } = await db.from("hub_blog_posts").select("title").order("created_at", { ascending: false }).limit(40);
    const recentTitles = new Set((recent || []).map((r) => r.title));
    const available = TOPICS.filter((t) => !recentTitles.has(t.topic));
    const pick = (available.length ? available : TOPICS)[Math.floor(Math.random() * (available.length || TOPICS.length))];

    const art = await generate(models, apiKey, pick);
    const slug = slugify(art.title) + "-" + Math.random().toString(36).slice(2, 7);
    const cover = curatedCover(pick.category, slug);

    const { data: inserted, error: insErr } = await db.from("hub_blog_posts").insert({
      title: art.title, slug, description: art.description, content: art.content,
      category: pick.category, tags: pick.tags, cover_url: cover,
      is_published: true, generated_by_ai: true, model: art.model,
    }).select("id, slug, title").single();
    if (insErr) throw insErr;

    await db.from("hub_log").insert({ source: "hub-blog-generate", level: "info", message: `Nowy post: "${art.title}" [${art.model}]`, data: { slug, category: pick.category } });

    // Jeden elegancki wpis dziennie na Discord (rich embed — nie zaśmiecamy serwera).
    const hook = cfg["discord_webhook_url"];
    if (hook) {
      try {
        await fetch(hook, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "GrouAI Stream",
            embeds: [{
              author: { name: "✦ Nowy artykuł na blogu" },
              title: art.title,
              url: `https://grouaistream.com/blog/${slug}`,
              description: (art.description || "").slice(0, 300),
              color: 0xFF6B00,
              image: { url: cover },
              footer: { text: "GrouAI Stream · grouaistream.com" },
              timestamp: new Date().toISOString(),
            }],
          }) });
      } catch { /* */ }
    }

    return json({ success: true, slug, title: art.title, model: art.model });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.from("hub_log").insert({ source: "hub-blog-generate", level: "error", message: `Błąd: ${msg}` });
    return json({ error: msg }, 500);
  }
});
