// Asystent tekstowy GrouAI — backend na Vercel (Edge), połączony z AI (OpenRouter).
// Strumieniuje odpowiedź w formacie OpenAI SSE (choices[].delta.content), więc
// istniejący klient działa bez zmian. Zna stronę i pamięta zalogowanego
// użytkownika (kontekst przekazany z klienta). Ustaw w Vercel: OPENROUTER_API_KEY
// (opcjonalnie ASSISTANT_MODEL, np. "anthropic/claude-3.5-sonnet").
export const config = { runtime: "edge" };

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};

function sseText(text: string): Response {
  const body =
    `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n` +
    "data: [DONE]\n\n";
  return new Response(body, { headers: SSE_HEADERS });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSystem(ctx: any): string {
  const parts: string[] = [];
  parts.push(
    "Jesteś asystentem tekstowym serwisu muzycznego GrouAI Stream (GrouaRock). " +
    "Odpowiadasz w języku użytkownika, wyczerpująco i dokładnie — nie skracaj bez potrzeby. " +
    "Nie bój się dłuższych, wielozdaniowych odpowiedzi gdy temat tego wymaga: dodawaj kontekst, " +
    "ciekawostki, porównania, konkretne wskazówki. Znasz stronę i pomagasz w muzyce, radiu, " +
    "epokach (Groua Era), studiu AI i nawigacji. Możesz działać jak DJ: proponować świeże, " +
    "najlepsze zestawy utworów (z katalogu GrouAI oraz z YouTube) i opowiadać o wykonawcach " +
    "i utworach. Bądź pomocny, proaktywny i rozmawiaj płynnie na dowolny temat, nie tylko o muzyce."
  );
  parts.push(
    "ZASADY ODPOWIEDZI: odpowiadaj od razu na to, o co pyta użytkownik — bez przygotowań i bez " +
    "przekierowywania na inne funkcje. Nie zamawiasz ani nie odtwarzasz utworów w radiu; w tej " +
    "rozmowie tylko rozmawiasz, doradzasz i pomagasz."
  );
  parts.push(
    "DOKUMENTY I TEKSTY: gdy użytkownik wrzuci dokument lub wklei tekst (blok „--- Dokument: … ---”), " +
    "przeczytaj go uważnie i wykonaj jego prośbę — streść, popraw, przetłumacz, wypunktuj, odpowiedz " +
    "na pytania, zrób analizę. Gdy prośby nie ma, krótko powiedz, co widzisz w dokumencie i zaproponuj " +
    "konkretne działania. Przy arkuszach (CSV) odnoś się do kolumn i wartości."
  );
  parts.push(
    "MUZYKA: gdy użytkownik wrzuci plik audio lub wideo, NIE słyszysz go. Powiedz to wprost, nie udawaj " +
    "odsłuchu. Zareaguj na podstawie nazwy i kontekstu, zaproponuj realną pomoc (tekst piosenki, opis, " +
    "tytuł i tagi, plan miksu, pomysły na aranż, promocję) i zapytaj, czego potrzebuje. Gdy użytkownik " +
    "wkleja tekst piosenki — pomagaj: struktura, rymy, interpretacja, poprawki, wersje językowe."
  );
  if (ctx?.userName) parts.push(`Zalogowany użytkownik: ${ctx.userName}. Zwracaj się po imieniu, pamiętaj jego gust.`);
  if (ctx?.currentPath) parts.push(`Aktualna podstrona: ${ctx.currentPath}.`);
  if (ctx?.currentTrack) parts.push(`Teraz gra: "${ctx.currentTrack.title}" — ${ctx.currentTrack.artist}.`);
  if (ctx?.listeningStats) {
    try { parts.push(`Statystyki słuchania użytkownika: ${JSON.stringify(ctx.listeningStats).slice(0, 800)}.`); } catch { /* */ }
  }
  if (ctx?.siteKnowledge) {
    const sk = typeof ctx.siteKnowledge === "string" ? ctx.siteKnowledge : JSON.stringify(ctx.siteKnowledge);
    parts.push("Wiedza o stronie (na bieżąco):\n" + sk.slice(0, 3500));
  }
  return parts.join("\n");
}

// Tryb studia (GrouAI Studio DAW): polecenie zwykłymi słowami → akcje w JSON (wykonuje je przeglądarka).
const DAW_SYSTEM = `Jesteś realizatorem dźwięku w GrouAI Studio DAW. Użytkownik opisuje zwykłymi słowami, co chce zrobić
(często nie zna się na korektorach). Zamień polecenie na akcje i odpowiedz WYŁĄCZNIE obiektem JSON:
{"reply":"<1–2 zdania po polsku: co robisz i dlaczego, prostym językiem>","actions":[...]}
Dozwolone akcje (pole "track" = nazwa ścieżki ze STANU; pomiń, by użyć zaznaczonej):
- {"type":"fx","track":"…","add":{…},"set":{…}} — klucze: gate(-90..-30 dB, -90=wył.), hpf(20..400 Hz), deEss(0..100),
  eqLow/eqMid/eqHigh(-12..12 dB), presence(-6..10), air(-6..10), compress(0..100), reverb(0..100), delay(0..100);
  "add" = zmiana względna, "set" = wartość. Ciepło: eqLow+2 eqHigh-1; czytelność: presence+3 air+2; syczenie: deEss+25;
  dudnienie: hpf+40; szum: gate -50.
- {"type":"preset","track":"…","preset":"natural|pop|rap|ballad|radio|flat"}
- {"type":"smart","track":"…"} — automatyczna obróbka nagrania głosu
- {"type":"autotune","track":"…","key":"C..B","scale":"major|minor|chromatic","strength":0..1,"speedMs":0..200}
- {"type":"bpm","value":50..220}
- {"type":"drums","style":"Pop|Hip-hop|House|Trap","bars":1..32}
- {"type":"harmony","part":"bass|chords","key":"C..B","progression":"pop|doo|ballad|minor|dark","bars":1..32}
- {"type":"mix","track":"…","volumeDb":±dB,"pan":-1..1,"mute":bool,"solo":bool}
- {"type":"transport","action":"play|stop|record"}, {"type":"backing","prompt":"opis podkładu"}, {"type":"save"}, {"type":"export"}
Gdy polecenie jest pytaniem, odpowiedz w "reply" i zostaw "actions":[]. Nie dodawaj tekstu poza JSON.`;

type Payload = { message?: string; history?: { role: string; content: string }[]; userContext?: unknown; documentContext?: string; mode?: string; attachments?: unknown };
type Attempt = { provider: string; status: number | string };

/**
 * Łańcuch dostawców — próbujemy po kolei, aż któryś odpowie:
 * 1) klucze w Vercel (Gemini/Groq/OpenRouter za darmo, xAI/OpenAI płatne),
 * 2) Pollinations bez klucza (bywa wyłączony — HTTP 402),
 * 3) funkcja ai-assistant w Supabase (ma własne klucze OpenRouter/Gemini; ten sam format SSE,
 *    klient był pod nią pisany). Dla trybu DAW pomijamy ją — tam klient ma lokalny parser poleceń.
 */
async function answer(payload: Payload, attempts: Attempt[], skip: string[] = []): Promise<Response | null> {
  const message = (payload.message || "").toString();
  const history = Array.isArray(payload.history) ? payload.history.slice(-12) : [];
  // Dokument wrzucony wcześniej w rozmowie — trzymamy go w kontekście, żeby pytania
  // „a co w punkcie 3?" działały. Pomijamy, gdy dokument jest już w bieżącej wiadomości.
  const docCtx = typeof payload.documentContext === "string" && !message.includes("--- Dokument:")
    ? payload.documentContext.slice(0, 40000)
    : "";
  // Jedna wiadomość systemowa (część dostawców nie łyka kilku naraz).
  const system = payload.mode === "daw" ? DAW_SYSTEM : [
    buildSystem(payload.userContext),
    ...(docCtx ? ["Dokument z tej rozmowy (kontekst, odwołuj się do niego w razie potrzeby):" + docCtx] : []),
  ].join("\n\n");
  const messages = [
    { role: "system", content: system },
    ...history.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 4000) })),
    { role: "user", content: message.slice(0, 48000) }, // + dokumenty (do 40 tys. znaków)
  ];

  const keyed = [
    { name: "gemini", key: process.env.GEMINI_API_KEY, url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", model: "gemini-2.5-flash" },
    { name: "groq", key: process.env.GROQ_API_KEY, url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile" },
    { name: "openrouter", key: process.env.OPENROUTER_API_KEY, url: "https://openrouter.ai/api/v1/chat/completions", model: "google/gemma-4-31b-it:free" },
    { name: "xai", key: process.env.XAI_API_KEY, url: "https://api.x.ai/v1/chat/completions", model: "grok-4.3" },
    { name: "openai", key: process.env.OPENAI_API_KEY, url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" },
  ].filter((p) => !!p.key);

  for (const p of keyed) {
    try {
      const r = await fetch(p.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${p.key}`,
          "Content-Type": "application/json",
          ...(p.name === "openrouter" ? { "HTTP-Referer": "https://grouaistream.com", "X-Title": "GrouAI Stream" } : {}),
        },
        body: JSON.stringify({ model: (keyed[0] === p && process.env.ASSISTANT_MODEL) || p.model, stream: true, max_tokens: 2048, temperature: 0.8, messages }),
        signal: AbortSignal.timeout(25_000),
      });
      attempts.push({ provider: p.name, status: r.status });
      if (r.ok && r.body) return new Response(r.body, { headers: SSE_HEADERS }); // format OpenAI — klient bez zmian
      console.error(`[assistant] ${p.name}: HTTP ${r.status}`, (await r.text().catch(() => "")).slice(0, 300));
    } catch (e) {
      attempts.push({ provider: p.name, status: String(e).slice(0, 80) });
    }
  }

  // Pollinations bez klucza — cała odpowiedź naraz, wysyłana jako SSE.
  if (!skip.includes("pollinations")) try {
    const r = await fetch("https://text.pollinations.ai/openai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai", stream: false, messages }),
      signal: AbortSignal.timeout(20_000),
    });
    attempts.push({ provider: "pollinations", status: r.status });
    const j = (await r.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null;
    const content = j?.choices?.[0]?.message?.content?.trim();
    if (r.ok && content) return sseText(content);
    console.error("[assistant] pollinations: HTTP", r.status);
  } catch (e) {
    attempts.push({ provider: "pollinations", status: String(e).slice(0, 80) });
  }

  if (payload.mode === "daw") return null;
  const sbUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
  const sbKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (sbUrl && sbKey) {
    try {
      const r = await fetch(`${sbUrl}/functions/v1/ai-assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: sbKey, Authorization: `Bearer ${sbKey}` },
        body: JSON.stringify({ message, history, userContext: payload.userContext, attachments: payload.attachments }),
        signal: AbortSignal.timeout(45_000),
      });
      attempts.push({ provider: "supabase-ai-assistant", status: r.status });
      if (r.ok && r.body) return new Response(r.body, { headers: SSE_HEADERS });
      console.error("[assistant] supabase ai-assistant: HTTP", r.status, (await r.text().catch(() => "")).slice(0, 300));
    } catch (e) {
      attempts.push({ provider: "supabase-ai-assistant", status: String(e).slice(0, 80) });
    }
  }
  return null;
}

/** Tekst z odpowiedzi SSE (do diagnostyki ?ping=1). */
async function sseToText(r: Response, max = 400): Promise<string> {
  const reader = r.body?.getReader();
  if (!reader) return "";
  const dec = new TextDecoder();
  let buf = "", out = "";
  const deadline = Date.now() + 40_000;
  while (out.length < max && Date.now() < deadline) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
      try { out += JSON.parse(line.slice(6))?.choices?.[0]?.delta?.content ?? ""; } catch { /* inne zdarzenia */ }
    }
  }
  reader.cancel().catch(() => {});
  return out.slice(0, max);
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });

  // Diagnostyka: GET /api/assistant?ping=1 → który dostawca odpowiada (bez kluczy w odpowiedzi).
  if (req.method === "GET" && new URL(req.url).searchParams.has("ping")) {
    const attempts: Attempt[] = [];
    const skip = (new URL(req.url).searchParams.get("skip") || "").split(",");
    const r = await answer({ message: "Odpowiedz jednym krótkim zdaniem: czy działasz?", userContext: { language: "pl" } }, attempts, skip);
    const sample = r ? await sseToText(r) : "";
    return new Response(JSON.stringify({ ok: Boolean(sample), sample, attempts }), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
  }

  let payload: Payload = {};
  try { payload = await req.json(); } catch { /* */ }
  const message = (payload.message || "").toString();
  if (!message.trim()) return sseText("Napisz, w czym mogę pomóc 🙂");

  const attempts: Attempt[] = [];
  const r = await answer(payload, attempts);
  if (r) return r;
  console.error("[assistant] żaden dostawca nie odpowiedział:", JSON.stringify(attempts), "— dodaj w Vercel GEMINI_API_KEY lub GROQ_API_KEY (darmowe)");
  const en = (payload.userContext as { language?: string } | undefined)?.language === "en";
  return sseText(en ? "The assistant is temporarily unavailable. Please try again in a few minutes 🙏" : "Asystent jest chwilowo niedostępny. Spróbuj ponownie za kilka minut 🙏");
}
