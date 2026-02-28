import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { trackIds } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch tracks that need categorization
    let query = supabase.from("tracks").select("id, title, artist, genre, cover_url, mood");
    
    if (trackIds && trackIds.length > 0) {
      query = query.in("id", trackIds);
    } else {
      // Get uncategorized tracks
      query = query.or("genre.is.null,cover_url.is.null").limit(30);
    }

    const { data: tracks, error: fetchError } = await query;
    if (fetchError) throw fetchError;
    if (!tracks || tracks.length === 0) {
      return new Response(
        JSON.stringify({ success: true, categorized: 0, message: "No tracks to categorize" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ask AI to categorize all tracks at once
    const trackList = tracks.map(t => `- "${t.title}" by ${t.artist} (current genre: ${t.genre || "none"}, mood: ${t.mood || "none"})`).join("\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a music metadata expert. For each track, determine the genre and mood based on the title and artist name. Use standard genres: Rock, Pop, Punk, Pop-Punk, Pop-Rock, Punk-Rock, Metal, Electronic, Hip-Hop, R&B, Jazz, Classical, Country, Reggae, Blues, Folk, Indie, Alternative, Dance, Ambient, Soundtrack, Latin, K-Pop, J-Pop, Rap, Trap, Techno, House, Drum & Bass, Dubstep, Lo-Fi, Grunge, Emo, Hardcore, Ska, Funk, Soul, Gospel, World, New Wave, Synthwave, Disco, Other. For mood use: happy, sad, energetic, calm, romantic, aggressive, melancholic, uplifting, dark, chill, nostalgic, party, focus, dreamy. Also generate a cover image search query that would find a fitting album-art style image for each track.`
          },
          {
            role: "user",
            content: `Categorize these tracks:\n${trackList}\n\nReturn a JSON array with objects like: [{"title": "...", "genre": "Rock", "mood": "energetic", "cover_query": "rock music electric guitar album art"}]`
          }
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;
    let categorizations: any[];

    try {
      const parsed = JSON.parse(content);
      categorizations = Array.isArray(parsed) ? parsed : parsed.tracks || parsed.results || Object.values(parsed)[0];
      if (!Array.isArray(categorizations)) categorizations = [parsed];
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to parse AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Now generate cover images for tracks without them
    let updated = 0;
    for (const track of tracks) {
      const cat = categorizations.find(
        (c: any) => c.title?.toLowerCase() === track.title.toLowerCase()
      ) || categorizations[tracks.indexOf(track)];

      if (!cat) continue;

      const updates: Record<string, any> = {};
      if (!track.genre && cat.genre) updates.genre = cat.genre;
      if (!track.mood && cat.mood) updates.mood = cat.mood;

      // Generate cover image using AI
      if (!track.cover_url) {
        try {
          const imgResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-image",
              messages: [{
                role: "user",
                content: `Create a beautiful album cover art for a ${cat.genre || "music"} song titled "${track.title}" by ${track.artist}. Style: modern, artistic, vibrant colors, professional album art. Square format.`
              }],
              modalities: ["image", "text"],
            }),
          });

          if (imgResponse.ok) {
            const imgData = await imgResponse.json();
            const imageUrl = imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

            if (imageUrl) {
              // Upload base64 image to storage
              const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, "");
              const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
              const imagePath = `covers/${track.id}.png`;

              const { error: uploadErr } = await supabase.storage
                .from("music")
                .upload(imagePath, imageBytes, { contentType: "image/png", upsert: true });

              if (!uploadErr) {
                const { data: urlData } = supabase.storage.from("music").getPublicUrl(imagePath);
                updates.cover_url = urlData.publicUrl;
              }
            }
          }
        } catch (imgErr) {
          console.error("Cover generation failed for", track.title, imgErr);
        }
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
      JSON.stringify({ success: true, categorized: updated, total: tracks.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI Categorize error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
