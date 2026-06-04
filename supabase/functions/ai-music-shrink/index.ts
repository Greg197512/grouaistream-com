import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mood, confidence, emotions } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const emotionsText = Array.isArray(emotions)
      ? emotions.slice(0, 3).map((e: any) => `${e.emotion} ${Math.round(e.probability * 100)}%`).join(", ")
      : "brak danych";

    const systemPrompt = `Jesteś muzycznym socjologiem i psychologiem — kimś między Jankiem Wasilewskim a barmanem o 3 nad ranem.
Mówisz po polsku, ciepło, prawdziwie i z lekkim humorem (NIE jak doktor w gabinecie!).
Twoja analiza ma:
- 3-4 zdania, max 350 znaków
- Zacząć od ludzkiej obserwacji (NIE "Wykryto emocję X")
- Połączyć nastrój z gatunkiem muzyki w intuicyjny sposób
- Skończyć propozycją gatunku/wibe'u — z mrugnięciem okiem
- Używać metafor, drobnego żartu, ciepła
NIGDY nie pisz jak raport. Pisz jak przyjaciel który wie o Tobie więcej niż powinien.`;

    const userPrompt = `Kamera wykryła twarz użytkownika.
Dominująca emocja: ${mood} (pewność ${confidence}%)
Top 3 emocje: ${emotionsText}

Daj krótką, ludzką, lekko zabawną analizę i poleć gatunek muzyki.`;

    const aiResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "HTTP-Referer": "https://grouaistream.com",
    "X-Title": "Groua AI Stream",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemma-2-9b-it:free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Za dużo zapytań, spróbuj za chwilę" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Brak kredytów AI" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway: ${aiResp.status}`);
    }

    const data = await aiResp.json();
    const analysis = data.choices?.[0]?.message?.content?.trim() || "Coś dziś jesteś tajemniczy. Daj sobie chwilę i wrzuć coś z dobrym basem 🎧";

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-music-shrink error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
