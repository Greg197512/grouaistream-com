// GROUAI HUB — studio-chat: ekspercki asystent GrouAI Studio (czat streaming).
// Zna muzykę, aranżację, instrumenty i inżynierię promptów (muzyka + wideo).
// Dokańcza pół-prompty i zwraca GOTOWY prompt między [[PROMPT]]...[[/PROMPT]].
// Auth: JWT usera LIVE (bvstv). AI: hub_config.openrouter_api_key. Passthrough SSE z OpenRouter.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const EXPERT_PROMPT = `Jesteś GrouAI Studio AI — światowej klasy producentem muzycznym, aranżerem i inżynierem promptów. Rozmawiasz normalnie (jak czat) i doradzasz. Znasz się perfekcyjnie na muzyce: gatunki i podgatunki, teoria i harmonia, tempo/BPM, instrumenty i brzmienia, aranżacja (intro, zwrotka, refren, bridge, drop, outro), miks i mastering, typy wokalu. Znasz też prompty do WIDEO/teledysków: sceneria, styl wizualny, ruch kamery, światło, kolorystyka, format 9:16 lub 16:9.

Twoje zadania:
1) Doradzasz i odpowiadasz na pytania o muzyce, studiach, instrumentach, jak promptować i aranżować.
2) Pomagasz ułożyć REWELACYJNY, bardzo szczegółowy prompt do GrouAI Studio. Jeśli użytkownik poda tylko kilka słów albo PÓŁ pomysłu — DOKOŃCZ go i dopracuj do pełnego, perfekcyjnego promptu.
3) Prompt do MUZYKI zawiera: gatunek+podgatunek, nastrój, tempo (BPM), 3-5 instrumentów, typ wokalu (np. ciepły męski), strukturę i temat/tekst; język wokalu (PL/EN/NL/UK) jeśli istotny.
4) Prompt do WIDEO/teledysku: sceneria, styl, ruch kamery, światło, kolor, nastrój, format.

ZASADY: Odpowiadaj ZAWSZE w języku użytkownika. Bądź konkretny i zwięzły (1-3 zdania rozmowy), bez lania wody. Gdy podajesz GOTOWY prompt do wklejenia, umieść go DOKŁADNIE między znacznikami, każdy w osobnej linii:
[[PROMPT]]
gotowy prompt jednym akapitem
[[/PROMPT]]
Zawsze, gdy user chce coś stworzyć/zmienić, dodaj taki blok [[PROMPT]] — to on trafia do głównego pola Studia.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const hub = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cfgRows } = await hub.from("hub_config").select("key, value");
  const cfg: Record<string, string> = {};
  for (const row of cfgRows || []) cfg[row.key] = row.value ?? "";

  // Auth: zalogowany user LIVE.
  const authHeader = req.headers.get("Authorization") ?? "";
  try {
    const live = createClient(cfg["bvstv_url"], cfg["bvstv_anon_key"], { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await live.auth.getUser();
    if (!u?.user) return json({ error: "unauthorized" }, 401);
  } catch { return json({ error: "unauthorized" }, 401); }

  const apiKey = cfg["openrouter_api_key"];
  if (!apiKey) return json({ error: "ai_not_configured" }, 200);
  const model = (cfg["openrouter_models"] || "meta-llama/llama-3.3-70b-instruct:free").split(",").map((m) => m.trim()).filter(Boolean)[0];

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const history = Array.isArray(body.messages) ? body.messages.slice(-12).map((m: any) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 4000) })) : [];
  if (!history.length) return json({ error: "no_messages" }, 400);

  const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://grouaistream.com",
      "X-Title": "GrouAI Studio Chat",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: EXPERT_PROMPT }, ...history],
      stream: true,
      max_tokens: 1200,
      temperature: 0.8,
    }),
  });

  if (!orRes.ok || !orRes.body) {
    const errTxt = await orRes.text().catch(() => "");
    return json({ error: "ai_error", status: orRes.status, details: errTxt.slice(0, 200) }, 200);
  }

  // Passthrough strumienia SSE (format OpenAI: data: {choices:[{delta:{content}}]} ... data: [DONE]).
  return new Response(orRes.body, {
    headers: { ...cors, "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },
  });
});
