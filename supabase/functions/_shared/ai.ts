// _shared/ai.ts — Unified AI gateway
// Primary: OpenRouter (free models), fallback: Anthropic, then OpenAI
//
// Required Supabase secrets:
//   OPENROUTER_API_KEY  — free at openrouter.ai (primary)
//   ANTHROPIC_API_KEY   — fallback
//   OPENAI_API_KEY      — second fallback

export type AIMessage = { role: "system" | "user" | "assistant"; content: string };

export interface CallAIOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_FREE_MODEL = "google/gemma-2-9b-it:free";

async function callOpenRouter(messages: AIMessage[], opts: CallAIOptions, apiKey: string): Promise<string> {
  const model = opts.model?.includes("/") ? opts.model : DEFAULT_FREE_MODEL;
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://grouaistream.com",
      "X-Title": "Groua AI Stream",
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.7,
      messages,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

async function callAnthropic(messages: AIMessage[], opts: CallAIOptions, apiKey: string): Promise<string> {
  const systemMsg = messages.find((m) => m.role === "system");
  const userMsgs = messages.filter((m) => m.role !== "system");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      max_tokens: opts.maxTokens ?? 4096,
      system: systemMsg?.content,
      messages: userMsgs,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content[0].text;
}

async function callOpenAI(messages: AIMessage[], opts: CallAIOptions, apiKey: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: opts.maxTokens ?? 4096,
      messages,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

export async function callAI(messages: AIMessage[], opts: CallAIOptions = {}): Promise<string> {
  const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");

  if (openrouterKey) return await callOpenRouter(messages, opts, openrouterKey);
  if (anthropicKey) return await callAnthropic(messages, opts, anthropicKey);
  if (openaiKey) return await callOpenAI(messages, opts, openaiKey);
  throw new Error("No AI API key configured. Add OPENROUTER_API_KEY to Supabase secrets.");
}
