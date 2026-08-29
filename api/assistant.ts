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
    "Odpowiadasz zwięźle, konkretnie i w języku użytkownika. Znasz stronę i pomagasz " +
    "w muzyce, radiu, epokach (Groua Era), studiu AI i nawigacji. Możesz działać jak DJ: " +
    "proponować świeże, najlepsze zestawy utworów (z katalogu GrouAI oraz z YouTube) i " +
    "opowiadać o wykonawcach i utworach. Bądź pomocny i proaktywny."
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
  let payload: { message?: string; history?: { role: string; content: string }[]; userContext?: unknown } = {};
  try { payload = await req.json(); } catch { /* */ }

  const key = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) return sseText("⚠️ Asystent nie jest jeszcze skonfigurowany — ustaw OPENROUTER_API_KEY w zmiennych Vercel.");

  const message = (payload.message || "").toString();
  if (!message.trim()) return sseText("Napisz, w czym mogę pomóc 🙂");

  const history = Array.isArray(payload.history) ? payload.history.slice(-12) : [];
  const messages = [
    { role: "system", content: buildSystem(payload.userContext) },
    ...history.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 4000) })),
    { role: "user", content: message.slice(0, 8000) },
  ];

  const usingOpenRouter = !!process.env.OPENROUTER_API_KEY;
  const endpoint = usingOpenRouter
    ? "https://openrouter.ai/api/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
  const model = process.env.ASSISTANT_MODEL || (usingOpenRouter ? "anthropic/claude-3.5-sonnet" : "gpt-4o-mini");

  try {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(usingOpenRouter ? { "HTTP-Referer": "https://grouaistream.com", "X-Title": "GrouAI Stream" } : {}),
      },
      body: JSON.stringify({ model, stream: true, max_tokens: 1200, temperature: 0.8, messages }),
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
