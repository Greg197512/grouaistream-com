import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ModerationInput {
  title: string;
  artist: string;
  genre: string;
  description?: string;
  duration?: number;
  hasSunoLink?: boolean;
  hasAudioFile?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const input: ModerationInput = await req.json();

    if (!input.title || !input.genre) {
      return new Response(
        JSON.stringify({ error: "title and genre are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const durationMin = input.duration
      ? `${Math.floor(input.duration / 60)}:${String(Math.floor(input.duration % 60)).padStart(2, "0")}`
      : "unknown";

    const systemPrompt = `You are a strict, professional music quality evaluator for GrouAI Stream platform.
You must evaluate a submitted track based on the metadata provided.
Score each category from 0 to 20 points. Be STRICT and critical.

Categories:
1. score_length – Track length adequacy. STRICT RULES:
   - Under 1:30 = 0 points (auto-reject)
   - 1:30–2:00 = max 3 points
   - 2:00–2:30 = max 5 points
   - 2:30–3:00 = max 8 points
   - 3:00–3:30 = max 12 points
   - 3:30–4:00 = max 16 points
   - 4:00+ = up to 20 points
2. score_lyrics – Title/description quality, creativity, emotional depth
3. score_vocal – Expected vocal quality based on genre and production context
4. score_production – Expected production quality, dynamics, arrangement
5. score_originality – Originality of concept, title, genre combination

Rules:
- Total score = sum of all 5 scores (max 100)
- If track is under 2:00, status MUST be "rejected" regardless of total score
- If total >= 65: status = "approved"
- If total 45-64: status = "review"
- If total < 45: status = "rejected"
- Provide a brief analysis in Polish
- Provide recommendations in Polish
- If track has issues, list rejection_reasons in Polish
- Always mention track length issues in rejection_reasons if under 3:00`;

    const userPrompt = `Evaluate this track submission:
- Title: "${input.title}"
- Artist: "${input.artist}"
- Genre: ${input.genre}
- Description: ${input.description || "none"}
- Duration: ${durationMin}
- Source: ${input.hasSunoLink ? "Suno AI" : input.hasAudioFile ? "uploaded audio file" : "unknown"}

Return your evaluation using the evaluate_track tool.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "evaluate_track",
              description: "Return the structured evaluation of a music track",
              parameters: {
                type: "object",
                properties: {
                  score_length: { type: "integer", minimum: 0, maximum: 20, description: "Length adequacy score" },
                  score_lyrics: { type: "integer", minimum: 0, maximum: 20, description: "Lyrics/title quality score" },
                  score_vocal: { type: "integer", minimum: 0, maximum: 20, description: "Vocal quality score" },
                  score_production: { type: "integer", minimum: 0, maximum: 20, description: "Production quality score" },
                  score_originality: { type: "integer", minimum: 0, maximum: 20, description: "Originality score" },
                  analysis: { type: "string", description: "Brief analysis in Polish" },
                  recommendations: { type: "string", description: "Recommendations in Polish" },
                  rejection_reasons: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of rejection reasons in Polish (empty if approved)",
                  },
                },
                required: [
                  "score_length", "score_lyrics", "score_vocal",
                  "score_production", "score_originality",
                  "analysis", "recommendations", "rejection_reasons",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "evaluate_track" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI Gateway error:", response.status, errText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Zbyt wiele zapytań AI. Spróbuj ponownie za chwilę." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Brak kredytów AI. Skontaktuj się z administratorem." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in AI response:", JSON.stringify(aiData));
      throw new Error("AI did not return structured evaluation");
    }

    const evaluation = typeof toolCall.function.arguments === "string"
      ? JSON.parse(toolCall.function.arguments)
      : toolCall.function.arguments;

    // Server-side enforcement of duration rules
    const durationSec = input.duration || 0;
    
    // Cap score_length based on actual duration
    let cappedScoreLength = evaluation.score_length || 0;
    if (durationSec > 0) {
      if (durationSec < 90) cappedScoreLength = 0;
      else if (durationSec < 120) cappedScoreLength = Math.min(cappedScoreLength, 3);
      else if (durationSec < 150) cappedScoreLength = Math.min(cappedScoreLength, 5);
      else if (durationSec < 180) cappedScoreLength = Math.min(cappedScoreLength, 8);
      else if (durationSec < 210) cappedScoreLength = Math.min(cappedScoreLength, 12);
      else if (durationSec < 240) cappedScoreLength = Math.min(cappedScoreLength, 16);
    }

    const totalScore =
      cappedScoreLength +
      (evaluation.score_lyrics || 0) +
      (evaluation.score_vocal || 0) +
      (evaluation.score_production || 0) +
      (evaluation.score_originality || 0);

    let status: string;
    // Hard reject if under 2 minutes
    if (durationSec > 0 && durationSec < 120) {
      status = "rejected";
    } else if (totalScore >= 65) {
      status = "approved";
    } else if (totalScore >= 45) {
      status = "review";
    } else {
      status = "rejected";
    }

    const result = {
      score_length: cappedScoreLength,
      score_lyrics: evaluation.score_lyrics,
      score_vocal: evaluation.score_vocal,
      score_production: evaluation.score_production,
      score_originality: evaluation.score_originality,
      total_score: totalScore,
      status,
      analysis: evaluation.analysis || "",
      recommendations: evaluation.recommendations || "",
      rejection_reasons: evaluation.rejection_reasons || [],
    };

    console.log("Moderation result:", JSON.stringify(result));

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Moderation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
