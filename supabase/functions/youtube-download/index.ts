import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function tryDownloadAudio(videoId: string): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  // Try multiple Invidious & Piped instances
  const invidiousInstances = [
    'inv.nadeko.net',
    'invidious.nerdvpn.de',
    'yewtu.be',
    'vid.puffyan.us',
    'invidious.lunar.icu',
    'iv.ggtyler.dev',
    'invidious.privacyredirect.com',
  ];

  // Try Invidious latest_version endpoint (direct audio stream)
  for (const instance of invidiousInstances) {
    try {
      console.log(`Trying Invidious: ${instance}...`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(
        `https://${instance}/latest_version?id=${videoId}&itag=140&local=true`,
        { 
          signal: controller.signal,
          redirect: 'follow',
        }
      );
      clearTimeout(timeout);

      if (!response.ok) {
        console.log(`${instance} returned ${response.status}`);
        await response.text().catch(() => {});
        continue;
      }

      const contentType = response.headers.get('content-type') || '';
      const buffer = await response.arrayBuffer();
      
      if (buffer.byteLength > 50000) {
        console.log(`${instance} success! Size: ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
        return { buffer, contentType: 'audio/mp4' };
      }
      console.log(`${instance} returned too small file: ${buffer.byteLength} bytes`);
    } catch (err) {
      console.log(`${instance} error: ${err.message}`);
    }
  }

  // Try Piped instances for audio stream URL
  const pipedInstances = [
    'pipedapi.kavin.rocks',
    'pipedapi.adminforge.de',
    'api.piped.yt',
    'pipedapi.r4fo.com',
  ];

  for (const instance of pipedInstances) {
    try {
      console.log(`Trying Piped: ${instance}...`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`https://${instance}/streams/${videoId}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        console.log(`${instance} returned ${response.status}`);
        await response.text().catch(() => {});
        continue;
      }

      const data = await response.json();
      
      if (data.audioStreams && data.audioStreams.length > 0) {
        const audioStream = data.audioStreams
          .filter((s: any) => s.mimeType?.includes('audio'))
          .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))[0];

        if (audioStream?.url) {
          console.log(`${instance} found audio URL, downloading...`);
          const audioController = new AbortController();
          const audioTimeout = setTimeout(() => audioController.abort(), 30000);
          
          const audioResponse = await fetch(audioStream.url, {
            signal: audioController.signal,
          });
          clearTimeout(audioTimeout);
          
          if (audioResponse.ok) {
            const buffer = await audioResponse.arrayBuffer();
            if (buffer.byteLength > 50000) {
              console.log(`Piped ${instance} success! Size: ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
              return { buffer, contentType: audioStream.mimeType || 'audio/mp4' };
            }
          }
          await audioResponse.text().catch(() => {});
        }
      }
    } catch (err) {
      console.log(`Piped ${instance} error: ${err.message}`);
    }
  }

  return null;
}

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

    console.log(`Starting download for video: ${videoId}, title: ${title}`);

    const result = await tryDownloadAudio(videoId);

    if (!result) {
      return new Response(JSON.stringify({ 
        error: 'Nie udało się pobrać audio. YouTube blokuje publiczne proxy. Utwór został zapisany z linkiem YouTube — możesz go odtwarzać online.',
        fallback: true,
      }), {
        status: 200, // Return 200 so frontend can handle gracefully
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ext = result.contentType.includes('webm') ? 'webm' : 'm4a';
    const safeName = (title || videoId).replace(/[^a-zA-Z0-9\-_ ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, '').substring(0, 100);
    const fileName = `${safeName}.${ext}`;
    const filePath = `youtube/${videoId}/${fileName}`;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: uploadError } = await supabase.storage
      .from('music')
      .upload(filePath, result.buffer, { contentType: result.contentType, upsert: true });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from('music').getPublicUrl(filePath);
    console.log(`Upload success: ${urlData.publicUrl}, size: ${(result.buffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

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
