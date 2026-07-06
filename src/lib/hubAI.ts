// GrouAI Hub — klient asystenta AI.
// Asystent (tekst + głos) działa na hubie z darmowymi modelami OpenRouter,
// niezależnie od Lovable. Zwraca kształt zgodny z supabase.functions.invoke,
// więc podmiana w istniejącym kodzie jest 1:1.
//
// Obsługiwane payloady (jak stare funkcje LIVE):
//  - ai-assistant:    { message, history?, userContext? } → data.response
//  - ai-voice-answer: { question, language? }             → data.answer

const HUB_AI_URL = "https://bmwtydwpevzhbdplilbr.supabase.co/functions/v1/ai-assistant";

export interface HubAIResult {
  data: { response?: string; answer?: string; model?: string; error?: string } | null;
  error: Error | null;
}

export async function invokeHubAI(body: Record<string, unknown>, timeoutMs = 60000): Promise<HubAIResult> {
  try {
    const res = await fetch(HUB_AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      return { data: null, error: new Error(`hub-ai ${res.status}`) };
    }
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
  }
}
