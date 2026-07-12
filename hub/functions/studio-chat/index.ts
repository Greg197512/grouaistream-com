// GROUAI HUB — studio-chat: ekspercki asystent GrouAI Studio (czat streaming).
// Zna muzykę, aranżację, instrumenty i inżynierię promptów (muzyka + wideo).
// PAMIĘTA ostatnie utwory usera (z tabeli generations) → „następna w tym klimacie /
// z tym samym głosem" odtwarza ten sam gatunek/nastrój/opis wokalu.
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

TWOJE ZADANIA:
1) Doradzasz i odpowiadasz na pytania o muzyce, studiach, instrumentach, jak promptować i aranżować.
2) Pomagasz ułożyć REWELACYJNY, bardzo szczegółowy prompt do GrouAI Studio. Jeśli użytkownik poda tylko kilka słów albo PÓŁ pomysłu — DOKOŃCZ go i dopracuj.
3) Prompt do MUZYKI zawiera: gatunek+podgatunek, nastrój, tempo (BPM), 3-5 instrumentów, typ wokalu (np. ciepły męski, ochrypły, emocjonalny), strukturę i temat/tekst; język wokalu (PL/EN/NL/UK) jeśli istotny.
4) Prompt do WIDEO/teledysku: sceneria, styl, ruch kamery, światło, kolor, nastrój, format.

PAMIĘĆ UTWORÓW (ważne): Dostajesz listę ostatnich utworów użytkownika. Gdy user odwoła się do TYTUŁU (np. „jak Map of the Midnight Road") albo poprosi „następną w tym klimacie / z tym samym głosem" — ODTWÓRZ ten sam gatunek, nastrój, tempo ORAZ ten sam szczegółowy OPIS WOKALU (płeć, barwa, charakter, np. „ochrypły emocjonalny męski wokal, mid-range"). UWAGA: silnik muzyczny nie ma stałego ID głosu, więc „ten sam głos" = ten sam dokładny opis głosu (będzie bardzo podobny, nie w 100% identyczny). Jeśli user chce IDENTYCZNY głos — zaproponuj funkcję Voice Clone w panelu Studia.

INTERPRETACJA STYLU: Poprawnie rozumiej odniesienia do artystów/zespołów. Np. Linkin Park = nu-metal / alternative rock / rap-rock (mocne gitary, emocjonalny/ochrypły wokal, czasem screamy i elektronika), a NIE hip-hop. Zawsze dobieraj gatunek zgodnie z PRAWDZIWYM brzmieniem referencji.

ZASADY: Odpowiadaj ZAWSZE w języku użytkownika. Bądź konkretny i zwięzły (1-3 zdania rozmowy). Gdy podajesz GOTOWY prompt do wklejenia, umieść go DOKŁADNIE między znacznikami, każdy w osobnej linii:
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

  // Auth: zalogowany user LIVE. Ten sam klient posłuży do odczytu pamięci utworów.
  const authHeader = req.headers.get("Authorization") ?? "";
  const live = createClient(cfg["bvstv_url"], cfg["bvstv_anon_key"], { global: { headers: { Authorization: authHeader } } });
  try {
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

  // PAMIĘĆ — ostatnie utwory usera (RLS: tylko własne, bo klient ma jego JWT).
  let memory = "";
  try {
    const { data: gens } = await live.from("generations")
      .select("title, genre, prompt, instrumental")
      .order("created_at", { ascending: false }).limit(12);
    if (gens && gens.length) {
      memory = "PAMIĘĆ — OSTATNIE UTWORY UŻYTKOWNIKA (odwołuj się po tytule):\n" +
        gens.map((g: any, i: number) =>
          `${i + 1}. "${g.title || "bez tytułu"}" — ${g.instrumental ? "instrumental" : "z wokalem"}, gatunek: ${g.genre || "?"}; opis: ${String(g.prompt || "").slice(0, 150)}`
        ).join("\n");
    }
  } catch { /* brak pamięci — jedź dalej */ }

  const messages = [
    { role: "system", content: EXPERT_PROMPT },
    ...(memory ? [{ role: "system", content: memory }] : []),
    ...history,
  ];

  const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://grouaistream.com",
      "X-Title": "GrouAI Studio Chat",
    },
    body: JSON.stringify({ model, messages, stream: true, max_tokens: 1200, temperature: 0.8 }),
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
