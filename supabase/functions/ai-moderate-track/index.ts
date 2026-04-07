import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

function getCorsHeaders(req: Request) {
  const allowedOrigins = [
    "https://grouaistream-com.lovable.app",
    "https://id-preview--462bddcb-d545-4f42-bc51-5f437cb12bbe.lovable.app",
  ];
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

interface ModerationInput {
  title: string;
  artist: string;
  genre: string;
  description?: string;
  duration?: number;
  hasSunoLink?: boolean;
  hasAudioFile?: boolean;
}

interface EvaluationPayload {
  score_length?: number;
  score_lyrics?: number;
  score_vocal?: number;
  score_production?: number;
  score_originality?: number;
  analysis?: string;
  recommendations?: string;
  rejection_reasons?: string[];
}

const AI_TIMEOUT_MS = 8000;

function clampScore(value: unknown, min = 0, max = 20): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

function getLengthScoreCap(durationSec: number): number {
  if (durationSec <= 0) return 8;
  if (durationSec < 120) return 0;
  if (durationSec < 150) return 5;
  if (durationSec < 180) return 10;
  if (durationSec < 210) return 14;
  if (durationSec < 240) return 17;
  return 20;
}

function buildFallbackEvaluation(input: ModerationInput, reason?: string): EvaluationPayload {
  const title = input.title?.trim() || "";
  const description = input.description?.trim() || "";
  const durationSec = input.duration || 0;
  const combined = `${title} ${description}`.toLowerCase();
  const genericMarkers = ["test", "track", "untitled", "demo", "sample"];
  const hasGenericMetadata = genericMarkers.some((marker) => combined.includes(marker));
  const hasDetailedDescription = description.length >= 40;
  const hasDecentTitle = title.length >= 4 && !hasGenericMetadata;
  const scoreLength = getLengthScoreCap(durationSec);
  const scoreLyrics = clampScore(
    hasDetailedDescription ? 13 : description.length >= 10 ? 9 : hasDecentTitle ? 7 : 3
  );
  const scoreVocal = clampScore(input.hasAudioFile ? 12 : input.hasSunoLink ? 10 : 8);
  const scoreProduction = clampScore(input.hasAudioFile ? 13 : 10);
  const scoreOriginality = clampScore(hasGenericMetadata ? 4 : hasDetailedDescription ? 14 : 10);

  const rejectionReasons: string[] = [];
  if (durationSec > 0 && durationSec < 120) {
    rejectionReasons.push("Utwór jest zbyt krótki – minimum to 2:00.");
  }
  if (hasGenericMetadata) {
    rejectionReasons.push("Tytuł lub opis są zbyt generyczne i wymagają dopracowania.");
  }
  if (reason) {
    rejectionReasons.push("Automatyczna analiza awaryjna została użyta z powodu chwilowego problemu z silnikiem AI.");
  }

  return {
    score_length: scoreLength,
    score_lyrics: scoreLyrics,
    score_vocal: scoreVocal,
    score_production: scoreProduction,
    score_originality: scoreOriginality,
    analysis: reason
      ? "Użyto trybu awaryjnej oceny metadanych, ponieważ główny moduł AI nie odpowiedział na czas. Wynik opiera się na długości utworu, jakości tytułu i opisu oraz typie źródła pliku."
      : "Ocena została wyliczona na podstawie metadanych utworu, długości, jakości tytułu i opisu oraz sposobu dostarczenia materiału.",
    recommendations: hasDetailedDescription && hasDecentTitle
      ? "Dopracuj finalny miks i zachowaj spójność między tytułem, opisem oraz brzmieniem utworu."
      : "Rozbuduj opis, dopracuj tytuł i upewnij się, że prezentacja utworu jasno pokazuje jego klimat oraz jakość.",
    rejection_reasons: rejectionReasons,
  };
}

function finalizeEvaluation(input: ModerationInput, evaluation: EvaluationPayload) {
  const durationSec = input.duration || 0;
  const lengthCap = getLengthScoreCap(durationSec);
  const scoreLength = durationSec > 0
    ? Math.min(clampScore(evaluation.score_length), lengthCap)
    : clampScore(evaluation.score_length, 0, 20);
  const scoreLyrics = clampScore(evaluation.score_lyrics);
  const scoreVocal = clampScore(evaluation.score_vocal);
  const scoreProduction = clampScore(evaluation.score_production);
  const scoreOriginality = clampScore(evaluation.score_originality);
  const totalScore = scoreLength + scoreLyrics + scoreVocal + scoreProduction + scoreOriginality;

  let status: string;
  if (totalScore >= 65) {
    status = "approved";
  } else if (totalScore >= 45) {
    status = "review";
  } else {
    status = "rejected";
  }

  const rejectionReasons = Array.isArray(evaluation.rejection_reasons)
    ? [...evaluation.rejection_reasons]
    : [];

  if (durationSec > 0 && durationSec < 120) {
    rejectionReasons.push("Utwór ma mniej niż 2:00, co znacząco obniża ocenę długości.");
  }

  return {
    score_length: scoreLength,
    score_lyrics: scoreLyrics,
    score_vocal: scoreVocal,
    score_production: scoreProduction,
    score_originality: scoreOriginality,
    total_score: totalScore,
    status,
    analysis: evaluation.analysis || "",
    recommendations: evaluation.recommendations || "",
    rejection_reasons: [...new Set(rejectionReasons)],
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Authentication check ---
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // --- End authentication ---

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
   - Under 2:00 = 0 points
   - 2:00–2:30 = max 5 points
   - 2:30–3:00 = max 10 points
   - 3:00–3:30 = max 14 points
   - 3:30–4:00 = max 17 points
   - 4:00+ = up to 20 points
2. score_lyrics – Title/description quality, creativity, emotional depth
3. score_vocal – Expected vocal quality based on genre and production context
4. score_production – Expected production quality, dynamics, arrangement
5. score_originality – Originality of concept, title, genre combination

Rules:
- Total score = sum of all 5 scores (max 100)
- If total >= 65: status = "approved"
- If total 45-64: status = "review"
- If total < 45: status = "rejected"
- Provide a brief analysis in Polish
- Provide recommendations in Polish
- If track has issues, list rejection_reasons in Polish
- Always mention track length issues in rejection_reasons if under 2:00`;

    const userPrompt = `Evaluate this track submission:
- Title: "${input.title}"
- Artist: "${input.artist}"
- Genre: ${input.genre}
- Description: ${input.description || "none"}
- Duration: ${durationMin}
- Source: ${input.hasSunoLink ? "Suno AI" : input.hasAudioFile ? "uploaded audio file" : "unknown"}

Return your evaluation using the evaluate_track tool.`;

    let evaluation: EvaluationPayload;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort("AI moderation timeout"), AI_TIMEOUT_MS);

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
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
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

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

      evaluation = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } catch (aiError) {
      console.error("AI moderation fallback triggered:", aiError);
      evaluation = buildFallbackEvaluation(
        input,
        aiError instanceof Error ? aiError.message : "unknown_error"
      );
    }

    const result = finalizeEvaluation(input, evaluation);

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
