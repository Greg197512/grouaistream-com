import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

function getCorsHeaders(req: Request) {
  const allowedOrigins = [
    "https://grouaistream-com.lovable.app",
    "https://id-preview--462bddcb-d545-4f42-bc51-5f437cb12bbe.lovable.app",
  ];
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
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
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user_id = userData.user.id;
    // --- End authentication ---

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");

    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get listening history
    const { data: history } = await supabase
      .from("listening_history")
      .select("track_id, played_at, skipped, duration_played")
      .eq("user_id", user_id)
      .order("played_at", { ascending: false })
      .limit(50);

    // Get track details for history
    let topGenres: Record<string, number> = {};
    let topArtists: Record<string, number> = {};
    let topMoods: Record<string, number> = {};

    if (history && history.length > 0) {
      const trackIds = [...new Set(history.map(h => h.track_id))];
      const { data: tracks } = await supabase
        .from("tracks")
        .select("id, genre, artist, mood, title")
        .in("id", trackIds);

      if (tracks) {
        for (const t of tracks) {
          const plays = history.filter(h => h.track_id === t.id && !h.skipped).length;
          if (t.genre) topGenres[t.genre] = (topGenres[t.genre] || 0) + plays;
          if (t.artist) topArtists[t.artist] = (topArtists[t.artist] || 0) + plays;
          if (t.mood) topMoods[t.mood] = (topMoods[t.mood] || 0) + plays;
        }
      }
    }

    // Get liked songs
    const { data: liked } = await supabase
      .from("liked_songs")
      .select("track_id")
      .eq("user_id", user_id)
      .limit(20);

    let likedTrackInfo: string[] = [];
    if (liked && liked.length > 0) {
      const { data: likedTracks } = await supabase
        .from("tracks")
        .select("title, artist, genre")
        .in("id", liked.map(l => l.track_id));
      likedTrackInfo = (likedTracks || []).map(t => `${t.title} - ${t.artist} (${t.genre || '?'})`);
    }

    // Time of day context
    const hour = new Date().getHours();
    let timeContext = "noc";
    if (hour >= 6 && hour < 12) timeContext = "rano";
    else if (hour >= 12 && hour < 17) timeContext = "popołudnie";
    else if (hour >= 17 && hour < 22) timeContext = "wieczór";

    const sortedGenres = Object.entries(topGenres).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
    const sortedArtists = Object.entries(topArtists).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
    const sortedMoods = Object.entries(topMoods).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);

    // Get all available tracks for recommendation
    const { data: allTracks } = await supabase
      .from("tracks")
      .select("id, title, artist, genre, mood")
      .limit(200);

    const prompt = `Jesteś inteligentnym asystentem muzycznym. Na podstawie profilu użytkownika zaproponuj 3-5 utworów z dostępnej bazy.

PROFIL UŻYTKOWNIKA:
- Ulubione gatunki: ${sortedGenres.join(", ") || "brak danych"}
- Ulubieni artyści: ${sortedArtists.join(", ") || "brak danych"}
- Najczęstsze nastroje: ${sortedMoods.join(", ") || "brak danych"}
- Polubione utwory: ${likedTrackInfo.slice(0, 10).join("; ") || "brak"}
- Pora dnia: ${timeContext} (${hour}:00)
- Liczba odsłuchanych utworów: ${history?.length || 0}

DOSTĘPNE UTWORY W BAZIE:
${(allTracks || []).map(t => `ID:${t.id} | ${t.title} - ${t.artist} | ${t.genre || '?'} | ${t.mood || '?'}`).join("\n")}

Odpowiedz TYLKO w formacie JSON z polem "suggestions" - tablica obiektów z polami: id (UUID z bazy), reason (krótki powód po polsku, max 15 słów).
Wybieraj utwory dopasowane do pory dnia i preferencji. Rano spokojniejsze, wieczorem energetyczne.`;

    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemma-2-9b-it:free",
        messages: [{ role: "user", content: prompt }],
        tools: [{
          type: "function",
          function: {
            name: "suggest_tracks",
            description: "Return track suggestions with reasons",
            parameters: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      reason: { type: "string" }
                    },
                    required: ["id", "reason"]
                  }
                }
              },
              required: ["suggestions"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "suggest_tracks" } }
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error("AI error");
    }

    const aiData = await aiResponse.json();
    
    let suggestions: { id: string; reason: string }[] = [];
    
    // Parse tool call response
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      suggestions = parsed.suggestions || [];
    }

    // Enrich with track data
    const enriched = [];
    for (const s of suggestions) {
      const track = (allTracks || []).find(t => t.id === s.id);
      if (track) {
        enriched.push({ ...track, reason: s.reason });
      }
    }

    return new Response(
      JSON.stringify({ suggestions: enriched, timeContext, profile: { topGenres: sortedGenres, topArtists: sortedArtists } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("AI suggest error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
