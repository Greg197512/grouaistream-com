import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    // Fetch user's mix history
    const { data: mixHistory } = await supabase
      .from("mix_preferences")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    // Fetch available tracks with audio
    const { data: tracks } = await supabase
      .from("tracks")
      .select("id, title, artist, genre, duration")
      .not("audio_url", "is", null)
      .limit(100);

    if (!tracks || tracks.length < 2) {
      return new Response(JSON.stringify({ suggestions: [], message: "Za mało utworów w bibliotece" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context for AI
    const historyContext = mixHistory && mixHistory.length > 0
      ? `User's mix history (most recent first):\n${mixHistory.map(m =>
          `- "${m.track_a_title}" (${m.track_a_genre || "unknown"}) × "${m.track_b_title}" (${m.track_b_genre || "unknown"}) — style: ${m.mix_style}, rating: ${m.rating}/5`
        ).join("\n")}`
      : "User has no mix history yet. Suggest diverse, interesting combinations.";

    const trackList = tracks.map(t => `ID:${t.id} | "${t.title}" by ${t.artist} | genre: ${t.genre || "unknown"} | ${Math.floor(t.duration / 60)}:${(t.duration % 60).toString().padStart(2, "0")}`).join("\n");

    const systemPrompt = `You are a professional DJ and music mixing AI. Analyze the user's mix history to understand their genre preferences and suggest 3-5 track pairs that would mix well together.

Rules:
- Suggest pairs that match the user's preferred genre combinations (from history)
- Also suggest 1-2 surprising/creative combinations they haven't tried
- Consider tempo compatibility and genre fusion potential
- Return ONLY valid JSON with the exact track IDs from the list
- For each suggestion explain WHY these tracks would mix well
- Respond in Polish`;

    const userPrompt = `${historyContext}

Available tracks:
${trackList}

Return JSON array of suggestions:
[{"track_a_id": "uuid", "track_b_id": "uuid", "reason": "why they mix well", "mix_style": "crossfade|overlay|mashup", "confidence": 0.0-1.0}]`;

    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemma-2-9b-it:free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "suggest_mixes",
            description: "Return mix pair suggestions",
            parameters: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      track_a_id: { type: "string" },
                      track_b_id: { type: "string" },
                      reason: { type: "string" },
                      mix_style: { type: "string", enum: ["crossfade", "overlay", "mashup"] },
                      confidence: { type: "number" },
                    },
                    required: ["track_a_id", "track_b_id", "reason", "mix_style", "confidence"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["suggestions"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "suggest_mixes" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Zbyt wiele zapytań, spróbuj za chwilę" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Brak środków na koncie AI" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let suggestions = [];

    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) {
        const parsed = JSON.parse(toolCall.function.arguments);
        suggestions = parsed.suggestions || [];
      }
    } catch {
      console.error("Failed to parse AI suggestions");
    }

    // Enrich suggestions with track details
    const enriched = suggestions.map((s: any) => {
      const trackA = tracks.find(t => t.id === s.track_a_id);
      const trackB = tracks.find(t => t.id === s.track_b_id);
      if (!trackA || !trackB) return null;
      return {
        ...s,
        track_a: trackA,
        track_b: trackB,
      };
    }).filter(Boolean);

    return new Response(JSON.stringify({ suggestions: enriched }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-mix-suggest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
