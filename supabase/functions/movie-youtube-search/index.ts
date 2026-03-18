import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function searchMoviePoster(title: string, year?: number): Promise<string | null> {
  try {
    // Try iTunes first (works great for music films)
    const itunesQuery = encodeURIComponent(`${title} ${year || ''}`);
    const itunesRes = await fetch(`https://itunes.apple.com/search?term=${itunesQuery}&media=movie&limit=3`);
    if (itunesRes.ok) {
      const data = await itunesRes.json();
      if (data.results?.length > 0) {
        // Get high-res artwork (600x600)
        return data.results[0].artworkUrl100?.replace('100x100', '600x600') || null;
      }
    }
  } catch (e) {
    console.error('iTunes poster search error:', e);
  }

  try {
    // Fallback: OMDB (free tier, no key needed for poster)
    const omdbQuery = encodeURIComponent(title);
    const omdbRes = await fetch(`https://www.omdbapi.com/?t=${omdbQuery}${year ? `&y=${year}` : ''}&apikey=aa4f1ca8`);
    if (omdbRes.ok) {
      const data = await omdbRes.json();
      if (data.Poster && data.Poster !== 'N/A') {
        return data.Poster;
      }
    }
  } catch (e) {
    console.error('OMDB poster search error:', e);
  }

  return null;
}

async function searchYouTube(query: string): Promise<{ videoId: string; title: string } | null> {
  try {
    const response = await fetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20240101.00.00',
            hl: 'pl',
            gl: 'PL',
          },
        },
        query: query,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();

    const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
    if (!contents) return null;

    for (const section of contents) {
      const items = section?.itemSectionRenderer?.contents;
      if (!items) continue;

      for (const item of items) {
        const video = item?.videoRenderer;
        if (video?.videoId) {
          return {
            videoId: video.videoId,
            title: video.title?.runs?.[0]?.text || query,
          };
        }
      }
    }
    return null;
  } catch (e) {
    console.error('YouTube search error:', e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { movieId, title, director, year, mode } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Mode: 'single' - search for one movie, 'batch' - search for multiple
    if (mode === 'batch') {
      // Batch mode: find YouTube for movies without video_url
      const { data: movies } = await supabase
        .from('movies')
        .select('id, title, director, year')
        .is('video_url', null)
        .limit(20);

      if (!movies || movies.length === 0) {
        return new Response(JSON.stringify({ success: true, updated: 0, message: 'All movies already have URLs' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let updated = 0;
      for (const movie of movies) {
        const query = `${movie.title} ${movie.director || ''} ${movie.year || ''} cały film`;
        const result = await searchYouTube(query);
        
        // Always try to get a real poster
        const poster = await searchMoviePoster(movie.title, movie.year);
        
        if (result) {
          await supabase.from('movies').update({
            video_url: `https://www.youtube.com/watch?v=${result.videoId}`,
            poster_url: poster || `https://img.youtube.com/vi/${result.videoId}/maxresdefault.jpg`,
          }).eq('id', movie.id);
          updated++;
        } else if (poster) {
          // Even without video, save the poster
          await supabase.from('movies').update({ poster_url: poster }).eq('id', movie.id);
        }

        await new Promise(r => setTimeout(r, 400));
      }

      return new Response(JSON.stringify({ success: true, updated, total: movies.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Single mode
    const searchQuery = `${title} ${director || ''} ${year || ''} cały film`;
    console.log('Searching YouTube for:', searchQuery);

    // Fetch poster in parallel with YouTube search
    const [result, poster] = await Promise.all([
      searchYouTube(searchQuery),
      searchMoviePoster(title, year),
    ]);

    const videoResult = result || await searchYouTube(`${title} film`);

    if (!videoResult) {
      // Still try to save poster even without video
      if (poster && movieId) {
        await supabase.from('movies').update({ poster_url: poster }).eq('id', movieId);
      }
      return new Response(JSON.stringify({ success: false, error: 'Nie znaleziono na YouTube', posterUrl: poster }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const finalPoster = poster || `https://img.youtube.com/vi/${videoResult.videoId}/maxresdefault.jpg`;

    if (movieId) {
      await supabase.from('movies').update({
        video_url: `https://www.youtube.com/watch?v=${videoResult.videoId}`,
        poster_url: finalPoster,
      }).eq('id', movieId);
    }

    return new Response(JSON.stringify({
      success: true,
      videoId: videoResult.videoId,
      videoUrl: `https://www.youtube.com/watch?v=${videoResult.videoId}`,
      posterUrl: finalPoster,
      youtubeTitle: videoResult.title,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Movie YouTube search error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
