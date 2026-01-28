import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EmailRequest {
  type: "invitation" | "challenge" | "newsletter" | "weekly_digest";
  recipientName?: string;
  customMessage?: string;
  stats?: {
    totalTracks: number;
    totalUsers: number;
    topGenres: string[];
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { type, recipientName, customMessage, stats }: EmailRequest = await req.json();

    const systemPrompt = `Jesteś asystentem platformy muzycznej GrouAI Stream. 
Generujesz kreatywne, przyjazne e-maile po polsku dla użytkowników.
Pisz w tonie entuzjastycznym, ale profesjonalnym.
Używaj emoji dla lepszego efektu wizualnego.
E-maile powinny być krótkie (max 150 słów) i angażujące.`;

    let userPrompt = "";
    switch (type) {
      case "invitation":
        userPrompt = `Wygeneruj e-mail zapraszający nowego użytkownika ${recipientName || ""}do GrouAI Stream.
Podkreśl funkcje: AI wykrywa nastrój, personalizowane playlisty, darmowa muzyka CC.
${customMessage ? `Dodatkowa informacja: ${customMessage}` : ""}`;
        break;
      case "challenge":
        userPrompt = `Wygeneruj e-mail z muzycznym wyzwaniem tygodniowym dla użytkownika ${recipientName || ""}.
Zaproponuj challenge jak: "Odkryj 5 nowych gatunków" lub "Słuchaj muzyki 30 min dziennie".
${customMessage ? `Temat challenge: ${customMessage}` : ""}`;
        break;
      case "newsletter":
        userPrompt = `Wygeneruj newsletter o nowościach w GrouAI Stream.
${stats ? `Statystyki: ${stats.totalTracks} utworów, ${stats.totalUsers} użytkowników, top gatunki: ${stats.topGenres.join(", ")}` : ""}
${customMessage ? `Główny temat: ${customMessage}` : ""}`;
        break;
      case "weekly_digest":
        userPrompt = `Wygeneruj cotygodniowe podsumowanie dla użytkownika ${recipientName || ""}.
Uwzględnij: podziękowanie za słuchanie, zachętę do odkrywania nowej muzyki, info o funkcji AI mood detection.
${stats ? `Aktualnie w serwisie: ${stats.totalTracks} utworów w ${stats.topGenres.length} gatunkach` : ""}`;
        break;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_email",
              description: "Generate email content with subject and body",
              parameters: {
                type: "object",
                properties: {
                  subject: { type: "string", description: "Email subject line" },
                  body: { type: "string", description: "Email HTML body content" },
                  preview: { type: "string", description: "Email preview text (50 chars max)" }
                },
                required: ["subject", "body", "preview"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "generate_email" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Zbyt wiele zapytań. Spróbuj ponownie za chwilę." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Brak środków na konto AI. Doładuj kredyty." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI generation failed");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error("No email content generated");
    }

    const emailContent = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({
      success: true,
      email: {
        subject: emailContent.subject,
        body: emailContent.body,
        preview: emailContent.preview,
        type,
        generatedAt: new Date().toISOString()
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("generate-email error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
