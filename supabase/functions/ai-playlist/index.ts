import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

function getCorsHeaders(_req: Request) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // --- End authentication ---

    const { mood, genre, context, action } = await req.json();
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

    if (!OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }

    let systemPrompt = "";
    let userPrompt = "";

    if (action === "generate_playlist") {
      systemPrompt = `You are an AI DJ that creates personalized music playlists. You understand music genres, moods, and user preferences deeply. Generate playlist suggestions that feel authentic and personalized.`;
      
      userPrompt = `Create a playlist for someone feeling "${mood || 'relaxed'}" who enjoys "${genre || 'various'}" music. ${context || ''}

Return a JSON response with this exact structure:
{
  "playlistName": "Creative playlist name",
  "description": "Brief description of the playlist vibe",
  "explanation": "Why this playlist fits the mood",
  "suggestedGenres": ["genre1", "genre2"],
  "energyLevel": "low/medium/high",
  "tempo": "slow/medium/fast"
}`;
    } else if (action === "analyze_mood") {
      systemPrompt = `You are an AI mood analyst for a music streaming platform. You analyze user behavior patterns and listening history to understand their current emotional state and music preferences.`;
      
      userPrompt = `Based on the following context, analyze the user's likely mood and music preferences:
${context}

Return a JSON response with this structure:
{
  "detectedMood": "mood name",
  "confidence": 0.0 to 1.0,
  "explanation": "brief explanation",
  "suggestedMoods": ["alternative1", "alternative2"],
  "musicRecommendation": "what type of music to play"
}`;
    } else if (action === "real_time_adaptation") {
      systemPrompt = `You are an AI that adapts music recommendations in real-time based on user behavior signals like skips, volume changes, and listening patterns.`;
      
      userPrompt = `User behavior signals:
${context}

Analyze these signals and suggest how to adapt the current playlist. Return JSON:
{
  "action": "continue/change_mood/increase_energy/decrease_energy",
  "reason": "explanation",
  "suggestedChange": "what to do next"
}`;
    } else if (action === "adapt_to_skips") {
      systemPrompt = `You are an intelligent music recommendation AI that learns from user skip patterns. When users skip tracks frequently, you adapt recommendations to better match their preferences.`;
      
      userPrompt = `The user has been skipping tracks frequently. Here's the context:
${context}

Based on this skip behavior, analyze what the user probably wants and suggest adjustments. Return JSON:
{
  "analysis": "brief analysis of skip patterns",
  "suggestedGenre": "recommended genre to switch to",
  "suggestedMood": "recommended mood",
  "avoidPatterns": ["pattern1", "pattern2"],
  "confidence": 0.0 to 1.0,
  "recommendedAction": "specific action to take"
}`;
    } else {
      throw new Error("Invalid action specified");
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemma-2-9b-it:free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch {
      parsedContent = { raw: content };
    }

    return new Response(
      JSON.stringify({ success: true, data: parsedContent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI Playlist error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
