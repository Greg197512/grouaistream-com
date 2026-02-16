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
    const { videoId, title, artist } = await req.json();

    if (!videoId) {
      return new Response(JSON.stringify({ error: 'Missing videoId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Downloading audio for video: ${videoId}`);

    // Use cobalt API to get audio download URL
    const cobaltResponse = await fetch('https://api.cobalt.tools/api/json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        url: `https://www.youtube.com/watch?v=${videoId}`,
        vCodec: 'h264',
        vQuality: '720',
        aFormat: 'mp3',
        isAudioOnly: true,
        filenamePattern: 'basic',
      }),
    });

    const cobaltData = await cobaltResponse.json();
    console.log('Cobalt response:', JSON.stringify(cobaltData));

    if (cobaltData.status === 'error' || (!cobaltData.url && !cobaltData.audio)) {
      // Fallback: try alternative API
      console.log('Cobalt failed, trying alternative...');
      
      const altResponse = await fetch(`https://yt-dlp-api.onrender.com/download?url=https://www.youtube.com/watch?v=${videoId}&format=bestaudio`, {
        method: 'GET',
      });

      if (!altResponse.ok) {
        return new Response(JSON.stringify({ 
          error: 'Nie udało się pobrać audio. Spróbuj ponownie później.',
          details: cobaltData 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Stream directly from alt API
      const audioBuffer = await altResponse.arrayBuffer();
      const fileName = `${(title || videoId).replace(/[^a-zA-Z0-9-_ ]/g, '')}.mp3`;

      // Create Supabase client
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const filePath = `youtube/${videoId}/${fileName}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('music')
        .upload(filePath, audioBuffer, { contentType: 'audio/mpeg', upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('music').getPublicUrl(filePath);

      return new Response(JSON.stringify({ 
        url: urlData.publicUrl,
        fileName,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Download the audio from cobalt URL
    const audioUrl = cobaltData.url || cobaltData.audio;
    console.log('Downloading from:', audioUrl);

    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error('Failed to download audio stream');
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const fileName = `${(title || videoId).replace(/[^a-zA-Z0-9-_ ]/g, '')}.mp3`;

    // Upload to Supabase Storage
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const filePath = `youtube/${videoId}/${fileName}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('music')
      .upload(filePath, audioBuffer, { contentType: 'audio/mpeg', upsert: true });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from('music').getPublicUrl(filePath);

    return new Response(JSON.stringify({ 
      url: urlData.publicUrl,
      fileName,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
