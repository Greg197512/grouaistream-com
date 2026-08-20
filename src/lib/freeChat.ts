// Darmowy model rozmowny (Pollinations, zgodny z OpenAI) — bez klucza, bez kosztów.
// Ostatnia warstwa asystenta: gdy główny silnik nic nie zwróci, i tak odpowiadamy
// płynnie na każdy temat (jak nowoczesny asystent AI).

interface ChatMsg { role: string; content: string }

export async function freeChat(
  message: string,
  history: ChatMsg[] = [],
  lang = "pl",
): Promise<string | null> {
  const clean = (message || "").trim();
  if (!clean) return null;

  const system = {
    role: "system",
    content:
      `Jesteś GrouAI — przyjaznym, elokwentnym asystentem serwisu muzycznego GrouAI Stream. ` +
      `Rozmawiasz swobodnie i płynnie na KAŻDY temat, jak nowoczesny asystent AI. ` +
      `Odpowiadaj naturalnie, konkretnie i pomocnie, w języku użytkownika (kod: ${lang}). ` +
      `Gdy pytanie dotyczy muzyki, tworzenia utworów, radia czy funkcji serwisu — chętnie doradź.`,
  };
  const msgs = [
    system,
    ...history.slice(-8).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    })),
    { role: "user", content: clean },
  ];

  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 30000);
    const res = await fetch("https://text.pollinations.ai/openai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai", messages: msgs, temperature: 0.8 }),
      signal: ctrl.signal,
    });
    clearTimeout(to);
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const txt = data?.choices?.[0]?.message?.content
      ?? data?.choices?.[0]?.delta?.content
      ?? (typeof data === "string" ? data : null);
    return typeof txt === "string" && txt.trim() ? txt.trim() : null;
  } catch {
    return null;
  }
}
