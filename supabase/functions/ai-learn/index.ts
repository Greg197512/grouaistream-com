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
    const { userId } = await req.json();
    if (!userId) throw new Error("userId required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all listening history for this user
    const { data: history } = await supabase
      .from("listening_history")
      .select("track_id, played_at, duration_played, skipped, mood_detected")
      .eq("user_id", userId)
      .order("played_at", { ascending: false })
      .limit(500);

    if (!history || history.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No history to analyze" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch track details for all listened tracks
    const trackIds = [...new Set(history.map(h => h.track_id))];
    const { data: tracks } = await supabase
      .from("tracks")
      .select("id, title, artist, genre, mood, duration")
      .in("id", trackIds);

    const trackMap = new Map((tracks || []).map(t => [t.id, t]));

    // Fetch liked songs
    const { data: liked } = await supabase
      .from("liked_songs")
      .select("track_id")
      .eq("user_id", userId);
    const likedIds = new Set((liked || []).map(l => l.track_id));

    // ==========================================
    // ANALYZE GENRE WEIGHTS
    // ==========================================
    const genreCounts: Record<string, { total: number; completed: number; skipped: number; liked: number }> = {};
    const moodCounts: Record<string, { total: number; completed: number; skipped: number }> = {};

    // Time-based patterns (hour of day -> genre preferences)
    const hourlyGenres: Record<number, Record<string, number>> = {};
    // Day of week patterns
    const dayGenres: Record<number, Record<string, number>> = {};

    for (const h of history) {
      const track = trackMap.get(h.track_id);
      if (!track) continue;

      const genre = track.genre || "Unknown";
      const mood = track.mood || h.mood_detected || "Unknown";
      const wasSkipped = h.skipped === true;
      const wasCompleted = !wasSkipped && (h.duration_played || 0) > (track.duration || 180) * 0.5;
      const isLiked = likedIds.has(h.track_id);

      // Genre weights
      if (!genreCounts[genre]) genreCounts[genre] = { total: 0, completed: 0, skipped: 0, liked: 0 };
      genreCounts[genre].total++;
      if (wasCompleted) genreCounts[genre].completed++;
      if (wasSkipped) genreCounts[genre].skipped++;
      if (isLiked) genreCounts[genre].liked++;

      // Mood weights
      if (!moodCounts[mood]) moodCounts[mood] = { total: 0, completed: 0, skipped: 0 };
      moodCounts[mood].total++;
      if (wasCompleted) moodCounts[mood].completed++;
      if (wasSkipped) moodCounts[mood].skipped++;

      // Hourly patterns
      const hour = new Date(h.played_at).getHours();
      if (!hourlyGenres[hour]) hourlyGenres[hour] = {};
      hourlyGenres[hour][genre] = (hourlyGenres[hour][genre] || 0) + 1;

      // Day of week patterns
      const day = new Date(h.played_at).getDay();
      if (!dayGenres[day]) dayGenres[day] = {};
      dayGenres[day][genre] = (dayGenres[day][genre] || 0) + 1;
    }

    // Calculate weighted scores per genre
    const genreWeights: Record<string, number> = {};
    for (const [genre, counts] of Object.entries(genreCounts)) {
      // Formula: completed listens * 2 + liked * 3 - skipped * 1.5
      genreWeights[genre] = Math.round(
        (counts.completed * 2 + counts.liked * 3 - counts.skipped * 1.5) * 100
      ) / 100;
    }

    const moodWeights: Record<string, number> = {};
    for (const [mood, counts] of Object.entries(moodCounts)) {
      moodWeights[mood] = Math.round(
        (counts.completed * 2 - counts.skipped * 1.5) * 100
      ) / 100;
    }

    // Determine avoid lists (genres/moods with high skip rates)
    const avoidGenres = Object.entries(genreCounts)
      .filter(([, c]) => c.total >= 3 && c.skipped / c.total > 0.6)
      .map(([g]) => g);

    const avoidMoods = Object.entries(moodCounts)
      .filter(([, c]) => c.total >= 3 && c.skipped / c.total > 0.6)
      .map(([m]) => m);

    // Determine energy preference from top genres
    const topGenres = Object.entries(genreWeights)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([g]) => g);

    const highEnergyGenres = ["Rock", "Metal", "Punk", "Electronic", "EDM", "Techno", "House", "Trance", "Hardstyle"];
    const lowEnergyGenres = ["Ambient", "Lo-Fi", "Classical", "Jazz", "Acoustic", "Chill"];
    const highCount = topGenres.filter(g => highEnergyGenres.some(h => g.includes(h))).length;
    const lowCount = topGenres.filter(g => lowEnergyGenres.some(l => g.includes(l))).length;
    const preferredEnergy = highCount > lowCount ? "high" : lowCount > highCount ? "low" : "medium";
    const preferredTempo = preferredEnergy === "high" ? "fast" : preferredEnergy === "low" ? "slow" : "medium";

    // Build daily patterns (simplified: morning/afternoon/evening/night preferences)
    const dailyPatterns: Record<string, string[]> = {};
    const timeSlots = { morning: [6,7,8,9,10,11], afternoon: [12,13,14,15,16,17], evening: [18,19,20,21,22,23], night: [0,1,2,3,4,5] };
    for (const [slot, hours] of Object.entries(timeSlots)) {
      const slotGenres: Record<string, number> = {};
      for (const h of hours) {
        if (hourlyGenres[h]) {
          for (const [g, c] of Object.entries(hourlyGenres[h])) {
            slotGenres[g] = (slotGenres[g] || 0) + c;
          }
        }
      }
      dailyPatterns[slot] = Object.entries(slotGenres)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([g]) => g);
    }

    // Build weekly patterns
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const weeklyPatterns: Record<string, string[]> = {};
    for (const [day, genres] of Object.entries(dayGenres)) {
      weeklyPatterns[dayNames[parseInt(day)]] = Object.entries(genres)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([g]) => g);
    }

    // Generate AI profile summary
    let aiProfileSummary = "";
    if (LOVABLE_API_KEY) {
      try {
        const profileContext = `User listening data:
- Total tracks analyzed: ${history.length}
- Top genres: ${topGenres.join(", ")}
- Preferred energy: ${preferredEnergy}
- Morning music: ${dailyPatterns.morning?.join(", ") || "none"}
- Afternoon music: ${dailyPatterns.afternoon?.join(", ") || "none"}
- Evening music: ${dailyPatterns.evening?.join(", ") || "none"}
- Night music: ${dailyPatterns.night?.join(", ") || "none"}
- Avoided genres: ${avoidGenres.join(", ") || "none"}
- Liked tracks count: ${likedIds.size}`;

        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              { role: "system", content: "You are a music psychologist AI. Create a short (3-4 sentences) personality profile of this listener based on their data. Include their musical identity, energy patterns, and what drives their taste. Be insightful and specific." },
              { role: "user", content: profileContext },
            ],
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          aiProfileSummary = aiData.choices?.[0]?.message?.content || "";
        }
      } catch (e) {
        console.error("AI profile generation failed:", e);
      }
    }

    // Upsert preferences using service role (bypasses RLS)
    const { error } = await supabase
      .from("user_preferences")
      .upsert({
        user_id: userId,
        genre_weights: genreWeights,
        mood_weights: moodWeights,
        daily_patterns: dailyPatterns,
        weekly_patterns: weeklyPatterns,
        preferred_energy: preferredEnergy,
        preferred_tempo: preferredTempo,
        avoid_genres: avoidGenres,
        avoid_moods: avoidMoods,
        total_tracks_analyzed: history.length,
        last_analyzed_at: new Date().toISOString(),
        ai_profile_summary: aiProfileSummary || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (error) {
      console.error("Upsert error:", error);
      throw error;
    }

    return new Response(JSON.stringify({
      success: true,
      profile: {
        topGenres,
        preferredEnergy,
        preferredTempo,
        dailyPatterns,
        weeklyPatterns,
        avoidGenres,
        avoidMoods,
        tracksAnalyzed: history.length,
        aiSummary: aiProfileSummary,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("AI Learn error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
