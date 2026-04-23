import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Process tracks without covers in batches
// Calls ai-cover function for each track (which handles iTunes/Deezer + AI fallback)

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(body.limit || 50, 200);
    const onlyRecent = body.onlyRecent !== false; // default true
    const allowAI = body.allowAI !== false; // default true (high quality requested)

    // --- Auth: only admin can trigger ---
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await supabaseAuth.auth.getClaims(token);
    const userId = claims?.claims?.sub;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch tracks without covers
    let query = supabase
      .from("tracks")
      .select("id, title, artist")
      .or("cover_url.is.null,cover_url.eq.,cover_url.ilike.%picsum.photos%,cover_url.ilike.%placeholder%")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (onlyRecent) {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("created_at", cutoff);
    }

    const { data: tracks, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;

    if (!tracks || tracks.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No tracks to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[batch-fill-covers] Processing ${tracks.length} tracks`);

    // Fire ai-cover for each track in parallel chunks of 5
    const results = { success: 0, original: 0, ai: 0, placeholder: 0, failed: 0 };
    const chunkSize = 5;

    for (let i = 0; i < tracks.length; i += chunkSize) {
      const chunk = tracks.slice(i, i + chunkSize);
      await Promise.all(chunk.map(async (track) => {
        try {
          const r = await supabase.functions.invoke("ai-cover", {
            body: {
              trackId: track.id,
              allow_ai_fallback: allowAI,
              source: "auto_trigger",
            },
          });
          if (r.error) {
            results.failed++;
            console.error(`[batch-fill-covers] Failed for ${track.id}:`, r.error);
          } else {
            results.success++;
            const src = r.data?.source;
            if (src === "original") results.original++;
            else if (src === "ai-generated") results.ai++;
            else if (src === "placeholder") results.placeholder++;
          }
        } catch (e) {
          results.failed++;
          console.error(`[batch-fill-covers] Exception for ${track.id}:`, e);
        }
      }));
    }

    return new Response(
      JSON.stringify({ success: true, processed: tracks.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[batch-fill-covers] error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
