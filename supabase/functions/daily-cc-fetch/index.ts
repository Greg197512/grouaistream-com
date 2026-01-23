import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const genres = ['rock', 'punk', 'pop', 'electronic'];
    const results: Record<string, number> = {};

    for (const genre of genres) {
      try {
        // Query CC Mixter for new tracks
        const apiUrl = new URL('http://dig.ccmixter.org/api/query');
        apiUrl.searchParams.set('f', 'json');
        apiUrl.searchParams.set('tags', genre);
        apiUrl.searchParams.set('sort', 'date');
        apiUrl.searchParams.set('lic', 'by,by-nc,by-sa,by-nc-sa');
        apiUrl.searchParams.set('limit', '20');

        console.log(`Fetching ${genre} tracks from CC Mixter...`);

        const response = await fetch(apiUrl.toString(), {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'GrooveAI-Stream/1.0 (Daily CC Fetch)'
          }
        });

        if (!response.ok) {
          console.error(`Failed to fetch ${genre}: ${response.status}`);
          continue;
        }

        const tracks = await response.json();
        let addedCount = 0;

        for (const track of tracks || []) {
          // Check if track already exists
          const { data: existing } = await supabase
            .from('tracks')
            .select('id')
            .eq('title', track.upload_name)
            .eq('artist', track.user_name || track.user_real_name)
            .maybeSingle();

          if (existing) {
            continue; // Skip existing tracks
          }

          // Get download URL
          let audioUrl = track.download_url;
          if (!audioUrl && track.files && Array.isArray(track.files)) {
            const mp3File = track.files.find((f: { file_name: string }) => 
              f.file_name?.endsWith('.mp3')
            );
            audioUrl = mp3File?.download_url || track.files[0]?.download_url;
          }

          // Insert new track
          const { error: insertError } = await supabase
            .from('tracks')
            .insert({
              title: track.upload_name,
              artist: track.user_real_name || track.user_name,
              genre: genre.charAt(0).toUpperCase() + genre.slice(1),
              audio_url: audioUrl,
              duration: 180, // Default duration
              mood: 'energetic', // Default mood
              album: `CC Mixter - ${track.license_name || 'CC BY'}`
            });

          if (!insertError) {
            addedCount++;
          } else {
            console.error('Insert error:', insertError);
          }
        }

        results[genre] = addedCount;
        console.log(`Added ${addedCount} new ${genre} tracks`);
        
        // Rate limit between genres
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (genreError) {
        console.error(`Error processing ${genre}:`, genreError);
        results[genre] = 0;
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Daily CC fetch completed',
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Daily CC fetch error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
