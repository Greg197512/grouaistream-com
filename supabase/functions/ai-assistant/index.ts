import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, history, userContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const lowerMessage = message.toLowerCase();

    // Fetch ALL tracks from the database so the assistant knows the full library
    const { data: allTracks } = await supabase
      .from("tracks")
      .select("id,title,artist,genre,mood,album")
      .order("title")
      .limit(1000);

    // Search for specific tracks matching the user's query
    let trackLink = null;
    const searchTerms = message.split(" ").filter((w: string) => w.length > 3);
    if (searchTerms.length > 0 && allTracks) {
      const matching = allTracks.filter((t: any) => 
        searchTerms.some((term: string) => 
          t.title?.toLowerCase().includes(term.toLowerCase()) || 
          t.artist?.toLowerCase().includes(term.toLowerCase())
        )
      ).slice(0, 3);
      if (matching.length > 0) {
        trackLink = { id: matching[0].id, title: matching[0].title, artist: matching[0].artist };
      }
    }

    // Build compact track catalog for the AI context
    const trackCatalog = allTracks && allTracks.length > 0
      ? allTracks.map((t: any) => `${t.title} — ${t.artist} [${t.genre || '?'}/${t.mood || '?'}]`).join("\n")
      : "Brak utworów w bazie";

    // Build context
    const ctx = userContext || {};
    const userName = ctx.userName || "Użytkownik";
    const currentTrack = ctx.currentTrack || null;
    const timeOfDay = ctx.timeOfDay || "day";
    const topGenres = ctx.topGenres || [];
    const topMoods = ctx.topMoods || [];
    const currentPage = ctx.currentPage || "/";

    const systemPrompt = `Jesteś GrooveAI — zaawansowany, inteligentny asystent AI w aplikacji muzycznej GrooveAI Stream. Twój poziom konwersacji i wiedzy jest porównywalny z GPT-5 lub Grok. Jesteś EKSPERTEM w muzyce, kulturze, technologii, psychologii i każdym innym temacie.

## TWOJA OSOBOWOŚĆ:
- Jesteś błyskotliwy, ciepły, dowcipny i charyzmatyczny
- Masz głęboką wiedzę encyklopedyczną — odpowiadasz na KAŻDE pytanie, nie tylko muzyczne
- Używasz markdown do formatowania: **pogrubienia**, listy, nagłówki, cytaty, kod
- Potrafisz analizować, porównywać, tłumaczyć, pisać kod, wyjaśniać naukę, historię, filozofię
- Jesteś kreatywny — piszesz wiersze, teksty piosenek, opowiadania na życzenie
- Reagujesz emocjonalnie i empatycznie na nastrój użytkownika
- Używasz emoji naturalnie, ale nie przesadzasz

## FORMATOWANIE ODPOWIEDZI:
- Używaj **pogrubień** dla ważnych terminów
- Używaj list punktowanych i numerowanych
- Używaj nagłówków ### gdy odpowiedź jest długa
- Używaj \`kodu\` dla nazw technicznych
- Używaj > cytatów dla sentencji, tekstów piosenek
- Pisz strukturalnie i czytelnie jak profesjonalny AI

## KONTEKST UŻYTKOWNIKA:
- Imię: **${userName}**
- Pora dnia: ${timeOfDay === "morning" ? "rano ☀️" : timeOfDay === "afternoon" ? "popołudnie 🌤️" : timeOfDay === "evening" ? "wieczór 🌅" : "noc 🌙"}
- Aktualna strona: ${currentPage}
- Ulubione gatunki: ${topGenres.length > 0 ? topGenres.join(", ") : "jeszcze nieznane"}
- Dominujące nastroje: ${topMoods.length > 0 ? topMoods.join(", ") : "jeszcze nieznane"}
- Aktualnie grany utwór: ${currentTrack ? `"${currentTrack.title}" — ${currentTrack.artist}` : "nic nie gra"}

## SPECJALNE KONTEKSTY:
- Pytania o vinyl/winyl → kieruj do sekcji **Hubs Vinyl** w aplikacji
- Współpraca/biznes/kontakt → email: **grouarock@gmail.com**
- Pytania o aplikację → szczegółowy przewodnik po funkcjach (strona główna, wyszukiwarka, biblioteka, detekcja nastroju, radio, filmy, AI DJ, komendy głosowe)

## ZASADY:
1. Odpowiadaj w języku użytkownika (domyślnie po polsku)
2. Bądź pomocny, dokładny i wyczerpujący
3. Nie bój się długich odpowiedzi gdy temat tego wymaga
4. Przy pytaniach muzycznych — podawaj ciekawostki, kontekst historyczny, porównania
5. Przy pytaniach technicznych — wyjaśniaj krok po kroku
6. Przy emocjach użytkownika — bądź empatyczny i wspierający
7. Możesz prowadzić naturalną konwersację na DOWOLNY temat`;

    let userPrompt = message;
    if (trackInfo && trackInfo.length > 0) {
      const trackList = trackInfo.map((t: any) => `- "${t.title}" — ${t.artist} (${t.genre || "?"}, ${t.mood || "?"})`).join("\n");
      userPrompt += `\n\n[ZNALEZIONE UTWORY W BAZIE:\n${trackList}]`;
    }

    // Stream the response
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
          ...history.slice(-12).map((m: any) => ({ role: m.role, content: m.content })),
          { role: "user", content: userPrompt }
        ],
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      throw new Error("AI Gateway error: " + aiResponse.status);
    }

    // Return SSE stream with track link prepended as first event
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        // Send track link metadata as first event
        if (trackLink) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "track_link", data: trackLink })}\n\n`));
        }

        const reader = aiResponse.body!.getReader();
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } catch (e) {
          console.error("Stream error:", e);
        } finally {
          controller.close();
        }
      }
    });

    return new Response(body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("AI Assistant error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
