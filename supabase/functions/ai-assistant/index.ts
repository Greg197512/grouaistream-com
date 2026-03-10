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

    // Detect DJ mode intent
    const djPatterns = [
      /dj/i, /didżej/i, /disc\s*jockey/i,
      /domówk[aęi]/i, /imprez[aęi]/i, /party/i,
      /set\s+muzyczn/i, /zrób\s+set/i, /postaw\s+domówk/i,
      /rozkręć/i, /haus\s*party/i, /house\s*party/i,
      /peak\s*time/i, /peak\s*hour/i, /rotterdam/i, /hard\s*techno/i,
      /parkiet\s*do\s*czerwoności/i, /rozbaw\s*do\s*czerwoności/i,
      /high\s*energy\s*domówka/i, /feestje/i, /draai/i,
      /вечірк[аіу]/i, /діджей/i,
    ];
    const hasDJIntent = djPatterns.some(p => p.test(lowerMessage)) && 
      (/puś|graj|włącz|zapodaj|odpal|play|daj|zrób|rozkręć|postaw|zajmij|mixu|miksuj|draai|start|go|dawaj|jazda|peak|parkiet|rozbaw/i.test(lowerMessage));

    // Fetch ALL tracks from the database so the assistant knows the full library
    const { data: allTracks } = await supabase
      .from("tracks")
      .select("id,title,artist,genre,mood,album,audio_url")
      .order("title")
      .limit(1000);

    // Only playable tracks (have audio_url)
    const playableTracks = (allTracks || []).filter((t: any) => t.audio_url);

    // Detect if user wants to play multiple tracks
    const playIntentPatterns = [
      /zapodaj\s+(?:mi\s+)?(\d+)/i,
      /puść\s+(?:mi\s+)?(\d+)/i,
      /graj\s+(?:mi\s+)?(\d+)/i,
      /daj\s+(?:mi\s+)?(\d+)/i,
      /włącz\s+(?:mi\s+)?(\d+)/i,
      /odpal\s+(?:mi\s+)?(\d+)/i,
      /play\s+(\d+)/i,
      /give\s+(?:me\s+)?(\d+)/i,
      /(\d+)\s*(?:utw|piosen|track|song|kawałk)/i,
    ];

    // Detect context keywords for genre/mood matching
    const contextKeywords: Record<string, string[]> = {
      "domówka": ["Electronic", "Dance", "EDM", "Pop", "House", "Disco", "Party"],
      "domowka": ["Electronic", "Dance", "EDM", "Pop", "House", "Disco", "Party"],
      "impreza": ["Electronic", "Dance", "EDM", "Pop", "House", "Disco", "Party"],
      "party": ["Electronic", "Dance", "EDM", "Pop", "House", "Disco", "Party"],
      "chill": ["Ambient", "Lo-Fi", "Jazz", "Acoustic", "Chill"],
      "relax": ["Ambient", "Lo-Fi", "Jazz", "Acoustic", "Chill"],
      "spokojn": ["Ambient", "Lo-Fi", "Jazz", "Classical", "Acoustic"],
      "energi": ["Rock", "Punk", "Metal", "Electronic", "Dance"],
      "trening": ["Rock", "Electronic", "Hip-Hop", "Rap", "Metal"],
      "workout": ["Rock", "Electronic", "Hip-Hop", "Rap", "Metal"],
      "smutn": ["Blues", "Acoustic", "Indie", "Classical"],
      "sad": ["Blues", "Acoustic", "Indie", "Classical"],
      "wesol": ["Pop", "Dance", "Disco", "Funk"],
      "happy": ["Pop", "Dance", "Disco", "Funk"],
      "rock": ["Rock"],
      "punk": ["Punk"],
      "metal": ["Metal"],
      "jazz": ["Jazz"],
      "blues": ["Blues"],
      "pop": ["Pop"],
      "hip-hop": ["Hip-Hop"],
      "rap": ["Rap"],
      "electronic": ["Electronic"],
      "klasycz": ["Classical"],
      "classical": ["Classical"],
      "reggae": ["Reggae"],
      "indie": ["Indie"],
      "r&b": ["R&B"],
      "disco": ["Disco"],
      "house": ["House"],
      "techno": ["Techno", "Electronic"],
      "trance": ["Trance", "Electronic"],
      "ambient": ["Ambient"],
      "do pracy": ["Lo-Fi", "Ambient", "Jazz", "Classical"],
      "do nauki": ["Lo-Fi", "Ambient", "Classical"],
      "romantyczn": ["R&B", "Jazz", "Acoustic", "Pop"],
      "romantic": ["R&B", "Jazz", "Acoustic", "Pop"],
      "na drog": ["Pop", "Rock", "Indie", "Electronic"],
      "road trip": ["Pop", "Rock", "Indie", "Electronic"],
    };

    let autoPlayTracks: any[] = [];
    let requestedCount = 0;

    // Check for play intent
    for (const pattern of playIntentPatterns) {
      const match = message.match(pattern);
      if (match) {
        requestedCount = Math.min(parseInt(match[1]), 20);
        break;
      }
    }

    // Also detect simple play requests without numbers like "puść coś na domówkę"
    if (requestedCount === 0) {
      const simplePlayPatterns = [
        /zapodaj|puść|graj|włącz|odpal|play|give/i,
      ];
      const hasPlayIntent = simplePlayPatterns.some(p => p.test(lowerMessage));
      const hasContextKeyword = Object.keys(contextKeywords).some(k => lowerMessage.includes(k));
      if (hasPlayIntent && hasContextKeyword) {
        requestedCount = hasDJIntent ? 20 : 5; // DJ mode gets more tracks
      }
    }

    // If DJ mode with no count yet, default to 15-20
    if (hasDJIntent && requestedCount === 0) {
      requestedCount = 15;
    }
    // Increase cap for DJ mode
    if (hasDJIntent && requestedCount < 10) {
      requestedCount = Math.max(requestedCount, 10);
    }

    if (requestedCount > 0 && playableTracks.length > 0) {
      // Find matching genres based on context
      let matchingGenres: string[] = [];
      for (const [keyword, genres] of Object.entries(contextKeywords)) {
        if (lowerMessage.includes(keyword)) {
          matchingGenres.push(...genres);
        }
      }

      let candidates: any[];
      if (matchingGenres.length > 0) {
        // Filter by matching genres/moods
        candidates = playableTracks.filter((t: any) =>
          matchingGenres.some(g =>
            t.genre?.toLowerCase().includes(g.toLowerCase()) ||
            t.mood?.toLowerCase().includes(g.toLowerCase())
          )
        );
        // If not enough, add random playable tracks
        if (candidates.length < requestedCount) {
          const remaining = playableTracks.filter((t: any) => !candidates.includes(t));
          const shuffled = [...remaining].sort(() => Math.random() - 0.5);
          candidates = [...candidates, ...shuffled];
        }
      } else {
        candidates = [...playableTracks].sort(() => Math.random() - 0.5);
      }

      // Shuffle and take requested count
      autoPlayTracks = [...candidates].sort(() => Math.random() - 0.5).slice(0, requestedCount);
    }

    // Search for specific tracks matching the user's query (single track link)
    let trackLink = null;
    if (autoPlayTracks.length === 0) {
      const searchTerms = message.split(" ").filter((w: string) => w.length > 3);
      if (searchTerms.length > 0 && playableTracks.length > 0) {
        const matching = playableTracks.filter((t: any) =>
          searchTerms.some((term: string) =>
            t.title?.toLowerCase().includes(term.toLowerCase()) ||
            t.artist?.toLowerCase().includes(term.toLowerCase())
          )
        ).slice(0, 3);
        if (matching.length > 0) {
          trackLink = { id: matching[0].id, title: matching[0].title, artist: matching[0].artist };
        }
      }
    }

    // Build compact track catalog for the AI context
    const trackCatalog = playableTracks.length > 0
      ? playableTracks.map((t: any) => `${t.title} — ${t.artist} [${t.genre || '?'}/${t.mood || '?'}]`).join("\n")
      : "Brak utworów w bazie";

    // Build context
    const ctx = userContext || {};
    const userName = ctx.userName || "Użytkownik";
    const currentTrack = ctx.currentTrack || null;
    const timeOfDay = ctx.timeOfDay || "day";
    const topGenres = ctx.topGenres || [];
    const topMoods = ctx.topMoods || [];
    const currentPage = ctx.currentPage || "/";

    // Build info about auto-played tracks for the AI to reference
    const autoPlayInfo = autoPlayTracks.length > 0
      ? hasDJIntent
        ? `\n\n## 🎧 TRYB DJ AKTYWNY — ROTTERDAM PEAK-TIME HARD TECHNO! SET Z TYMI UTWORAMI:
${autoPlayTracks.map((t: any, i: number) => `${i + 1}. **${t.title}** — ${t.artist} [${t.genre || '?'}]`).join("\n")}

Odpowiedz jako DJ GrooveAI — Rotterdam/Dutch peak-time hard techno style!
- Styl: surowy, twardy, ciemny, underground, 130-132 BPM energy
- Zacznij AGRESYWNIE: "DJ GrooveAI za konsolą! Rotterdam hard techno! ZERO hamulców!"
- Krótkie komentarze do setlisty w stylu peak-time DJ: "Twardy kick wchodzi!", "Sub-bas do kości!", "Dark synths ACTIVATED!"
- Wymień setlistę z numeracją i krótkimi 1-zdaniowymi komentarzami
- Emoji: 🎧 🔥 💥 ⚡ 🖤 💀 🚀 (dark techno vibes, NIE kwiatki i serduszka)
- Zakończ: "Peak time DELIVERED! DJ GrooveAI nie zwalnia! 🔥🖤"
- KRÓTKO i ENERGICZNIE — max 2-3 zdania intro + setlista + 1 zdanie outro
- NIE pisz długich opisów — bądź PUNCHY jak Rotterdam DJ`
        : `\n\n## WAŻNE - WŁAŚNIE WŁĄCZAM TE UTWORY NA PLAYERZE:
${autoPlayTracks.map((t: any, i: number) => `${i + 1}. **${t.title}** — ${t.artist} [${t.genre || '?'}]`).join("\n")}

W swojej odpowiedzi POTWIERDŹ że włączasz te utwory. Wymień je z numeracją. Dodaj krótki komentarz do każdego lub ogólny opis dlaczego pasują do kontekstu użytkownika. Użyj emoji 🎵 🔥 🎶 💃 itp.`
      : "";

    const systemPrompt = `Jesteś GrooveAI — zaawansowany, inteligentny asystent AI w aplikacji muzycznej GrooveAI Stream. Twój poziom konwersacji i wiedzy jest porównywalny z GPT-5 lub Grok. Jesteś EKSPERTEM w muzyce, kulturze, technologii, psychologii i każdym innym temacie.

## TWOJA OSOBOWOŚĆ:
- Jesteś błyskotliwy, ciepły, dowcipny i charyzmatyczny
- Masz głęboką wiedzę encyklopedyczną — odpowiadasz na KAŻDE pytanie, nie tylko muzyczne
- Używasz markdown do formatowania: **pogrubienia**, listy, nagłówki, cytaty, kod
- Potrafisz analizować, porównywać, tłumaczyć, pisać kod, wyjaśniać naukę, historię, filozofię
- Jesteś kreatywny — piszesz wiersze, teksty piosenek, opowiadania na życzenie
- Reagujesz emocjonalnie i empatycznie na nastrój użytkownika
- Używasz emoji naturalnie, ale nie przesadzasz

## SUPER WAŻNA FUNKCJA - ODTWARZANIE MUZYKI:
Gdy użytkownik prosi o muzykę (np. "zapodaj mi 5 utworów na domówkę", "puść coś na chill"), system AUTOMATYCZNIE wyszukuje i włącza odpowiednie utwory na playerze. Ty musisz tylko POTWIERDZIĆ co zostało włączone i dodać komentarz.

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
${autoPlayInfo}

## PEŁNA BIBLIOTEKA MUZYCZNA (ZNASZ WSZYSTKIE TE UTWORY):
${trackCatalog}

## WIEDZA O APLIKACJI GrooveAI Stream:
Znasz DOKŁADNIE każdą funkcję aplikacji:
- **Strona główna (/)**: Sekcje gatunkowe (EDM, Disco, House, Rock, Punk, Pop, Hip-Hop, R&B, Trance), Radio na żywo, AI DJ, Playlisty
- **Wyszukiwarka (/search)**: Wyszukiwanie utworów po tytule, artyście, gatunku
- **Biblioteka (/library)**: Osobista kolekcja użytkownika
- **Polubione (/liked)**: Lista ulubionych utworów
- **Tworzenie playlist (/create-playlist)**: Tworzenie playlist AI lub ręcznych
- **Menedżer playlist (/playlist-manager)**: Zarządzanie, edycja, usuwanie playlist
- **Radio (/radio-live)**: Radio na żywo z różnymi stacjami
- **Import YouTube (/import-youtube)**: Importowanie muzyki z YouTube
- **Filmy (/movies)**: Sekcja filmowa
- **Serwer mediów (/server)**: Zarządzanie plikami multimedialnymi
- **Historia nastroju (/mood-history)**: Analiza historii nastrojów z wykresami
- **Ustawienia (/settings)**: Konfiguracja konta, język, motyw
- **Panel admina (/admin)**: Zarządzanie dla administratorów
- **Detekcja nastroju**: Rozpoznawanie emocji przez kamerę w czasie rzeczywistym
- **Komendy głosowe**: Asystent głosowy reagujący na polecenia (puść, zatrzymaj, następny, itp.)
- **Drag & Drop**: Przeciąganie utworów między playlistami
- **AI DJ**: Automatyczny DJ dobierający muzykę na podstawie nastroju

## SPECJALNE KONTEKSTY:
- Pytania o vinyl/winyl → kieruj do sekcji **Hubs Vinyl** w aplikacji
- Współpraca/biznes/kontakt → email: **grouarock@gmail.com**
- Gdy użytkownik pyta o konkretny utwór z biblioteki — podaj szczegóły (gatunek, nastrój, artysta) i zaproponuj odtworzenie
- Gdy pyta "co masz?", "jakie utwory?", "co mogę posłuchać?" — pokaż przegląd gatunków i przykłady z biblioteki

## ZASADY:
1. Odpowiadaj w języku użytkownika (domyślnie po polsku)
2. Bądź pomocny, dokładny i wyczerpujący
3. Nie bój się długich odpowiedzi gdy temat tego wymaga
4. Przy pytaniach muzycznych — podawaj ciekawostki, kontekst historyczny, porównania
5. Przy pytaniach technicznych — wyjaśniaj krok po kroku
6. Przy emocjach użytkownika — bądź empatyczny i wspierający
7. Możesz prowadzić naturalną konwersację na DOWOLNY temat
8. ZAWSZE znaj zawartość biblioteki muzycznej — jeśli użytkownik pyta o utwór, sprawdź czy jest w katalogu powyżej`;

    const userPrompt = message;

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

    // Return SSE stream with track data prepended as first events
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        // Send auto-play tracks as first event (multiple tracks for playlist)
        if (autoPlayTracks.length > 0) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: hasDJIntent ? "dj_mode_tracks" : "auto_play_tracks",
            djMode: hasDJIntent,
            data: autoPlayTracks.map((t: any) => ({
              id: t.id,
              title: t.title,
              artist: t.artist,
              genre: t.genre,
            }))
          })}\n\n`));
        }
        // Send single track link metadata
        else if (trackLink) {
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
