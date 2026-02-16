import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Use YouTube's InnerTube API with ANDROID client - returns direct URLs without cipher
async function getDirectAudioUrl(videoId: string): Promise<{ url: string; mimeType: string; duration: number } | null> {
  const clients = [
    {
      name: 'ANDROID',
      version: '19.29.37',
      apiKey: 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w',
      userAgent: 'com.google.android.youtube/19.29.37 (Linux; U; Android 14) gzip',
    },
    {
      name: 'ANDROID_MUSIC',
      version: '7.27.52',
      apiKey: 'AIzaSyAOghZGza2MQSZkY_zfZ370N-PUdXEo8AI',
      userAgent: 'com.google.android.apps.youtube.music/7.27.52 (Linux; U; Android 14) gzip',
    },
    {
      name: 'IOS',
      version: '19.29.1',
      apiKey: 'AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc',
      userAgent: 'com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)',
    },
  ];

  for (const client of clients) {
    try {
      console.log(`Trying InnerTube client: ${client.name}...`);

      const body = {
        videoId,
        context: {
          client: {
            hl: 'en',
            gl: 'US',
            clientName: client.name,
            clientVersion: client.version,
            ...(client.name === 'ANDROID' || client.name === 'ANDROID_MUSIC'
              ? { androidSdkVersion: 34, platform: 'MOBILE' }
              : {}),
            ...(client.name === 'IOS'
              ? { deviceMake: 'Apple', deviceModel: 'iPhone16,2', platform: 'MOBILE' }
              : {}),
          },
        },
        playbackContext: {
          contentPlaybackContext: {
            signatureTimestamp: 20073,
          },
        },
        contentCheckOk: true,
        racyCheckOk: true,
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(
        `https://youtubei.googleapis.com/youtubei/v1/player?key=${client.apiKey}&prettyPrint=false`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': client.userAgent,
            'X-Goog-Api-Format-Version': '2',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);

      if (!response.ok) {
        console.log(`${client.name} returned ${response.status}`);
        continue;
      }

      const data = await response.json();

      if (data.playabilityStatus?.status !== 'OK') {
        console.log(`${client.name} playability: ${data.playabilityStatus?.status} - ${data.playabilityStatus?.reason}`);
        continue;
      }

      const streamingData = data.streamingData;
      if (!streamingData) {
        console.log(`${client.name}: no streaming data`);
        continue;
      }

      // Get duration
      const duration = parseInt(data.videoDetails?.lengthSeconds || '180', 10);

      // Find audio formats with direct URL (adaptive formats)
      const adaptiveFormats = streamingData.adaptiveFormats || [];
      const audioFormats = adaptiveFormats
        .filter((f: any) => f.mimeType?.startsWith('audio/') && f.url)
        .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));

      console.log(`${client.name}: ${audioFormats.length} audio formats with direct URLs`);

      if (audioFormats.length > 0) {
        // Prefer m4a (mp4a) over webm, and pick medium quality for faster download
        const m4aFormats = audioFormats.filter((f: any) => f.mimeType?.includes('mp4a'));
        const best = m4aFormats.length > 0 ? m4aFormats[0] : audioFormats[0];
        console.log(`Selected: ${best.mimeType}, bitrate: ${best.bitrate}, contentLength: ${best.contentLength}`);
        return { url: best.url, mimeType: best.mimeType, duration };
      }

      // Check if formats need signatureCipher (can't use those)
      const ciphered = adaptiveFormats.filter((f: any) => f.signatureCipher && f.mimeType?.startsWith('audio/'));
      if (ciphered.length > 0) {
        console.log(`${client.name}: ${ciphered.length} ciphered audio formats (can't use)`);
      }
    } catch (err: any) {
      console.log(`${client.name} error: ${err.message}`);
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

    console.log(`Starting download: ${videoId} - ${title}`);

    const result = await getDirectAudioUrl(videoId);

    if (!result) {
      return new Response(JSON.stringify({
        error: 'Nie udało się pobrać audio - YouTube zablokował dostęp',
        fallback: true,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Download audio
    console.log('Downloading audio stream...');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    const audioResponse = await fetch(result.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'com.google.android.youtube/19.29.37 (Linux; U; Android 14) gzip',
      },
    });
    clearTimeout(timeout);

    if (!audioResponse.ok) {
      console.log(`Audio download failed: ${audioResponse.status}`);
      return new Response(JSON.stringify({
        error: `Błąd pobierania audio: ${audioResponse.status}`,
        fallback: true,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const buffer = await audioResponse.arrayBuffer();
    console.log(`Downloaded ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

    if (buffer.byteLength < 50000) {
      return new Response(JSON.stringify({
        error: 'Plik audio zbyt mały',
        fallback: true,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upload to storage
    const isWebm = result.mimeType?.includes('webm');
    const ext = isWebm ? 'webm' : 'm4a';
    const contentType = isWebm ? 'audio/webm' : 'audio/mp4';
    const safeName = (title || videoId).replace(/[^a-zA-Z0-9\-_ ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, '').substring(0, 100);
    const fileName = `${safeName}.${ext}`;
    const filePath = `youtube/${videoId}/${fileName}`;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { error: uploadError } = await supabase.storage
      .from('music')
      .upload(filePath, new Uint8Array(buffer), { contentType, upsert: true });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from('music').getPublicUrl(filePath);
    console.log(`Upload success: ${urlData.publicUrl}`);

    return new Response(JSON.stringify({
      url: urlData.publicUrl,
      fileName,
      duration: result.duration,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error:', error.message);
    return new Response(JSON.stringify({
      error: error.message || 'Błąd pobierania',
      fallback: true,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
