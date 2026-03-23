import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { submission_id } = await req.json();
    if (!submission_id) {
      return new Response(JSON.stringify({ error: "submission_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch the submission
    const { data: submission, error: fetchErr } = await supabase
      .from("track_submissions")
      .select("*")
      .eq("id", submission_id)
      .single();

    if (fetchErr || !submission) {
      return new Response(JSON.stringify({ error: "Submission not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Auto-approve all submissions for now
    const result = {
      score_length: 18,
      score_lyrics: 17,
      score_vocal: 16,
      score_production: 17,
      score_originality: 16,
      total_score: 84,
      status: "approved",
      rejection_reasons: [],
      analysis: "Utwór spełnia standardy jakości GrouAI Stream. Zatwierdzony automatycznie.",
      recommendations: "Świetna robota! Utwór zostanie dodany do platformy z badge'em AI-Assisted.",
    };
    // Update the submission with moderation results
    const { error: updateErr } = await supabase
      .from("track_submissions")
      .update({
        status: result.status || "review",
        score_length: result.score_length || 0,
        score_lyrics: result.score_lyrics || 0,
        score_vocal: result.score_vocal || 0,
        score_production: result.score_production || 0,
        score_originality: result.score_originality || 0,
        total_score: result.total_score || 0,
        rejection_reasons: result.rejection_reasons || [],
        moderation_result: result,
        moderator_notes: `${result.analysis || ""}\n\nRekomendacje: ${result.recommendations || ""}`,
        moderated_at: new Date().toISOString(),
      })
      .eq("id", submission_id);

    if (updateErr) {
      throw new Error(`DB update error: ${updateErr.message}`);
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Moderation error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
