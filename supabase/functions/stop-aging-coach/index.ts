/**
 * stop-aging-coach — warstwa językowa AI Coacha modułu „Zatrzymać Starość”.
 *
 * Funkcja NIE wylicza wskaźników zdrowotnych. Otrzymuje gotowy kontekst
 * z klienta (liczby i wnioski policzone przez silnik reguł) oraz odpowiedź
 * bazową (`groundTruth`) i ma ją wyłącznie przeformułować w naturalny język.
 * Dzięki temu halucynacja modelu nie zmienia merytoryki porady.
 *
 * Bezpieczeństwo:
 *  • wykrywanie objawów alarmowych ma pierwszeństwo przed modelem —
 *    przy ich wystąpieniu zwracamy stałą, przetestowaną treść;
 *  • kontekst nie zawiera danych identyfikujących (imię, e-mail, ID urządzeń);
 *  • przy braku klucza AI zwracamy `groundTruth`, więc klient zawsze ma odpowiedź.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI, type AIMessage } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DISCLAIMER =
  "To wskazówka oparta na Twoich danych, a nie diagnoza medyczna. Aplikacja nie zastępuje konsultacji z lekarzem ani badań.";

const SYSTEM_PROMPT = `Jesteś trenerem stylu życia w aplikacji „Zatrzymać Starość”.

TWOJA ROLA
Rozmawiasz z użytkownikiem o śnie, stresie, regeneracji, ruchu i diecie. Dostajesz gotowe wnioski wyliczone przez silnik aplikacji oraz odpowiedź bazową. Twoim zadaniem jest przekazać tę samą treść zrozumiale i naturalnie.

ZASADY BEZWZGLĘDNE
1. Nie stawiasz diagnoz, nie interpretujesz objawów chorobowych, nie zalecasz ani nie odradzasz leków.
2. Nie wymyślasz liczb. Używasz wyłącznie wartości z kontekstu i z odpowiedzi bazowej. Jeśli danych brakuje, mówisz o tym wprost.
3. Nie obiecujesz zatrzymania ani odwrócenia starzenia. Mówisz o spowolnieniu skutków stylu życia i o konkretnych, mierzalnych zmianach.
4. Przy objawach alarmowych (ból w klatce piersiowej, duszność, omdlenia, myśli samobójcze) przerywasz temat stylu życia i kierujesz do pomocy medycznej.
5. Nie zmieniasz zaleceń z odpowiedzi bazowej na przeciwne. Możesz je skrócić, uporządkować i wyjaśnić.

STYL
- Zwracasz się bezpośrednio, bez zdrobnień i bez patosu.
- Maksymalnie 4 konkretne działania na raz, każde wykonalne dziś.
- Odwołujesz się do liczb użytkownika — to one budują zaufanie.
- Nie moralizujesz. Gorszy dzień to informacja, nie porażka.
- Odpowiadasz w języku wskazanym w polu locale kontekstu (domyślnie polski).
- Długość: 3–8 zdań plus lista działań. Bez nagłówków markdown.`;

/** Frazy, przy których nie oddajemy głosu modelowi. */
const RED_FLAGS = [
  "ból w klatce",
  "bol w klatce",
  "duszno",
  "duszność",
  "dusznosc",
  "omdle",
  "zemdla",
  "krwawi",
  "samobój",
  "samoboj",
  "nie chcę żyć",
  "nie chce zyc",
  "odebrać sobie życie",
  "chest pain",
  "suicid",
  "can't breathe",
];

const SAFETY_RESPONSE = `To, co opisujesz, wykracza poza zakres aplikacji wspierającej styl życia.

Jeśli objawy występują teraz — ból w klatce piersiowej, duszność, zasłabnięcie — zadzwoń pod numer alarmowy 112.

Jeśli masz myśli o odebraniu sobie życia, zadzwoń pod 116 123 (kryzysowy telefon zaufania, całodobowo) albo 800 70 2222 (Centrum Wsparcia). Rozmowa jest bezpłatna i anonimowa.

Nie jestem w stanie ocenić objawów medycznych i nie zastąpię kontaktu z lekarzem. Wrócę do tematu snu, stresu i regeneracji, kiedy będziesz gotowy.`;

interface CoachRequest {
  question?: string;
  context?: Record<string, unknown>;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  /** Odpowiedź z silnika reguł — źródło prawdy merytorycznej. */
  groundTruth?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Metoda nieobsługiwana" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as CoachRequest;
    const question = (body.question ?? "").trim();
    const groundTruth = (body.groundTruth ?? "").trim();

    if (question.length === 0) {
      return new Response(JSON.stringify({ error: "Brak pytania" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Bezpieczeństwo przed wygodą: przy objawach alarmowych model nie odpowiada.
    const lowered = question.toLowerCase();
    if (RED_FLAGS.some((flag) => lowered.includes(flag))) {
      return new Response(
        JSON.stringify({ reply: SAFETY_RESPONSE, source: "safety", disclaimer: DISCLAIMER }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const messages: AIMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "system",
        content: `KONTEKST UŻYTKOWNIKA (dane wyliczone lokalnie, nie zmieniaj tych liczb):\n${JSON.stringify(
          body.context ?? {},
          null,
          2,
        )}`,
      },
      ...(groundTruth
        ? ([
            {
              role: "system",
              content: `ODPOWIEDŹ BAZOWA z silnika reguł — zachowaj jej sens i wszystkie liczby, popraw wyłącznie formę:\n${groundTruth}`,
            },
          ] as AIMessage[])
        : []),
      ...((body.history ?? []).slice(-6) as AIMessage[]),
      { role: "user", content: question },
    ];

    try {
      const reply = await callAI(messages, { temperature: 0.5, maxTokens: 700 });
      const trimmed = reply.trim();
      return new Response(
        JSON.stringify({
          reply: trimmed.length > 0 ? trimmed : groundTruth,
          source: trimmed.length > 0 ? "ai" : "rules",
          disclaimer: DISCLAIMER,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (aiError) {
      // Brak klucza albo limit dostawcy — oddajemy odpowiedź regułową.
      console.warn("[stop-aging-coach] AI niedostępne:", (aiError as Error).message);
      return new Response(
        JSON.stringify({
          reply: groundTruth || "Nie mogę teraz połączyć się z modelem. Otwórz pulpit — pełny raport dnia jest tam dostępny offline.",
          source: "rules",
          disclaimer: DISCLAIMER,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } catch (error) {
    console.error("[stop-aging-coach]", error);
    return new Response(JSON.stringify({ error: "Nieprawidłowe żądanie" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
