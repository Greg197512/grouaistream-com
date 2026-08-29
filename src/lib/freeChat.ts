// Darmowy model rozmowny (Pollinations, zgodny z OpenAI) — bez klucza, bez kosztów.
// Ostatnia warstwa asystenta: gdy główny silnik nic nie zwróci, i tak odpowiadamy
// płynnie na każdy temat (jak nowoczesny asystent AI).

import { SITE_KNOWLEDGE } from "@/lib/siteKnowledge";

interface ChatMsg { role: string; content: string }

async function pollinationsChat(messages: { role: string; content: string }[], timeoutMs = 30000): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch("https://text.pollinations.ai/openai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai", messages, temperature: 0.85 }),
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
      `Znasz CAŁY serwis (stare i nowe funkcje) — oto wiedza o nim:\n\n${SITE_KNOWLEDGE}`,
  };
  const msgs = [
    system,
    ...history.slice(-8).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    })),
    { role: "user", content: clean },
  ];
  return pollinationsChat(msgs, 30000);
}

/**
 * Żywa, wygadana zapowiedź DJ-a dla utworu (darmowo, przez Pollinations).
 * Zwraca 1–2 charyzmatyczne zdania w języku użytkownika, albo null (fallback do szablonów).
 */
export async function freeDjLine(
  opts: { title: string; artist: string; genre?: string; mood?: string; lang?: string },
): Promise<string | null> {
  const langNames: Record<string, string> = { pl: "polsku", en: "angielsku", nl: "niderlandzku", ua: "ukraińsku" };
  const lang = (opts.lang || "pl").slice(0, 2);
  const sys = {
    role: "system",
    content:
      `Jesteś GrouAI DJ — energetyczny, charyzmatyczny i WYGADANY radiowy didżej. ` +
      `Mówisz z pazurem, humorem i luzem, jak prawdziwy prowadzący na żywo. ` +
      `Zwróć TYLKO 1–2 krótkie, żywe zdania zapowiedzi (bez cudzysłowów, bez opisu, bez emoji), po ${langNames[lang] || "polsku"}.`,
  };
  const user = {
    role: "user",
    content: `Zapowiedz utwór „${opts.title}” — ${opts.artist}${opts.genre ? ` (${opts.genre})` : ""}${opts.mood ? `, nastrój: ${opts.mood}` : ""}. Rozkręć słuchaczy.`,
  };
  const line = await pollinationsChat([sys, user], 7000);
  if (!line) return null;
  // pierwsze 2 zdania, bez cudzysłowów
  return line.replace(/^["'“”„»«\s]+|["'“”„»«\s]+$/g, "").split("\n")[0].slice(0, 240).trim() || null;
}
