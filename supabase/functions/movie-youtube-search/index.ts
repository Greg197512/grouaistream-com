import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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
        
        if (result) {
          await supabase.from('movies').update({
            video_url: `https://www.youtube.com/watch?v=${result.videoId}`,
            poster_url: `https://img.youtube.com/vi/${result.videoId}/hqdefault.jpg`,
          }).eq('id', movie.id);
          updated++;
        }

        await new Promise(r => setTimeout(r, 300));
      }

      return new Response(JSON.stringify({ success: true, updated, total: movies.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Single mode
    const searchQuery = `${title} ${director || ''} ${year || ''} cały film`;
    console.log('Searching YouTube for:', searchQuery);

    const result = await searchYouTube(searchQuery);

    if (!result) {
      // Fallback: try simpler query
      const fallback = await searchYouTube(`${title} film`);
      if (!fallback) {
        return new Response(JSON.stringify({ success: false, error: 'Nie znaleziono na YouTube' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (movieId) {
        await supabase.from('movies').update({
          video_url: `https://www.youtube.com/watch?v=${fallback.videoId}`,
          poster_url: `https://img.youtube.com/vi/${fallback.videoId}/hqdefault.jpg`,
        }).eq('id', movieId);
      }

      return new Response(JSON.stringify({
        success: true,
        videoId: fallback.videoId,
        videoUrl: `https://www.youtube.com/watch?v=${fallback.videoId}`,
        posterUrl: `https://img.youtube.com/vi/${fallback.videoId}/hqdefault.jpg`,
        youtubeTitle: fallback.title,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update DB
    if (movieId) {
      await supabase.from('movies').update({
        video_url: `https://www.youtube.com/watch?v=${result.videoId}`,
        poster_url: `https://img.youtube.com/vi/${result.videoId}/hqdefault.jpg`,
      }).eq('id', movieId);
    }

    return new Response(JSON.stringify({
      success: true,
      videoId: result.videoId,
      videoUrl: `https://www.youtube.com/watch?v=${result.videoId}`,
      posterUrl: `https://img.youtube.com/vi/${result.videoId}/hqdefault.jpg`,
      youtubeTitle: result.title,
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
