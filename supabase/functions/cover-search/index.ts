import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Search iTunes for high-res artwork
async function searchItunes(query: string): Promise<string | null> {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=3`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.results?.length > 0) {
      // Get the highest resolution artwork (replace 100x100 with 3000x3000)
      const artwork = data.results[0].artworkUrl100;
      if (artwork) {
        return artwork.replace(/100x100bb/, "3000x3000bb").replace(/600x600bb/, "3000x3000bb");
      }
    }
  } catch { /* ignore */ }
  return null;
}

// Search Deezer for high-res artwork
async function searchDeezer(query: string): Promise<string | null> {
  try {
    const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=3`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.data?.length > 0) {
      const album = data.data[0].album;
      if (album?.cover_xl) {
        // cover_xl is 1000x1000, try to get even bigger
        return album.cover_xl.replace(/1000x1000/, "1800x1800");
      }
      if (album?.cover_big) return album.cover_big;
    }
  } catch { /* ignore */ }
  return null;
}

// Search MusicBrainz + Cover Art Archive
async function searchMusicBrainz(artist: string, title: string): Promise<string | null> {
  try {
    const query = `recording:"${title}" AND artist:"${artist}"`;
    const url = `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(query)}&limit=1&fmt=json`;
    const res = await fetch(url, {
      headers: { "User-Agent": "GrouAIStream/1.0 (contact@grouai.com)" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const releases = data.recordings?.[0]?.releases;
    if (releases?.length > 0) {
      const mbid = releases[0].id;
      // Try Cover Art Archive
      const coverRes = await fetch(`https://coverartarchive.org/release/${mbid}`);
      if (coverRes.ok) {
        const coverData = await coverRes.json();
        const front = coverData.images?.find((img: any) => img.front);
        if (front?.thumbnails?.["1200"] || front?.image) {
          return front.thumbnails?.["1200"] || front.image;
        }
      }
    }
  } catch { /* ignore */ }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { artist, title } = await req.json();
    
    if (!artist && !title) {
      return new Response(JSON.stringify({ error: "artist or title required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const query = `${artist || ""} ${title || ""}`.trim();

    // Search all sources in parallel
    const [itunesUrl, deezerUrl, mbUrl] = await Promise.all([
      searchItunes(query),
      searchDeezer(query),
      searchMusicBrainz(artist || "", title || ""),
    ]);

    // Priority: iTunes (best quality) > Deezer > MusicBrainz
    const coverUrl = itunesUrl || deezerUrl || mbUrl;

    return new Response(
      JSON.stringify({ 
        cover_url: coverUrl,
        source: itunesUrl ? "itunes" : deezerUrl ? "deezer" : mbUrl ? "musicbrainz" : null,
      }),
      {
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=86400", // Cache 24h
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
