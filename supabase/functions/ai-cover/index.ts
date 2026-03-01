import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function findOriginalCover(title: string, artist: string): Promise<string | null> {
  // 1. Try iTunes Search API (high quality, real album art)
  try {
    const query = encodeURIComponent(`${artist} ${title}`);
    const itunesRes = await fetch(`https://itunes.apple.com/search?term=${query}&media=music&limit=5`);
    if (itunesRes.ok) {
      const data = await itunesRes.json();
      if (data.results?.length > 0) {
        // Get the highest resolution artwork (replace 100x100 with 600x600)
        const artwork = data.results[0].artworkUrl100;
        if (artwork) {
          return artwork.replace("100x100bb", "600x600bb");
        }
      }
    }
  } catch (e) {
    console.log("iTunes search failed:", e);
  }

  // 2. Try MusicBrainz + Cover Art Archive
  try {
    const query = encodeURIComponent(`recording:"${title}" AND artist:"${artist}"`);
    const mbRes = await fetch(`https://musicbrainz.org/ws/2/recording?query=${query}&limit=3&fmt=json`, {
      headers: { "User-Agent": "GrooveAI/1.0 (music-app)" }
    });
    if (mbRes.ok) {
      const mbData = await mbRes.json();
      for (const recording of mbData.recordings || []) {
        for (const release of recording.releases || []) {
          if (release.id) {
            try {
              const coverRes = await fetch(`https://coverartarchive.org/release/${release.id}`, {
                redirect: "follow"
              });
              if (coverRes.ok) {
                const coverData = await coverRes.json();
                const front = coverData.images?.find((img: any) => img.front);
                if (front?.thumbnails?.large || front?.image) {
                  return front.thumbnails.large || front.image;
                }
              }
            } catch { /* skip this release */ }
          }
        }
      }
    }
  } catch (e) {
    console.log("MusicBrainz search failed:", e);
  }

  // 3. Try Deezer API as fallback
  try {
    const query = encodeURIComponent(`${artist} ${title}`);
    const deezerRes = await fetch(`https://api.deezer.com/search?q=${query}&limit=3`);
    if (deezerRes.ok) {
      const data = await deezerRes.json();
      if (data.data?.length > 0) {
        const albumCover = data.data[0].album?.cover_xl || data.data[0].album?.cover_big;
        if (albumCover) return albumCover;
      }
    }
  } catch (e) {
    console.log("Deezer search failed:", e);
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { trackId } = await req.json();
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!trackId) throw new Error("trackId is required");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: track, error: fetchError } = await supabase
      .from("tracks")
      .select("id, title, artist, genre, cover_url")
      .eq("id", trackId)
      .single();

    if (fetchError || !track) {
      return new Response(
        JSON.stringify({ success: false, error: "Track not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Skip if already has a real cover (not placeholder)
    if (track.cover_url && !track.cover_url.includes("picsum.photos") && !track.cover_url.includes("placeholder")) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, message: "Already has cover" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Search for original album cover
    console.log(`Searching original cover for: "${track.title}" by ${track.artist}`);
    const coverUrl = await findOriginalCover(track.title, track.artist);

    if (!coverUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "No original cover found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update track with the original cover URL directly (no need to re-upload)
    const { error: updateErr } = await supabase
      .from("tracks")
      .update({ cover_url: coverUrl })
      .eq("id", track.id);

    if (updateErr) throw updateErr;

    console.log(`Found original cover for "${track.title}": ${coverUrl}`);

    return new Response(
      JSON.stringify({ success: true, cover_url: coverUrl, source: "original" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI Cover error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
