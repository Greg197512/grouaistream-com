// _shared/ai.ts — Unified AI gateway
//
// Fallback chain (używa pierwszego dostępnego klucza):
//   1. Gemini 2.0 Flash    — GEMINI_API_KEY       (1500 req/dzień free)
//   2. DeepSeek V3         — DEEPSEEK_API_KEY      ($0.27/1M tokenów, prawie gratis)
//   3. Groq Llama 3.3 70B  — GROQ_API_KEY          (bardzo szybki, free tier)
//   4. Mistral Small        — MISTRAL_API_KEY       (free tier)
//   5. OpenRouter free      — OPENROUTER_API_KEY    (deepseek/llama/:free)
//   6. Anthropic Claude     — ANTHROPIC_API_KEY     (płatny, fallback)
//   7. OpenAI GPT-4o-mini   — OPENAI_API_KEY        (płatny, ostatni fallback)

export type AIMessage = { role: "system" | "user" | "assistant"; content: string };

export interface CallAIOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

// ─── Gemini ───────────────────────────────────────────────────────────────────
async function callGemini(messages: AIMessage[], opts: CallAIOptions, apiKey: string): Promise<string> {
  const model = opts.model && !opts.model.includes("/") ? opts.model : "gemini-2.0-flash";
  const systemMsg = messages.find((m) => m.role === "system");
  const chatMsgs = messages.filter((m) => m.role !== "system");
  const contents = chatMsgs.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const body: Record<string, unknown> = {
    contents,
    generationConfig: { maxOutputTokens: opts.maxTokens ?? 4096, temperature: opts.temperature ?? 0.7 },
  };
  if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ─── DeepSeek ─────────────────────────────────────────────────────────────────
async function callDeepSeek(messages: AIMessage[], opts: CallAIOptions, apiKey: string): Promise<string> {
  const model = opts.model || "deepseek-chat"; // deepseek-chat = V3, deepseek-reasoner = R1
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.7,
      messages,
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

// ─── Groq ─────────────────────────────────────────────────────────────────────
async function callGroq(messages: AIMessage[], opts: CallAIOptions, apiKey: string): Promise<string> {
  const model = opts.model || "llama-3.3-70b-versatile"; // szybki i darmowy
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.7,
      messages,
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

// ─── Mistral ──────────────────────────────────────────────────────────────────
async function callMistral(messages: AIMessage[], opts: CallAIOptions, apiKey: string): Promise<string> {
  const model = opts.model || "mistral-small-latest";
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.7,
      messages,
    }),
  });
  if (!res.ok) throw new Error(`Mistral ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

// ─── OpenRouter (free models) ─────────────────────────────────────────────────
async function callOpenRouter(messages: AIMessage[], opts: CallAIOptions, apiKey: string): Promise<string> {
  const model = opts.model?.includes("/") ? opts.model : "deepseek/deepseek-chat-v3-0324:free";
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://grouaistream.com",
      "X-Title": "Groua AI Stream",
    },
    body: JSON.stringify({ model, max_tokens: opts.maxTokens ?? 4096, temperature: opts.temperature ?? 0.7, messages }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

// ─── Anthropic ────────────────────────────────────────────────────────────────
async function callAnthropic(messages: AIMessage[], opts: CallAIOptions, apiKey: string): Promise<string> {
  const systemMsg = messages.find((m) => m.role === "system");
  const userMsgs = messages.filter((m) => m.role !== "system");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      max_tokens: opts.maxTokens ?? 4096,
      system: systemMsg?.content,
      messages: userMsgs,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content[0].text;
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────
async function callOpenAI(messages: AIMessage[], opts: CallAIOptions, apiKey: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: opts.maxTokens ?? 4096, messages }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

// ─── Main gateway ─────────────────────────────────────────────────────────────
async function tryProvider(name: string, fn: () => Promise<string>): Promise<string | null> {
  try { return await fn(); } catch (e) {
    console.warn(`[AI] ${name} failed: ${(e as Error).message}`);
    return null;
  }
}

export async function callAI(messages: AIMessage[], opts: CallAIOptions = {}): Promise<string> {
  const geminiKey     = Deno.env.get("GEMINI_API_KEY");
  const deepseekKey   = Deno.env.get("DEEPSEEK_API_KEY");
  const groqKey       = Deno.env.get("GROQ_API_KEY");
  const mistralKey    = Deno.env.get("MISTRAL_API_KEY");
  const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
  const anthropicKey  = Deno.env.get("ANTHROPIC_API_KEY");
  const openaiKey     = Deno.env.get("OPENAI_API_KEY");

  if (geminiKey)     { const r = await tryProvider("Gemini",     () => callGemini(messages, opts, geminiKey));     if (r) return r; }
  if (deepseekKey)   { const r = await tryProvider("DeepSeek",   () => callDeepSeek(messages, opts, deepseekKey)); if (r) return r; }
  if (groqKey)       { const r = await tryProvider("Groq",       () => callGroq(messages, opts, groqKey));         if (r) return r; }
  if (mistralKey)    { const r = await tryProvider("Mistral",    () => callMistral(messages, opts, mistralKey));   if (r) return r; }
  if (openrouterKey) { const r = await tryProvider("OpenRouter", () => callOpenRouter(messages, opts, openrouterKey)); if (r) return r; }
  if (anthropicKey)  { const r = await tryProvider("Anthropic",  () => callAnthropic(messages, opts, anthropicKey)); if (r) return r; }
  if (openaiKey)     return callOpenAI(messages, opts, openaiKey);

  throw new Error("Brak klucza AI. Dodaj GEMINI_API_KEY, DEEPSEEK_API_KEY lub GROQ_API_KEY do Supabase secrets.");
}
