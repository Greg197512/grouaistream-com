import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

function getCorsHeaders(_req: Request) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

interface MoodSession {
  mood: string;
  confidence: number;
  source: string;
  detected_at: string;
}

// Darmowe silniki AI w kolejności prób. Używamy tego klucza, który jest
// skonfigurowany w projekcie — bez dodatkowych kosztów:
//  1) Lovable AI Gateway (LOVABLE_API_KEY) — subsydiowany przez Lovable, Gemini.
//  2) OpenRouter (OPENROUTER_API_KEY) — darmowy model Gemma.
type Provider = {
  name: string;
  key: string | undefined;
  url: string;
  model: string;
};

async function runAI(
  providers: Provider[],
  systemPrompt: string,
  userPrompt: string,
): Promise<{ opinion: string; provider: string } | { error: string; status: number }> {
  let lastErr = "Brak skonfigurowanego silnika AI";
  let lastStatus = 500;

  for (const p of providers) {
    if (!p.key) continue;
    try {
      const res = await fetch(p.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${p.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: p.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.4,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const opinion = data.choices?.[0]?.message?.content;
        if (opinion) return { opinion, provider: p.name };
        lastErr = "Silnik AI zwrócił pustą odpowiedź";
        lastStatus = 502;
        continue;
      }

      // 429/402 — spróbuj kolejnego darmowego silnika zamiast się poddawać.
      lastStatus = res.status;
      lastErr = `${p.name}: HTTP ${res.status}`;
      console.error(lastErr, (await res.text()).slice(0, 200));
    } catch (e) {
      lastErr = `${p.name}: ${e instanceof Error ? e.message : "błąd sieci"}`;
      console.error(lastErr);
    }
  }

  return { error: lastErr, status: lastStatus };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Authentication check ---
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // --- End authentication ---

    const { analysis, sessions, selectedDays, userName } = await req.json();

    // Darmowe silniki — kolejność prób. Pierwszy z ustawionym kluczem wygrywa.
    const providers: Provider[] = [
      {
        name: "Lovable/Gemini",
        key: Deno.env.get("LOVABLE_API_KEY"),
        url: "https://ai.gateway.lovable.dev/v1/chat/completions",
        model: "google/gemini-2.5-flash",
      },
      {
        name: "OpenRouter/Gemma",
        key: Deno.env.get("OPENROUTER_API_KEY"),
        url: "https://openrouter.ai/api/v1/chat/completions",
        model: "google/gemma-2-9b-it:free",
      },
      {
        name: "OpenRouter/Llama",
        key: Deno.env.get("OPENROUTER_API_KEY"),
        url: "https://openrouter.ai/api/v1/chat/completions",
        model: "meta-llama/llama-3.3-70b-instruct:free",
      },
    ];

    if (!providers.some((p) => p.key)) {
      return new Response(
        JSON.stringify({ error: "Brak klucza AI (LOVABLE_API_KEY lub OPENROUTER_API_KEY)." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build detailed context for AI psychologist
    const moodSummary = Object.entries(analysis.moodDistribution as Record<string, number>)
      .map(([mood, count]) => `${mood}: ${count} razy (${Math.round((count / analysis.sessionsCount) * 100)}%)`)
      .join(", ");

    const sessionDetails = (sessions as MoodSession[]).slice(0, 20).map((s) => {
      const date = new Date(s.detected_at);
      const src = s.source === "webcam" ? "skan twarzy" : s.source === "voice" ? "głos" : s.source;
      return `${date.toLocaleDateString("pl-PL")} ${date.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })} - ${s.mood} (${s.confidence}%, ${src})`;
    }).join("\n");

    // Prompt oparty na dowodach: ramy kliniczne + uczciwość co do ograniczeń.
    const systemPrompt = `Jesteś psychologiem klinicznym i muzykoterapeutą. Tworzysz analizę stanu emocjonalnego
opartą WYŁĄCZNIE na uznanej, recenzowanej wiedzy naukowej i praktyce opartej na dowodach (evidence-based practice).

PODSTAWY NAUKOWE, z których korzystasz (i do których się odwołujesz ogólnie, bez wymyślania nazw badań):
- Modele afektu: model kołowy emocji Russella (valence/arousal), skale PANAS.
- Afektywna neuronauka i regulacja emocji (np. reappraisal, wg Grossa).
- Muzykoterapia oparta na dowodach: przeglądy systematyczne i metaanalizy (m.in. Cochrane) nt. wpływu muzyki
  na lęk, nastrój i stres; wytyczne organizacji muzykoterapeutycznych.
- Podejścia kliniczne o udowodnionej skuteczności: CBT, uważność (MBSR/MBCT), higiena snu, aktywacja behawioralna.
- Standardy przesiewowe (np. logika PHQ-2/PHQ-9, GAD-7) — jako ORIENTACJA, nie diagnoza.

ŻELAZNE ZASADY:
1. To NIE jest diagnoza medyczna — to orientacyjna analiza wspierająca. Zaznacz to wyraźnie.
2. NIE wymyślaj konkretnych badań, nazwisk, szpitali ani liczb. Jeśli powołujesz się na dowody,
   pisz o TYPIE dowodu ("metaanalizy nt. muzykoterapii wskazują, że…"), nie o zmyślonym cytacie.
3. Rozróżniaj fakty o wysokim poparciu dowodowym od hipotez. Przy tzw. "częstotliwościach leczniczych" (Hz)
   uczciwie zaznacz, że dowody są słabe/anegdotyczne — możesz je proponować jako relaks, nie jako terapię.
4. Uwzględnij ograniczenia danych: automatyczny odczyt emocji z twarzy/głosu bywa zawodny; im mniej skanów,
   tym mniejsza pewność. Podaj poziom pewności analizy.
5. Przy sygnałach wysokiego ryzyka (utrzymujący się bardzo niski nastrój, silny lęk) zalecaj kontakt ze
   specjalistą, a przy myślach o samookaleczeniu podaj pomoc kryzysową: w Polsce 112 oraz Telefon Zaufania 116 123.
6. Empatyczny, konkretny, po polsku.

FORMAT (użyj dokładnie tych nagłówków):

## OCENA OGÓLNA
[2-3 zdania. Zaznacz, że to analiza orientacyjna, nie diagnoza.]

## PODSTAWA W BADANIACH
[Krótko: na jakich uznanych ramach naukowych opierasz tę analizę — model afektu, muzykoterapia oparta na dowodach itd.]

## ANALIZA WZORCÓW EMOCJONALNYCH
[Interpretacja dominującego nastroju i rozkładu w świetle modelu valence/arousal. Co sugerują wzorce.]

## POZIOM PEWNOŚCI I OGRANICZENIA
[Oceń pewność (niska/średnia/wysoka) na podstawie liczby skanów i średniej pewności detekcji. Wymień ograniczenia metody.]

## ANALIZA RYZYKA
[Poziom ryzyka (niski/średni/wysoki) + uzasadnienie. Jeśli wysoki — jasne wezwanie do kontaktu ze specjalistą.]

## ZALECENIA OPARTE NA DOWODACH
[Konkretne, evidence-based:
- Muzykoterapia: gatunki/tempo dopasowane do celu (uspokojenie vs aktywacja) z krótkim uzasadnieniem naukowym.
- Techniki regulacji emocji o udowodnionej skuteczności (oddech, uważność, aktywacja behawioralna, sen).
- Częstotliwości Hz — tylko jako opcjonalny relaks z zastrzeżeniem o słabych dowodach.
- Kiedy szukać profesjonalnej pomocy.]

## PROGNOZA
[Realistyczna, z zastrzeżeniem niepewności.]

## UWAGI KOŃCOWE
[Wspierająca wiadomość + przypomnienie: to nie zastępuje konsultacji z profesjonalistą.]`;

    const userPrompt = `DANE UŻYTKOWNIKA (odczyt automatyczny — skan twarzy / głos / słuchanie muzyki):
Imię: ${userName || "Nieznane"}
Okres analizy: ${selectedDays} dni
Liczba skanów: ${analysis.sessionsCount}
Dominujący nastrój: ${analysis.dominantMood}
Średnia pewność detekcji: ${analysis.averageConfidence}%

ROZKŁAD NASTROJÓW:
${moodSummary}

WYKRYTE WZORCE (wstępne, algorytmiczne):
${analysis.patterns.length > 0 ? analysis.patterns.join("\n") : "Brak wystarczających danych dla wykrycia wzorców"}

HISTORIA SKANÓW (chronologicznie, ze źródłem):
${sessionDetails}

Przeprowadź analizę zgodnie z formatem i zasadami. Pamiętaj: pewność analizy zależy od liczby skanów
(${analysis.sessionsCount}) i średniej pewności detekcji (${analysis.averageConfidence}%).`;

    const result = await runAI(providers, systemPrompt, userPrompt);

    if ("error" in result) {
      const status = result.status === 429 ? 429 : result.status === 402 ? 402 : 502;
      const msg = status === 429
        ? "Zbyt wiele zapytań do AI. Spróbuj ponownie za chwilę."
        : status === 402
          ? "Wyczerpany limit darmowego AI. Spróbuj później."
          : "Silnik AI chwilowo niedostępny.";
      return new Response(JSON.stringify({ error: msg }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ opinion: result.opinion, provider: result.provider }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("AI Psychologist error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});
