// GROUAI HUB — whisper-dj („Szept o 4:17")
// Piszesz/mówisz jednym zdaniem, jak się czujesz → GPT czyta emocję i zwraca
// parametry muzyczne (gatunki, nastroje, energia) + JEDNO empatyczne zdanie
// w Twoim języku. Frontend dobiera na tej podstawie TEN jeden utwór i gra.
// Nie tworzymy muzyki — tłumaczymy uczucie na muzykę z naszego katalogu.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function admin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}
async function cfg(key: string): Promise<string> {
  const { data } = await admin().from("hub_config").select("value").eq("key", key).maybeSingle();
  return (data?.value as string) || "";
}

const GENRES = ["Pop", "Rock", "Hip-Hop", "Electronic", "Folk", "EDM", "Country", "R&B", "Disco", "Jazz", "Classical", "Ambient", "Lo-Fi", "Chill"];
const MOODS = ["happy", "sad", "calm", "energetic", "melancholic", "romantic", "dark", "dreamy", "uplifting", "intense", "chill", "hopeful", "nostalgic"];
const LANG = { pl: "Polish", en: "English", nl: "Dutch", ua: "Ukrainian", uk: "Ukrainian" } as Record<string, string>;

async function callGPT(models: string[], key: string, sentence: string, langName: string): Promise<any | null> {
  const sys = `You are the empathetic DJ of GrouAI Stream — you feel what a person feels and answer with music.
The user tells you, in one line, how they feel (maybe at 4:17 AM). Read the TRUE emotion beneath the words.
Return STRICT JSON only (no markdown):
{
  "mood_label": "<2-3 word feeling in ${langName}>",
  "emoji": "<one emoji>",
  "genres": [<2-4 from this list, best first: ${GENRES.join(", ")}>],
  "moods": [<2-3 from: ${MOODS.join(", ")}>],
  "energy": "<low|mid|high>",
  "reply": "<ONE warm, intimate sentence in ${langName} — not clinical, not fake-cheerful; speak to them like a friend who gets it, and hint at the song you're about to play>"
}
Rules: match the emotion honestly (if they hurt, don't force happy music — meet them, then lift gently). reply max ~180 chars, no quotes inside.`;
  for (const model of models) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "HTTP-Referer": "https://grouaistream.com", "X-Title": "GrouAI Whisper DJ" },
        body: JSON.stringify({
          model, temperature: 0.8, max_tokens: 500, response_format: { type: "json_object" },
          messages: [{ role: "system", content: sys }, { role: "user", content: sentence.slice(0, 500) }],
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) continue;
      const out = await res.json();
      const txt = (out.choices?.[0]?.message?.content ?? "").trim();
      const m = txt.match(/\{[\s\S]*\}/);
      if (!m) continue;
      const p = JSON.parse(m[0]);
      if (p && (p.genres || p.moods)) return p;
    } catch { /* następny model */ }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const text = String(body.text || "").trim();
    if (text.length < 2) return json({ error: "empty" }, 400);
    const language = String(body.language || "pl").toLowerCase();
    const langName = LANG[language] || "Polish";

    const key = (await cfg("openrouter_api_key")).trim();
    if (!key) return json({ error: "ai_not_configured" }, 200);
    const models = ((await cfg("studio_llm_models")) || "openai/gpt-4o,google/gemini-2.5-flash,meta-llama/llama-3.3-70b-instruct:free")
      .split(",").map((s) => s.trim()).filter(Boolean);

    const p = await callGPT(models, key, text, langName);
    if (!p) return json({ error: "read_failed" }, 200);

    const genres = Array.isArray(p.genres) ? p.genres.filter((g: string) => GENRES.includes(g)).slice(0, 4) : [];
    const moods = Array.isArray(p.moods) ? p.moods.map((m: string) => String(m).toLowerCase()).filter((m: string) => MOODS.includes(m)).slice(0, 3) : [];

    return json({
      ok: true,
      mood_label: String(p.mood_label || "").slice(0, 40),
      emoji: String(p.emoji || "🌙").slice(0, 4),
      genres: genres.length ? genres : ["Pop", "Chill"],
      moods: moods.length ? moods : ["calm"],
      energy: ["low", "mid", "high"].includes(p.energy) ? p.energy : "mid",
      reply: String(p.reply || "").slice(0, 240),
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
