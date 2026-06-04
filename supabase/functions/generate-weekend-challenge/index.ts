import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAI } from "../_shared/ai.ts";

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

    // Ask AI to generate a weekend challenge
    const messages = [
      {
        role: "system" as const,
        content: "Tworzysz weekendowe wyzwanie dla muzycznej platformy GrouAI Stream. Każde wyzwanie musi być inne, motywujące, krótkie. Tytuł max 60 znaków, opis max 200 znaków. Zwróć TYLKO poprawny JSON bez markdown.",
      },
      {
        role: "user" as const,
        content: `Wygeneruj nowe weekendowe wyzwanie. Wybierz typ aktywności, sensowny target i nagrodę 1-5€.

Zwróć JSON z dokładnie tymi polami:
{
  "title": "krótki, chwytliwy tytuł",
  "description": "opis wyzwania (max 200 znaków)",
  "activity_type": "uploads" | "ratings" | "mood_sessions" | "studio_tracks" | "listens",
  "target": liczba (np. 5),
  "reward": liczba (1-5),
  "duration_days": liczba (2 lub 3)
}`,
      },
    ];

    const aiText = await callAI(messages, { model: "grok-3-mini", maxTokens: 512 });
    let challenge: any;
    try {
      challenge = JSON.parse(aiText);
    } catch {
      const match = aiText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("AI returned non-JSON: " + aiText.slice(0, 200));
      challenge = JSON.parse(match[0]);
    }

    const now = new Date();
    const endsAt = new Date(now.getTime() + (challenge.duration_days ?? 2) * 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from("weekend_challenges")
      .insert({
        title: challenge.title,
        description: challenge.description,
        activity_type: challenge.activity_type,
        target: challenge.target,
        reward_euros: challenge.reward,
        starts_at: now.toISOString(),
        ends_at: endsAt.toISOString(),
        status: "active",
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, challenge: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-weekend-challenge error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
