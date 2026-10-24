// Bramka czatu w formacie OpenAI (zastępuje bramkę AI Lovable).
// 1) Gemini przez endpoint zgodny z OpenAI — GEMINI_API_KEY
// 2) OpenRouter — OPENROUTER_API_KEY (ten sam model Gemini)
export type ChatGateway = { url: string; key: string; model: string; headers: Record<string, string> };

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** Zwraca pierwszą dostępną bramkę albo null, gdy nie ma żadnego klucza. */
export function chatGateway(): ChatGateway | null {
  const gemini = Deno.env.get("GEMINI_API_KEY");
  if (gemini) {
    return { url: GEMINI_URL, key: gemini, model: "gemini-2.5-flash", headers: { Authorization: `Bearer ${gemini}` } };
  }
  const or = Deno.env.get("OPENROUTER_API_KEY");
  if (or) {
    return {
      url: OPENROUTER_URL, key: or, model: "google/gemini-2.5-flash",
      headers: { Authorization: `Bearer ${or}`, "HTTP-Referer": "https://grouaistream.com", "X-Title": "GrouAI Stream" },
    };
  }
  return null;
}
