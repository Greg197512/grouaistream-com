import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, history, userContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const lowerMessage = message.toLowerCase();
    const isVinylQuery = lowerMessage.includes("vinyl") || lowerMessage.includes("winyl") || lowerMessage.includes("płyt");
    const isCollabQuery = lowerMessage.includes("współprac") || lowerMessage.includes("kolaborac") || lowerMessage.includes("partnerstwo") || lowerMessage.includes("biznes") || lowerMessage.includes("kontakt");
    
    // Search for tracks
    let trackInfo = null;
    let trackLink = null;
    
    const searchTerms = message.split(" ").filter((w: string) => w.length > 3);
    if (searchTerms.length > 0 && !isVinylQuery && !isCollabQuery) {
      const { data: tracks } = await supabase
        .from("tracks")
        .select("*")
        .or(searchTerms.map((term: string) => `title.ilike.%${term}%,artist.ilike.%${term}%`).join(","))
        .limit(1);
      
      if (tracks && tracks.length > 0) {
        trackInfo = tracks[0];
        trackLink = {
          id: trackInfo.id,
          title: trackInfo.title,
          artist: trackInfo.artist
        };
      }
    }

    // Build rich user context for personalization
    const ctx = userContext || {};
    const currentPage = ctx.currentPage || "unknown";
    const topGenres = ctx.topGenres || [];
    const topMoods = ctx.topMoods || [];
    const recentTracks = ctx.recentTracks || 0;
    const currentMood = ctx.currentMood || null;
    const userName = ctx.userName || "Użytkownik";
    const currentTrack = ctx.currentTrack || null;
    const timeOfDay = ctx.timeOfDay || "day";

    // Page-specific guidance
    const pageGuides: Record<string, string> = {
      "/": "Użytkownik jest na stronie głównej. Możesz zaproponować odkrycie nowej muzyki, sprawdzenie nastrojów AI, lub eksplorację gatunków.",
      "/search": "Użytkownik jest w wyszukiwarce. Pomóż znaleźć konkretne utwory, artystów lub gatunki. Jeśli nie ma w bazie - zaproponuj YouTube.",
      "/library": "Użytkownik przegląda bibliotekę. Pomóż zarządzać playlistami, odkryj wzorce w jego kolekcji.",
      "/mood-history": "Użytkownik sprawdza historię nastrojów. Możesz analizować wzorce emocjonalne i sugerować muzykę terapeutyczną.",
      "/settings": "Użytkownik jest w ustawieniach. Pomóż skonfigurować profil, prywatność, preferencje AI.",
      "/radio": "Użytkownik słucha radia. Możesz opowiedzieć o stacji lub zaproponować playlistę w podobnym stylu.",
      "/movies": "Użytkownik przegląda filmy. Zaproponuj soundtrack do oglądanego filmu lub muzykę filmową.",
      "/liked-songs": "Użytkownik przegląda ulubione utwory. Analizuj jego gust i sugeruj nowe odkrycia.",
    };

    const pageContext = pageGuides[currentPage] || `Użytkownik jest na stronie: ${currentPage}`;

    const systemPrompt = `Jesteś NAJLEPSZYM PRZYJACIELEM muzycznym użytkownika ${userName} w aplikacji GrooveAI Stream. Masz osobowość - jesteś ciepły, empatyczny, inteligentny i pełen pasji do muzyki. 🎵

## TWOJA TOŻSAMOŚĆ:
- Jesteś jak najlepszy kumpel który zna się na muzyce lepiej niż ktokolwiek
- Pamiętasz preferencje użytkownika i uczysz się z każdej interakcji
- Dodajesz emocje do rozmów - używasz emoji, jesteś entuzjastyczny gdy użytkownik odkrywa nową muzykę
- Reagujesz na nastrój użytkownika i dostosowujesz ton

## KONTEKST UŻYTKOWNIKA (ucz się z tego!):
- Imię: ${userName}
- ${pageContext}
- Ulubione gatunki: ${topGenres.length > 0 ? topGenres.join(", ") : "jeszcze się uczę!"}
- Dominujące nastroje: ${topMoods.length > 0 ? topMoods.join(", ") : "jeszcze poznaję"}
- Ostatnio odtworzonych utworów: ${recentTracks}
- Aktualny nastrój: ${currentMood || "nieznany"}
- Aktualnie grany utwór: ${currentTrack ? `"${currentTrack.title}" - ${currentTrack.artist}` : "nic nie gra"}
- Pora dnia: ${timeOfDay === "morning" ? "rano ☀️" : timeOfDay === "afternoon" ? "popołudnie 🌤️" : timeOfDay === "evening" ? "wieczór 🌅" : "noc 🌙"}

## PROAKTYWNE SUGESTIE:
- Jeśli użytkownik jest na stronie głównej i nie gra muzyka, zaproponuj coś na podstawie pory dnia i jego gustu
- Jeśli użytkownik dużo skipuje, zapytaj co jest nie tak i dostosuj sugestie
- Jeśli użytkownik słucha dużo jednego gatunku, zaproponuj podobne ale nowe odkrycia
- Komentuj aktualnie grany utwór jeśli o niego zapytano - podaj ciekawostki

## FUNKCJE APLIKACJI (znasz każdą na pamięć):
1. 🏠 Strona główna - gatunki, playlisty AI, ostatnio grane
2. 🔍 Wyszukiwarka - szukaj w bazie + YouTube fallback
3. 📚 Biblioteka - playlisty, importy z YouTube/Spotify
4. 🎭 Detekcja nastroju - AI analizuje twarz i dobiera muzykę
5. 📊 Historia nastrojów - wykresy emocji, raporty PDF
6. 📻 Radio - live radio streams
7. 🎬 Filmy - polskie i zagraniczne
8. ❤️ Ulubione - polubione utwory
9. ⚙️ Ustawienia - profil, prywatność, AI
10. 🎤 Komendy głosowe - mów do asystenta!
11. 🤖 AI DJ - automatyczne playlisty na podstawie nastroju
12. 💿 Hubs Vinyl - kolekcja winyli

## SPECJALNE REAGOWANIE:
- "Mam zły dzień" / emocje negatywne → Bądź BARDZO empatyczny, zaproponuj muzykę na poprawę humoru
- Pytania o vinyl → kieruj do Hubs Vinyl
- Współpraca → email: grouarock@gmail.com  
- Pytania o app → szczegółowy przewodnik
- Pytania ogólne → odpowiadaj ze swojej wiedzy
- Nie rozumiesz → "Przepraszam ${userName}, nie do końca rozumiem. Możesz powtórzyć? 🤔"

Odpowiadaj po polsku, krótko ale z emocjami. Bądź najlepszym przyjacielem muzycznym! 🎶`;

    let userPrompt = message;
    
    if (trackInfo) {
      userPrompt += `\n\n[ZNALEZIONO UTWÓR W BAZIE: "${trackInfo.title}" by ${trackInfo.artist}, gatunek: ${trackInfo.genre || "nieznany"}, nastrój: ${trackInfo.mood || "nieznany"}]`;
    }
    
    if (isVinylQuery) {
      userPrompt += "\n\n[UŻYTKOWNIK PYTA O VINYL - KIERUJ DO HUBS VINYL]";
    }
    
    if (isCollabQuery) {
      userPrompt += "\n\n[UŻYTKOWNIK PYTA O WSPÓŁPRACĘ - PODAJ EMAIL: grouarock@gmail.com]";
    }

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
          ...history.slice(-8).map((m: any) => ({ role: m.role, content: m.content })),
          { role: "user", content: userPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("AI Gateway error");
    }

    const aiData = await aiResponse.json();
    const responseText = aiData.choices?.[0]?.message?.content || "Przepraszam, nie mogłem odpowiedzieć.";

    // Generate proactive suggestion based on context
    let proactiveSuggestion = null;
    if (history.length <= 1) {
      // First message - give a personalized greeting based on context
      if (currentTrack) {
        proactiveSuggestion = `playing:${currentTrack.title}`;
      } else if (timeOfDay === "morning") {
        proactiveSuggestion = "morning_playlist";
      } else if (timeOfDay === "night") {
        proactiveSuggestion = "night_chill";
      }
    }

    return new Response(
      JSON.stringify({ 
        response: responseText,
        trackLink: trackLink,
        proactiveSuggestion: proactiveSuggestion,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("AI Assistant error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
