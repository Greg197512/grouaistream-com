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

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  let payload: { message?: string; history?: { role: string; content: string }[]; userContext?: unknown; documentContext?: string } = {};
  try { payload = await req.json(); } catch { /* */ }

  // Dostawcy w kolejności pierwszeństwa — bierzemy pierwszy, dla którego jest klucz.
  // Wszyscy mówią protokołem OpenAI (stream SSE), więc klient bez zmian.
  const PROVIDERS = [
    { name: "openrouter", key: process.env.OPENROUTER_API_KEY, url: "https://openrouter.ai/api/v1/chat/completions", model: "anthropic/claude-3.5-sonnet" },
    { name: "groq", key: process.env.GROQ_API_KEY, url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile" },
    { name: "xai", key: process.env.XAI_API_KEY, url: "https://api.x.ai/v1/chat/completions", model: "grok-4.3" },
    { name: "openai", key: process.env.OPENAI_API_KEY, url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" },
  ].filter((p) => !!p.key);
  const provider = PROVIDERS[0];
  if (!provider) {
    return sseText(
      "⚠️ Asystent nie ma klucza AI. W Vercel (projekt grouaistream-com → Settings → Environment Variables) " +
      "dodaj jedną z zmiennych: OPENROUTER_API_KEY, GROQ_API_KEY (darmowy plan), XAI_API_KEY albo OPENAI_API_KEY, " +
      "a potem zrób redeploy."
    );
  }
  const key = provider.key as string;

  const message = (payload.message || "").toString();
  if (!message.trim()) return sseText("Napisz, w czym mogę pomóc 🙂");

  const history = Array.isArray(payload.history) ? payload.history.slice(-12) : [];
  // Dokument wrzucony wcześniej w rozmowie — trzymamy go w kontekście, żeby pytania
  // „a co w punkcie 3?" działały. Pomijamy, gdy dokument jest już w bieżącej wiadomości.
  const docCtx = typeof payload.documentContext === "string" && !message.includes("--- Dokument:")
    ? payload.documentContext.slice(0, 40000)
    : "";
  const messages = [
    { role: "system", content: buildSystem(payload.userContext) },
    ...(docCtx ? [{ role: "system", content: "Dokument z tej rozmowy (kontekst, odwołuj się do niego w razie potrzeby):" + docCtx }] : []),
    ...history.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 4000) })),
    { role: "user", content: message.slice(0, 48000) }, // + dokumenty (do 40 tys. znaków)
  ];

  const endpoint = provider.url;
  const model = process.env.ASSISTANT_MODEL || provider.model;

  try {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(provider.name === "openrouter" ? { "HTTP-Referer": "https://grouaistream.com", "X-Title": "GrouAI Stream" } : {}),
      },
      body: JSON.stringify({ model, stream: true, max_tokens: 2048, temperature: 0.8, messages }),
    });
    if (!r.ok || !r.body) {
      const t = await r.text().catch(() => "");
      return sseText(`⚠️ Błąd AI (${r.status}). ${t.slice(0, 200)}`);
    }
    // Przekaż strumień SSE bez zmian (OpenRouter/OpenAI = format OpenAI).
    return new Response(r.body, { headers: SSE_HEADERS });
  } catch (e) {
    return sseText("⚠️ Nie mogę teraz połączyć się z AI. Spróbuj ponownie za chwilę.");
  }
}
