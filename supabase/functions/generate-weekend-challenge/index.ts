import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: corsHeaders });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Ask AI to generate a weekend challenge
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "Tworzysz weekendowe wyzwanie dla muzycznej platformy GrouAI Stream. Każde wyzwanie musi być inne, motywujące, krótkie. Tytuł max 60 znaków, opis max 140 znaków. Po polsku.",
          },
          {
            role: "user",
            content: "Wygeneruj nowe weekendowe wyzwanie. Wybierz typ aktywności, sensowny target i nagrodę 1-5€.",
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "create_challenge",
            description: "Tworzy weekendowe wyzwanie",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "Krótki, chwytliwy tytuł" },
                description: { type: "string", description: "Opis wyzwania" },
                activity_type: {
                  type: "string",
                  enum: ["uploads", "ratings", "mood_sessions", "studio_tracks", "listens"],
                },
                target_count: { type: "integer", minimum: 1, maximum: 50 },
                reward_amount: { type: "number", minimum: 1, maximum: 5 },
              },
              required: ["title", "description", "activity_type", "target_count", "reward_amount"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "create_challenge" } },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit" }), { status: 429, headers: corsHeaders });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Brak kredytów Lovable AI" }), { status: 402, headers: corsHeaders });
      }
      throw new Error("AI gateway error");
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call from AI");

    const args = JSON.parse(toolCall.function.arguments);

    const { data, error } = await supabase.rpc("admin_create_weekend_challenge", {
      _title: args.title,
      _description: args.description,
      _activity_type: args.activity_type,
      _target_count: args.target_count,
      _reward_amount: args.reward_amount,
      _duration_hours: 72,
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, challenge: { ...args, id: (data as any)?.id } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-weekend-challenge error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
