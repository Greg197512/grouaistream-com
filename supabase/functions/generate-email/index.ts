import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EmailRequest {
  type: "invitation" | "challenge" | "newsletter" | "weekly_digest" | "easter";
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

    const systemPrompt = `Jesteś ekspertem od komunikacji marki GrouAI Stream — premium platformy muzycznej z AI.

TOŻSAMOŚĆ MARKI:
- GrouAI Stream to „muzyka, która słucha Ciebie" — empatyczny, inteligentny DJ oparty na AI
- Funkcje kluczowe: detekcja nastroju przez kamerę, komendy głosowe, generowanie muzyki AI, radio na żywo, sesje DJ z QR, raport AI-psychologa
- Ton marki: premium, ciepły, inteligentny, z nutą poetyckości. Nigdy korporacyjny czy sztywny.
- Kolory marki: pomarańczowy (#e8450a) jako akcent, ciemne tło, neonowe detale

ZASADY PISANIA:
1. Pisz po polsku, profesjonalnie ale z duszą — jak człowiek do człowieka
2. Używaj max 3 emoji, tylko jako subtelne akcenty (🎵 🎧 ✨), nigdy w nadmiarze
3. Struktura: chwytliwy nagłówek → treść wartościowa → jasne CTA
4. Unikaj pustych frazesów i korporacyjnego żargonu
5. Max 120 słów treści — każde zdanie musi nieść wartość
6. Wplataj unikalne cechy platformy (AI mood, generowanie muzyki, sesje DJ)
7. Generuj piękny, dobrze sformatowany HTML z:
   - Nagłówkami w kolorze #e8450a (pomarańczowy GrouAI)
   - Przyciskami CTA z gradientem od #e8450a do #f59e0b
   - Czystą typografią (Inter lub Arial)
   - Separatorami i spacjami dla czytelności
   - Responsywnym layoutem (max-width 580px, padding 20-30px)
8. HTML body musi mieć białe tło (#ffffff), akcenty w kolorach marki`;

    let userPrompt = "";
    switch (type) {
      case "invitation":
        userPrompt = `Wygeneruj e-mail zapraszający ${recipientName ? `użytkownika ${recipientName} ` : ""}do GrouAI Stream.
Podkreśl 3 unikalne funkcje: (1) AI rozpoznaje nastrój przez kamerę i dobiera muzykę, (2) generowanie własnych utworów w 15 gatunkach, (3) radio na żywo z czatem i głosowaniem.
Zakończ mocnym CTA zachęcającym do dołączenia.
${customMessage ? `Kontekst: ${customMessage}` : ""}`;
        break;
      case "challenge":
        userPrompt = `Wygeneruj e-mail z ekskluzywnym muzycznym wyzwaniem tygodniowym dla ${recipientName ? `${recipientName}` : "użytkownika"}.
Wymyśl kreatywne, angażujące wyzwanie powiązane z funkcjami AI (np. „Pozwól AI odczytać 5 Twoich nastrojów", „Stwórz utwór AI w gatunku, którego nigdy nie słuchałeś").
Dodaj motywujący opis dlaczego warto i co użytkownik zyska.
${customMessage ? `Temat challenge: ${customMessage}` : ""}`;
        break;
      case "newsletter":
        userPrompt = `Wygeneruj elegancki newsletter o nowościach w GrouAI Stream.
Struktura: (1) główna nowość/highlight, (2) ciekawostka o AI w muzyce, (3) krótka statystyka platformy.
${stats ? `Statystyki do wykorzystania: ${stats.totalTracks} utworów, ${stats.totalUsers} użytkowników, popularne gatunki: ${stats.topGenres.join(", ")}` : ""}
${customMessage ? `Główny temat: ${customMessage}` : ""}`;
        break;
      case "weekly_digest":
        userPrompt = `Wygeneruj spersonalizowane cotygodniowe podsumowanie dla ${recipientName ? `${recipientName}` : "użytkownika"}.
Struktura: (1) podziękowanie za bycie częścią społeczności, (2) odkrywcza rekomendacja — zaproponuj eksplorację nowego gatunku lub funkcji (np. sesje DJ, generowanie muzyki, mood detection), (3) inspirująca myśl o muzyce na nowy tydzień.
${stats ? `Dane platformy: ${stats.totalTracks} utworów dostępnych w ${stats.topGenres.length} gatunkach` : ""}`;
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
