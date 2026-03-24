import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get top 10 most liked tracks
    const { data: likedData, error: likedError } = await supabase
      .from("liked_songs")
      .select("track_id, tracks(id, title, artist, audio_url, duration)");

    if (likedError) throw likedError;

    // Count likes per track
    const likeCounts: Record<string, { count: number; track: any }> = {};
    (likedData || []).forEach((ls: any) => {
      if (!ls.tracks || !ls.tracks.audio_url) return;
      const tid = ls.track_id;
      if (!likeCounts[tid]) {
        likeCounts[tid] = { count: 0, track: ls.tracks };
      }
      likeCounts[tid].count++;
    });

    const top10 = Object.entries(likeCounts)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 10);

    if (top10.length === 0) {
      return new Response(JSON.stringify({ message: "No liked tracks to schedule" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get current max position in radio_schedule
    const { data: maxPosData } = await supabase
      .from("radio_schedule")
      .select("position")
      .order("position", { ascending: false })
      .limit(1);

    let nextPosition = (maxPosData?.[0]?.position || 0) + 1;

    // Insert top 10 tracks into radio schedule
    const inserts = top10.map(([trackId, { track }], i) => ({
      track_id: trackId,
      position: nextPosition + i,
      item_type: "track",
      custom_title: `🏆 Top ${i + 1} — ${track.title}`,
      custom_duration: track.duration || 180,
    }));

    const { error: insertError } = await supabase
      .from("radio_schedule")
      .insert(inserts);

    if (insertError) throw insertError;

    return new Response(JSON.stringify({
      message: `Added ${top10.length} top liked tracks to radio schedule`,
      tracks: top10.map(([, { track, count }]) => ({
        title: track.title,
        artist: track.artist,
        likes: count,
      })),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
