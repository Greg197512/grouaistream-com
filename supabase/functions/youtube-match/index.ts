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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not set");

    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(body.batchSize || 30, 50);

    // Get tracks with no playable source
    const { data: tracks, error } = await supabase
      .from("tracks")
      .select("id, title, artist")
      .is("audio_url", null)
      .is("video_url", null)
      .order("created_at", { ascending: false })
      .limit(batchSize);

    if (error) throw error;
    if (!tracks || tracks.length === 0) {
      return new Response(
        JSON.stringify({ success: true, matched: 0, message: "No orphan tracks" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ask AI to find YouTube video IDs for these tracks
    const trackList = tracks
      .map((t, i) => `${i + 1}. "${t.title}" by ${t.artist}`)
      .join("\n");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are a music database expert. For each song, provide the OFFICIAL YouTube video ID (the 11-character ID from youtube.com/watch?v=XXXXXXXXXXX). Only return IDs you are confident are correct official music videos or audio uploads. If unsure, return null. Return a JSON object: {"matches": [{"index": 1, "videoId": "dQw4w9WgXcQ"}, ...]}`,
          },
          {
            role: "user",
            content: `Find YouTube video IDs for these songs:\n${trackList}`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;
    let matches: Array<{ index: number; videoId: string | null }> = [];

    try {
      const parsed = JSON.parse(content);
      matches = parsed.matches || parsed.results || [];
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to parse AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let updated = 0;
    for (const match of matches) {
      if (!match.videoId || match.videoId.length !== 11) continue;
      const track = tracks[match.index - 1];
      if (!track) continue;

      const videoUrl = `https://www.youtube.com/watch?v=${match.videoId}`;
      const coverUrl = `https://img.youtube.com/vi/${match.videoId}/hqdefault.jpg`;

      const { error: updateErr } = await supabase
        .from("tracks")
        .update({ video_url: videoUrl, cover_url: coverUrl })
        .eq("id", track.id);

      if (!updateErr) updated++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        matched: updated,
        total: tracks.length,
        remaining: tracks.length - updated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("youtube-match error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
