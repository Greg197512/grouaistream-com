import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ingest-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface IngestPayload {
  title: string;
  artist: string;
  source: "cc_mixter" | "fma" | "jamendo" | "ia" | "musicbrainz" | "suno_scraped" | "spotify_meta" | "youtube_meta" | "other";
  audio_url?: string;
  external_id?: string;
  source_url?: string;
  lyrics?: string;
  genre?: string;
  subgenre?: string;
  mood?: string;
  language?: string;
  duration_seconds?: number;
  cover_url?: string;
  license?: string;
  audio_features?: {
    bpm?: number;
    music_key?: string;
    music_mode?: string;
    energy?: number;
    danceability?: number;
    valence?: number;
    acousticness?: number;
    instrumentalness?: number;
    loudness_db?: number;
    speechiness?: number;
    liveness?: number;
    time_signature?: string;
  };
  metadata?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Token z headera (preferowane) lub z query (fallback dla N8N)
    const url = new URL(req.url);
    const token =
      req.headers.get("x-ingest-token") ||
      url.searchParams.get("token") ||
      "";

    if (!token) {
      return new Response(JSON.stringify({ error: "missing_token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Walidacja tokena
    const { data: tokenRow, error: tokenError } = await supabase
      .from("n8n_ingest_tokens")
      .select("id, is_active, source_type")
      .eq("token", token)
      .maybeSingle();

    if (tokenError || !tokenRow || !tokenRow.is_active) {
      return new Response(JSON.stringify({ error: "invalid_token" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const items: IngestPayload[] = Array.isArray(body) ? body : [body];

    if (items.length > 100) {
      return new Response(JSON.stringify({ error: "batch_too_large", max: 100 }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = {
      ingested: 0,
      skipped: 0,
      errors: [] as Array<{ title: string; error: string }>,
    };

    for (const item of items) {
      if (!item.title || !item.artist || !item.source) {
        results.skipped++;
        continue;
      }

      try {
        // Wstaw do katalogu przez RPC (deduplikacja po stronie DB)
        const { data: catalogId, error: catErr } = await supabase.rpc("add_to_song_catalog", {
          _title: item.title.substring(0, 500),
          _artist: item.artist.substring(0, 300),
          _source: item.source,
          _audio_url: item.audio_url || null,
          _external_id: item.external_id || null,
          _lyrics: item.lyrics || null,
          _genre: item.genre || null,
          _mood: item.mood || null,
          _duration: item.duration_seconds || null,
          _license: item.license || "unknown",
          _metadata: {
            ...(item.metadata || {}),
            subgenre: item.subgenre,
            language: item.language,
            cover_url: item.cover_url,
            source_url: item.source_url,
          },
          _ingested_by: `n8n:${tokenRow.source_type}`,
        });

        if (catErr) throw new Error(catErr.message);
        if (!catalogId) {
          results.skipped++;
          continue;
        }

        // Wstaw audio_features jeśli podane
        if (item.audio_features) {
          await supabase.from("audio_features").upsert({
            catalog_id: catalogId,
            bpm: item.audio_features.bpm,
            music_key: item.audio_features.music_key,
            music_mode: item.audio_features.music_mode,
            time_signature: item.audio_features.time_signature || "4/4",
            energy: item.audio_features.energy,
            danceability: item.audio_features.danceability,
            valence: item.audio_features.valence,
            acousticness: item.audio_features.acousticness,
            instrumentalness: item.audio_features.instrumentalness,
            loudness_db: item.audio_features.loudness_db,
            speechiness: item.audio_features.speechiness,
            liveness: item.audio_features.liveness,
            analyzed_by: `n8n:${tokenRow.source_type}`,
          }, { onConflict: "catalog_id" });
        }

        // Auto-dodaj do training_dataset jeśli mamy audio + lyrics + jest legalny
        const isLegal = ["cc_mixter", "fma", "jamendo", "ia", "musicbrainz"].includes(item.source);
        if (isLegal && item.audio_url && (item.lyrics || item.genre)) {
          const promptText = [
            item.genre || "music",
            item.subgenre,
            item.mood,
            item.lyrics ? `with lyrics: ${item.lyrics.substring(0, 200)}` : "instrumental",
          ].filter(Boolean).join(", ");

          await supabase.from("training_dataset").upsert({
            catalog_id: catalogId,
            prompt_text: promptText,
            audio_url: item.audio_url,
            duration_seconds: item.duration_seconds,
            quality_score: isLegal ? 0.8 : 0.4,
            opt_in: true,
          }, { onConflict: "catalog_id" });
        }

        results.ingested++;
      } catch (e) {
        results.errors.push({
          title: item.title,
          error: e instanceof Error ? e.message : "unknown",
        });
      }
    }

    // Aktualizuj statystyki tokena
    await supabase
      .from("n8n_ingest_tokens")
      .update({
        last_used_at: new Date().toISOString(),
        total_ingests: (tokenRow as any).total_ingests
          ? (tokenRow as any).total_ingests + results.ingested
          : results.ingested,
      })
      .eq("id", tokenRow.id);

    return new Response(JSON.stringify({
      success: true,
      ...results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[n8n-music-ingest] error:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "unknown_error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
