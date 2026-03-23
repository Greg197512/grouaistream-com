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

    // Step 1: Analyze the Suno link and metadata using AI
    const analysisPrompt = `You are a professional music A&R quality controller for GrouAI Stream platform. 
Analyze this track submission and score it on 5 criteria (each 0-20, total max 100).

TRACK SUBMISSION:
- Title: "${submission.title}"
- Genre: "${submission.genre}"
- Suno Link: "${submission.suno_link}"
- Description: "${submission.description || 'No description provided'}"
- Artist Email: "${submission.user_email}"

SCORING CRITERIA (be strict, we want quality):

1. LENGTH & STRUCTURE (0-20):
- Below 1:30 = score 0-5 (unless intentional intro/outro)
- Must have verse-chorus-bridge structure
- 3+ min with good structure = 15-20

2. LYRICS QUALITY (0-20):
- No lyrics / gibberish = 0-3
- Copy-paste ChatGPT without editing = 3-8
- Has sense, flow, emotion = 12-20
- If instrumental, score based on melodic storytelling

3. VOCAL QUALITY (0-20):
- Robotic/flat like 2018 TTS = 0-5
- Inconsistent intonation = 5-10
- Natural, emotional, consistent = 15-20
- If instrumental, score based on lead melody quality

4. PRODUCTION & ARRANGEMENT (0-20):
- 4-min loop with no dynamics = 0-5
- Some variation but basic = 8-12
- Dynamic (drops, build-ups, energy changes, instrumentation variety) = 15-20

5. ORIGINALITY (0-20):
- Obvious copy of popular song = 0-5
- Generic but original = 8-12
- Unique concept/sound/approach = 15-20

Based on the title, genre, description and Suno link pattern, give your BEST ESTIMATE scores.
Note: Since you can't listen to the actual audio, analyze what you can from metadata, title patterns, and description quality.

DECISION RULES:
- Total >= 60: APPROVED
- Total 40-59: REVIEW (needs manual check)
- Total < 40: REJECTED

Respond in JSON format ONLY:
{
  "score_length": <number>,
  "score_lyrics": <number>,
  "score_vocal": <number>,
  "score_production": <number>,
  "score_originality": <number>,
  "total_score": <number>,
  "status": "approved" | "review" | "rejected",
  "rejection_reasons": ["reason1", "reason2"],
  "analysis": "Brief explanation of the decision in Polish",
  "recommendations": "What could be improved, in Polish"
}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a strict music quality controller. Respond only in valid JSON." },
          { role: "user", content: analysisPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`AI Gateway error [${aiResponse.status}]: ${errText}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "{}";
    
    let result;
    try {
      result = JSON.parse(rawContent);
    } catch {
      result = {
        score_length: 10, score_lyrics: 10, score_vocal: 10,
        score_production: 10, score_originality: 10, total_score: 50,
        status: "review", rejection_reasons: ["AI parsing error - needs manual review"],
        analysis: "Automatyczna analiza nie powiodła się, wymaga ręcznego sprawdzenia.",
        recommendations: "",
      };
    }

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
