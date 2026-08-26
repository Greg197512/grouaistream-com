// Jednorazowe zapytanie do asystenta (Vercel /api/assistant) — zbiera cały
// strumień SSE i zwraca gotowy tekst. Używane np. w rolkach („opowiedz o…").
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function askAssistantOnce(message: string, userContext?: any): Promise<string> {
  try {
    const r = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, userContext }),
    });
    if (!r.ok || !r.body) return "";
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let out = "";
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf("\n")) !== -1) {
        let line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const j = line.slice(6).trim();
        if (j === "[DONE]") continue;
        try { const p = JSON.parse(j); const c = p.choices?.[0]?.delta?.content; if (c) out += c; } catch { /* */ }
      }
    }
    return out.trim();
  } catch {
    return "";
  }
}
