import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

function getCorsHeaders(req: Request) {
  const allowedOrigins = [
    "https://grouaistream.com",
    "https://www.grouaistream.com",
    "https://grouaistream-com.lovable.app",
    "https://id-preview--462bddcb-d545-4f42-bc51-5f437cb12bbe.lovable.app",
  ];
  const origin = req.headers.get("origin") || "";
  const isCustomDomain = /^https:\/\/([a-z0-9-]+\.)?grouaistream\.com$/i.test(origin);
  return {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin) || isCustomDomain ? origin : allowedOrigins[0],
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
  const durationSec = input.duration || 0;

  // Hard reject < 2 min
  if (durationSec > 0 && durationSec < 120) {
    return {
      score_length: 0,
      score_lyrics: 5,
      score_vocal: 5,
      score_production: 5,
      score_originality: 5,
      analysis: "Utwór jest zbyt krótki – minimum to 2:00.",
      recommendations: "Wydłuż utwór do co najmniej 2 minut.",
      rejection_reasons: ["Utwór ma mniej niż 2:00 – wymagane minimum to 2 minuty."],
    };
  }

  // Auto-approve everything >= 2 min
  const scoreLength = getLengthScoreCap(durationSec);
  return {
    score_length: Math.max(scoreLength, 14),
    score_lyrics: 14,
    score_vocal: 14,
    score_production: 14,
    score_originality: 14,
    analysis: "Utwór spełnia wymagania platformy i został zaakceptowany automatycznie.",
    recommendations: "Dbaj o jakość produkcji i oryginalność – to klucz do sukcesu na platformie.",
    rejection_reasons: [],
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

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !userData?.user) {
      console.error("Auth error:", userError?.message || "No user");
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
