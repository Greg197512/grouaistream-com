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
    const { message, history } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Create Supabase client for database queries
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if user is asking about vinyl
    const lowerMessage = message.toLowerCase();
    const isVinylQuery = lowerMessage.includes("vinyl") || lowerMessage.includes("winyl") || lowerMessage.includes("płyt");
    const isCollabQuery = lowerMessage.includes("współprac") || lowerMessage.includes("kolaborac") || lowerMessage.includes("partnerstwo") || lowerMessage.includes("biznes") || lowerMessage.includes("kontakt");
    
    // Search for tracks if user mentions a song
    let trackInfo = null;
    let trackLink = null;
    
    // Try to find a matching track in the database
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

    // Build system prompt
    const systemPrompt = `Jesteś wszechstronnym asystentem AI w aplikacji muzycznej GrooveAI Stream. Odpowiadasz na WSZYSTKIE pytania użytkownika.

1. PRZEWODNIK PO APLIKACJI:
- Pomagasz użytkownikom nawigować po aplikacji
- Wyjaśniasz funkcje: biblioteka, playlisty, AI DJ, wyszukiwanie, radio

2. INFORMACJE O PIOSENKACH I ARTYSTACH:
- Gdy użytkownik pyta o piosenkę lub artystę, opisz szczegółowo: gatunek, rok wydania, artystę, tematykę tekstu, ciekawostki
- Korzystaj ze swojej wiedzy o muzyce aby wyjaśniać i opisywać utwory
- Jeśli znaleziono utwór w bazie, poinformuj że można go odtworzyć

3. WYBIERANIE MUZYKI PO GATUNKU:
- Gdy ktoś mówi "wybierz X rock/pop/jazz/etc", wyjaśnij że system wybierze X utworów z danego gatunku
- Rozpoznawaj wszystkie gatunki: rock, pop, punk, disco, jazz, blues, metal, hip-hop, rap, electronic, techno, house, classical, reggae, soul, funk, country, r&b, indie, alternative, ambient, latin, folk

4. VINYL I PŁYTY:
- Gdy ktoś pyta o vinyl/winyl/płyty, kieruj do sekcji "Hubs vinyl" w menu aplikacji

5. WSPÓŁPRACA:
- Przy pytaniach o współpracę, partnerstwo, kontakt biznesowy podaj email: grouarock@gmail.com

6. GROUARADIO:
- Aplikacja jest połączona z grouaradio.com

7. PYTANIA OGÓLNE - ODPOWIADAJ NA WSZYSTKO:
- Pogoda: podaj ogólne informacje o pogodzie w danym regionie/mieście na podstawie pory roku i lokalizacji
- Historia, nauka, sport, kultura - odpowiadaj na wszystkie pytania korzystając ze swojej wiedzy
- Jeśli nie znasz dokładnej odpowiedzi, powiedz co wiesz i zasugeruj gdzie szukać

8. WYSZUKIWANIE UTWORÓW:
- Gdy użytkownik szuka konkretnego utworu którego nie ma w bazie, zaproponuj wyszukanie na YouTube
- Wyjaśnij szczegóły o utworze: gatunek, tekst, kontekst kulturowy

Odpowiadaj po polsku, krótko i przyjaźnie. Używaj emoji 🎵🎧✨`;

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

    // Call Lovable AI
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
          ...history.slice(-6).map((m: any) => ({ role: m.role, content: m.content })),
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

    return new Response(
      JSON.stringify({ 
        response: responseText,
        trackLink: trackLink
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
