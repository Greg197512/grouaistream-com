// GROUAI HUB — ai-assistant
// Zamiennik funkcji ai-assistant + ai-voice-answer z projektu LIVE (tam brak klucza AI).
// Frontend grouaistream.com woła tę funkcję bezpośrednio. Darmowe modele OpenRouter
// z łańcuchem awaryjnym (hub_config.openrouter_models).
//
// Wejście (dwa formaty — zgodne ze starymi funkcjami):
//   A) czat/tekst:  { message, history?: [{role,content}], userContext? } → { response }
//   B) głos:        { question, language? }                               → { answer }
//
// Ochrona: tylko żądania z przeglądarki na grouaistream.com (Origin) — bez tokenu,
// bo woła to publiczny frontend. Modele darmowe → koszt zerowy.
// Deploy: verify_jwt = false.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ALLOWED_ORIGINS = [
  "https://grouaistream.com",
  "https://www.grouaistream.com",
  "https://grouaistream-com.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

const SYSTEM_PROMPT = `Jesteś asystentem GrouAI Stream (grouaistream.com) — polskiej platformy streamingu muzycznego z AI.
O platformie: weryfikowane odsłuchania (zero botów), artyści zarabiają na prawdziwych fanach, Groua Radio gra 24/7 (także w autach i Teslach), AI Studio generuje utwory w 15 gatunkach, playlisty pod nastrój (mood detection), plany Pro 19 zł i Ultimate 39 zł/mies.
Zasady: odpowiadaj w języku użytkownika (domyślnie polski). Bądź konkretny, pomocny i naturalny. Przy pytaniach o muzykę/platformę — pomagaj entuzjastycznie. Przy innych pytaniach — odpowiadaj normalnie, jak dobry asystent.`;

const VOICE_SUFFIX = `\nTo jest odpowiedź GŁOSOWA — mów krótko: maksymalnie 2-4 zdania, bez markdown, bez list, bez emoji. Sama treść do przeczytania na głos.`;

async function chat(models: string[], apiKey: string, messages: Array<{ role: string; content: string }>) {
  let lastErr = "";
  for (const model of models) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://grouaistream.com",
          "X-Title": "GrouAI Assistant",
        },
        body: JSON.stringify({ model, messages, max_tokens: 1200 }),
        signal: AbortSignal.timeout(45000),
      });
      if (!res.ok) {
        lastErr = `HTTP ${res.status} [${model}]`;
        continue;
      }
      const out = await res.json();
      if (out.error) {
        lastErr = `[${model}] ${JSON.stringify(out.error).slice(0, 120)}`;
        continue;
      }
      const content: string = out.choices?.[0]?.message?.content ?? "";
      if (content.trim()) return { content: content.trim(), model };
      lastErr = `empty [${model}]`;
    } catch (e) {
      lastErr = `fetch [${model}]: ${String(e).slice(0, 100)}`;
    }
  }
  throw new Error(lastErr || "all_models_failed");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // Ochrona: tylko z naszej strony (przeglądarka zawsze wysyła Origin przy fetch POST)
  const origin = req.headers.get("origin") || "";
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return json({ error: "forbidden_origin" }, 403);
  }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cfgRows } = await db.from("hub_config").select("key, value");
  const cfg: Record<string, string> = {};
  for (const row of cfgRows || []) cfg[row.key] = row.value ?? "";

  const apiKey = cfg["openrouter_api_key"];
  if (!apiKey) return json({ error: "ai_not_configured", response: "Asystent chwilowo niedostępny.", answer: "Asystent chwilowo niedostępny." }, 200);

  const models = (cfg["openrouter_models"] || cfg["openrouter_model"] || "meta-llama/llama-3.3-70b-instruct:free")
    .split(",").map((m) => m.trim()).filter(Boolean);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const isVoice = typeof body.question === "string" && body.question.trim();
  const userText: string = isVoice ? body.question.trim() : String(body.message ?? "").trim();
  if (!userText) return json({ error: "empty_message" }, 422);

  const langNote = isVoice && body.language ? `\nJęzyk odpowiedzi: ${body.language}.` : "";
  const system = SYSTEM_PROMPT + (isVoice ? VOICE_SUFFIX : "") + langNote;

  // Historia (format czatu): [{role:"user"|"assistant", content}]
  const history = Array.isArray(body.history)
    ? body.history
        .filter((h: any) => h && typeof h.content === "string" && (h.role === "user" || h.role === "assistant"))
        .slice(-10)
    : [];

  const userCtx = body.userContext?.userName ? `\n(Użytkownik: ${String(body.userContext.userName).slice(0, 60)})` : "";

  const messages = [
    { role: "system", content: system },
    ...history,
    { role: "user", content: userText + userCtx },
  ];

  try {
    const result = await chat(models, apiKey, messages);
    // Log lekki (bez treści rozmowy — prywatność)
    db.from("hub_log").insert({
      source: "ai-assistant", level: "info",
      message: `${isVoice ? "🎤 głos" : "💬 czat"} OK [${result.model}] (${userText.length} zn.)`,
    }).then(() => {});
    // Zwracamy OBA pola — zgodność z ai-assistant ({response}) i ai-voice-answer ({answer})
    return json({ response: result.content, answer: result.content, model: result.model });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    db.from("hub_log").insert({ source: "ai-assistant", level: "error", message: `Błąd AI: ${msg}` }).then(() => {});
    return json({
      error: "ai_failed",
      response: "Przepraszam, mam chwilowy problem z odpowiedzią. Spróbuj za moment.",
      answer: "Przepraszam, mam chwilowy problem z odpowiedzią. Spróbuj za moment.",
    }, 200);
  }
});
