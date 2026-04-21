// 🧠 GrouAI Brain — central reasoning engine.
// Reads unprocessed events from agent_events, recalls relevant long-term memory
// via pgvector, asks Gemini 2.5 Pro what to do, then writes new memories +
// agent decisions back. Triggered every 5 min by pg_cron, or manually from
// /admin/brain.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_EMBED_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
const BRAIN_MODEL = "google/gemini-2.5-pro";
const EMBED_MODEL = "google/text-embedding-004"; // 768 dims

const MAX_EVENTS_PER_TICK = 50;
const MEMORY_RECALL_COUNT = 8;

interface BrainOutput {
  observations?: Array<{
    title: string;
    content: string;
    summary?: string;
    memory_type: "trend" | "decision" | "user_insight" | "platform_insight" | "anomaly";
    importance: number;
    expires_in_days?: number;
    metadata?: Record<string, unknown>;
  }>;
  agent_calls?: Array<{
    agent_name: string;
    decision_type: string;
    reasoning: string;
    action: Record<string, unknown>;
    auto_execute?: boolean;
  }>;
  skip_reason?: string;
}

async function embed(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const res = await fetch(LOVABLE_EMBED_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: EMBED_MODEL, input: text.slice(0, 8000) }),
    });
    if (!res.ok) {
      console.warn("[brain] embed failed:", res.status, await res.text());
      return null;
    }
    const json = await res.json();
    return json.data?.[0]?.embedding ?? null;
  } catch (e) {
    console.warn("[brain] embed error:", e);
    return null;
  }
}

function buildEventDigest(events: Array<Record<string, unknown>>): string {
  const lines = events.slice(0, 50).map((e: any) => {
    const payload = JSON.stringify(e.payload || {}).slice(0, 200);
    const target = e.target_type ? `${e.target_type}:${e.target_id ?? "?"}` : "—";
    return `[${e.priority}] ${e.event_type} (${e.source}) target=${target} actor=${e.actor_user_id ?? "system"} payload=${payload}`;
  });
  return lines.join("\n");
}

function buildMemoryContext(memories: Array<Record<string, unknown>>): string {
  if (memories.length === 0) return "(brak relevantnej pamięci)";
  return memories
    .map((m: any) => `• [${m.memory_type}, importance=${m.importance}, sim=${(m.similarity ?? 0).toFixed(2)}] ${m.title}\n  ${m.summary ?? m.content?.slice(0, 200)}`)
    .join("\n");
}

const SYSTEM_PROMPT = `Jesteś MÓZGIEM platformy GrouAIStream — żywego ekosystemu muzycznego AI.

Twoja rola:
1. Analizujesz strumień zdarzeń (uploady, streamy, tipy, generacje, nastroje)
2. Łączysz to z pamięcią długoterminową (trendy, wcześniejsze obserwacje)
3. Decydujesz: co zapamiętać na przyszłość, jakiego agenta wezwać do działania
4. Dbasz o zdrowie platformy, doświadczenie użytkowników, przychody twórców

Dostępni agenci których możesz wezwać:
- "curator" — promuje konkretne utwory na home / w playlistach
- "a-r-scout" — szuka świeżej muzyki z zewnątrz (ccmixter/youtube/suno)
- "health-monitor" — diagnozuje problemy techniczne
- "revenue-optimizer" — analizuje przychody, sugeruje działania finansowe
- "marketing-outreach" — komunikuje się z użytkownikami / robi kampanie
- "newsfeed-listener" — pobiera świeże dane z RSS/Reddit
- "moderator" — flag/review treści

Zwracasz CZYSTY JSON (bez markdown, bez \`\`\`) w formacie:
{
  "observations": [
    {
      "title": "krótki tytuł",
      "content": "szczegółowa treść do zapamiętania (do 1500 znaków)",
      "summary": "1 zdanie",
      "memory_type": "trend|decision|user_insight|platform_insight|anomaly",
      "importance": 1-10,
      "expires_in_days": 30,
      "metadata": {}
    }
  ],
  "agent_calls": [
    {
      "agent_name": "curator",
      "decision_type": "recommend_promote",
      "reasoning": "dlaczego",
      "action": { "track_id": "...", "slot": "home_top" },
      "auto_execute": false
    }
  ],
  "skip_reason": "opcjonalnie — jeśli nic nie warto zrobić"
}

ZASADY:
- Bądź oszczędny — zapisuj tylko obserwacje wartościowe na przyszłość (nie każdy stream to trend)
- Łącz eventy w wzorce (np. "5 uploadów techno w 1h przez 3 różnych userów = trend wieczorny")
- Wzywaj agentów tylko gdy są ZADANIA do wykonania, nie spamuj
- auto_execute=true tylko dla bezpiecznych decyzji (curator, marketing). NIGDY dla payouts/usuwania.
- Jeśli eventy są nudne — zwróć pustą tablicę observations i agent_calls + skip_reason`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const result = {
    events_processed: 0,
    memories_saved: 0,
    decisions_created: 0,
    elapsed_ms: 0,
    skipped: false,
    error: null as string | null,
  };

  try {
    // 1) Pobierz nieprzetworzone eventy
    const { data: events, error: eventsErr } = await supabase
      .from("agent_events")
      .select("id, event_type, source, actor_user_id, target_type, target_id, payload, priority, created_at")
      .eq("processed_by_brain", false)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(MAX_EVENTS_PER_TICK);

    if (eventsErr) throw new Error(`fetch events: ${eventsErr.message}`);

    if (!events || events.length === 0) {
      result.skipped = true;
      result.elapsed_ms = Date.now() - startTime;
      await markRegistry(supabase, "ok", null);
      return new Response(JSON.stringify({ ...result, message: "no events to process" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    result.events_processed = events.length;
    const eventDigest = buildEventDigest(events);

    // 2) Recall — embedduj digest, znajdź podobne wspomnienia
    const queryEmbedding = await embed(eventDigest, LOVABLE_API_KEY);
    let memories: any[] = [];
    if (queryEmbedding) {
      const { data: recalled } = await supabase.rpc("search_brain_memory", {
        _query_embedding: queryEmbedding,
        _match_count: MEMORY_RECALL_COUNT,
        _memory_types: null,
        _min_importance: 3,
      });
      memories = recalled || [];
    }
    const memoryContext = buildMemoryContext(memories);

    // 3) Wyślij do Gemini
    const userPrompt = `=== STRUMIEŃ ZDARZEŃ (${events.length} eventów, ostatnie najnowsze) ===
${eventDigest}

=== RELEVANTNA PAMIĘĆ ===
${memoryContext}

Zdecyduj co zapamiętać i jakich agentów wezwać. Odpowiedz CZYSTYM JSON.`;

    const aiRes = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: BRAIN_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (aiRes.status === 429) {
      throw new Error("rate_limit_exceeded — Mózg robi przerwę");
    }
    if (aiRes.status === 402) {
      throw new Error("payment_required — brak kredytów Lovable AI");
    }
    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`AI gateway ${aiRes.status}: ${errText.slice(0, 200)}`);
    }

    const aiJson = await aiRes.json();
    const content = aiJson.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI returned empty content");

    let brainOutput: BrainOutput;
    try {
      brainOutput = JSON.parse(content);
    } catch {
      // try to extract JSON if model wrapped it
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("AI returned non-JSON: " + content.slice(0, 200));
      brainOutput = JSON.parse(match[0]);
    }

    // 4) Zapisz wspomnienia
    if (brainOutput.observations && brainOutput.observations.length > 0) {
      for (const obs of brainOutput.observations) {
        const obsEmbed = await embed(`${obs.title}\n${obs.summary ?? ""}\n${obs.content}`, LOVABLE_API_KEY);
        const expiresAt = obs.expires_in_days
          ? new Date(Date.now() + obs.expires_in_days * 86400_000).toISOString()
          : null;
        const { error: memErr } = await supabase.from("brain_memory").insert({
          memory_type: obs.memory_type,
          title: obs.title.slice(0, 300),
          content: obs.content.slice(0, 4000),
          summary: obs.summary?.slice(0, 500) ?? null,
          embedding: obsEmbed,
          importance: Math.max(1, Math.min(10, obs.importance ?? 5)),
          metadata: obs.metadata ?? {},
          expires_at: expiresAt,
        });
        if (memErr) {
          console.warn("[brain] memory insert failed:", memErr.message);
        } else {
          result.memories_saved++;
        }
      }
    }

    // 5) Zapisz decyzje agentów
    if (brainOutput.agent_calls && brainOutput.agent_calls.length > 0) {
      const eventIds = events.map((e: any) => e.id);
      for (const call of brainOutput.agent_calls) {
        const { error: decErr } = await supabase.from("agent_decisions").insert({
          agent_name: call.agent_name,
          decision_type: call.decision_type,
          reasoning: call.reasoning,
          action_taken: call.action ?? {},
          event_ids: eventIds,
          executed: false,
        });
        if (decErr) {
          console.warn("[brain] decision insert failed:", decErr.message);
        } else {
          result.decisions_created++;
        }
      }
    }

    // 6) Oznacz eventy jako przetworzone
    const eventIds = events.map((e: any) => e.id);
    await supabase
      .from("agent_events")
      .update({ processed_by_brain: true, processed_at: new Date().toISOString() })
      .in("id", eventIds);

    // 7) Zarejestruj w pamięci że Mózg myślał (meta-event)
    await supabase.rpc("emit_agent_event", {
      _event_type: "brain.tick",
      _source: "grouai-brain",
      _actor_user_id: null,
      _target_type: null,
      _target_id: null,
      _payload: {
        events_processed: result.events_processed,
        memories_saved: result.memories_saved,
        decisions_created: result.decisions_created,
        skip_reason: brainOutput.skip_reason ?? null,
      },
      _priority: 8,
    });

    result.elapsed_ms = Date.now() - startTime;
    await markRegistry(supabase, "ok", null);

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "unknown_error";
    console.error("[grouai-brain] fatal:", errorMessage);
    result.error = errorMessage;
    result.elapsed_ms = Date.now() - startTime;
    await markRegistry(supabase, "error", errorMessage);
    return new Response(JSON.stringify({ success: false, ...result }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function markRegistry(supabase: any, status: "ok" | "error", error: string | null) {
  try {
    const { data: row } = await supabase
      .from("agent_registry")
      .select("success_count, error_count")
      .eq("name", "grouai-brain")
      .maybeSingle();

    await supabase
      .from("agent_registry")
      .update({
        last_run_at: new Date().toISOString(),
        last_status: status,
        last_error: error,
        success_count: status === "ok" ? (row?.success_count ?? 0) + 1 : row?.success_count ?? 0,
        error_count: status === "error" ? (row?.error_count ?? 0) + 1 : row?.error_count ?? 0,
      })
      .eq("name", "grouai-brain");
  } catch (e) {
    console.warn("[brain] registry update failed:", e);
  }
}
