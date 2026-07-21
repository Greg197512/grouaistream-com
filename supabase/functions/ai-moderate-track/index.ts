import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

function getCorsHeaders(_req: Request) {
  return {
    "Access-Control-Allow-Origin": "*",
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

// Minimum required duration for non-admin uploads: 2:30 (150s)
const MIN_DURATION_SEC = 150;

function clampScore(value: unknown, min = 0, max = 20): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

function getLengthScoreCap(durationSec: number): number {
  if (durationSec <= 0) return 8;
  if (durationSec < 120) return 0;   // < 2:00 → 0
  if (durationSec < 210) return 10;  // 3:00–3:30
  if (durationSec < 240) return 14;  // 3:30–4:00
  if (durationSec < 300) return 17;  // 4:00–5:00
  return 20;                          // ≥ 5:00
}

function buildFallbackEvaluation(input: ModerationInput, isAdmin: boolean): EvaluationPayload {
  const durationSec = input.duration || 0;

  // Admin bypasses duration check entirely
  if (isAdmin) {
    return {
      score_length: 20,
      score_lyrics: 18,
      score_vocal: 18,
      score_production: 18,
      score_originality: 18,
      analysis: "Wgrane przez administratora — automatyczna akceptacja.",
      recommendations: "Bypass admina aktywny.",
      rejection_reasons: [],
    };
  }

  // Hard reject < 3 min for regular users
  if (durationSec > 0 && durationSec < MIN_DURATION_SEC) {
    return {
      score_length: 0,
      score_lyrics: 5,
      score_vocal: 5,
      score_production: 5,
      score_originality: 5,
      analysis: "Utwór jest zbyt krótki — minimum publikacji to 2:30.",
      recommendations: "Wydłuż utwór do co najmniej 2:30, aby przejść moderację.",
      rejection_reasons: ["Utwór ma mniej niż 2:30 — wymagane minimum to 2:30."],
    };
  }

  const scoreLength = getLengthScoreCap(durationSec);
  return {
    score_length: Math.max(scoreLength, 14),
    score_lyrics: 14,
    score_vocal: 14,
    score_production: 14,
    score_originality: 14,
    analysis: "Utwór spełnia wymagania platformy i został zaakceptowany automatycznie.",
    recommendations: "Dbaj o jakość produkcji i oryginalność — to klucz do sukcesu na platformie.",
    rejection_reasons: [],
  };
}

function finalizeEvaluation(input: ModerationInput, evaluation: EvaluationPayload, isAdmin: boolean) {
  const durationSec = input.duration || 0;

  // Admin shortcut: always approved with full scores
  if (isAdmin) {
    return {
      score_length: 20,
      score_lyrics: 18,
      score_vocal: 18,
      score_production: 18,
      score_originality: 18,
      total_score: 92,
      status: "approved",
      analysis: evaluation.analysis || "Bypass admina.",
      recommendations: evaluation.recommendations || "",
      rejection_reasons: [],
    };
  }

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
  // Hard reject if too short — overrides any score
  if (durationSec > 0 && durationSec < MIN_DURATION_SEC) {
    status = "rejected";
  } else if (totalScore >= 65) {
    status = "approved";
  } else if (totalScore >= 45) {
    status = "review";
  } else {
    status = "rejected";
  }

  const rejectionReasons = Array.isArray(evaluation.rejection_reasons)
    ? [...evaluation.rejection_reasons]
    : [];

  if (durationSec > 0 && durationSec < MIN_DURATION_SEC) {
    rejectionReasons.push("Utwór ma mniej niż 2:30 — wymagane minimum publikacji to 2:30.");
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

    // Admin role check via has_role RPC
    const { data: isAdminData } = await supabaseAuth.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    const isAdmin = isAdminData === true;
    // --- End authentication ---

    const input: ModerationInput = await req.json();

    if (!input.title || !input.genre) {
      return new Response(
        JSON.stringify({ error: "title and genre are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const evaluation = buildFallbackEvaluation(input, isAdmin);
    const result = finalizeEvaluation(input, evaluation, isAdmin);

    console.log("Moderation result:", JSON.stringify({ ...result, isAdmin }));

    return new Response(JSON.stringify({ success: true, result, isAdmin }), {
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
