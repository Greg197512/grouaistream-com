import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Resolves a Suno share/song link to a direct CDN audio URL + metadata.
 * Supports:
 *   https://suno.com/s/{shortId}
 *   https://suno.com/song/{uuid}
 *   https://app.suno.ai/song/{uuid}
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let clipId: string | null = null;

    // Direct song URL: /song/{uuid}
    const songMatch = url.match(/suno\.(?:com|ai)\/song\/([a-f0-9-]{36})/i);
    if (songMatch) {
      clipId = songMatch[1];
    }

    // Short link: /s/{shortId} — need to follow redirect
    if (!clipId) {
      const shortMatch = url.match(/suno\.com\/s\/([A-Za-z0-9]+)/);
      if (shortMatch) {
        try {
          const res = await fetch(url, { redirect: 'manual' });
          const location = res.headers.get('location') || '';
          const redirectMatch = location.match(/\/song\/([a-f0-9-]{36})/i);
          if (redirectMatch) {
            clipId = redirectMatch[1];
          }
        } catch (e) {
          console.error('[Suno Resolve] Redirect follow error:', e);
        }
      }
    }

    if (!clipId) {
      return new Response(JSON.stringify({ error: 'Could not extract Suno song ID from URL' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build CDN URLs
    const audioUrl = `https://cdn1.suno.ai/${clipId}.mp3`;
    const imageUrl = `https://cdn2.suno.ai/image_${clipId}.jpeg`;

    // Verify the audio URL actually works
    const headRes = await fetch(audioUrl, { method: 'HEAD' });
    if (!headRes.ok) {
      return new Response(JSON.stringify({ 
        error: 'Audio file not found on Suno CDN. The song may have been deleted or is not public.',
        clipId,
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contentLength = parseInt(headRes.headers.get('content-length') || '0', 10);
    // Rough duration estimate: mp3 ~128kbps = 16KB/s
    const estimatedDuration = contentLength > 0 ? Math.round(contentLength / 16000) : 180;

    // Try to get OG metadata from page (title)
    let title = '';
    let artist = 'Suno AI';
    try {
      const pageRes = await fetch(`https://suno.com/song/${clipId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot)' },
      });
      const html = await pageRes.text();
      
      // Extract og:title
      const ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i)
        || html.match(/<meta\s+content="([^"]+)"\s+property="og:title"/i);
      if (ogTitle) {
        title = ogTitle[1];
      }
      
      // Try <title> tag as fallback
      if (!title) {
        const titleTag = html.match(/<title>([^<]+)<\/title>/i);
        if (titleTag) {
          title = titleTag[1].replace(/ \| Suno$/i, '').trim();
        }
      }
    } catch (e) {
      console.log('[Suno Resolve] Could not fetch page metadata:', e);
    }

    console.log(`[Suno Resolve] Resolved ${url} -> clipId=${clipId}, audio=${audioUrl}`);

    return new Response(JSON.stringify({
      success: true,
      clipId,
      audioUrl,
      imageUrl,
      title: title || `Suno Track ${clipId.slice(0, 8)}`,
      artist,
      duration: estimatedDuration,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[Suno Resolve] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
