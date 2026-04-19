// Agregator statystyk budowy "AI muzycznego" dla Admina:
// - tracki w R2 (i suma rozmiarów jeśli w metadata)
// - n8n boty (per source_type)
// - generacje per engine (musicgen / suno / elevenlabs)
// - % zajętości R2 (limit Free 10 GB = 10240 MB)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const R2_FREE_LIMIT_MB = 10 * 1024; // 10 GB

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

    // sprawdź admina
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: prof } = await admin.from("profiles").select("role").eq("user_id", u.user.id).maybeSingle();
    if (prof?.role !== "admin") {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === Tracks: total + R2 only + suma MB ===
    const [{ count: totalTracks }, { count: r2Tracks }, { data: tracksWithMeta }] = await Promise.all([
      admin.from("tracks").select("*", { count: "exact", head: true }),
      admin.from("tracks").select("*", { count: "exact", head: true }).ilike("audio_url", "%r2.dev%"),
      admin.from("tracks").select("metadata").not("metadata", "is", null).limit(5000),
    ]);

    let totalSizeMB = 0;
    (tracksWithMeta || []).forEach((t: any) => {
      const sz = t.metadata?.size_bytes || t.metadata?.file_size || t.metadata?.size;
      if (typeof sz === "number") totalSizeMB += sz / 1024 / 1024;
    });
    // Jeśli brak metadanych, oszacuj: 4MB/track
    if (totalSizeMB < 1 && (r2Tracks || 0) > 0) {
      totalSizeMB = (r2Tracks || 0) * 4;
    }
    const r2PercentUsed = Math.min(100, (totalSizeMB / R2_FREE_LIMIT_MB) * 100);

    // === n8n boty: per source ===
    const { data: n8nTokens } = await admin
      .from("n8n_ingest_tokens")
      .select("label, source_type, total_ingests, last_used_at, is_active");

    // === Generations per engine ===
    const { data: gens } = await admin
      .from("studio_generations")
      .select("ai_model, status");
    const engineStats: Record<string, { total: number; completed: number }> = {};
    (gens || []).forEach((g: any) => {
      const m = g.ai_model || "unknown";
      if (!engineStats[m]) engineStats[m] = { total: 0, completed: 0 };
      engineStats[m].total++;
      if (g.status === "completed") engineStats[m].completed++;
    });

    // === Ostatnia aktywność (24h)
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: tracksLast24h } = await admin
      .from("tracks").select("*", { count: "exact", head: true })
      .gte("created_at", dayAgo);
    const { count: gensLast24h } = await admin
      .from("studio_generations").select("*", { count: "exact", head: true })
      .gte("created_at", dayAgo);

    return new Response(JSON.stringify({
      r2: {
        total_tracks: totalTracks || 0,
        r2_tracks: r2Tracks || 0,
        size_mb: Math.round(totalSizeMB),
        limit_mb: R2_FREE_LIMIT_MB,
        percent_used: Math.round(r2PercentUsed * 10) / 10,
      },
      n8n_bots: (n8nTokens || []).map((t: any) => ({
        label: t.label,
        source: t.source_type,
        ingests: t.total_ingests || 0,
        last_used: t.last_used_at,
        active: !!t.is_active,
      })),
      engines: engineStats,
      activity_24h: {
        new_tracks: tracksLast24h || 0,
        new_generations: gensLast24h || 0,
      },
      generated_at: new Date().toISOString(),
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[ai-builder-stats]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
