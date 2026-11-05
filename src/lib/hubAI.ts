// GrouAI Hub — klient asystenta AI.
// Asystent (tekst + głos) działa na hubie z darmowymi modelami OpenRouter,
// niezależnie od Lovable. Zwraca kształt zgodny z supabase.functions.invoke,
// więc podmiana w istniejącym kodzie jest 1:1.
//
// Obsługiwane payloady (jak stare funkcje LIVE):
//  - ai-assistant:    { message, history?, userContext? } → data.response
//  - ai-voice-answer: { question, language? }             → data.answer

// Stary hub (bmwtydwpevzhbdplilbr) już nie istnieje — asystent idzie przez Vercel /api/assistant
// (łańcuch dostawców z zapasem na funkcję ai-assistant głównego projektu). Odpowiedź SSE → tekst.

export interface HubAIResult {
  data: { response?: string; answer?: string; model?: string; error?: string } | null;
  error: Error | null;
}

async function readSse(res: Response): Promise<string> {
  const text = await res.text();
  let out = "";
  for (const line of text.split("\n")) {
    const l = line.trim();
    if (!l.startsWith("data:")) continue;
    const d = l.slice(5).trim();
    if (!d || d === "[DONE]") continue;
    try { out += JSON.parse(d)?.choices?.[0]?.delta?.content ?? ""; } catch { /* */ }
  }
  return out.trim();
}

export async function invokeHubAI(body: Record<string, unknown>, timeoutMs = 60000): Promise<HubAIResult> {
  try {
    const message = String(body.message ?? body.question ?? "");
    const userContext = (body.userContext as Record<string, unknown> | undefined) ?? (body.language ? { language: body.language } : undefined);
    const res = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history: body.history, userContext }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { data: null, error: new Error(`assistant ${res.status}`) };
    const reply = await readSse(res);
    if (!reply) return { data: null, error: new Error("assistant: pusta odpowiedź") };
    return { data: { response: reply, answer: reply }, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
  }
}
