// 🧠 Semantic embedding via Lovable AI + deterministic projection.
//
// WHY: Lovable AI Gateway no longer supports text-embedding-004.
// We replace classical embeddings with an LLM-extracted "concept fingerprint"
// (16 normalized concepts + mood + category), then deterministically project
// it into a 768-dim vector compatible with the existing pgvector(768) column
// and search_brain_memory() RPC.
//
// Properties:
// - similar texts → similar concepts → similar vectors (cosine sim works)
// - zero new secrets, uses Deno.env.get("OPENROUTER_API_KEY") only
// - cheap: gemini-2.5-flash-lite, ~30 tokens output per call
// - drop-in replacement for the old embed() helper

const VECTOR_DIM = 768;

interface ConceptFingerprint {
  concepts: string[]; // up to 16 normalized lowercase concepts/keywords
  mood: string; // single dominant mood word
  category: string; // single domain category
}

const SYSTEM_PROMPT = `You extract a compact semantic fingerprint from text for vector search.
Return ONLY valid JSON matching this schema:
{
  "concepts": [string],   // 8-16 lowercase single/compound concept keywords (nouns, named entities, key topics). NO stopwords, NO duplicates.
  "mood":     string,     // single lowercase word: e.g. neutral, excited, melancholic, urgent, technical, celebratory
  "category": string      // single lowercase word: e.g. music, user, payment, system, content, marketing, error
}
Be deterministic — for the same input, return the same concepts in stable alphabetical order.`;

// Deterministic 32-bit FNV-1a hash for concept → bucket assignment.
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

// Project a concept fingerprint into a stable 768-dim unit vector.
// - Each concept hashes to 3 buckets (multi-hash → robustness).
// - Concept weight contributes to those buckets.
// - Mood/category contribute as well, with higher weight.
// - Vector is L2-normalized so cosine similarity is meaningful.
function projectFingerprint(fp: ConceptFingerprint): number[] {
  const v = new Array<number>(VECTOR_DIM).fill(0);

  const addToken = (token: string, weight: number, hashSeeds: string[]) => {
    if (!token) return;
    const norm = token.toLowerCase().trim();
    if (!norm) return;
    for (const seed of hashSeeds) {
      const h = fnv1a(`${seed}::${norm}`);
      const idx = h % VECTOR_DIM;
      // Sign bit determined by another hash to allow negative contributions
      const signHash = fnv1a(`${seed}::sign::${norm}`);
      const sign = (signHash & 1) === 0 ? 1 : -1;
      v[idx] += sign * weight;
    }
  };

  // Concepts: 3 hashes each, weight 1.0 (decreasing with position to favor first/strongest)
  fp.concepts.slice(0, 16).forEach((c, i) => {
    const w = 1.0 - i * 0.03; // 1.00, 0.97, 0.94...
    addToken(c, Math.max(0.4, w), ["c1", "c2", "c3"]);
  });

  // Mood: stronger weight, 4 hashes
  addToken(fp.mood, 1.5, ["mood1", "mood2", "mood3", "mood4"]);

  // Category: dominant signal, 5 hashes
  addToken(fp.category, 2.0, ["cat1", "cat2", "cat3", "cat4", "cat5"]);

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < VECTOR_DIM; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < VECTOR_DIM; i++) v[i] /= norm;

  return v;
}

// Fallback: pure deterministic hash projection without LLM (used if AI fails).
// Coarser but always works; ensures we never store NULL embeddings.
function hashOnlyProjection(text: string): number[] {
  const tokens = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && t.length < 30)
    .slice(0, 64);

  const fp: ConceptFingerprint = {
    concepts: Array.from(new Set(tokens)).slice(0, 16),
    mood: "neutral",
    category: "general",
  };
  return projectFingerprint(fp);
}

export async function semanticEmbed(
  text: string,
  apiKey: string,
): Promise<number[] | null> {
  if (!text || !text.trim()) return null;

  const trimmed = text.slice(0, 4000);

  // 1) Try LLM-extracted fingerprint
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EXTRACT_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: trimmed },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "emit_fingerprint",
              description: "Emit the semantic fingerprint",
              parameters: {
                type: "object",
                properties: {
                  concepts: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 4,
                    maxItems: 16,
                  },
                  mood: { type: "string" },
                  category: { type: "string" },
                },
                required: ["concepts", "mood", "category"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "emit_fingerprint" } },
      }),
    });

    if (!res.ok) {
      console.warn("[semanticEmbed] LLM call failed:", res.status, await res.text().catch(() => ""));
      return hashOnlyProjection(trimmed);
    }

    const json = await res.json();
    const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
    const argsRaw = toolCall?.function?.arguments;
    if (!argsRaw) {
      console.warn("[semanticEmbed] no tool_call in response — fallback to hash");
      return hashOnlyProjection(trimmed);
    }

    let parsed: ConceptFingerprint;
    try {
      parsed = typeof argsRaw === "string" ? JSON.parse(argsRaw) : argsRaw;
    } catch {
      console.warn("[semanticEmbed] could not parse tool args — fallback to hash");
      return hashOnlyProjection(trimmed);
    }

    if (!Array.isArray(parsed?.concepts) || parsed.concepts.length === 0) {
      return hashOnlyProjection(trimmed);
    }

    return projectFingerprint({
      concepts: parsed.concepts,
      mood: parsed.mood || "neutral",
      category: parsed.category || "general",
    });
  } catch (e) {
    console.warn("[semanticEmbed] error, fallback to hash:", e);
    return hashOnlyProjection(trimmed);
  }
}
