import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

function getCorsHeaders(_req: Request) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(SUPABASE_URL, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // --- End authentication ---

    const { trackIds } = await req.json();
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch tracks to categorize
    let query = supabase.from("tracks").select("id, title, artist, genre, cover_url, mood, duration, audio_url, video_url");
    
    if (trackIds && trackIds.length > 0) {
      query = query.in("id", trackIds);
    } else {
      query = query.or("genre.is.null,cover_url.is.null,mood.is.null").limit(50);
    }

    const { data: tracks, error: fetchError } = await query;
    if (fetchError) throw fetchError;
    if (!tracks || tracks.length === 0) {
      return new Response(
        JSON.stringify({ success: true, categorized: 0, total: 0, message: "No tracks to categorize" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build track list for AI
    const trackList = tracks.map(t => 
      `- "${t.title}" by ${t.artist} (genre: ${t.genre || "unknown"}, mood: ${t.mood || "unknown"}, duration: ${t.duration || 0}s)`
    ).join("\n");

    // 12s timeout for AI gateway call
    const controller = new AbortController();
    const aiTimeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "google/gemma-2-9b-it:free",
        messages: [
          {
            role: "system",
            content: `You are a music metadata expert. For EVERY track provide:
1. genre - Standard genres: Rock, Pop, Punk, Pop-Punk, Metal, Electronic, Hip-Hop, R&B, Jazz, Classical, Country, Reggae, Blues, Folk, Indie, Alternative, Dance, Ambient, Soundtrack, Latin, Rap, Trap, Techno, House, Drum & Bass, Lo-Fi, Grunge, Emo, Hardcore, Ska, Funk, Soul, Disco, Synthwave, New Wave, Other
2. mood - One of: happy, sad, energetic, calm, romantic, aggressive, melancholic, uplifting, dark, chill, nostalgic, party, focus, dreamy
3. estimated_duration - Estimated seconds (typical: 180-300s, punk: 120-200s). If duration already > 30, keep existing.
4. cover_prompt - Short image prompt for album cover art matching genre/mood.
Be fast. Polish punk bands (Para Wino, Nauka O Gównie, The Analogs) → Punk.`
          },
          {
            role: "user",
            content: `Categorize:\n${trackList}\n\nReturn JSON array: [{"title":"...","genre":"...","mood":"...","estimated_duration":180,"cover_prompt":"..."}]`
          }
        ],
      }),
    });

    clearTimeout(aiTimeout);

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again in a minute" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    
    if (!content || content.trim().length === 0) {
      console.error("AI returned empty content:", JSON.stringify(aiData).substring(0, 500));
      return new Response(
        JSON.stringify({ success: false, error: "AI returned empty response", categorized: 0, total: tracks.length }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let categorizations: any[];

    try {
      // Strip markdown code fences if present
      const cleaned = content.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      const parsed = JSON.parse(cleaned);
      categorizations = Array.isArray(parsed) ? parsed : parsed.tracks || parsed.results || parsed.categorizations || Object.values(parsed)[0];
      if (!Array.isArray(categorizations)) categorizations = [parsed];
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr, "Content preview:", content.substring(0, 300));
      return new Response(
        JSON.stringify({ success: false, error: "Failed to parse AI response", raw: content.substring(0, 200) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update tracks with ALL metadata
    let updated = 0;
    for (const track of tracks) {
      const cat = categorizations.find(
        (c: any) => c.title?.toLowerCase().trim() === track.title.toLowerCase().trim()
      ) || categorizations[tracks.indexOf(track)];

      if (!cat) continue;

      const updates: Record<string, any> = {};
      
      // Always update genre and mood (overwrite if AI has better data)
      if (cat.genre) updates.genre = cat.genre;
      if (cat.mood) updates.mood = cat.mood;
      
      // Update duration if current is 0 or missing
      if ((!track.duration || track.duration === 0) && cat.estimated_duration) {
        updates.duration = cat.estimated_duration;
      }

      // Set placeholder cover if none (will be replaced by ai-cover)
      if (!track.cover_url || track.cover_url.includes("picsum.photos")) {
        updates.cover_url = `https://picsum.photos/seed/${encodeURIComponent(track.id)}/300/300`;
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateErr } = await supabase
          .from("tracks")
          .update(updates)
          .eq("id", track.id);
        if (!updateErr) updated++;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        categorized: updated, 
        total: tracks.length,
        message: `Updated ${updated}/${tracks.length} tracks with genre, mood & duration`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const isAbort = error instanceof DOMException && error.name === "AbortError";
    console.error("AI Categorize error:", isAbort ? "TIMEOUT after 12s" : error);
    return new Response(
      JSON.stringify({ 
        error: isAbort ? "AI analysis timed out – try again" : (error instanceof Error ? error.message : "Unknown error"),
        categorized: 0,
        total: 0,
      }),
      { status: isAbort ? 504 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
