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

    // Temporary: skip AI analysis, only duration-based evaluation
    const evaluation = buildFallbackEvaluation(input);

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
