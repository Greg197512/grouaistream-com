import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Timeout wrapper
function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// Clean title for better search results
function cleanTitle(title: string): string {
  return title
    .replace(/^\d+[\s\-_.]+/, "")           // Remove leading track numbers
    .replace(/\(.*?\)/g, "")                 // Remove parentheses content
    .replace(/\[.*?\]/g, "")                 // Remove brackets content
    .replace(/[-_]+/g, " ")                  // Replace dashes/underscores with spaces
    .replace(/\s+/g, " ")                    // Normalize spaces
    .trim();
}

// Extract artist from filename patterns like "artist - title" or "artist_-_title"
function extractArtistFromTitle(title: string): { artist: string; cleanTitle: string } {
  // Pattern: "01-artist--title" or "artist - title"
  const dashMatch = title.match(/^\d*[-_]*(.+?)[-_]{1,3}(.+)$/);
  if (dashMatch) {
    const possibleArtist = dashMatch[1].replace(/[-_]+/g, " ").trim();
    const possibleTitle = dashMatch[2].replace(/[-_]+/g, " ").trim();
    if (possibleArtist.length > 1 && possibleTitle.length > 1) {
      return { artist: possibleArtist, cleanTitle: possibleTitle };
    }
  }
  return { artist: "", cleanTitle: cleanTitle(title) };
}

// Search iTunes
async function searchItunes(query: string): Promise<string | null> {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=3`;
    const res = await fetchWithTimeout(url, {}, 4000);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.results?.length > 0) {
      const artwork = data.results[0].artworkUrl100;
      if (artwork) {
        return artwork.replace(/\d+x\d+bb/, "1200x1200bb");
      }
    }
  } catch { /* timeout or error */ }
  return null;
}

// Search Deezer
async function searchDeezer(query: string): Promise<string | null> {
  try {
    const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=3`;
    const res = await fetchWithTimeout(url, {}, 4000);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.data?.length > 0) {
      const album = data.data[0].album;
      if (album?.cover_xl) return album.cover_xl;
      if (album?.cover_big) return album.cover_big;
    }
  } catch { /* timeout or error */ }
  return null;
}

// Simple in-memory cache
const cache = new Map<string, { url: string | null; ts: number }>();
const CACHE_TTL = 3600_000; // 1 hour

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { artist, title } = await req.json();
    
    if (!artist && !title) {
      return new Response(JSON.stringify({ cover_url: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Smart title parsing
    const parsed = extractArtistFromTitle(title || "");
    const effectiveArtist = artist || parsed.artist;
    const effectiveTitle = parsed.cleanTitle || cleanTitle(title || "");
    
    const query = effectiveArtist 
      ? `${effectiveArtist} ${effectiveTitle}` 
      : effectiveTitle;

    // Check cache
    const cacheKey = query.toLowerCase();
    const cached = cache.get(cacheKey);
    if (cached && (Date.now() - cached.ts) < CACHE_TTL) {
      return new Response(
        JSON.stringify({ cover_url: cached.url, source: "cache" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Search iTunes and Deezer in parallel (skip MusicBrainz - too slow)
    const [itunesUrl, deezerUrl] = await Promise.all([
      searchItunes(query),
      searchDeezer(query),
    ]);

    const coverUrl = itunesUrl || deezerUrl;
    
    // Cache result
    cache.set(cacheKey, { url: coverUrl, ts: Date.now() });

    // Limit cache size
    if (cache.size > 500) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts);
      for (let i = 0; i < 100; i++) cache.delete(oldest[i][0]);
    }

    return new Response(
      JSON.stringify({ 
        cover_url: coverUrl,
        source: itunesUrl ? "itunes" : deezerUrl ? "deezer" : null,
      }),
      {
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=86400",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ cover_url: null, error: error.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
