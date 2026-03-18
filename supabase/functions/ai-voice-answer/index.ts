import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question, language } = await req.json();
    if (!question) {
      return new Response(JSON.stringify({ error: "No question" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GROK_API_KEY = Deno.env.get("GROK_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    let answer = "";

    // Try Grok first for real-time web knowledge
    if (GROK_API_KEY) {
      try {
        console.log("🔍 Voice query via Grok:", question.slice(0, 80));
        const grokResp = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${GROK_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "grok-4-1-fast",
            messages: [
              {
                role: "system",
                content: `You are a voice assistant named GrouAI. Answer concisely in 2-4 sentences, optimized for text-to-speech (no markdown, no links, no special characters). Answer in ${language === "en" ? "English" : language === "nl" ? "Dutch" : language === "ua" ? "Ukrainian" : "Polish"}. For weather: provide temperature (Celsius), conditions, wind for ANY city/country. For factual questions: provide accurate, up-to-date information. For opinions: be helpful and balanced. Always answer — never say you can't.`,
              },
              { role: "user", content: question },
            ],
            search_mode: "auto",
          }),
        });

        if (grokResp.ok) {
          const grokData = await grokResp.json();
          answer = grokData.choices?.[0]?.message?.content || "";
          console.log("✅ Grok answer length:", answer.length);
        } else {
          console.error("Grok error:", grokResp.status);
        }
      } catch (e) {
        console.error("Grok fetch error:", e);
      }
    }

    // Fallback to Lovable AI if Grok failed
    if (!answer && LOVABLE_API_KEY) {
      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: `You are GrouAI voice assistant. Answer concisely in 2-4 sentences for TTS. No markdown, no links. Answer in ${language === "en" ? "English" : language === "nl" ? "Dutch" : language === "ua" ? "Ukrainian" : "Polish"}.`,
              },
              { role: "user", content: question },
            ],
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          answer = aiData.choices?.[0]?.message?.content || "";
        }
      } catch (e) {
        console.error("Lovable AI error:", e);
      }
    }

    if (!answer) {
      answer = language === "en" ? "Sorry, I couldn't find an answer right now." :
               language === "nl" ? "Sorry, ik kon nu geen antwoord vinden." :
               language === "ua" ? "Вибачте, не вдалося знайти відповідь." :
               "Przepraszam, nie udało mi się znaleźć odpowiedzi.";
    }

    // Clean answer for TTS - remove markdown artifacts
    answer = answer
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/#{1,6}\s/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\n+/g, ". ")
      .trim();

    return new Response(JSON.stringify({ answer }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Voice answer error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
