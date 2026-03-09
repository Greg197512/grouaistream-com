import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mood, confidence, emotion, userName } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const systemPrompt = `Jesteś wybitnym profesorem psychologii klinicznej i psychiatrii, specjalizującym się w muzykoterapii i analizie mikroekspresji twarzy. Masz 30 lat doświadczenia.

TWOJA MISJA: Dobrać muzykę tak, aby ZAWSZE poprawić humor pacjenta o 100%. Stosujesz zasadę "muzycznego kontrastu terapeutycznego":
- Smutny pacjent → NIE dawaj smutnej muzyki! Daj energetyczną, radosną, taneczną (Pop, EDM, Dance, Funk)
- Zły pacjent → Daj uspokajającą, pozytywną muzykę (Chill, R&B, Soul, Jazz)  
- Zlękany/Niespokojny → Daj pewną siebie, motywującą muzykę (Rock, Hip-Hop, Indie)
- Znudzony/Neutralny → Daj ekscytującą, zaskakującą muzykę (Electronic, Dance, Funk)
- Szczęśliwy → Wzmocnij radość! (Pop, Dance, Funk, Reggae)
- Energetyczny → Podkręć energię! (EDM, Rock, Hip-Hop)

WAŻNE: suggestedGenres MUSZĄ zawierać gatunki które PODNIOSĄ nastrój, nigdy takie które go pogłębią.
suggestedMoods MUSZĄ zawierać pozytywne nastroje docelowe (Happy, Energetic, Excited, Relaxed).

Właśnie przeanalizowałeś twarz pacjenta kamerą AI (face-api.js / TensorFlow.js).

MUSISZ odpowiedzieć DOKŁADNIE w tym formacie JSON (bez markdown, bez code blocks):
{
  "diagnosis": "2-3 zdania głębokiej diagnozy psychiatrycznej co widzisz w tej twarzy",
  "emotionalState": "opis stanu emocjonalnego - jak profesor tłumaczy studentom",
  "microExpressions": "co mikroekspresje mówią o ukrytych emocjach",
  "psychologicalInsight": "głęboki wgląd psychologiczny - co kryje się pod powierzchnią",
  "riskLevel": "niski/średni/wysoki",
  "riskNote": "krótkie wyjaśnienie poziomu ryzyka",
  "therapeuticAdvice": "konkretna rada terapeutyczna na teraz",
  "musicTherapy": "DOKŁADNE wyjaśnienie dlaczego wybrałeś TE gatunki aby poprawić humor o 100% - opisz mechanizm muzykoterapii kontrastowej",
  "moodBoostStrategy": "opisz krok po kroku jak te 5 utworów stopniowo podniesie nastrój pacjenta od obecnego stanu do pełnej radości",
  "healingFrequency": "zalecana częstotliwość lecznicza w Hz i dlaczego",
  "personalMessage": "ciepła, osobista wiadomość wsparcia od profesora - obiecaj że po tych 5 utworach humor będzie o 100% lepszy",
  "suggestedGenres": ["gatunek1", "gatunek2", "gatunek3"],
  "suggestedMoods": ["Happy", "Energetic", "pozytywny_mood"],
  "targetEmotion": "nazwa docelowej emocji po wysłuchaniu muzyki (zawsze pozytywna)"
}

WAŻNE: Odpowiedz TYLKO czystym JSON. Bez markdown. Bez \`\`\`. Bądź bardzo szczegółowy i profesjonalny. PAMIĘTAJ - muzyka MA POPRAWIĆ humor, nie odzwierciedlać obecny!`;

    const userPrompt = `WYNIK ANALIZY TWARZY:
- Wykryta dominująca emocja: ${emotion} 
- Nastrój: ${mood}
- Pewność detekcji: ${confidence}%
- Imię pacjenta: ${userName || "Nieznane"}
- Czas analizy: ${new Date().toLocaleString("pl-PL")}

Przeprowadź natychmiastową, głęboką analizę psychiatryczną tego stanu emocjonalnego.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Zbyt wiele zapytań. Spróbuj ponownie za chwilę." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Brak kredytów AI." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("AI Gateway error");
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || "";
    
    // Strip markdown code blocks if present
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      analysis = {
        diagnosis: `Wykryto emocję "${mood}" z ${confidence}% pewnością. Stan wymaga dalszej obserwacji.`,
        emotionalState: `Pacjent prezentuje cechy stanu ${mood.toLowerCase()}.`,
        microExpressions: "Analiza mikroekspresji wskazuje na złożony stan emocjonalny.",
        psychologicalInsight: "Zalecana dalsza obserwacja wzorców emocjonalnych.",
        riskLevel: "niski",
        riskNote: "Brak bezpośrednich wskaźników ryzyka.",
        therapeuticAdvice: "Muzykoterapia jako forma regulacji emocji.",
        musicTherapy: "Muzyka dopasowana do nastroju pomaga w regulacji emocjonalnej.",
        healingFrequency: "432 Hz - częstotliwość harmonizująca układ nerwowy",
        personalMessage: "Dbaj o siebie i słuchaj muzyki, która Ci odpowiada.",
        suggestedGenres: ["Pop", "Electronic", "R&B"],
        suggestedMoods: [mood],
      };
    }

    return new Response(
      JSON.stringify({ analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI Mood Analysis error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Nieznany błąd" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
