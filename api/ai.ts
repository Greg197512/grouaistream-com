// Lekki optymalizator kosztów AI (Vercel Edge). Cel: ~50% mniej tokenów/kredytów
// przy zachowaniu jakości. Drop-in za /api/assistant — zwraca ten sam SSE
// (OpenAI delta), więc klient nie wymaga zmian poza adresem.
//
// Techniki (realne oszczędności):
//  1. Routing modelu: domyślnie TANI; DROGI tylko gdy quality=true lub prompt złożony.
//  2. Kompresja kontekstu: przycięcie historii, dedup, limit znaków/wiadomość.
//  3. Cache odpowiedzi: klucz = SHA-256 znormalizowanego promptu (+model). Trafienie
//     = 0 tokenów (odsyłamy zapamiętaną treść). Pamięć per-instancja (ciepła);
//     do trwałego/współdzielonego użyj KV (Upstash) — patrz komentarz niżej.
//  4. Early-stop: rozsądny max_tokens per trasa.
//
// ENV (Vercel): OPENROUTER_API_KEY, opc. AI_MODEL_CHEAP, AI_MODEL_STRONG.
export const config = { runtime: "edge" };

const SSE = { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" };
const CHEAP = () => process.env.AI_MODEL_CHEAP || "openai/gpt-4o-mini";
const STRONG = () => process.env.AI_MODEL_STRONG || "anthropic/claude-3.5-sonnet";

type Msg = { role: string; content: string };

// --- Cache (best-effort, per ciepła instancja edge) ---
const CACHE = new Map<string, { text: string; exp: number }>();
const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 500;

function sseOnce(text: string): Response {
  return new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n` + "data: [DONE]\n\n", { headers: SSE });
}
async function sha(s: string): Promise<string> {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

// Heurystyka złożoności: długość, wieloczęściowość, słowa „twórcze/analityczne".
function looksComplex(msg: string, history: Msg[]): boolean {
  if (msg.length > 600) return true;
  if (history.length > 6) return true;
  return /(napisz|wygeneruj|zaprojektuj|przeanalizuj|porównaj|kod|debug|strategi|plan|krok po kroku|analyz|write|design|refactor)/i.test(msg);
}

// Kompresja kontekstu: ostatnie N tur, bez duplikatów, limit znaków/wiadomość.
function compress(history: Msg[]): Msg[] {
  const KEEP = 8, CAP = 1500;
  const out: Msg[] = [];
  let prev = "";
  for (const m of history.slice(-KEEP)) {
    const content = String(m.content || "").slice(0, CAP);
    const key = m.role + "|" + norm(content);
    if (key === prev) continue; // dedup kolejnych identycznych
    prev = key;
    out.push({ role: m.role === "assistant" ? "assistant" : "user", content });
  }
  return out;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  let body: { message?: string; history?: Msg[]; quality?: boolean; system?: string } = {};
  try { body = await req.json(); } catch { /* */ }

  const message = (body.message || "").toString().slice(0, 8000);
  if (!message.trim()) return sseOnce("Napisz, w czym mogę pomóc 🙂");

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return sseOnce("⚠️ Brak OPENROUTER_API_KEY w Vercel.");

  const history = Array.isArray(body.history) ? compress(body.history) : [];
  const model = body.quality || looksComplex(message, history) ? STRONG() : CHEAP();
  const maxTokens = model === STRONG() ? 1200 : 600; // early-stop: tani model = krótsza odpowiedź

  // Cache: tylko gdy brak długiej historii (bezpieczne, powtarzalne pytania).
  const cacheable = history.length <= 1;
  const cacheKey = cacheable ? await sha(model + "|" + norm(message) + "|" + norm(body.system || "")) : "";
  if (cacheable) {
    const hit = CACHE.get(cacheKey);
    if (hit && hit.exp > Date.now()) return sseOnce(hit.text); // 0 tokenów
  }

  const messages: Msg[] = [
    { role: "system", content: (body.system || "Jesteś zwięzłym, pomocnym asystentem GrouAI Stream. Odpowiadaj krótko i konkretnie po polsku.").slice(0, 2000) },
    ...history,
    { role: "user", content: message },
  ];

  let r: Response;
  try {
    r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "HTTP-Referer": "https://grouaistream.com", "X-Title": "GrouAI Stream" },
      body: JSON.stringify({ model, stream: true, max_tokens: maxTokens, temperature: 0.7, messages }),
    });
  } catch { return sseOnce("⚠️ Nie mogę połączyć się z AI."); }
  if (!r.ok || !r.body) return sseOnce(`⚠️ Błąd AI (${r.status}).`);

  // Tee: strumień do klienta + zbieranie treści do cache.
  if (!cacheable) return new Response(r.body, { headers: SSE });
  const [toClient, toCache] = r.body.tee();
  (async () => {
    try {
      const rd = toCache.getReader(); const dec = new TextDecoder(); let buf = "", text = "";
      for (;;) {
        const { done, value } = await rd.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        for (const line of buf.split("\n")) {
          const t = line.trim(); if (!t.startsWith("data:")) continue;
          const d = t.slice(5).trim(); if (d === "[DONE]") continue;
          try { const c = JSON.parse(d)?.choices?.[0]?.delta?.content; if (c) text += c; } catch { /* */ }
        }
        buf = buf.slice(buf.lastIndexOf("\n") + 1);
      }
      if (text) { if (CACHE.size >= MAX_ENTRIES) CACHE.clear(); CACHE.set(cacheKey, { text, exp: Date.now() + TTL_MS }); }
    } catch { /* */ }
  })();
  return new Response(toClient, { headers: SSE });
}

// Trwały/współdzielony cache: podmień Map na Upstash Redis (REST) — 2 linie w
// get/set, klucz ten sam (sha). Wtedy trafienia działają między instancjami i
// deployami (jeszcze większa oszczędność przy powtarzalnych pytaniach).
