import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { genre, limit = 50 } = await req.json();

    // Map genre to CC Mixter tags
    const tagMap: Record<string, string> = {
      'rock': 'rock',
      'punk': 'punk',
      'pop': 'pop',
      'electronic': 'electronic',
      'chill': 'chill,ambient',
      'punk-rock': 'punk,rock',
      'pop-rock': 'pop,rock',
      'pop-punk': 'pop,punk'
    };

    const tags = tagMap[genre.toLowerCase()] || genre.toLowerCase();
    
    // Query CC Mixter API
    // Using dig.ccmixter.org for better API access
    const apiUrl = new URL('http://dig.ccmixter.org/api/query');
    apiUrl.searchParams.set('f', 'json');
    apiUrl.searchParams.set('tags', tags);
    apiUrl.searchParams.set('sort', 'date');
    apiUrl.searchParams.set('lic', 'by,by-nc,by-sa,by-nc-sa');
    apiUrl.searchParams.set('limit', limit.toString());

    console.log(`CC Mixter: Fetching ${genre} tracks from ${apiUrl.toString()}`);

    const response = await fetch(apiUrl.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'GrooveAI-Stream/1.0 (Legal CC Music Discovery)'
      }
    });

    if (!response.ok) {
      // Fallback to alternative endpoint
      const fallbackUrl = new URL('http://ccmixter.org/api/query');
      fallbackUrl.searchParams.set('f', 'json');
      fallbackUrl.searchParams.set('tags', tags);
      fallbackUrl.searchParams.set('sort', 'date');
      fallbackUrl.searchParams.set('limit', limit.toString());

      console.log(`CC Mixter: Trying fallback ${fallbackUrl.toString()}`);
      
      const fallbackResponse = await fetch(fallbackUrl.toString(), {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'GrooveAI-Stream/1.0'
        }
      });

      if (!fallbackResponse.ok) {
        throw new Error(`CC Mixter API error: ${fallbackResponse.status}`);
      }

      const fallbackData = await fallbackResponse.json();
      return new Response(JSON.stringify({ tracks: fallbackData || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    
    // Transform and enhance track data
    const tracks = (data || []).map((track: Record<string, unknown>) => ({
      upload_id: track.upload_id,
      upload_name: track.upload_name || 'Unknown Track',
      user_name: track.user_name || 'Unknown Artist',
      user_real_name: track.user_real_name,
      license_url: track.license_url || 'https://creativecommons.org/licenses/by/4.0/',
      license_name: track.license_name || 'CC BY',
      file_page_url: track.file_page_url || `http://ccmixter.org/files/${track.user_name}/${track.upload_id}`,
      download_url: track.download_url || (track.files && Array.isArray(track.files) && track.files[0]?.download_url),
      files: track.files,
      upload_date: track.upload_date,
      upload_tags: track.upload_tags,
      upload_description: track.upload_description
    }));

    console.log(`CC Mixter: Found ${tracks.length} ${genre} tracks`);

    return new Response(JSON.stringify({ tracks }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('CC Mixter proxy error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch CC Mixter tracks';
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      tracks: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
