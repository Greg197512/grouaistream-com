// Pełen agregator statystyk budowy "AI muzycznego" dla Admina
// Pokazuje wszystko: tracki per źródło, gatunki, generacje per silnik,
// boty n8n, R2 storage, aktywność (1h/24h/7d), katalog AI (audio_features, embeddings)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const R2_FREE_LIMIT_MB = 10 * 1024; // 10 GB

function classifySource(url: string | null): string {
  if (!url) return "missing_url";
  const u = url.toLowerCase();
  if (u.includes("r2.dev") || u.includes("r2.cloudflarestorage")) return "r2";
  if (u.includes("ccmixter")) return "ccmixter";
  if (u.includes("archive.org")) return "internet_archive";
  if (u.includes("jamendo")) return "jamendo";
  if (u.includes("freemusicarchive") || u.includes("/fma/")) return "fma";
  if (u.includes("youtube") || u.includes("youtu.be")) return "youtube";
  if (u.includes("suno")) return "suno";
  if (u.includes("replicate")) return "replicate";
  if (u.includes("elevenlabs")) return "elevenlabs";
  if (u.includes("supabase.co/storage")) return "supabase_storage";
  return "other";
}

const SOURCE_LABELS: Record<string, string> = {
  r2: "🟢 Cloudflare R2 (własny serwer)",
  ccmixter: "🎵 ccMixter (CC-BY)",
  internet_archive: "📚 Internet Archive",
  jamendo: "🎧 Jamendo",
  fma: "📻 Free Music Archive",
  youtube: "▶️ YouTube",
  suno: "🤖 Suno (AI)",
  replicate: "⚙️ Replicate / MusicGen",
  elevenlabs: "🗣️ ElevenLabs",
  supabase_storage: "📦 Supabase Storage",
  other: "❓ Inne źródła",
  missing_url: "⚠️ Brak audio_url (metadane)",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Sprawdź admina
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Sprawdź rolę przez has_role
    const { data: isAdminData } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
    if (isAdminData !== true) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Pobierz WSZYSTKIE tracki (klasyfikacja po URL) - tylko lekkie kolumny
    // Paginacja jeśli >1000
    let allTracks: any[] = [];
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error } = await admin
        .from("tracks")
        .select("audio_url,duration,genre,mood,created_at,is_monetized,user_id")
        .range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allTracks = allTracks.concat(data);
      if (data.length < PAGE) break;
      from += PAGE;
      if (allTracks.length >= 50000) break; // safety
    }

    // === Klasyfikacja per źródło + statystyki
    const bySource: Record<string, { count: number; hours: number; with_genre: number; monetized: number }> = {};
    const byGenre: Record<string, number> = {};
    const byMood: Record<string, number> = {};
    const byUser: Record<string, number> = {};
    let totalDurationSec = 0;
    let withCover = 0;
    let withMood = 0;

    const now = Date.now();
    const HOUR = 60 * 60 * 1000;
    let last1h = 0, last24h = 0, last7d = 0;

    allTracks.forEach((t) => {
      const src = classifySource(t.audio_url);
      if (!bySource[src]) bySource[src] = { count: 0, hours: 0, with_genre: 0, monetized: 0 };
      bySource[src].count++;
      bySource[src].hours += (t.duration || 0) / 3600;
      if (t.genre) bySource[src].with_genre++;
      if (t.is_monetized) bySource[src].monetized++;

      totalDurationSec += t.duration || 0;
      if (t.genre) byGenre[t.genre] = (byGenre[t.genre] || 0) + 1;
      if (t.mood) { byMood[t.mood] = (byMood[t.mood] || 0) + 1; withMood++; }
      if (t.user_id) byUser[t.user_id] = (byUser[t.user_id] || 0) + 1;

      const created = t.created_at ? new Date(t.created_at).getTime() : 0;
      const age = now - created;
      if (age < HOUR) last1h++;
      if (age < 24 * HOUR) last24h++;
      if (age < 7 * 24 * HOUR) last7d++;
    });

    const r2Count = bySource.r2?.count || 0;
    // Estymata rozmiaru R2: 4MB/track (jeśli brak metadata)
    const totalSizeMB = r2Count * 4;
    const r2PercentUsed = Math.min(100, (totalSizeMB / R2_FREE_LIMIT_MB) * 100);

    // Top 10 gatunków
    const topGenres = Object.entries(byGenre)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([genre, count]) => ({ genre, count }));

    // Top 10 nastrojów
    const topMoods = Object.entries(byMood)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([mood, count]) => ({ mood, count }));

    // === n8n boty
    const { data: n8nTokens } = await admin
      .from("n8n_ingest_tokens")
      .select("label, source_type, total_ingests, last_used_at, is_active, created_at")
      .order("total_ingests", { ascending: false });

    // === Generations (legacy + studio_generations)
    const { data: gens } = await admin.from("generations").select("status, genre");
    const { count: studioGensCount } = await admin
      .from("studio_generations").select("*", { count: "exact", head: true });

    const engineStats: Record<string, { total: number; completed: number }> = {};
    (gens || []).forEach((g: any) => {
      const m = g.genre || "unknown";
      if (!engineStats[m]) engineStats[m] = { total: 0, completed: 0 };
      engineStats[m].total++;
      if (g.status === "completed") engineStats[m].completed++;
    });

    // === Katalog AI
    const [
      { count: songCatalogCount },
      { count: audioFeaturesCount },
      { count: embeddingsCount },
      { count: profilesCount },
      { count: playlistsCount },
      { count: likedSongsCount },
      { count: listeningHistoryCount },
      { count: moodSessionsCount },
      { count: blogPostsCount },
    ] = await Promise.all([
      admin.from("song_catalog").select("*", { count: "exact", head: true }),
      admin.from("audio_features").select("*", { count: "exact", head: true }),
      admin.from("melody_embeddings").select("*", { count: "exact", head: true }),
      admin.from("profiles").select("*", { count: "exact", head: true }),
      admin.from("playlists").select("*", { count: "exact", head: true }),
      admin.from("liked_songs").select("*", { count: "exact", head: true }),
      admin.from("listening_history").select("*", { count: "exact", head: true }),
      admin.from("mood_sessions").select("*", { count: "exact", head: true }),
      admin.from("seo_blog_posts").select("*", { count: "exact", head: true }),
    ]);

    // === Aktywność dzienna (14 dni)
    const dailyMap: Record<string, number> = {};
    const fourteenDaysAgo = now - 14 * 24 * HOUR;
    allTracks.forEach((t) => {
      if (!t.created_at) return;
      const ts = new Date(t.created_at).getTime();
      if (ts >= fourteenDaysAgo) {
        const day = t.created_at.slice(0, 10);
        dailyMap[day] = (dailyMap[day] || 0) + 1;
      }
    });
    const dailyActivity = Object.entries(dailyMap)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 14)
      .map(([day, count]) => ({ day, count }));

    // === Sources w czytelnej formie
    const sources = Object.entries(bySource)
      .map(([key, v]) => ({
        key,
        label: SOURCE_LABELS[key] || key,
        count: v.count,
        hours: Math.round(v.hours * 10) / 10,
        with_genre: v.with_genre,
        monetized: v.monetized,
        percent: Math.round((v.count / allTracks.length) * 1000) / 10,
      }))
      .sort((a, b) => b.count - a.count);

    return new Response(JSON.stringify({
      summary: {
        total_tracks: allTracks.length,
        total_hours: Math.round((totalDurationSec / 3600) * 10) / 10,
        unique_artists_users: Object.keys(byUser).length,
        with_genre: Object.values(byGenre).reduce((a, b) => a + b, 0),
        with_mood: withMood,
        monetized_tracks: allTracks.filter(t => t.is_monetized).length,
      },
      r2: {
        tracks: r2Count,
        size_mb: Math.round(totalSizeMB),
        limit_mb: R2_FREE_LIMIT_MB,
        percent_used: Math.round(r2PercentUsed * 10) / 10,
      },
      sources,
      top_genres: topGenres,
      top_moods: topMoods,
      n8n_bots: (n8nTokens || []).map((t: any) => ({
        label: t.label,
        source: t.source_type,
        ingests: t.total_ingests || 0,
        last_used: t.last_used_at,
        active: !!t.is_active,
        created_at: t.created_at,
      })),
      engines: engineStats,
      studio_generations_count: studioGensCount || 0,
      activity: {
        last_1h: last1h,
        last_24h: last24h,
        last_7d: last7d,
        daily: dailyActivity,
      },
      ai_catalog: {
        song_catalog: songCatalogCount || 0,
        audio_features: audioFeaturesCount || 0,
        melody_embeddings: embeddingsCount || 0,
      },
      platform: {
        users: profilesCount || 0,
        playlists: playlistsCount || 0,
        liked_songs: likedSongsCount || 0,
        listening_history: listeningHistoryCount || 0,
        mood_sessions: moodSessionsCount || 0,
        blog_posts: blogPostsCount || 0,
      },
      generated_at: new Date().toISOString(),
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[ai-builder-stats]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
