import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MoodSession {
  mood: string;
  confidence: number;
  source: string;
  detected_at: string;
}

interface MoodAnalysis {
  dominantMood: string;
  moodDistribution: Record<string, number>;
  averageConfidence: number;
  sessionsCount: number;
  patterns: string[];
  recommendations: {
    music: string[];
    frequencies: string[];
    symptoms: string[];
    advice: string[];
  };
  suggestedGenres: string[];
  healingFrequencies: { hz: number; purpose: string }[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { analysis, sessions, selectedDays, userName } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Build detailed context for AI psychologist
    const moodSummary = Object.entries(analysis.moodDistribution as Record<string, number>)
      .map(([mood, count]) => `${mood}: ${count} razy (${Math.round((count / analysis.sessionsCount) * 100)}%)`)
      .join(", ");

    const sessionDetails = (sessions as MoodSession[]).slice(0, 20).map((s) => {
      const date = new Date(s.detected_at);
      return `${date.toLocaleDateString("pl-PL")} ${date.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })} - ${s.mood} (${s.confidence}%)`;
    }).join("\n");

    const systemPrompt = `Jesteś doświadczonym psychologiem klinicznym specjalizującym się w psychologii emocji i muzykoterapii. 
Przeprowadzasz profesjonalną analizę stanu emocjonalnego pacjenta na podstawie danych z automatycznego wykrywania nastroju.

ZASADY:
1. Pisz profesjonalnie ale zrozumiale dla laika
2. Używaj terminologii psychologicznej z wyjaśnieniami
3. Bądź empatyczny ale obiektywny
4. Podawaj konkretne, praktyczne zalecenia
5. Zwracaj uwagę na potencjalne ryzyka zdrowotne
6. Rekomenduj kiedy pacjent powinien skonsultować się ze specjalistą
7. Odpowiadaj TYLKO po polsku

FORMAT ODPOWIEDZI (użyj dokładnie tych nagłówków):

## OCENA OGÓLNA
[2-3 zdania podsumowujące ogólny stan emocjonalny pacjenta]

## DIAGNOZA KLINICZNA
[Szczegółowa analiza dominującego nastroju i wzorców emocjonalnych. Opisz co mogą oznaczać wykryte stany.]

## ANALIZA RYZYKA
[Oceń poziom ryzyka (niski/średni/wysoki) dla zdrowia psychicznego. Wyjaśnij dlaczego.]

## WYKRYTE SYMPTOMY
[Lista konkretnych symptomów, które mogą wymagać uwagi. Jeśli brak - napisz "Nie wykryto niepokojących symptomów."]

## DIAGNOZA RÓŻNICOWA
[Jakie stany psychologiczne mogą odpowiadać zaobserwowanym wzorcom. Wymień 2-3 możliwości.]

## ZALECENIA TERAPEUTYCZNE
[Konkretne działania które pacjent powinien podjąć, w tym:
- Muzykoterapia (gatunki, częstotliwości lecznicze Hz)
- Techniki relaksacyjne
- Zmiany w stylu życia
- Kiedy szukać pomocy profesjonalnej]

## PROGNOZA
[Krótka prognoza przy zastosowaniu zaleceń vs bez interwencji]

## UWAGI KOŃCOWE
[Osobista wiadomość wsparcia dla pacjenta]`;

    const userPrompt = `DANE PACJENTA:
Imię: ${userName || "Nieznane"}
Okres analizy: ${selectedDays} dni
Liczba skanów nastroju: ${analysis.sessionsCount}

DOMINUJĄCY NASTRÓJ: ${analysis.dominantMood}
Średnia pewność detekcji: ${analysis.averageConfidence}%

ROZKŁAD NASTROJÓW:
${moodSummary}

WYKRYTE WZORCE:
${analysis.patterns.length > 0 ? analysis.patterns.join("\n") : "Brak wystarczających danych dla wykrycia wzorców"}

HISTORIA SKANÓW (chronologicznie):
${sessionDetails}

WSTĘPNIE WYKRYTE SYMPTOMY:
${analysis.recommendations.symptoms.length > 0 ? analysis.recommendations.symptoms.join("\n") : "Brak wstępnych symptomów"}

Przeprowadź pełną analizę psychologiczną i wygeneruj profesjonalną opinię kliniczną.`;

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
          JSON.stringify({ error: "Brak kredytów AI. Skontaktuj się z administratorem." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("AI Gateway error");
    }

    const aiData = await aiResponse.json();
    const opinion = aiData.choices?.[0]?.message?.content || "Nie udało się wygenerować opinii.";

    return new Response(
      JSON.stringify({ opinion }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI Psychologist error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Nieznany błąd" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
