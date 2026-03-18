import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function fetchSpotifyApi(endpoint: string, token: string) {
  const res = await fetch(`https://api.spotify.com/${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify API error ${res.status}: ${text}`);
  }
  return await res.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { spotifyToken, mode = 'all' } = await req.json();

    if (!spotifyToken) {
      return new Response(JSON.stringify({ error: 'Spotify token required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const allTracks: any[] = [];
    const errors: string[] = [];

    // 1. Top tracks (short, medium, long term)
    for (const range of ['short_term', 'medium_term', 'long_term']) {
      try {
        const data = await fetchSpotifyApi(
          `v1/me/top/tracks?time_range=${range}&limit=50`, spotifyToken
        );
        if (data.items) allTracks.push(...data.items);
      } catch (e) {
        errors.push(`Top tracks ${range}: ${e.message}`);
      }
    }

    // 2. Saved/liked tracks (multiple pages)
    try {
      for (let offset = 0; offset < 500; offset += 50) {
        const data = await fetchSpotifyApi(
          `v1/me/tracks?limit=50&offset=${offset}`, spotifyToken
        );
        if (data.items) {
          allTracks.push(...data.items.map((i: any) => i.track));
        }
        if (!data.next) break;
      }
    } catch (e) {
      errors.push(`Saved tracks: ${e.message}`);
    }

    // 3. Recently played
    try {
      const data = await fetchSpotifyApi(
        `v1/me/player/recently-played?limit=50`, spotifyToken
      );
      if (data.items) {
        allTracks.push(...data.items.map((i: any) => i.track));
      }
    } catch (e) {
      errors.push(`Recently played: ${e.message}`);
    }

    // 4. User playlists tracks
    try {
      const playlists = await fetchSpotifyApi(
        `v1/me/playlists?limit=50`, spotifyToken
      );
      if (playlists.items) {
        for (const pl of playlists.items.slice(0, 20)) {
          try {
            const plData = await fetchSpotifyApi(
              `v1/playlists/${pl.id}/tracks?limit=100`, spotifyToken
            );
            if (plData.items) {
              allTracks.push(...plData.items.filter((i: any) => i.track).map((i: any) => i.track));
            }
          } catch (e) {
            // skip individual playlist errors
          }
        }
      }
    } catch (e) {
      errors.push(`Playlists: ${e.message}`);
    }

    // 5. Browse featured playlists & new releases
    try {
      const featured = await fetchSpotifyApi(
        `v1/browse/featured-playlists?limit=10`, spotifyToken
      );
      if (featured.playlists?.items) {
        for (const pl of featured.playlists.items.slice(0, 5)) {
          try {
            const plData = await fetchSpotifyApi(
              `v1/playlists/${pl.id}/tracks?limit=100`, spotifyToken
            );
            if (plData.items) {
              allTracks.push(...plData.items.filter((i: any) => i.track).map((i: any) => i.track));
            }
          } catch {}
        }
      }
    } catch (e) {
      errors.push(`Featured: ${e.message}`);
    }

    try {
      const newReleases = await fetchSpotifyApi(
        `v1/browse/new-releases?limit=50`, spotifyToken
      );
      if (newReleases.albums?.items) {
        for (const album of newReleases.albums.items.slice(0, 20)) {
          try {
            const albumData = await fetchSpotifyApi(
              `v1/albums/${album.id}/tracks?limit=50`, spotifyToken
            );
            if (albumData.items) {
              albumData.items.forEach((t: any) => {
                t.album = album; // attach album info
              });
              allTracks.push(...albumData.items);
            }
          } catch {}
        }
      }
    } catch (e) {
      errors.push(`New releases: ${e.message}`);
    }

    // 6. Search popular genres for more tracks
    const genres = ['pop', 'rock', 'hip-hop', 'electronic', 'r&b', 'jazz', 'classical', 'latin', 'metal', 'indie', 'country', 'reggaeton', 'house', 'techno', 'disco', 'punk', 'soul', 'funk', 'blues', 'ambient'];
    for (const genre of genres) {
      try {
        const search = await fetchSpotifyApi(
          `v1/search?q=genre:${encodeURIComponent(genre)}&type=track&limit=50`, spotifyToken
        );
        if (search.tracks?.items) {
          allTracks.push(...search.tracks.items);
        }
      } catch (e) {
        errors.push(`Search ${genre}: ${e.message}`);
      }
    }

    // Deduplicate by Spotify ID
    const seen = new Set<string>();
    const uniqueTracks = allTracks.filter(t => {
      if (!t || !t.id || seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    // Map to DB format
    const dbTracks = uniqueTracks.map(t => ({
      title: t.name || 'Unknown',
      artist: t.artists?.map((a: any) => a.name).join(', ') || 'Unknown',
      album: t.album?.name || null,
      duration: Math.round((t.duration_ms || 180000) / 1000),
      cover_url: t.album?.images?.[0]?.url || null,
      genre: null, // Spotify doesn't return genre per track
      mood: null,
      audio_url: t.preview_url || null,
      video_url: null,
    }));

    // Insert in batches, skip duplicates by title+artist
    let inserted = 0;
    const batchSize = 100;
    
    for (let i = 0; i < dbTracks.length; i += batchSize) {
      const batch = dbTracks.slice(i, i + batchSize);
      
      // Check existing
      const titles = batch.map(t => t.title);
      const { data: existing } = await supabase
        .from('tracks')
        .select('title, artist')
        .in('title', titles);
      
      const existingSet = new Set(
        (existing || []).map(e => `${e.title}|||${e.artist}`)
      );
      
      const newTracks = batch.filter(t => !existingSet.has(`${t.title}|||${t.artist}`));
      
      if (newTracks.length > 0) {
        const { error } = await supabase.from('tracks').insert(newTracks);
        if (!error) inserted += newTracks.length;
        else errors.push(`Insert batch ${i}: ${error.message}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      fetched: uniqueTracks.length,
      inserted,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
