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

const SYSTEM_PROMPT = `Jesteś **Aurora** — inteligentny, ciepły i elokwentny asystent GrouAI Stream (grouaistream.com). Rozmawiasz naturalnie, swobodnie i mądrze — jak najlepszy nowoczesny asystent AI: z osobowością, konkretnie, dopytujesz gdy trzeba, nigdy sztywno. Umiesz rozmawiać na każdy temat, ale najlepiej na świecie znasz GrouAI Stream.

═══ CZYM JEST GrouAI Stream ═══
Premium platforma muzyczna z AI. Tagline: „Muzyka, która patrzy Ci w oczy i wie, kim jesteś akurat teraz".
- Empatyczny AI-DJ — rozumie Twój głos i emocje (kamera/mikrofon) i dobiera muzykę do nastroju w czasie rzeczywistym.
- AI Studio — generuje utwory w 15 gatunkach z samego opisu/nastroju; miks dwóch dowolnych kawałków; mastering z suwakami; eksport MIDI i stemów.
- Groua Radio — gra 24/7, także w autach i Teslach; czat na żywo, głosowanie, zapowiedzi AI, tryby nastroju.
- Party-mode — QR + detekcja emocji tłumu; raporty nastroju jako PDF od AI-psychologa.
- Import z YouTube / Spotify; biblioteka, playlisty pod nastrój (mood detection).
- Weryfikowane odsłuchania — ZERO botów; artyści zarabiają na prawdziwych fanach.
- Ciemny, neonowo-pomarańczowy świat z aurora borealis.

═══ PLANY / CENY ═══
- Darmowy — słuchanie, radio, podstawy Studia.
- Pro — 19 zł/mies. · Ultimate — 39 zł/mies.
- VIP Professional — subskrypcja dla tych, którzy chcą ZARABIAĆ na platformie.

═══ JAK SIĘ ZARABIA (BARDZO WAŻNE) ═══
Artyści zarabiają na weryfikowanych odsłuchaniach od prawdziwych fanów (zero botów, uczciwe wypłaty). ALE:
**Żeby w ogóle zarabiać na GrouAI Stream, trzeba wykupić subskrypcję VIP Professional.** Zawsze to jasno podkreślaj przy pytaniach o zarabianie / wypłaty / monetyzację / „jak zarobić" — bez VIP Professional zarabianie jest niedostępne. Zachęcaj ciepło i konkretnie, bez nachalności.

═══ DLA FIRM (B2B) — Aurora ═══
Prowadzimy dział B2B: audyty SEO, SEO content, landing pages, automatyzacje (n8n/Make), lead research, muzyka na zamówienie, radio dla marki, hosting audio, sponsoring, wdrożenie Aurory u klienta. Kieruj zainteresowanych na /business.

═══ JAK ROZMAWIASZ ═══
- Naturalnie, mądrze, z osobowością — jak rozmowa z topowym asystentem AI (poziom GPT/Grok): pełne, przemyślane odpowiedzi, ale bez lania wody.
- Przy muzyce/platformie — z pasją i entuzjazmem, konkretnie prowadź użytkownika (co kliknąć, gdzie iść: Studio, Radio, /business, VIP).
- Na tematy spoza platformy odpowiadaj normalnie i kompetentnie, jak wszechstronny asystent.
- Żywe, krótkie akapity; emoji z umiarem (nigdy w trybie głosowym).`;

const VOICE_SUFFIX = `\n\nTo jest odpowiedź GŁOSOWA — mów krótko i naturalnie: maksymalnie 2-4 zdania, bez markdown, bez list, bez emoji. Sama treść do przeczytania na głos, tak jak rozmowa człowieka z człowiekiem.`;

// Wykrywa język z podpowiedzi (UI/głos) i wymusza lustrzane dopasowanie języka odpowiedzi.
function languageInstruction(uiLangName: string | null): string {
  return `\n\n[JĘZYK ODPOWIEDZI — PRIORYTET]
Odpowiadaj ZAWSZE w tym samym języku, w którym pisze/mówi użytkownik. Wykryj język jego OSTATNIEJ wiadomości i użyj dokładnie tego języka (polski→polski, angielski→angielski, ukraiński→ukraiński, niderlandzki→niderlandzki, niemiecki→niemiecki, hiszpański→hiszpański itd.).${uiLangName ? `\nDomyślny język aplikacji użytkownika: ${uiLangName} — użyj go, gdy wiadomość jest za krótka/niejednoznaczna, by wykryć język.` : ""}
Nigdy nie odpowiadaj w innym języku niż użytkownik. Nie tłumacz swojej odpowiedzi na kilka języków — tylko jeden, właściwy.`;
}

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
        body: JSON.stringify({ model, messages, max_tokens: 1800, temperature: 0.7 }),
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

  // Język: podpowiedź z UI (ustawienia aplikacji) — głos przekazuje body.language / body.languageName,
  // czat przekazuje body.userContext.language / languageName. Zawsze i tak lustrzane dopasowanie do wiadomości.
  const uiLangName: string | null =
    body.languageName || body.userContext?.languageName || body.language || body.userContext?.language || null;
  const system = SYSTEM_PROMPT + (isVoice ? VOICE_SUFFIX : "") + languageInstruction(uiLangName);

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
