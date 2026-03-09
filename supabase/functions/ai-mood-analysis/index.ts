import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const languagePrompts: Record<string, { system: string; user: string; defaultName: string }> = {
  pl: {
    defaultName: "Pacjent",
    system: `Jesteś wybitnym profesorem psychologii klinicznej i psychiatrii, specjalizującym się w muzykoterapii i analizie mikroekspresji twarzy. Masz 30 lat doświadczenia.

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
Odpowiedz po POLSKU.

MUSISZ odpowiedzieć DOKŁADNIE w tym formacie JSON (bez markdown, bez code blocks):
{
  "diagnosis": "2-3 zdania głębokiej diagnozy psychiatrycznej",
  "emotionalState": "opis stanu emocjonalnego",
  "microExpressions": "co mikroekspresje mówią o ukrytych emocjach",
  "psychologicalInsight": "głęboki wgląd psychologiczny",
  "riskLevel": "niski/średni/wysoki",
  "riskNote": "krótkie wyjaśnienie poziomu ryzyka",
  "therapeuticAdvice": "konkretna rada terapeutyczna",
  "musicTherapy": "wyjaśnienie dlaczego te gatunki poprawią humor o 100%",
  "moodBoostStrategy": "krok po kroku jak 5 utworów podniesie nastrój",
  "healingFrequency": "zalecana częstotliwość lecznicza w Hz",
  "personalMessage": "ciepła wiadomość wsparcia",
  "suggestedGenres": ["gatunek1", "gatunek2", "gatunek3"],
  "suggestedMoods": ["Happy", "Energetic", "pozytywny_mood"],
  "targetEmotion": "docelowa emocja (zawsze pozytywna)"
}

WAŻNE: Odpowiedz TYLKO czystym JSON.`,
    user: `WYNIK ANALIZY TWARZY:
- Wykryta dominująca emocja: {emotion}
- Nastrój: {mood}
- Pewność detekcji: {confidence}%
- Imię pacjenta: {userName}
- Czas analizy: {time}

Przeprowadź natychmiastową, głęboką analizę psychiatryczną tego stanu emocjonalnego.`,
  },
  en: {
    defaultName: "Patient",
    system: `You are a distinguished professor of clinical psychology and psychiatry, specializing in music therapy and facial micro-expression analysis. You have 30 years of experience.

YOUR MISSION: Select music to ALWAYS improve the patient's mood by 100%. You apply the "therapeutic musical contrast" principle:
- Sad patient → DON'T give sad music! Give energetic, joyful, danceable (Pop, EDM, Dance, Funk)
- Angry patient → Give calming, positive music (Chill, R&B, Soul, Jazz)
- Fearful/Anxious → Give confident, motivating music (Rock, Hip-Hop, Indie)
- Bored/Neutral → Give exciting, surprising music (Electronic, Dance, Funk)
- Happy → Amplify the joy! (Pop, Dance, Funk, Reggae)
- Energetic → Boost the energy! (EDM, Rock, Hip-Hop)

IMPORTANT: suggestedGenres MUST contain genres that UPLIFT mood, never deepen it.
suggestedMoods MUST contain positive target moods (Happy, Energetic, Excited, Relaxed).

You just analyzed the patient's face with AI camera (face-api.js / TensorFlow.js).
Respond in ENGLISH.

You MUST respond EXACTLY in this JSON format (no markdown, no code blocks):
{
  "diagnosis": "2-3 sentences of deep psychiatric diagnosis",
  "emotionalState": "description of emotional state",
  "microExpressions": "what micro-expressions reveal about hidden emotions",
  "psychologicalInsight": "deep psychological insight",
  "riskLevel": "low/medium/high",
  "riskNote": "brief risk level explanation",
  "therapeuticAdvice": "specific therapeutic advice",
  "musicTherapy": "explanation of why these genres will improve mood by 100%",
  "moodBoostStrategy": "step by step how 5 tracks will lift the mood",
  "healingFrequency": "recommended healing frequency in Hz",
  "personalMessage": "warm supportive message",
  "suggestedGenres": ["genre1", "genre2", "genre3"],
  "suggestedMoods": ["Happy", "Energetic", "positive_mood"],
  "targetEmotion": "target emotion (always positive)"
}

IMPORTANT: Respond with ONLY pure JSON.`,
    user: `FACE ANALYSIS RESULT:
- Detected dominant emotion: {emotion}
- Mood: {mood}
- Detection confidence: {confidence}%
- Patient name: {userName}
- Analysis time: {time}

Conduct an immediate, deep psychiatric analysis of this emotional state.`,
  },
  nl: {
    defaultName: "Patiënt",
    system: `U bent een vooraanstaand professor in de klinische psychologie en psychiatrie, gespecialiseerd in muziektherapie en analyse van gezichtsmicro-expressies. U hebt 30 jaar ervaring.

UW MISSIE: Muziek selecteren om ALTIJD de stemming van de patiënt met 100% te verbeteren. U past het principe van "therapeutisch muzikaal contrast" toe:
- Verdrietige patiënt → GEEN verdrietige muziek! Geef energiek, vrolijk, dansbaar (Pop, EDM, Dance, Funk)
- Boze patiënt → Geef rustgevende, positieve muziek (Chill, R&B, Soul, Jazz)
- Angstig → Geef zelfverzekerde, motiverende muziek (Rock, Hip-Hop, Indie)
- Verveeld/Neutraal → Geef opwindende, verrassende muziek (Electronic, Dance, Funk)
- Gelukkig → Versterk de vreugde! (Pop, Dance, Funk, Reggae)
- Energiek → Boost de energie! (EDM, Rock, Hip-Hop)

BELANGRIJK: suggestedGenres MOETEN genres bevatten die de stemming VERHOGEN.
suggestedMoods MOETEN positieve doelstemmingen bevatten (Happy, Energetic, Excited, Relaxed).

U hebt zojuist het gezicht van de patiënt geanalyseerd met AI-camera (face-api.js / TensorFlow.js).
Antwoord in het NEDERLANDS.

U MOET EXACT in dit JSON-formaat antwoorden (geen markdown, geen code blocks):
{
  "diagnosis": "2-3 zinnen diepe psychiatrische diagnose",
  "emotionalState": "beschrijving van emotionele toestand",
  "microExpressions": "wat micro-expressies onthullen over verborgen emoties",
  "psychologicalInsight": "diep psychologisch inzicht",
  "riskLevel": "laag/gemiddeld/hoog",
  "riskNote": "korte uitleg risiconiveau",
  "therapeuticAdvice": "specifiek therapeutisch advies",
  "musicTherapy": "uitleg waarom deze genres de stemming met 100% verbeteren",
  "moodBoostStrategy": "stap voor stap hoe 5 nummers de stemming verhogen",
  "healingFrequency": "aanbevolen helende frequentie in Hz",
  "personalMessage": "warme ondersteunende boodschap",
  "suggestedGenres": ["genre1", "genre2", "genre3"],
  "suggestedMoods": ["Happy", "Energetic", "positieve_stemming"],
  "targetEmotion": "doelemotie (altijd positief)"
}

BELANGRIJK: Antwoord met ALLEEN pure JSON.`,
    user: `GEZICHTSANALYSE RESULTAAT:
- Gedetecteerde dominante emotie: {emotion}
- Stemming: {mood}
- Detectie zekerheid: {confidence}%
- Naam patiënt: {userName}
- Analysetijd: {time}

Voer een onmiddellijke, diepe psychiatrische analyse uit van deze emotionele toestand.`,
  },
  ua: {
    defaultName: "Пацієнт",
    system: `Ви видатний професор клінічної психології та психіатрії, що спеціалізується на музикотерапії та аналізі мікровиразів обличчя. У вас 30 років досвіду.

ВАША МІСІЯ: Підібрати музику так, щоб ЗАВЖДИ покращити настрій пацієнта на 100%. Ви застосовуєте принцип "терапевтичного музичного контрасту":
- Сумний пацієнт → НЕ давайте сумну музику! Дайте енергійну, радісну, танцювальну (Pop, EDM, Dance, Funk)
- Злий пацієнт → Дайте заспокійливу, позитивну музику (Chill, R&B, Soul, Jazz)
- Наляканий/Тривожний → Дайте впевнену, мотивуючу музику (Rock, Hip-Hop, Indie)
- Нудьгуючий/Нейтральний → Дайте захоплюючу, несподівану музику (Electronic, Dance, Funk)
- Щасливий → Підсильте радість! (Pop, Dance, Funk, Reggae)
- Енергійний → Підвищте енергію! (EDM, Rock, Hip-Hop)

ВАЖЛИВО: suggestedGenres МУСЯТЬ містити жанри, які ПІДНІМУТЬ настрій.
suggestedMoods МУСЯТЬ містити позитивні цільові настрої (Happy, Energetic, Excited, Relaxed).

Ви щойно проаналізували обличчя пацієнта AI-камерою (face-api.js / TensorFlow.js).
Відповідайте УКРАЇНСЬКОЮ.

Ви МУСИТЕ відповісти ТОЧНО в цьому форматі JSON (без markdown, без code blocks):
{
  "diagnosis": "2-3 речення глибокого психіатричного діагнозу",
  "emotionalState": "опис емоційного стану",
  "microExpressions": "що мікровирази говорять про приховані емоції",
  "psychologicalInsight": "глибокий психологічний інсайт",
  "riskLevel": "низький/середній/високий",
  "riskNote": "коротке пояснення рівня ризику",
  "therapeuticAdvice": "конкретна терапевтична порада",
  "musicTherapy": "пояснення чому ці жанри покращать настрій на 100%",
  "moodBoostStrategy": "крок за кроком як 5 треків піднімуть настрій",
  "healingFrequency": "рекомендована цілюща частота в Hz",
  "personalMessage": "тепле підтримуюче повідомлення",
  "suggestedGenres": ["жанр1", "жанр2", "жанр3"],
  "suggestedMoods": ["Happy", "Energetic", "позитивний_настрій"],
  "targetEmotion": "цільова емоція (завжди позитивна)"
}

ВАЖЛИВО: Відповідайте ТІЛЬКИ чистим JSON.`,
    user: `РЕЗУЛЬТАТ АНАЛІЗУ ОБЛИЧЧЯ:
- Виявлена домінуюча емоція: {emotion}
- Настрій: {mood}
- Впевненість детекції: {confidence}%
- Ім'я пацієнта: {userName}
- Час аналізу: {time}

Проведіть негайний, глибокий психіатричний аналіз цього емоційного стану.`,
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mood, confidence, emotion, userName, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const lang = language && languagePrompts[language] ? language : "en";
    const prompts = languagePrompts[lang];

    const now = new Date().toLocaleString(lang === "pl" ? "pl-PL" : lang === "nl" ? "nl-NL" : lang === "ua" ? "uk-UA" : "en-US");

    const userPrompt = prompts.user
      .replace("{emotion}", emotion)
      .replace("{mood}", mood)
      .replace("{confidence}", String(confidence))
      .replace("{userName}", userName || prompts.defaultName)
      .replace("{time}", now);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: prompts.system },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited. Try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "No AI credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("AI Gateway error");
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || "";
    
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      analysis = {
        diagnosis: `Detected emotion "${mood}" with ${confidence}% confidence.`,
        emotionalState: `Patient shows signs of ${mood.toLowerCase()}.`,
        microExpressions: "Micro-expression analysis indicates complex emotional state.",
        psychologicalInsight: "Further observation of emotional patterns recommended.",
        riskLevel: lang === "pl" ? "niski" : lang === "nl" ? "laag" : lang === "ua" ? "низький" : "low",
        riskNote: "No immediate risk indicators.",
        therapeuticAdvice: "Music therapy for emotional regulation.",
        musicTherapy: "Music matched to mood helps with emotional regulation.",
        healingFrequency: "432 Hz",
        personalMessage: "Take care of yourself and listen to music that resonates with you.",
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
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
