// GROUAI HUB — studio-storyboard: z tekstu/klimatu utworu układa sceny teledysku.
// AI (OpenRouter) czyta tytuł + tagi + tekst piosenki i pisze N spójnych,
// kinowych opisów ujęć (po angielsku — modele wideo tego wymagają), które
// wizualnie opowiadają historię utworu. Frontend generuje z nich klipy.
// Auth: JWT użytkownika z LIVE (bvstv).
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cfgRows } = await db.from("hub_config").select("key, value");
  const cfg: Record<string, string> = {};
  for (const row of cfgRows || []) cfg[row.key] = row.value ?? "";

  // Autoryzacja użytkownika przez auth LIVE (bvstv).
  const authHeader = req.headers.get("Authorization") ?? "";
  try {
    const bvstv = createClient(cfg["bvstv_url"], cfg["bvstv_anon_key"], { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await bvstv.auth.getUser();
    if (!u?.user) return json({ ok: false, error: "unauthorized" }, 401);
  } catch {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const apiKey = cfg["openrouter_api_key"];
  const models = (cfg["openrouter_models"] || cfg["openrouter_model"] || "meta-llama/llama-3.3-70b-instruct:free")
    .split(",").map((m) => m.trim()).filter(Boolean);

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: "invalid_json" }, 400); }

  const count = Math.min(Math.max(Number(body.count || 4), 1), 8);
  const title = String(body.title || "").slice(0, 200);
  const tags = String(body.tags || "").slice(0, 300);
  const lyrics = String(body.lyrics || "").slice(0, 2500);
  const songPrompt = String(body.song_prompt || "").slice(0, 500);
  const styleHint = String(body.style || "").slice(0, 300);
  const singing = body.singing === true;

  // Awaryjne sceny, jeśli AI zawiedzie — spójne z tagami/klimatem.
  const fallback = (): string[] => {
    const base = [tags, styleHint, songPrompt].filter(Boolean).join(", ") || "cinematic music video, moody neon lighting";
    const shots = singing
      ? ["close-up of the singer singing into the camera, face well-lit, lips clearly visible", "medium shot of the same singer performing, chest-up, emotional expression", "the same singer singing under stage lights, face front and centered", "slow push-in on the same singer's face while singing"]
      : ["wide establishing shot", "close-up of the artist", "dynamic tracking shot", "slow-motion detail", "aerial drone shot", "silhouette against light", "rain and reflections", "crowd energy"];
    return Array.from({ length: count }).map((_, i) => `${shots[i % shots.length]}, ${base}, cinematic, high quality`);
  };

  if (!apiKey) return json({ ok: true, scenes: fallback(), fallback: true });

  const singingRules = singing
    ? ` CRITICAL (lip-sync performance video): EVERY scene MUST clearly show THE SAME singer (identical face, hair, outfit in every scene) facing the camera and singing, with the mouth and full face clearly visible and well-lit, framed chest-up or closer. No scenes without the singer's face. The body language and emotion must match the lyrics of that moment.`
    : "";
  const system = `You are a professional music video director. From a song's title, style tags and lyrics, write a coherent shot list that visually tells the song's story and mood. Return ${count} scene descriptions IN ENGLISH, in narrative order. Each scene: 1-2 sentences, concrete cinematic visuals (setting, subject, action, camera move, lighting), KEEP A CONSISTENT protagonist and visual style across all scenes for continuity. No lyrics text on screen.${singingRules} Before answering, VERIFY each scene truly reflects the meaning and emotion of the corresponding part of the lyrics — revise any scene that does not. Return ONLY JSON: {"scenes":["...","..."]}.`;
  const user = `TITLE: ${title || "(none)"}\nSTYLE TAGS: ${tags || "(none)"}\nEXTRA STYLE HINT: ${styleHint || "(none)"}\nSONG IDEA: ${songPrompt || "(none)"}\nLYRICS:\n${lyrics || "(instrumental / no lyrics — infer mood from tags)"}\n\nWrite ${count} scenes.`;

  for (const model of models) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://grouaistream.com", "X-Title": "GrouAI Storyboard" },
        body: JSON.stringify({ model, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: user }], max_tokens: 1200, temperature: 0.8 }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) continue;
      const out = await res.json();
      const raw = out.choices?.[0]?.message?.content || "";
      let parsed: any = null;
      try { parsed = JSON.parse(raw); } catch {
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) { try { parsed = JSON.parse(m[0]); } catch { /* */ } }
      }
      const scenes = Array.isArray(parsed?.scenes) ? parsed.scenes.filter((s: any) => typeof s === "string" && s.trim().length > 5) : [];
      if (scenes.length >= 1) {
        const trimmed = scenes.slice(0, count).map((s: string) => s.trim());
        while (trimmed.length < count) trimmed.push(fallback()[trimmed.length]);
        return json({ ok: true, scenes: trimmed, model });
      }
    } catch { /* następny model */ }
  }

  return json({ ok: true, scenes: fallback(), fallback: true });
});
