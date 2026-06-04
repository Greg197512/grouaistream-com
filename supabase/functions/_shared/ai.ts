// AI Gateway — Grok (primary) / Anthropic (fallback)
// Replaces Lovable's ai.gateway.lovable.dev
//
// Usage:
//   import { callAI } from "../_shared/ai.ts";
//   const text = await callAI([{ role: "user", content: "Hello" }]);

export type AIMessage = { role: "system" | "user" | "assistant"; content: string };

export interface CallAIOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  responseFormat?: "text" | "json_object";
}

/**
 * Call AI — tries Grok first, falls back to Anthropic Claude.
 * Set GROK_API_KEY and/or ANTHROPIC_API_KEY in Supabase secrets.
 */
export async function callAI(
  messages: AIMessage[],
  opts: CallAIOptions = {}
): Promise<string> {
  const grokKey = Deno.env.get("GROK_API_KEY");
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");

  if (grokKey) {
    return await callGrok(messages, opts, grokKey);
  } else if (anthropicKey) {
    return await callAnthropic(messages, opts, anthropicKey);
  } else if (openaiKey) {
    return await callOpenAI(messages, opts, openaiKey);
  }
  throw new Error("No AI API key configured. Set GROK_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY.");
}

async function callGrok(messages: AIMessage[], opts: CallAIOptions, apiKey: string): Promise<string> {
  const model = opts.model?.includes("/") ? "grok-3-mini" : (opts.model ?? "grok-3-mini");
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.max_tokens ?? 2048,
      response_format: opts.responseFormat === "json_object" ? { type: "json_object" } : undefined,
    }),
  });
  if (!res.ok) throw new Error(`Grok error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

async function callAnthropic(messages: AIMessage[], opts: CallAIOptions, apiKey: string): Promise<string> {
  const system = messages.find(m => m.role === "system")?.content ?? "";
  const userMessages = messages.filter(m => m.role !== "system");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      max_tokens: opts.max_tokens ?? 2048,
      system: system || undefined,
      messages: userMessages,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content[0].text;
}

async function callOpenAI(messages: AIMessage[], opts: CallAIOptions, apiKey: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model ?? "gpt-4o-mini",
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.max_tokens ?? 2048,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}
